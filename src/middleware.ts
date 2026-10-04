import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { isAdmin } from './lib/auth';
export const onRequest=defineMiddleware(async(context,next)=>{
 const local=import.meta.env.DEV && ['localhost','127.0.0.1','[::1]'].includes(context.url.hostname);
 const adminHost=context.url.hostname==='admin.tana.gg';
 const privatePath=/^\/admin(?:\/|$)|^\/api\/admin(?:\/|$)|^\/api\/auth(?:\/|$)|^\/login\/?$/.test(context.url.pathname);
 if(!adminHost && !local && privatePath)return new Response('Not found.',{status:404});
 const authentication=/^\/api\/auth(?:\/|$)|^\/login\/?$/.test(context.url.pathname);
 const adminRoute=(adminHost && !authentication) || /^\/admin(?:\/|$)|^\/api\/admin(?:\/|$)/.test(context.url.pathname);
 if(adminRoute){
  context.locals.admin=await isAdmin(context.request,env,import.meta.env.DEV);
  if(!context.locals.admin){
   if(context.url.pathname.startsWith('/api/'))return Response.json({error:'Sign in to continue.'},{status:401,headers:{'Cache-Control':'no-store'}});
   return context.redirect('/login',302);
  }
  if(!['GET','HEAD','OPTIONS'].includes(context.request.method) && context.request.headers.get('Origin')!==context.url.origin)return new Response('Request origin rejected.',{status:403});
 }
 const response=await next();
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 if(adminRoute || authentication){response.headers.set('Cache-Control','no-store');response.headers.set('X-Frame-Options','DENY');response.headers.set('Referrer-Policy','no-referrer');}
 return response;
});
