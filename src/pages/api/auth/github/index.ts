import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { beginGithub } from '../../../../lib/auth';
export const GET:APIRoute=({request})=>beginGithub(request,env);
