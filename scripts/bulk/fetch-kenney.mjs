// Download every Kenney 3D pack (CC0) politely: one at a time, cached, resumable.
// Usage: node scripts/bulk/fetch-kenney.mjs [pack-slug ...]
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const UA = 'TanaStudio/0.1 (tana.gg; catalog sourcing; contact sfouad@gmail.com)';
const out = resolve('.tmp/bulk/cache/kenney'); await mkdir(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async url => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw Error(`${r.status} ${url}`); return r; };
let slugs = process.argv.slice(2);
if (!slugs.length) {
  const set = new Set();
  for (let p = 1; p <= 8; p++) {
    let html; try { html = await (await get(`https://kenney.nl/assets/category:3D/page:${p}`)).text(); } catch { break; }
    const found = [...html.matchAll(/https:\/\/kenney\.nl\/assets\/([a-z0-9-]+)/g)].map(m => m[1]).filter(s => !['category','series','tag','page'].includes(s));
    found.forEach(s => set.add(s)); await sleep(500);
  }
  slugs = [...set].sort();
}
const index = [];
for (const slug of slugs) {
  const file = resolve(out, slug + '.zip');
  const html = await (await get(`https://kenney.nl/assets/${slug}`)).text();
  const zip = html.match(/href='(https:\/\/kenney\.nl\/media\/pages\/assets\/[^']+\.zip)'/)?.[1];
  const title = html.match(/<title>([^<]+)/)?.[1]?.replace(/\s*·.*$/, '').trim();
  if (!zip) { console.log('no zip for', slug); continue; }
  let have = false; try { have = (await stat(file)).size > 1000; } catch {}
  if (!have) { const buf = Buffer.from(await (await get(zip)).arrayBuffer()); await writeFile(file, buf); console.log(`downloaded ${slug} ${(buf.length/1048576).toFixed(1)} MB`); await sleep(1500); }
  index.push({ slug, title, page: `https://kenney.nl/assets/${slug}`, zip });
}
await writeFile(resolve(out, 'index.json'), JSON.stringify(index, null, 1));
console.log('kenney packs', index.length);
