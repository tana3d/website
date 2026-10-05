import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { readRelease, emptyRelease, type ReleaseBindings } from '../../lib/releases';
export const GET:APIRoute=async()=>{
 try{return Response.json(await readRelease(env as unknown as ReleaseBindings)??emptyRelease,{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'The release catalog is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
