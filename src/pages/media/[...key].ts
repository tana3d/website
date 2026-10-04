import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAdmin } from '../../lib/auth';
import type { Bindings } from '../../lib/types';
export const GET: APIRoute = async ({request,params}) => {
  const bindings=env as unknown as Bindings, key=params.key ?? '';
  const asset=await bindings.DB.prepare('SELECT published FROM assets WHERE model_key=? OR preview_key=? OR poster_key=?').bind(key,key,key).first<{published:number}>();
  if (!asset || (!asset.published && !await isAdmin(request,bindings,import.meta.env.DEV))) return new Response('Not found.',{status:404});
  const object=await bindings.LIBRARY.get(key,{range:request.headers as unknown as import('@cloudflare/workers-types').Headers});
  if (!object) return new Response('Not found.',{status:404});
  const headers=new Headers({'Cache-Control':asset.published ? 'public, max-age=60' : 'no-store','Access-Control-Allow-Origin':'*','Accept-Ranges':'bytes'});
  object.writeHttpMetadata(headers as unknown as import('@cloudflare/workers-types').Headers); headers.set('ETag',object.httpEtag); headers.set('X-Content-Type-Options','nosniff');
  if (request.headers.get('If-None-Match')===object.httpEtag && !request.headers.has('Range')) return new Response(null,{status:304,headers});
  const range=object.range;
  if (request.headers.has('Range') && range && 'offset' in range && 'length' in range && range.offset !== undefined && range.length !== undefined) headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${object.size}`);
  return new Response(object.body as unknown as ReadableStream,{status:headers.has('Content-Range') ? 206 : 200,headers});
};
export const HEAD: APIRoute = async context => { const response=await GET(context); return new Response(null,{status:response.status,headers:response.headers}); };
