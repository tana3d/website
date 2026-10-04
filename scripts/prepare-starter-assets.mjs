// Prepare a small, attributed CC0 starter set. Models stay out of Git.
// Poly Haven preview renders are not reused: we render our own below.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const root=resolve('.tmp/starter');await mkdir(root,{recursive:true});
const headers={'User-Agent':'TanaStudio/0.1 (tana.gg)'};
async function fetchChecked(url) {const r=await fetch(url,{headers});if(!r.ok)throw new Error(`${r.status}: ${url}`);return r;}
const all=await (await fetchChecked('https://api.polyhaven.com/assets?t=models')).json();
const entries=[
  ['WoodenChair_01','A carved wooden chair for interiors and period scenes.','hero','#d4bd9f'],
  ['Barrel_01','A weathered wooden barrel for street corners and storage rooms.','small','#decda5'],
  ['Lantern_01','A portable lantern for camps, cabins, and evening scenes.','vert','#e5dc9c'],
  ['Camera_01','A vintage camera for a desk, a shop, or a film set.','small','#bcd4d2'],
  ['Television_01','An old television for retro living rooms and shop windows.','hero','#c4cfdc'],
  ['Ukulele_01','A small string instrument for a musician’s room.','vert','#d7b49e'],
  ['SchoolDesk_01','A school desk for classrooms and workspaces.','small','#c9d4bf'],
  ['CheeseBox_01','A wooden box for markets, kitchens, and storage.','micro','#ede2c8'],
  ['CoffeeTable_01','A low table for living rooms and lounge scenes.','small','#c6cbb7'],
  ['CashRegister_01','A vintage register for a shop counter or café.','vert','#c7d4ce'],
  ['WetFloorSign_01','A floor sign for hallways and everyday street scenes.','small','#e7de98'],
];
const io=new NodeIO(fetch,{headers}).setAllowNetwork(true).registerExtensions(ALL_EXTENSIONS);
const catalog=[];
for(const [source,description,tile_size,colour] of entries) {
  const info=all[source];if(!info)throw new Error(`Missing asset ${source}`);
  const files=await (await fetchChecked(`https://api.polyhaven.com/files/${source}`)).json();
  const model=files.gltf?.['1k']?.gltf;if(!model)throw new Error(`No glTF for ${source}`);
  const filename=`${source}.glb`;
  // Poly Haven's glTF URIs are relative to a downloadable package, not to
  // its CDN directory. Resolve each resource with the API's include map.
  const resources={};
  for(const [path,info] of Object.entries(model.include ?? {})) {
    const bytes=new Uint8Array(await (await fetchChecked(info.url)).arrayBuffer());
    if(bytes.byteLength!==info.size)throw new Error(`Incomplete resource ${path}`);
    resources[path]=bytes;
  }
  const json=await (await fetchChecked(model.url)).json();
  const doc=await io.readJSON({json,resources});
  await writeFile(resolve(root,filename),await io.writeBinary(doc));
  catalog.push({filename,slug:source.toLowerCase().replaceAll('_','-'),name:info.name,description,category:'props',tags:info.tags.slice(0,12),creator:Object.keys(info.authors).join(', '),source_url:`https://polyhaven.com/a/${source}`,license:'CC0',license_url:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:`Model by ${Object.keys(info.authors).join(', ')} / Poly Haven. Converted to GLB with 1K textures. Preview rendered by Tana.`,tile_size,colour});
  console.log(`Prepared ${info.name}`);
}
// This model is also bundled in Studio and originally created by Quaternius.
const robot=await fetchChecked('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb');
await writeFile(resolve(root,'robot.glb'),new Uint8Array(await robot.arrayBuffer()));
catalog.unshift({filename:'robot.glb',slug:'expressive-robot',name:'Expressive robot',description:'A friendly rigged robot with walking, running, idle, and gesture animations.',category:'characters',tags:['robot','animated','walk','idle','character'],creator:'Tomás Laulhé / Quaternius',source_url:'https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive',license:'CC0',license_url:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'RobotExpressive by Tomás Laulhé (Quaternius). GLB conversion, facial morphs and material adjustments by Don McCurdy. Preview rendered by Tana.',tile_size:'vert',colour:'#bdcddc',animated:true});
await writeFile(resolve(root,'render.html'),`<!doctype html><html><head><style>*{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body><script type="module">
import * as THREE from 'three';import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;document.body.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.01,100);scene.add(new THREE.HemisphereLight(0xf6f8ff,0x9b8678,3));const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(3,5,4);scene.add(light);const fill=new THREE.DirectionalLight(0xd6e8ff,2);fill.position.set(-4,2,-3);scene.add(fill);
let object,mixer;window.loadAsset=async url=>{if(object)scene.remove(object);const gltf=await new GLTFLoader().loadAsync(url);object=gltf.scene;scene.add(object);const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());object.position.sub(center);const scale=3/Math.max(size.x,size.y,size.z);object.scale.setScalar(scale);object.position.multiplyScalar(scale);mixer=gltf.animations.length?new THREE.AnimationMixer(object):null;if(mixer){const clip=gltf.animations.find(a=>a.name==='Walking')??gltf.animations[0];mixer.clipAction(clip).play();}window.renderFrame(0);};window.renderFrame=(time,angle=.65+time*.15)=>{if(mixer)mixer.setTime(time);camera.position.set(5*Math.sin(angle),2.6,5*Math.cos(angle));camera.lookAt(0,0,0);renderer.render(scene,camera);};
</script></body></html>`);
const server=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.startsWith('/node_modules/')?resolve('.'+path):resolve(root,'.'+path);
  if(!file.startsWith(root+'/')&&!file.startsWith(resolve('node_modules')+'/')){res.writeHead(403).end();return;}
  try { const body=await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'}[extname(file)]??'application/octet-stream'}).end(body); } catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});await page.goto(url+'/render.html');await page.waitForFunction(()=>window.loadAsset);
  for(const asset of catalog) {
    await page.evaluate(filename=>window.loadAsset('/'+filename),asset.filename);await page.evaluate(()=>window.renderFrame(0));
    await page.screenshot({path:resolve(root,asset.slug+'.png'),omitBackground:true});
    if(asset.animated || ['camera-01','ukulele-01'].includes(asset.slug)) {
      const gif=GIFEncoder();
      const turntable=!asset.animated,frames=turntable?100:20;
      for(let i=0;i<frames;i++) {await page.evaluate(({time,angle})=>window.renderFrame(time,angle),{time:i/10,angle:turntable ? .65+i/frames*Math.PI*2 : undefined});const png=await page.screenshot({omitBackground:true});const {data,info}=await sharp(png).resize(360,360).flatten({background:asset.colour}).ensureAlpha().raw().toBuffer({resolveWithObject:true});const palette=quantize(data,256);gif.writeFrame(applyPalette(data,palette),info.width,info.height,{palette,delay:turntable?120:100,repeat:0});}
      gif.finish();await writeFile(resolve(root,asset.slug+'.gif'),gif.bytes());asset.animated=true;
    }
  }
} finally {await browser.close();server.close();}
await writeFile(resolve(root,'catalog.json'),JSON.stringify(catalog,null,2));
console.log(`Rendered ${catalog.length} starter assets. Run npm run seed:local against the dev server.`);
