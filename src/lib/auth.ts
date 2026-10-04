import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Bindings } from './types';
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function isAdmin(request: Request, env: Bindings, localBuild = false): Promise<boolean> {
  // The dev bypass is compiled out of production, even if someone sets the var.
  const host = new URL(request.url).hostname;
  if (localBuild && env.LOCAL_ADMIN === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(host)) return true;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)) return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  try {
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    if (!keys.has(issuer)) keys.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    const { payload } = await jwtVerify(token, keys.get(issuer)!, { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'] });
    return typeof payload.email === 'string' || payload.type === 'app';
  } catch { return false; }
}
