import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { saveAsset } from '../../../../lib/save-asset';
import type { Bindings } from '../../../../lib/types';
export const PUT: APIRoute = ({request,params}) => saveAsset(request,env as unknown as Bindings,params.id);
