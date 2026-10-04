// Own-render previews: Three.js in headless Chromium, transparent 512px PNG (plus a short GIF for animated models).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
const html = `<!doctype html><html><head><style>*{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body><script type="module">
import * as THREE from 'three';import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';import { MeshoptDecoder } from '/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;document.body.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.01,100);scene.add(new THREE.HemisphereLight(0xf6f8ff,0x9b8678,1.5));const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(3,5,4);scene.add(light);const fill=new THREE.DirectionalLight(0xd6e8ff,1);fill.position.set(-4,2,-3);scene.add(fill);
let object,mixer,clip;
window.fitScale=2.5;window.elev=2.6;window.loadAsset=async url=>{if(object)scene.remove(object);const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);object=gltf.scene;object.traverse(o=>{o.frustumCulled=false;});scene.add(object);
 mixer=gltf.animations.length?new THREE.AnimationMixer(object):null;clip=null;
 if(mixer){clip=gltf.animations.find(a=>/idle/i.test(a.name))??gltf.animations.find(a=>/walk|run/i.test(a.name))??gltf.animations[0];mixer.clipAction(clip).play();mixer.setTime(clip.duration*.1);}
 object.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const wrap=new THREE.Group();scene.remove(object);wrap.add(object);object.position.sub(center);const scale=window.fitScale/Math.max(size.x,size.y,size.z,1e-6);wrap.scale.setScalar(scale);scene.add(wrap);object=wrap;
 window.renderFrame(0);return {duration:clip?clip.duration:0,animated:!!clip,tris:0};};
window.renderFrame=(t,angle=.65)=>{if(mixer&&clip)mixer.setTime(Math.min(t,clip.duration*.999));camera.position.set(5*Math.sin(angle),window.elev,5*Math.cos(angle));camera.lookAt(0,0,0);renderer.render(scene,camera);};
</script></body></html>`;
export async function createRenderer() {
  const models = new Map(); let n = 0;
  const server = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/render.html') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    if (p.startsWith('/model/')) { const b = models.get(p); return b ? res.writeHead(200, { 'Content-Type': 'model/gltf-binary' }).end(b) : res.writeHead(404).end(); }
    if (p.startsWith('/node_modules/three/')) { try { return res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await readFile(resolve('.' + p))); } catch {} }
    res.writeHead(404).end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { page.lastError = e.message; });
  await page.goto(`http://127.0.0.1:${server.address().port}/render.html`);
  await page.waitForFunction(() => window.loadAsset);
  return {
    // Returns { png, gif|null, colour }.
    async render(glb, { animate = true, fit = 2.5, elev = 2.6 } = {}) {
      const key = `/model/${n++}.glb`; models.set(key, glb);
      try {
        await page.evaluate(({ f, e }) => { window.fitScale = f; window.elev = e; }, { f: fit, e: elev });
        const info = await page.evaluate(u => window.loadAsset(u), key);
        await page.evaluate(() => window.renderFrame(0));
        const png = await sharp(await page.screenshot({ omitBackground: true })).png({ compressionLevel: 9 }).toBuffer();
        const px = await sharp(png).resize(24, 24, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
        let r = 0, g = 0, b = 0, w = 0; for (let i = 0; i < px.length; i += 4) { const a = px[i + 3] / 255; r += px[i] * a; g += px[i + 1] * a; b += px[i + 2] * a; w += a; }
        const mix = c => Math.round((w ? c / w : 200) * .5 + 232 * .5).toString(16).padStart(2, '0');
        const colour = '#' + mix(r) + mix(g) + mix(b);
        let gif = null;
        if (animate && info.animated && info.duration > 0.2) {
          const enc = GIFEncoder(), frames = 20, span = Math.min(info.duration, 2.4);
          for (let i = 0; i < frames; i++) {
            await page.evaluate(t => window.renderFrame(t), (i / frames) * span);
            const { data, info: im } = await sharp(await page.screenshot({ omitBackground: true })).resize(360, 360).flatten({ background: colour }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const palette = quantize(data, 256); enc.writeFrame(applyPalette(data, palette), im.width, im.height, { palette, delay: Math.round(span / frames * 1000), repeat: 0 });
          }
          enc.finish(); gif = Buffer.from(enc.bytes());
        }
        return { png, gif, colour };
      } finally { models.delete(key); }
    },
    async close() { await browser.close(); server.close(); },
  };
}
