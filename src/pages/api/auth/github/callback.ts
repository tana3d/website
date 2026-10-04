import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { completeGithub } from '../../../../lib/auth';
export const GET:APIRoute=({request})=>completeGithub(request,env);
