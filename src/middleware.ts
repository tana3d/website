import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { isAdmin } from './lib/auth';
import type { Bindings } from './lib/types';
export const onRequest = defineMiddleware(async (context, next) => {
  const adminRoute = /^\/admin(?:\/|$)|^\/api\/admin(?:\/|$)/.test(context.url.pathname);
  if (adminRoute) {
    context.locals.admin = await isAdmin(context.request, env as unknown as Bindings, import.meta.env.DEV);
    if (!context.locals.admin) return new Response('Admin access requires Cloudflare Access. Configure the Access application for /admin and /api/admin.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    if (!['GET','HEAD','OPTIONS'].includes(context.request.method) && context.request.headers.get('Origin') !== context.url.origin) return new Response('Request origin rejected.', { status: 403 });
  }
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (adminRoute) { response.headers.set('Cache-Control', 'no-store'); response.headers.set('X-Frame-Options', 'DENY'); }
  return response;
});
