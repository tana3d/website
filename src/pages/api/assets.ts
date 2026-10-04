import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listAssets } from '../../lib/library';
import type { Bindings } from '../../lib/types';
export const GET: APIRoute = async ({ url }) => {
  try { return Response.json(await listAssets(env as unknown as Bindings,url.searchParams), { headers: { 'Access-Control-Allow-Origin':'*', 'Cache-Control':'no-store' } }); }
  catch { return Response.json({ error:'The library is temporarily unavailable.' },{status:503}); }
};
