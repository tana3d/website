import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { releaseDownload, type ReleaseBindings } from '../../lib/releases';
export const GET:APIRoute=async({params,request})=>{
 try{return await releaseDownload(env as unknown as ReleaseBindings,params.key??'',request);}
 catch{return new Response('Download temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});}
};
export const HEAD:APIRoute=GET;
