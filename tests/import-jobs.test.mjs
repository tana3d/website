import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { saveAdminUpload, finishImport, publicJob } from '../src/lib/import-jobs.ts';
async function fixture(){
 const db=new DatabaseSync(':memory:');for(const name of ['0001_library.sql','0002_download_counts.sql','0003_asset_categories.sql','0004_import_jobs.sql'])db.exec(await readFile('migrations/'+name,'utf8'));
 const objects=new Map(),started=[];
 const env={DB:{prepare(sql){const statement=db.prepare(sql);let params=[];return{bind(...args){params=args;return this;},async first(){return statement.get(...params)??null;},async run(){statement.run(...params);return{success:true};}};}},LIBRARY:{async put(key,bytes,options){objects.set(key,{bytes:await new Response(bytes).arrayBuffer(),httpMetadata:options.httpMetadata});},async get(key){const item=objects.get(key);return item?{...item,arrayBuffer:async()=>item.bytes}:null;},async delete(keys){for(const key of typeof keys==='string'?[keys]:keys)objects.delete(key);}},IMPORT_JOBS:{getByName(id){return{async fetch(){started.push(id);return Response.json({queued:true});}};}}};
 return{db,env,objects,started};
}
function form(){const form=new FormData();for(const[k,v]of Object.entries({name:'Blender Cube',slug:'blender-cube',description:'Textured model.',tags:'test, cube',category:'props',license:'CC0',published:'1'}))form.set(k,v);form.set('model',new File(['BLENDER fixture'],'cube.BLEND'));form.set('preview',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'preview.png'));return form;}
function glb(){let text=JSON.stringify({asset:{version:'2.0'},meshes:[{primitives:[]}],animations:[{name:'Walk'}]});text+=' '.repeat((4-text.length%4)%4);const b=new ArrayBuffer(text.length+20),v=new DataView(b);[0x46546c67,2,b.byteLength,text.length,0x4e4f534a].forEach((n,i)=>v.setUint32(i*4,n,true));new Uint8Array(b,20).set(new TextEncoder().encode(text));return b;}
const request=body=>new Request('https://admin.tana.gg/api/admin/assets',{method:'POST',body});
test('source uploads remain pending and private until validated GLB and metadata are saved',async()=>{
 const f=await fixture(),source=form();const response=await saveAdminUpload(request(source),f.env);assert.equal(response.status,202,await response.clone().text());const{job}=await response.json();assert.equal(job.state,'queued');assert.equal(f.started[0],job.id);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM assets').get().n,0);assert.ok([...f.objects.keys()].every(k=>k.startsWith('imports/')));assert.equal(job.source_key,undefined);
 const row=f.db.prepare('SELECT * FROM import_jobs').get();await finishImport(row,glb(),['Procedural material warning'],f.env);const saved=f.db.prepare('SELECT * FROM assets').get();assert.equal(saved.id,job.id);assert.equal(saved.published,1);assert.deepEqual(JSON.parse(saved.animations),['Walk']);assert.equal(f.db.prepare('SELECT state FROM import_jobs').get().state,'ready');assert.ok(f.objects.has(row.source_key));assert.ok(f.objects.has(saved.model_key));
 // A retry after a database interruption must not create duplicate models.
 await finishImport(row,glb(),[],f.env);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM assets').get().n,1);
});
test('concurrent duplicate upload is refused and invalid converted output never publishes',async()=>{
 const f=await fixture();await saveAdminUpload(request(form()),f.env);assert.equal((await saveAdminUpload(request(form()),f.env)).status,409);const row=f.db.prepare('SELECT * FROM import_jobs').get();await assert.rejects(finishImport(row,new ArrayBuffer(24),[],f.env),/GLB/);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM assets').get().n,0);assert.ok(f.objects.has(row.source_key));
});
