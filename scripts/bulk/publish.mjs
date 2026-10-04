// Publish stage: upload built models/previews to R2, then insert the D1 row (published=1) only after every
// R2 write is size-verified. Existing slugs are skipped so admin edits are preserved. Resumable; bounded concurrency.
// Usage: node scripts/bulk/publish.mjs --publish [--limit N] [--concurrency N]
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { path, readJson, writeJson, cloudflare, pool, progress } from './lib/common.mjs';
import { metadata } from '../../src/lib/validation.ts';
if (!process.argv.includes('--publish')) throw Error('Pass --publish to upload to production.');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? Number(process.argv[i + 1]) : d; };
const cf = await cloudflare();
const plan = await readJson(path('plan.json'));
const existing = new Set(); for (let off = 0; ; off += 1000) { const rows = await cf.query('SELECT slug FROM assets LIMIT 1000 OFFSET ?', [off]); rows.forEach(r => existing.add(r.slug)); if (rows.length < 1000) break; }
const ledgerFile = path('published.json'); const ledger = await readJson(ledgerFile, {});
const todo = [];
for (const item of plan) { if (existing.has(item.slug)) { ledger[item.slug] ??= { preexisting: true }; continue; } try { await stat(path('out', item.slug, 'built.json')); todo.push(item); } catch {} }
const batch = todo.slice(0, arg('limit', todo.length));
console.log(`plan ${plan.length}, already in D1 ${plan.filter(i => existing.has(i.slug)).length}, ready to publish ${todo.length}, this run ${batch.length}`);
let done = 0;
const errors = await pool(batch, arg('concurrency', 4), async item => {
  const dir = path('out', item.slug); const b = await readJson(resolve(dir, 'built.json'));
  const form = new FormData();
  for (const k of ['slug', 'name', 'description', 'creator', 'source_url', 'license', 'license_url', 'attribution', 'tile_size']) form.set(k, item[k] ?? '');
  if (!['props', 'characters', 'scenes'].includes(item.category)) throw Error('bad category ' + item.category);
  if (item.category === 'characters' && !b.animations.length) throw Error('character without animation clips: ' + item.slug);
  form.set('category', 'props'); // validated here as props; the real top-level category (props|characters|scenes) is applied below
  form.set('colour', b.colour); form.set('tags', item.tags.join(', ')); form.set('published', '1');
  const meta = metadata(form);
  const id = randomUUID(), prefix = `assets/${id}/${randomUUID()}`;
  const model = await readFile(resolve(dir, 'model.glb')), poster = await readFile(resolve(dir, 'poster.png'));
  const animated = b.preview !== 'poster.png'; const previewBuf = animated ? await readFile(resolve(dir, b.preview)) : poster;
  const keys = { model_key: `${prefix}/model.glb`, preview_key: animated ? `${prefix}/preview.gif` : `${prefix}/preview.png`, poster_key: animated ? `${prefix}/poster.png` : `${prefix}/preview.png` };
  await cf.put(keys.model_key, model, 'model/gltf-binary');
  await cf.put(keys.preview_key, previewBuf, animated ? 'image/gif' : 'image/png');
  if (animated) await cf.put(keys.poster_key, poster, 'image/png');
  const row = { ...meta, category: item.category, id, tags: JSON.stringify(meta.tags), ...keys, model_bytes: model.byteLength, preview_animated: animated ? 1 : 0, animations: JSON.stringify(b.animations), rigged: b.rigged };
  const fields = Object.keys(row);
  await cf.query(`INSERT INTO assets (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`, Object.values(row));
  ledger[item.slug] = { id, ...keys, at: new Date().toISOString(), item };
  if (++done % 50 === 0) { await writeJson(ledgerFile, ledger); await progress({ current_action: `publishing ${done}/${batch.length}` }); console.log('published', done); }
});
await writeJson(ledgerFile, ledger);
console.log('publish run done:', done, 'published; errors', errors.length); for (const e of errors.slice(0, 20)) console.log(e.item.slug, e.error);
