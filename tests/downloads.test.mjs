import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { assetDownload } from '../src/lib/download.ts';
function fixture({published=true,missing=false,incomplete=false,format='glb'}={}){
 const database=new DatabaseSync(':memory:');
 database.exec('CREATE TABLE assets (id TEXT PRIMARY KEY,slug TEXT,model_key TEXT,model_bytes INTEGER,published INTEGER,downloads INTEGER NOT NULL DEFAULT 0)');
 database.prepare('INSERT INTO assets (id,slug,model_key,model_bytes,published) VALUES (?,?,?,?,?)').run('asset','oak-table',`assets/model.${format}`,4,Number(published));
 const env={DB:{prepare(sql){return{bind(id){return{async first(){return database.prepare(sql).get(id)??null;}};}};}},LIBRARY:{async get(){if(missing)return null;return{size:incomplete?2:4,body:new ReadableStream({start(c){c.enqueue(new Uint8Array([103,108,84,70]));c.close();}})};}}};
 return{env,count:()=>database.prepare('SELECT downloads FROM assets WHERE id=?').get('asset').downloads};
}
test('explicit downloads increment atomically and serve GLB with uncached counts',async()=>{
 const f=fixture();const responses=await Promise.all(Array.from({length:10},()=>assetDownload(f.env,'asset')));
 assert.equal(f.count(),10);assert.equal(new Set(responses.map(r=>r.headers.get('x-download-count'))).size,10);
 for(const r of responses){assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('content-disposition'),'attachment; filename="oak-table.glb"');assert.equal(await r.text(),'glTF');}
});
test('HEAD, unpublished, missing and incomplete models do not count',async()=>{
 const f=fixture();const head=await assetDownload(f.env,'asset',true);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(f.count(),0);
 for(const options of [{published:false},{missing:true},{incomplete:true}]){const f=fixture(options);assert.equal((await assetDownload(f.env,'asset')).status,404);assert.equal(f.count(),0);}
 assert.equal((await assetDownload(f.env,'unknown')).status,404);assert.equal(f.count(),0);
});

test('source download filenames and MIME types match the retained package',async()=>{
 for(const [format,mime] of [['zip','application/zip'],['blend','application/octet-stream']]){const f=fixture({format});const response=await assetDownload(f.env,'asset');assert.equal(response.headers.get('content-type'),mime);assert.equal(response.headers.get('content-disposition'),`attachment; filename="oak-table.${format}"`);assert.equal(f.count(),1);}
});
