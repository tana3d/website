import type { APIRoute } from 'astro';
import { logout } from '../../../lib/auth';
export const POST:APIRoute=({request})=>logout(request);
