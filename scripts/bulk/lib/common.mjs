// Shared helpers for the bulk catalogue pipeline. Work files live in .tmp/bulk (git-ignored).
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
export const ROOT = resolve('.tmp/bulk');
export const path = (...p) => resolve(ROOT, ...p);
export const sha256 = buf => createHash('sha256').update(buf).digest('hex');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function readJson(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { if (fallback !== undefined) return fallback; throw Error('Cannot read ' + file); } }
export async function writeJson(file, data) { await mkdir(dirname(file), { recursive: true }); const tmp = file + '.tmp'; await writeFile(tmp, JSON.stringify(data, null, 1)); await rename(tmp, file); }
// Run `fn` over items with bounded concurrency; errors are collected, not thrown.
export async function pool(items, size, fn) {
  const errors = []; let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { for (;;) { const n = i++; if (n >= items.length) return; try { await fn(items[n], n); } catch (e) { errors.push({ item: items[n], error: e.message }); } } }));
  return errors;
}
// Cloudflare control-plane access. The token is read from the credentials file and never logged.
let cf;
export async function cloudflare() {
  if (cf) return cf;
  const token = (await readFile(process.env.HOME + '/.ssh/cf_token', 'utf8')).match(/^TOKEN\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  if (!token) throw Error('Missing TOKEN in ~/.ssh/cf_token');
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  const account = config.account_id, database = config.d1_databases[0].database_id, bucket = config.r2_buckets[0].bucket_name;
  const root = `https://api.cloudflare.com/client/v4/accounts/${account}`;
  async function api(p, method = 'GET', body, contentType = 'application/json', attempt = 0) {
    try {
      const r = await fetch(root + p, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType }, body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429 || r.status >= 500) throw Object.assign(Error(`Cloudflare ${r.status}`), { retry: true });
      if (!r.ok || !j.success) throw Error(`Cloudflare ${r.status}: ${JSON.stringify(j.errors)}`);
      return j.result;
    } catch (e) { if ((e.retry || e.cause) && attempt < 5) { await sleep(1000 * 2 ** attempt); return api(p, method, body, contentType, attempt + 1); } throw e; }
  }
  const query = async (sql, params = []) => (await api(`/d1/database/${database}/query`, 'POST', { sql, params }))[0].results;
  const put = async (key, data, mime) => { const r = await api(`/r2/buckets/${bucket}/objects/${encodeURIComponent(key).replaceAll('%2F', '/')}`, 'PUT', data, mime); if (Number(r.size) !== data.byteLength) throw Error('R2 upload size mismatch for ' + key); return r; };
  const head = async key => { const r = await fetch(`${root}/r2/buckets/${bucket}/objects/${encodeURIComponent(key).replaceAll('%2F', '/')}`, { headers: { Authorization: `Bearer ${token}` } }); return r; };
  return (cf = { api, query, put, head, bucket, database });
}
// Progress file consumed by Codex.
export async function progress(patch) {
  const file = resolve('.tmp/catalog-progress.json');
  const cur = await readJson(file, {});
  await writeJson(file, { ...cur, ...patch, updated: new Date().toISOString() });
}
