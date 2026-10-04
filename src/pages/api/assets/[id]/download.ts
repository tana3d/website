import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Bindings } from '../../../../lib/types';
import { assetDownload } from '../../../../lib/download';
const serve = (head:boolean): APIRoute => async ({params}) => {
  try { return await assetDownload(env as unknown as Bindings,params.id ?? '',head); }
  catch { return new Response('Download unavailable. Please try again.',{status:503,headers:{'Cache-Control':'no-store'}}); }
};
export const GET=serve(false);
export const HEAD=serve(true);
