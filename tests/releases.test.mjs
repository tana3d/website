import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease,readRelease,releaseDownload,downloadRange,updateResponse} from '../src/lib/releases.ts';
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

function signedManifest() {
 const release=manifest(),targets=['darwin-aarch64','darwin-x86_64','windows-x86_64','linux-x86_64'];
 release.updates=release.files.map((file,index)=>({...file,...(index<2?record(file.filename.replace('.dmg','.app.tar.gz'),file.platform,file.label):{}),target:targets[index],signature:Buffer.from('signed updater fixture').toString('base64')}));
 return release;
}
test('the update feed selects each platform and serves newer numeric versions only',async()=>{
 const release=signedManifest(),bindings={RELEASES:{get:async()=>({size:2048,text:async()=>JSON.stringify(release)})}};
 for(const [index,target,arch]of [[0,'darwin','aarch64'],[1,'darwin','x86_64'],[2,'windows','x86_64'],[3,'linux','x86_64']]){
  const response=await updateResponse(bindings,target,arch,'0.1.9'),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.version,release.version);assert.equal(body.url,release.updates[index].url);assert.equal(body.signature,release.updates[index].signature);assert.equal(response.headers.get('cache-control'),'no-store');
 }
 for(const version of [release.version,'0.2.0','1.0.0'])assert.equal((await updateResponse(bindings,'darwin','aarch64',version)).status,204);
 assert.equal((await updateResponse(bindings,'windows','aarch64','0.1.0')).status,204);
 for(const version of ['bad','01.0.0','0.1.0-beta'])assert.equal((await updateResponse(bindings,'darwin','aarch64',version)).status,400);
 assert.equal((await updateResponse({},'darwin','aarch64','0.1.0')).status,204);
 delete release.updates;assert.equal((await updateResponse(bindings,'darwin','aarch64','0.1.0')).status,204);
});
test('incomplete, misdirected or mismatched signed updates are never advertised',()=>{
 assert.equal(validateRelease(signedManifest()).updates.length,4);
 for(const mutate of [r=>r.updates.pop(),r=>r.updates[0].signature='',r=>r.updates[0].target='windows-x86_64',r=>r.updates[2].sha256='b'.repeat(64),r=>r.updates[0].url='https://evil.example/update',r=>r.updates[0].filename='private.p8']){
  const release=signedManifest();mutate(release);assert.throws(()=>validateRelease(release));
 }
});
test('signed Mac bundles use the same resumable immutable download route',async()=>{
 const f=fixture(),release=signedManifest();Object.assign(f.release,release);
 const key=release.updates[0].key,response=await releaseDownload(f.bindings,key,new Request('https://tana.gg/',{headers:{Range:'bytes=2-5'}}));
 assert.equal(response.status,206);assert.equal(await response.text(),'2345');assert.match(response.headers.get('content-disposition'),/app.tar.gz/);
});

test('Mac and Linux releases are complete without Windows; Windows update feed is empty',async()=>{
 const release=signedManifest();release.files=release.files.filter(file=>file.platform!=='win32-x64');release.updates=release.updates.filter(file=>file.platform!=='win32-x64');
 assert.equal(validateRelease(release).files.length,3);
 const bindings={RELEASES:{get:async()=>({text:async()=>JSON.stringify(release)})}};
 assert.equal((await updateResponse(bindings,'windows','x86_64','0.1.0')).status,204);
 assert.equal((await updateResponse(bindings,'darwin','x86_64','0.1.0')).status,200);
 release.updates.pop();assert.throws(()=>validateRelease(release),/Incomplete/);
});
