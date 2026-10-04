import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { fromRow, type AssetRow, type Bindings } from '../../../lib/types';
const headers = { 'Access-Control-Allow-Origin':'*', 'Cache-Control':'no-store' };
export const GET: APIRoute = async ({ params }) => {
  try {
    const row = await (env as unknown as Bindings).DB.prepare('SELECT * FROM assets WHERE id=? AND published=1').bind(params.id ?? '').first<AssetRow>();
    return row ? Response.json(fromRow(row),{ headers }) : Response.json({ error:'Asset not found.' },{ status:404, headers });
  } catch { return Response.json({ error:'The library is temporarily unavailable.' },{ status:503, headers }); }
};
