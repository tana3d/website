// Source registry: how to pick model files from each extracted pack and the licence facts for each source.
import { basename, dirname, extname, resolve } from 'node:path';
const ext = f => extname(f).toLowerCase();
const byName = (files, test, prefer) => {
  const best = new Map();
  for (const f of files.filter(test)) { const n = basename(f).replace(/\.gltf\.glb$/i, '').replace(/\.(glb|gltf)$/i, ''); const cur = best.get(n); if (!cur || prefer(f) > prefer(cur)) best.set(n, f); }
  return [...best.values()].sort();
};
export const SOURCES = [
  { id: 'kenney', creator: 'Kenney', license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    nameOf: f => basename(f).replace(/\.(glb|gltf)$/i, ''),
    pick: files => byName(files, f => ['.glb', '.gltf'].includes(ext(f)), f => /GLB format/i.test(f) ? 3 : ext(f) === '.glb' ? 2 : 1) },
  { id: 'kaykit', creator: 'Kay Lousberg', license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    nameOf: f => basename(f).replace(/\.gltf\.glb$/i, '').replace(/\.(glb|gltf)$/i, ''),
    pick: files => byName(files, f => ['.glb', '.gltf'].includes(ext(f)) && !/\/(Animations|animations)\//.test(f) && !/(^|\/)Rig_/i.test(f) && !/_Rig/i.test(basename(f)), f => ext(f) === '.glb' ? 2 : 1) },
  { id: 'quaternius', creator: 'Quaternius', license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    nameOf: f => basename(f).replace(/\.(glb|gltf)$/i, ''),
    pick: files => byName(files, f => ['.glb', '.gltf'].includes(ext(f)), f => ext(f) === '.glb' ? 2 : 1) },
  { id: 'quaternius-drive', creator: 'Quaternius', license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    nameOf: f => basename(f).replace(/\.(glb|gltf)$/i, ''),
    pick: files => byName(files, f => ['.glb', '.gltf'].includes(ext(f)), f => ext(f) === '.glb' ? 2 : 1) },
  { id: 'polyhaven', creator: '', license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    nameOf: f => basename(dirname(f)),
    pick: files => files.filter(f => basename(f) === 'model.glb').sort() },
  { id: 'gso', creator: 'Google Research', license: 'CC-BY-4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/',
    nameOf: f => basename(dirname(f)),
    pick: files => files.filter(f => basename(f) === 'model.glb').sort() },
  { id: 'nasa', creator: 'NASA', license: 'CUSTOM', license_url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    nameOf: f => basename(dirname(f)),
    pick: files => files.filter(f => basename(f) === 'model.glb').sort() },
  { id: 'graft', creator: 'Quaternius', license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    nameOf: f => basename(dirname(f)),
    pick: files => files.filter(f => basename(f) === 'model.glb').sort() },
  { id: 'scenes', creator: 'Tana', license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    nameOf: f => basename(dirname(f)),
    pick: files => files.filter(f => basename(f) === 'model.glb').sort() },
];
