// Fetch Poly Haven CC0 models (public API) and pack each as a self-contained GLB with 1K textures.
// Output: .tmp/bulk/ex/polyhaven/<id>/model.glb + info.json. Resumable; one request at a time.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { path, sleep, writeJson } from './lib/common.mjs';
const headers = { 'User-Agent': 'TanaStudio/0.1 (tana.gg; catalog sourcing)' };
const get = async url => { for (let a = 0; a < 4; a++) { const r = await fetch(url, { headers }); if (r.ok) return r; await sleep(1500 * (a + 1)); } throw Error('GET failed ' + url); };
const all = await (await get('https://api.polyhaven.com/assets?t=models')).json();
const io = new NodeIO(fetch, { headers }).setAllowNetwork(true).registerExtensions(ALL_EXTENSIONS);
let done = 0, failed = 0;
for (const [id, info] of Object.entries(all)) {
  const dir = path('ex/polyhaven', id); const out = resolve(dir, 'model.glb');
  try { if ((await stat(out)).size > 100) continue; } catch {}
  try {
    await mkdir(dir, { recursive: true });
    const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
    const model = files.gltf?.['1k']?.gltf ?? files.gltf?.['2k']?.gltf; if (!model) throw Error('no glTF');
    const resources = {};
    for (const [p, r] of Object.entries(model.include ?? {})) { const b = new Uint8Array(await (await get(r.url)).arrayBuffer()); if (b.byteLength !== r.size) throw Error('incomplete ' + p); resources[p] = b; }
    const doc = await io.readJSON({ json: await (await get(model.url)).json(), resources });
    await writeFile(out, await io.writeBinary(doc));
    await writeJson(resolve(dir, 'info.json'), { id, ...info, fetched: new Date().toISOString() });
    done++; if (done % 20 === 0) console.log('polyhaven', done);
  } catch (e) { failed++; console.log('FAILED', id, e.message); }
  await sleep(300);
}
console.log('polyhaven done', done, 'failed', failed, 'of', Object.keys(all).length);
