import { metadata, inspectModel, inspectImage, BODY_LIMIT } from './validation';
import { fromRow, type AssetRow, type Bindings } from './types';

const file = (form: FormData,name: string) => { const f=form.get(name); return f instanceof File && f.size ? f : null; };
export async function saveAsset(request: Request, env: Bindings, existingId?: string) {
  const newKeys: string[] = [];
  let committed = false;
  try {
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) throw new Error('Submit this form with multipart/form-data.');
    if (Number(request.headers.get('Content-Length')) > BODY_LIMIT) throw new Error('Upload exceeds the 48 MB total limit.');
    let bytes=0;
    const body=request.body?.pipeThrough(new TransformStream({ transform(chunk,controller) { bytes+=chunk.byteLength; if(bytes>BODY_LIMIT) throw new Error('Upload exceeds the 48 MB total limit.'); controller.enqueue(chunk); } }));
    const form=await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')!}}).formData();
    const meta=metadata(form);
    const existing=existingId ? await env.DB.prepare('SELECT * FROM assets WHERE id=?').bind(existingId).first<AssetRow>() : null;
    if (existingId && !existing) return Response.json({error:'Asset not found.'},{status:404});
    const duplicate=await env.DB.prepare('SELECT id FROM assets WHERE slug=? AND id!=?').bind(meta.slug,existingId ?? '').first();
    if (duplicate) return Response.json({error:'That URL slug is already in use.'},{status:409});
    const model=file(form,'model'), preview=file(form,'preview'), poster=file(form,'poster');
    if (!existing && (!model || !preview)) throw new Error('Choose a GLB model and a thumbnail or GIF.');
    const modelInfo=model ? await inspectModel(model) : null;
    const previewInfo=preview ? await inspectImage(preview) : null;
    const posterInfo=poster ? await inspectImage(poster,true) : null;
    if (previewInfo?.animated && !posterInfo && (!existing || existing.poster_key === existing.preview_key)) throw new Error('Add a still thumbnail alongside an animated preview.');
    const id=existingId ?? crypto.randomUUID();
    const revision=crypto.randomUUID();
    async function put(name: string, data: ArrayBuffer, mime: string) {
      const key=`assets/${id}/${revision}/${name}`;
      newKeys.push(key);
      await env.LIBRARY.put(key,data,{httpMetadata:{contentType:mime}});
      return key;
    }
    const model_key=modelInfo ? await put('model.glb',modelInfo.buffer,'model/gltf-binary') : existing!.model_key;
    const preview_key=previewInfo ? await put(`preview.${previewInfo.kind}`,previewInfo.buffer,previewInfo.mime) : existing!.preview_key;
    const poster_key=posterInfo ? await put(`poster.${posterInfo.kind}`,posterInfo.buffer,posterInfo.mime) : previewInfo && !previewInfo.animated ? preview_key : existing!.poster_key;
    const row={...meta,id,model_key,model_bytes:model?.size ?? existing!.model_bytes,preview_key,poster_key,
      preview_animated:previewInfo ? Number(previewInfo.animated) : existing!.preview_animated,
      animations:JSON.stringify(modelInfo?.animations ?? JSON.parse(existing!.animations)),rigged:modelInfo?.rigged ?? existing!.rigged,tags:JSON.stringify(meta.tags)};
    const fields=Object.keys(row), values=Object.values(row);
    if (existing) await env.DB.prepare(`UPDATE assets SET ${fields.filter(f=>f!=='id').map(f=>`${f}=?`).join(',')},updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).bind(...fields.filter(f=>f!=='id').map(f=>row[f as keyof typeof row]),id).run();
    else await env.DB.prepare(`INSERT INTO assets (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).bind(...values).run();
    committed=true;
    // Immutable old versions are retained; a separate maintenance job can remove
    // unreferenced objects later without risking an interrupted replacement.
    const saved=await env.DB.prepare('SELECT * FROM assets WHERE id=?').bind(id).first<AssetRow>();
    return Response.json({asset:fromRow(saved!)},{status:existing ? 200 : 201});
  } catch(error) {
    if (!committed && newKeys.length) await env.LIBRARY.delete(newKeys).catch(()=>{});
    const message=error instanceof Error ? error.message : 'Upload failed.';
    const databaseFailure=/D1_|SQLITE|R2|database/i.test(message);
    return Response.json({error:databaseFailure ? 'The upload could not be saved. Try again.' : message},{status:databaseFailure ? 503 : 400});
  }
}
