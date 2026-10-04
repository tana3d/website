import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { publicJob, type ImportJob } from '../../../../lib/import-jobs';
export const GET:APIRoute=async({params})=>{
  const job=await env.DB.prepare('SELECT * FROM import_jobs WHERE id=?').bind(params.id).first<ImportJob>();
  return job?Response.json({job:publicJob(job)},{headers:{'Cache-Control':'no-store'}}):Response.json({error:'Import not found.'},{status:404});
};
