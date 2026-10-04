// Download Kay Lousberg's official KayKit GitHub repos (CC0; each ships its licence file).
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const UA = 'TanaStudio/0.1 (tana.gg; catalog sourcing)';
const out = resolve('.tmp/bulk/cache/kaykit'); await mkdir(out, { recursive: true });
const get = async url => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw Error(`${r.status} ${url}`); return r; };
const repos = await (await get('https://api.github.com/users/KayKit-Game-Assets/repos?per_page=100')).json();
const index = [];
for (const r of repos) {
  const file = resolve(out, r.name + '.zip');
  let have = false; try { have = (await stat(file)).size > 1000; } catch {}
  if (!have) { const buf = Buffer.from(await (await get(`https://codeload.github.com/KayKit-Game-Assets/${r.name}/zip/refs/heads/${r.default_branch}`)).arrayBuffer()); await writeFile(file, buf); console.log('downloaded', r.name, (buf.length/1048576).toFixed(1), 'MB'); }
  index.push({ repo: r.name, url: r.html_url, description: r.description, pushed_at: r.pushed_at });
}
await writeFile(resolve(out, 'index.json'), JSON.stringify(index, null, 1));
console.log('kaykit repos', index.length);
