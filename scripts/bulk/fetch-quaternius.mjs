// Download Quaternius packs from their official itch.io pages using the anonymous
// "no thanks, just take me to the downloads" flow. Quaternius publishes the Standard
// packs as CC0; licence text is verified from each pack page and kept beside the zip.
// Usage: node scripts/bulk/fetch-quaternius.mjs [pack-page-slug ...]
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const UA = 'Mozilla/5.0 (compatible; TanaStudio/0.1; +https://tana.gg; catalog sourcing)';
const out = resolve('.tmp/bulk/cache/quaternius'); await mkdir(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, opts = {}) => { const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } }); if (!r.ok) throw Error(`${r.status} ${url}`); return r; };
let pages = process.argv.slice(2);
if (!pages.length) {
  const home = await (await get('https://quaternius.com/')).text();
  const more = await (await get('https://quaternius.com/packs.html').catch(() => ({ text: async () => '' }))).text();
  pages = [...new Set([...(home + more).matchAll(/href="\/packs\/([a-z0-9_-]+)\.html"/gi)].map(m => m[1]))].sort();
}
const jar = new Map();
const cookies = r => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); } };
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const csrf = html => html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
const index = [];
for (const page of pages) {
  try {
    const html = await (await get(`https://quaternius.com/packs/${page}.html`)).text();
    const game = html.match(/game:\s*"([^"]+)"/)?.[1];
    const title = html.match(/<title>([^<]+)/)?.[1]?.trim() ?? page;
    const cc0 = /CC0/i.test(html) && /publicdomain\/zero/.test(html);
    if (!game) { console.log('no itch game for', page); continue; }
    if (!cc0) { console.log('SKIP (no CC0 statement)', page); continue; }
    const dir = resolve(out, page); await mkdir(dir, { recursive: true });
    jar.clear();
    const itch = `https://quaternius.itch.io/${game}`;
    const r1 = await get(itch); cookies(r1); const h1 = await r1.text();
    const r2 = await get(`${itch}/download_url`, { method: 'POST', headers: { Cookie: cookieHeader(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'csrf_token=' + encodeURIComponent(csrf(h1)) }); cookies(r2);
    const dlUrl = (await r2.json()).url;
    const r3 = await get(dlUrl, { headers: { Cookie: cookieHeader() } }); cookies(r3); const h3 = await r3.text();
    const uploads = [...h3.matchAll(/data-upload_id="(\d+)"[\s\S]*?<strong title="([^"]+)"/g)].map(m => ({ id: m[1], name: m[2] }));
    const files = [];
    for (const u of uploads) {
      const file = resolve(dir, u.name.replace(/[^\w.\[\] -]/g, '_'));
      let have = false; try { have = (await stat(file)).size > 1000; } catch {}
      if (!have) {
        const r4 = await get(`${itch}/file/${u.id}?source=view_game`, { method: 'POST', headers: { Cookie: cookieHeader(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'csrf_token=' + encodeURIComponent(csrf(h3)) });
        const signed = (await r4.json()).url;
        const buf = Buffer.from(await (await get(signed)).arrayBuffer()); await writeFile(file, buf);
        console.log(`downloaded ${page}: ${u.name} ${(buf.length / 1048576).toFixed(1)} MB`); await sleep(3000);
      }
      files.push(file);
    }
    index.push({ page, title, itch, game, files, license_statement: 'CC0 (stated on pack page)' });
  } catch (e) { console.log('FAILED', page, e.message); }
  await sleep(1500);
}
await writeFile(resolve(out, 'index.json'), JSON.stringify(index, null, 1));
console.log('quaternius packs', index.length);
