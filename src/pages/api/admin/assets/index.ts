import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listAssets } from '../../../../lib/library';
import { saveAdminUpload } from '../../../../lib/import-jobs';
import type { Bindings } from '../../../../lib/types';
export const GET: APIRoute = async ({url}) => Response.json(await listAssets(env as unknown as Bindings,url.searchParams,true));
export const POST: APIRoute = context => saveAdminUpload(context.request,env as unknown as Bindings);
