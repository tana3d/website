import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease,readRelease,releaseDownload,downloadRange} from '../src/lib/releases.ts';
const buildId='23-2-aaaaaaaaaaaa';
const record=(filename,platform=null,label=filename)=>({filename,platform,label,key:`releases/${buildId}/${filename}`,url:`https://tana.gg/downloads/releases/${buildId}/${filename}`,bytes:10,sha256:'a'.repeat(64)});
const manifest=()=>({schema:1,version:'0.1.23',buildId,buildNumber:23,commit:'a'.repeat(40),publishedAt:'2026-10-04T12:00:00Z',files:[record('Studio-darwin-arm64.dmg','darwin-arm64','macOS Apple Silicon'),record('Studio-darwin-x64.dmg','darwin-x64','macOS Intel'),record('Studio-win32-x64.exe','win32-x64','Windows'),record('Studio-linux-x64.AppImage','linux-x64','Linux')],sources:[record('blender-4.5.14.tar.xz'),record('studio-source.tar.gz')]});
function fixture({missing=false,short=false}={}){
 const release=manifest(),bytes=new TextEncoder().encode('0123456789');let payloadReads=0;
 const bindings={RELEASES:{async get(key,options){if(key.endsWith('.json'))return {size:2048,text:async()=>JSON.stringify(release)};payloadReads++;if(missing)return null;const data=options?.range?bytes.slice(options.range.offset,options.range.offset+options.range.length):bytes;return {body:new ReadableStream({start(controller){controller.enqueue(data);controller.close();}})};},async head(){if(missing)return null;return {size:short?3:bytes.length,httpEtag:'"fixture"'};}}};
 return {bindings,release,reads:()=>payloadReads,key:release.files[0].key};
}
test('only complete manifests with local URLs and valid checksums are advertised',()=>{
 assert.equal(validateRelease(manifest()).files.length,4);
 for(const mutate of [r=>r.files.pop(),r=>r.files[0].url='https://evil.example/download',r=>r.files[0].sha256='bad',r=>r.files[0].key='../private',r=>r.files[0].platform='unrecognized']){
  const r=manifest();mutate(r);assert.throws(()=>validateRelease(r));
 }
});
test('absence of the first release or binding is a valid coming-soon state',async()=>{
 assert.equal(await readRelease({}),null);assert.equal(await readRelease({RELEASES:{get:async()=>null}}),null);
});
test('installers stream with checksums, attachment names and immutable caching',async()=>{
 const f=fixture(),response=await releaseDownload(f.bindings,f.key,new Request('https://tana.gg/downloads/'+f.key));
 assert.equal(response.status,200);assert.equal(await response.text(),'0123456789');assert.equal(response.headers.get('content-length'),'10');assert.match(response.headers.get('content-disposition'),/Studio-darwin-arm64\.dmg/);assert.equal(response.headers.get('x-checksum-sha256'),'a'.repeat(64));assert.match(response.headers.get('cache-control'),/immutable/);
});
test('resumable downloads serve exact ranges, suffixes, invalid ranges and stale If-Range',async()=>{
 const f=fixture();
 for(const [range,status,body,header]of [['bytes=2-5',206,'2345','bytes 2-5/10'],['bytes=-3',206,'789','bytes 7-9/10'],['bytes=7-',206,'789','bytes 7-9/10'],['bytes=999-',416,'','bytes */10'],['bytes=0-1,4-5',416,'','bytes */10']]){
  const response=await releaseDownload(f.bindings,f.key,new Request('https://tana.gg/',{headers:{Range:range}}));assert.equal(response.status,status);assert.equal(await response.text(),body);assert.equal(response.headers.get('content-range'),header);
 }
 const response=await releaseDownload(f.bindings,f.key,new Request('https://tana.gg/',{headers:{Range:'bytes=2-5','If-Range':'"stale"'}}));assert.equal(response.status,200);assert.equal(await response.text(),'0123456789');
 assert.deepEqual(downloadRange('bytes=0-99',10),{offset:0,length:10});
});
test('HEAD and conditional requests never fetch the installer body',async()=>{
 const f=fixture();const head=await releaseDownload(f.bindings,f.key,new Request('https://tana.gg/',{method:'HEAD'}));assert.equal(head.status,200);assert.equal(await head.text(),'');
 const cached=await releaseDownload(f.bindings,f.key,new Request('https://tana.gg/',{headers:{'If-None-Match':'"fixture"'}}));assert.equal(cached.status,304);assert.equal(f.reads(),0);
});
test('unlisted or corrupt objects never become downloads; version links work independently of latest',async()=>{
 const f=fixture();for(const key of ['latest.json',`releases/${buildId}/private-key.p12`,'releases/../secret'])assert.equal((await releaseDownload(f.bindings,key,new Request('https://tana.gg/'))).status,404);
 for(const options of [{missing:true},{short:true}]){const f=fixture(options);assert.equal((await releaseDownload(f.bindings,f.key,new Request('https://tana.gg/'))).status,503);}
 assert.equal((await releaseDownload(f.bindings,f.key,new Request('https://tana.gg/'))).status,200);
});
