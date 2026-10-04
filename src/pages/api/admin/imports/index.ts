import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { publicJob, type ImportJob } from '../../../../lib/import-jobs';
export const GET:APIRoute=async()=>{
  const result=await env.DB.prepare('SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 30').all<ImportJob>();
  return Response.json({jobs:result.results.map(publicJob)},{headers:{'Cache-Control':'no-store'}});
};
