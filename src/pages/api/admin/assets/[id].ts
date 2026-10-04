import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { saveAsset } from '../../../../lib/save-asset';
import type { Bindings } from '../../../../lib/types';
import { fromRow, type AssetRow } from '../../../../lib/types';
export const GET: APIRoute = async ({params}) => {
  const asset=await (env as unknown as Bindings).DB.prepare('SELECT * FROM assets WHERE id=?').bind(params.id).first<AssetRow>();
  return asset?Response.json({asset:fromRow(asset)},{headers:{'Cache-Control':'no-store'}}):Response.json({error:'Asset not found.'},{status:404});
};
export const PUT: APIRoute = ({request,params}) => saveAsset(request,env as unknown as Bindings,params.id);
