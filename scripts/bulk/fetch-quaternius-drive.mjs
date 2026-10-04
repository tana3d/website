// Fetch Quaternius's older CC0 packs from the public Google Drive folders linked on quaternius.com.
// Picks glTF if offered, else FBX, else OBJ; always keeps License.txt and root-level atlas images.
// Usage: node scripts/bulk/fetch-quaternius-drive.mjs [pack-page-slug ...]
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { path, readJson, writeJson, sleep, pool } from './lib/common.mjs';
const UA = 'Mozilla/5.0 (compatible; TanaStudio/0.1; +https://tana.gg; catalog sourcing)';
const out = path('cache/quaternius-drive'); await mkdir(out, { recursive: true });
const text = async url => { for (let a = 0; a < 4; a++) { const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (r.ok) return r.text(); await sleep(2000 * (a + 1)); } throw Error('GET failed ' + url); };
const list = async id => {
  const html = await text(`https://drive.google.com/embeddedfolderview?id=${id}`);
  return [...html.matchAll(/<a href="https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/([\w-]+)[^"]*"[\s\S]*?flip-entry-title">([^<]+)/g)].map(m => ({ kind: m[1] === 'file/d' ? 'file' : 'folder', id: m[2], name: m[3].replaceAll('&amp;', '&').trim() }));
};
const download = async (id, file) => {
  for (let a = 0; a < 5; a++) {
    const r = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { headers: { 'User-Agent': UA } });
    const type = r.headers.get('content-type') ?? '';
    if (r.ok && !type.startsWith('text/html')) { const buf = Buffer.from(await r.arrayBuffer()); await writeFile(file, buf); return buf.length; }
    await sleep(3000 * (a + 1));
  }
  throw Error('download failed ' + id);
};
const walk = async (id, dir, depth = 0) => {
  await mkdir(dir, { recursive: true }); const jobs = [];
  for (const e of await list(id)) { if (e.kind === 'folder' && depth < 4) jobs.push(...await walk(e.id, resolve(dir, e.name), depth + 1)); else if (e.kind === 'file') jobs.push({ id: e.id, file: resolve(dir, e.name) }); }
  return jobs;
};
let pages = process.argv.slice(2);
const UAH = { headers: { 'User-Agent': UA } };
if (!pages.length) pages = [...new Set([...(await (await fetch('https://quaternius.com/', UAH)).text()).matchAll(/href="\/packs\/([a-z0-9_-]+)\.html"/gi)].map(m => m[1]))].sort();
const index = await readJson(resolve(out, 'index.json'), []);
for (const page of pages) {
  if (index.some(p => p.page === page && p.done)) continue;
  const html = await (await fetch(`https://quaternius.com/packs/${page}.html`, UAH)).text();
  const drive = html.match(/drive\.google\.com\/drive\/folders\/([\w-]+)/)?.[1];
  const lic = html.match(/license\.svg"[^>]*> License<div class="text-right"><a[^>]*>([^<]+)/)?.[1];
  const title = html.match(/<title>([^<]+)/)?.[1]?.trim() ?? page;
  if (!drive || lic !== 'CC0') { if (drive) console.log('skip (licence', lic + ')', page); continue; }
  const top = await list(drive); const names = top.map(e => e.name.toLowerCase());
  const wanted = ['gltf', 'fbx', 'obj'].find(f => names.includes(f));
  const folders = wanted ? top.filter(e => e.kind === 'folder' && e.name.toLowerCase() === wanted) : top.filter(e => e.kind === 'folder' && !/blend|preview|texture/i.test(e.name));
  const dir = resolve(out, page); let jobs = [];
  for (const f of folders) jobs.push(...await walk(f.id, resolve(dir, f.name), 1));
  for (const e of top.filter(e => e.kind === 'file' && /licen|\.(png|jpg|jpeg)$/i.test(e.name) && !/^preview/i.test(e.name))) jobs.push({ id: e.id, file: resolve(dir, e.name) });
  for (const e of top.filter(e => e.kind === 'folder' && /^textures?$/i.test(e.name))) jobs.push(...await walk(e.id, resolve(dir, e.name), 1));
  await mkdir(dir, { recursive: true }); let bytes = 0, n = 0;
  const todo = []; for (const j of jobs) { try { if ((await stat(j.file)).size > 0) continue; } catch {} todo.push(j); }
  const errors = await pool(todo, 2, async j => { bytes += await download(j.id, j.file); n++; await sleep(400); });
  console.log(`${page}: format=${wanted ?? 'mixed'} files=${jobs.length} fetched=${n} ${(bytes / 1048576).toFixed(1)} MB errors=${errors.length}`);
  const rec = { page, title, drive: `https://drive.google.com/drive/folders/${drive}`, page_url: `https://quaternius.com/packs/${page}.html`, format: wanted ?? 'mixed', files: jobs.length, errors: errors.length, done: errors.length === 0, license: 'CC0' };
  const i = index.findIndex(p => p.page === page); if (i >= 0) index[i] = rec; else index.push(rec);
  await writeJson(resolve(out, 'index.json'), index);
}
