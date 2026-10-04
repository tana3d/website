// NASA 3D Resources (github.com/nasa/NASA-3D-Resources): download GLB models with their README/usage-guideline evidence.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { path, sleep, writeJson } from './lib/common.mjs';
const UA = 'TanaStudio/0.1 (tana.gg; catalog sourcing)';
const get = async url => { for (let a = 0; a < 4; a++) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) return r; await sleep(2000 * (a + 1)); } throw Error('GET failed ' + url); };
const tree = (await (await get('https://api.github.com/repos/nasa/NASA-3D-Resources/git/trees/master?recursive=1')).json()).tree;
const glbs = tree.filter(t => t.type === 'blob' && /^3D Models\/.+\.glb$/i.test(t.path) && t.size < 80 * 1048576);
const ev = path('cache/nasa'); await mkdir(ev, { recursive: true });
await writeFile(resolve(ev, 'README.md'), await (await get('https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/README.md')).text());
await writeFile(resolve(ev, 'usage-guidelines.html'), await (await get('https://www.nasa.gov/nasa-brand-center/images-and-media/')).text()).catch(() => {});
let n = 0;
for (const t of glbs) {
  const parts = t.path.split('/'); const folder = parts[1]; const dir = path('ex/nasa', folder.replace(/[^\w.() -]/g, '_')); const out = resolve(dir, 'model.glb');
  try { if ((await stat(out)).size === t.size) continue; } catch {}
  await mkdir(dir, { recursive: true });
  await writeFile(out, Buffer.from(await (await get('https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/' + t.path.split('/').map(encodeURIComponent).join('/'))).arrayBuffer()));
  await writeJson(resolve(dir, 'info.json'), { title: folder, file: parts.slice(1).join('/'), bytes: t.size, sha: t.sha, repo: 'https://github.com/nasa/NASA-3D-Resources/tree/master/' + parts.slice(0, 2).map(encodeURIComponent).join('/') });
  if (++n % 25 === 0) console.log('nasa', n); await sleep(300);
}
console.log('nasa done', n, 'of', glbs.length);
