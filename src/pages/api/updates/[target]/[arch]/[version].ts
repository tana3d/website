import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { updateResponse, type ReleaseBindings } from '../../../../../lib/releases';
export const GET:APIRoute=async({params})=>{
 try{return await updateResponse(env as unknown as ReleaseBindings,params.target??'',params.arch??'',params.version??'');}
 catch{return new Response('Updates temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});}
};
