import { metadata, inspectImage } from './validation.ts';
import { readUploadForm, saveAssetForm } from './save-asset.ts';
import type { Bindings, AssetRow } from './types.ts';

export interface ImportJob {
  id:string;asset_id:string|null;source_key:string;source_name:string;metadata:string;
  preview_key:string|null;poster_key:string|null;state:string;result_id:string|null;
  warnings:string;error:string;attempts:number;elapsed_ms:number|null;created_at:string;updated_at:string;
}
const SOURCE_LIMIT=80*1024*1024;
const FORMATS=['blend','zip','fbx','obj','gltf','stl','ply','usd','usda','usdc','usdz'];
const file=(form:FormData,name:string)=>{const value=form.get(name);return value instanceof File&&value.size?value:null;};
export const publicJob=(job:ImportJob)=>({id:job.id,name:(JSON.parse(job.metadata) as Record<string,string>).name,state:job.state,asset_id:job.result_id,error:job.error,warnings:JSON.parse(job.warnings),elapsed_ms:job.elapsed_ms,created_at:job.created_at});

export async function saveAdminUpload(request:Request,env:Bindings,existingId?:string){
  const keys:string[]=[];let queued=false;
  try{
    const form=await readUploadForm(request,96*1024*1024);
    const source=file(form,'model');
    if(!source||source.name.toLowerCase().endsWith('.glb'))return saveAssetForm(form,env,existingId);
    if(!env.IMPORT_JOBS)throw new Error('Model conversion is temporarily unavailable. Upload a GLB or try again shortly.');
    const extension=source.name.split('.').at(-1)?.toLowerCase()??'';
    if(!FORMATS.includes(extension)||source.size>SOURCE_LIMIT)throw new Error('Upload a supported model or an asset ZIP up to 80 MB.');
    const meta=metadata(form);
    const existing=existingId?await env.DB.prepare('SELECT * FROM assets WHERE id=?').bind(existingId).first<AssetRow>():null;
    if(existingId&&!existing)return Response.json({error:'Asset not found.'},{status:404});
    const duplicate=await env.DB.prepare('SELECT id FROM assets WHERE slug=? AND id!=?').bind(meta.slug,existingId??'').first();
    if(duplicate)return Response.json({error:'That URL slug is already in use.'},{status:409});
    const pending=await env.DB.prepare("SELECT id FROM import_jobs WHERE json_extract(metadata,'$.slug')=? AND state IN ('queued','converting','saving')").bind(meta.slug).first();
    if(pending)return Response.json({error:'This asset is already being converted. Its progress appears below the form.'},{status:409});
    const preview=file(form,'preview'),poster=file(form,'poster');
    if(!existing&&!preview)throw new Error('Choose a thumbnail or GIF.');
    const previewInfo=preview?await inspectImage(preview):null,posterInfo=poster?await inspectImage(poster,true):null;
    if(previewInfo?.animated&&!posterInfo&&(!existing||existing.poster_key===existing.preview_key))throw new Error('Add a still thumbnail alongside an animated preview.');
    const id=crypto.randomUUID(),prefix=`imports/${id}/`;
    async function put(name:string,data:ReadableStream|ArrayBuffer,mime:string){const key=prefix+name;keys.push(key);await env.LIBRARY.put(key,data as Parameters<Bindings['LIBRARY']['put']>[1],{httpMetadata:{contentType:mime}});return key;}
    const sourceKey=await put('source.'+extension,source.stream(),'application/octet-stream');
    const previewKey=previewInfo?await put('preview.'+previewInfo.kind,previewInfo.buffer,previewInfo.mime):null;
    const posterKey=posterInfo?await put('poster.'+posterInfo.kind,posterInfo.buffer,posterInfo.mime):null;
    const fields=Object.fromEntries([...form.entries()].filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
    await env.DB.prepare('INSERT INTO import_jobs (id,asset_id,source_key,source_name,metadata,preview_key,poster_key) VALUES (?,?,?,?,?,?,?)')
      .bind(id,existingId??null,sourceKey,source.name,JSON.stringify(fields),previewKey,posterKey).run();
    queued=true;
    const started=await env.IMPORT_JOBS.getByName(id).fetch(new Request('https://import/start',{method:'POST',body:JSON.stringify({id})}));
    if(!started.ok){await env.DB.prepare("UPDATE import_jobs SET state='failed',error='Could not start conversion. Please retry.' WHERE id=?").bind(id).run();throw new Error('Could not start conversion. Please retry.');}
    const job=await env.DB.prepare('SELECT * FROM import_jobs WHERE id=?').bind(id).first<ImportJob>();
    return Response.json({job:publicJob(job!)},{status:202,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    if(!queued&&keys.length)await env.LIBRARY.delete(keys).catch(()=>{});
    return Response.json({error:error instanceof Error?error.message:'Upload could not be converted.'},{status:400});
  }
}

export async function finishImport(job:ImportJob,model:ArrayBuffer,warnings:string[],env:Bindings){
  const form=new FormData();
  for(const [key,value] of Object.entries(JSON.parse(job.metadata) as Record<string,string>))form.set(key,value);
  form.set('model',new File([model],job.source_name.replace(/\.[^.]+$/,'.glb'),{type:'model/gltf-binary'}));
  for(const [field,key] of [['preview',job.preview_key],['poster',job.poster_key]] as const){
    if(!key)continue;
    const object=await env.LIBRARY.get(key);if(!object)throw new Error('An uploaded thumbnail is missing.');
    form.set(field,new File([await object.arrayBuffer()],key.split('/').at(-1)!,{type:object.httpMetadata?.contentType??'application/octet-stream'}));
  }
  const recovered=job.asset_id?null:await env.DB.prepare('SELECT id FROM assets WHERE id=?').bind(job.id).first<{id:string}>();
  const response=await saveAssetForm(form,env,job.asset_id??recovered?.id,job.id);
  const result=await response.json() as {asset?:{id:string};error?:string};
  if(!response.ok||!result.asset)throw new Error(result.error??'The converted model could not be saved.');
  await env.DB.prepare("UPDATE import_jobs SET state='ready',result_id=?,warnings=?,error='',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
    .bind(result.asset.id,JSON.stringify(warnings),job.id).run();
  // Keep the original source (including textures in ZIPs) private in R2 for
  // future editing. Public downloads always use the validated GLB.
}
