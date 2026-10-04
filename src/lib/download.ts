import type { Bindings } from './types';

// Viewer/media requests stay separate. Only this explicit model download counts.
export async function assetDownload(env: Bindings, id: string, head = false) {
  const missing = () => new Response('Asset not found.', { status:404, headers:{'Cache-Control':'no-store'} });
  const asset = await env.DB.prepare('SELECT id, slug, model_key, model_bytes FROM assets WHERE id=? AND published=1').bind(id).first<{id:string;slug:string;model_key:string;model_bytes:number}>();
  if (!asset) return missing();
  const object = await env.LIBRARY.get(asset.model_key);
  if (!object || object.size !== asset.model_bytes) return missing();
  const headers = new Headers({
    'Content-Type':'model/gltf-binary', 'Content-Length':String(object.size),
    'Content-Disposition':`attachment; filename="${asset.slug.replace(/[^a-z0-9_-]/gi,'-')}.glb"`,
    'Cache-Control':'no-store', 'Accept-Ranges':'none', 'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'*', 'Access-Control-Expose-Headers':'X-Download-Count',
  });
  if (head) { await object.body.cancel(); return new Response(null,{headers}); }
  // Increment atomically, including simultaneous downloads. Recheck publication.
  const result = await env.DB.prepare('UPDATE assets SET downloads=downloads+1 WHERE id=? AND published=1 RETURNING downloads').bind(id).first<{downloads:number}>();
  if (!result) { await object.body.cancel(); return missing(); }
  headers.set('X-Download-Count',String(result.downloads));
  return new Response(object.body as unknown as ReadableStream,{headers});
}
