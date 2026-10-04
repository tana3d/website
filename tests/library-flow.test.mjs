import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Explicit opt-in: exercise real local D1/R2, not a mock database.
const base=process.env.TANA_TEST_URL;
test('local admin → R2 upload → D1 catalog → edit → unpublish',{skip:!base},async()=>{
 const name='Integration '+Date.now();const form=new FormData();
 for(const[k,v]of Object.entries({name,slug:name.toLowerCase().replace(' ','-'),description:'Test upload.',tags:'test, robot',category:'characters',license:'CC0',published:'0',tile_size:'small',colour:'#ccddee'}))form.set(k,v);
 form.set('model',new File([await readFile('.tmp/starter/robot.glb')],'robot.glb'));
 form.set('preview',new File([await readFile('.tmp/starter/expressive-robot.png')],'preview.png'));
 const create=await fetch(base+'/api/admin/assets',{method:'POST',headers:{Origin:base},body:form});
 assert.equal(create.status,201,await create.clone().text());const {asset}=await create.json();
 assert.ok(asset.animations.includes('Walking'));assert.equal(asset.rigged,1);
 const originDenied=await fetch(base+'/api/admin/assets/'+asset.id,{method:'PUT',headers:{Origin:'https://other.example'},body:form});assert.equal(originDenied.status,403);
 const publicBefore=await(await fetch(base+'/api/assets?q='+encodeURIComponent(name))).json();assert.equal(publicBefore.total,0);
 // The signed-in local administrator can preview a draft, without caching it.
 // Production auth denial is tested separately with the dev override disabled.
 const draft=await fetch(base+'/media/'+asset.model_key);assert.equal(draft.status,200);assert.equal(draft.headers.get('cache-control'),'no-store');
 for(const key of ['model','preview'])form.delete(key);form.set('published','1');form.set('description','An edited test description.');
 const update=await fetch(base+'/api/admin/assets/'+asset.id,{method:'PUT',headers:{Origin:base},body:form});assert.equal(update.status,200,await update.clone().text());
 const publicAfter=await(await fetch(base+'/api/assets?q='+encodeURIComponent(name))).json();assert.equal(publicAfter.total,1);assert.equal(publicAfter.assets[0].description,'An edited test description.');
 const download=await fetch(base+'/media/'+asset.model_key);assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'model/gltf-binary');const model=new Uint8Array(await download.arrayBuffer());assert.equal(new TextDecoder().decode(model.slice(0,4)),'glTF');
 const range=await fetch(base+'/media/'+asset.model_key,{headers:{Range:'bytes=0-11'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,12);
 const duplicate=await fetch(base+'/api/admin/assets',{method:'POST',headers:{Origin:base},body:form});assert.equal(duplicate.status,409);
 form.set('published','0');const unpublish=await fetch(base+'/api/admin/assets/'+asset.id,{method:'PUT',headers:{Origin:base},body:form});assert.equal(unpublish.status,200);
 assert.equal((await(await fetch(base+'/api/assets?q='+encodeURIComponent(name))).json()).total,0);
});
