import test from 'node:test';
import assert from 'node:assert/strict';
import { importSource, parseSource, sourceLocation } from '../src/lib/source-import.ts';
const cyber='https://sketchfab.com/3d-models/tesla-cybertruck-f12e67159f75486bb21213e573520612';
const model={name:'Tesla Cybertruck',description:'A <b>truck</b>.',user:{displayName:'Lexyc16'},tags:[{name:'tesla'},{name:'car'}],categories:[{slug:'cars-vehicles'}],license:{url:'http://creativecommons.org/licenses/by/4.0/'},isDownloadable:true,animationCount:0};
test('public Sketchfab API maps individual model credits and licence without credentials',async()=>{
 let called;
 const source=await importSource(cyber,async(url,options)=>{called=String(url);assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,undefined);return Response.json(model);});
 assert.equal(called,'https://api.sketchfab.com/v3/models/f12e67159f75486bb21213e573520612');
 assert.equal(source.name,'Tesla Cybertruck');assert.equal(source.creator,'Lexyc16');assert.equal(source.license,'CC-BY-4.0');assert.equal(source.license_url,'https://creativecommons.org/licenses/by/4.0/');assert.equal(source.category,'props');assert.equal(source.description,'A truck.');assert.deepEqual(source.tags,['tesla','car']);assert.match(source.attribution,/Lexyc16.*sketchfab.*CC-BY-4.0/);
});
test('only known HTTPS asset paths can trigger outbound requests',()=>{
 for(const url of ['http://sketchfab.com/models/abc','https://localhost/a/x','https://sketchfab.com.evil.test/models/abc','https://user:pass@kenney.nl/assets/car-kit','https://kenney.nl:8443/assets/car-kit','https://kenney.nl/api/token','https://quaternius.com/packs/../admin','https://polyhaven.com/a/a/b'])assert.throws(()=>sourceLocation(url));
 assert.equal(sourceLocation('https://www.kenney.nl/assets/car-kit?tracking=1').request.href,'https://kenney.nl/assets/car-kit');
});
test('noncommercial, no derivatives and missing licences are never inferred as CC0',()=>{
 for(const license of [null,{url:'https://creativecommons.org/licenses/by-nc/4.0/'},{url:'https://creativecommons.org/licenses/by-nd/4.0/'},{url:'https://evil.test/publicdomain/zero/1.0/'}])assert.throws(()=>parseSource(sourceLocation(cyber),JSON.stringify({...model,license})));
});
test('character source warns about missing clips instead of promising animation',()=>{
 const result=parseSource(sourceLocation(cyber),JSON.stringify({...model,categories:[{slug:'characters-creatures'}]}));assert.equal(result.category,'characters');assert.match(result.warnings.join(' '),/no source animations/);
});
test('pack metadata preserves HTML entities and labels individual-model review',()=>{
 const html='<title>Car &amp; Bike Kit · Kenney</title><meta content="45 models" property="og:description"><table><tr><td>Tags</td><td><a>car</a><a>transportation</a></td></tr></table><a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>';
 const result=parseSource(sourceLocation('https://kenney.nl/assets/car-kit'),html);assert.equal(result.name,'Car & Bike Kit');assert.equal(result.creator,'Kenney');assert.deepEqual(result.tags,['car','transportation']);assert.match(result.warnings.join(' '),/individual GLB/);
 assert.throws(()=>parseSource(sourceLocation('https://kenney.nl/assets/car-kit'),'<title>Pack</title>'));
});
test('Poly Haven reads actual public structured model data and per-asset creator',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'3DModel',name:'Chair',description:'Wooden chair',creator:[{name:'Jake Mobley'}],keywords:'wood, furniture',license:'https://creativecommons.org/publicdomain/zero/1.0/'}]})+'</script>';
 const result=parseSource(sourceLocation('https://polyhaven.com/a/WoodenChair_01'),html);assert.equal(result.creator,'Jake Mobley');assert.deepEqual(result.tags,['wood','furniture']);assert.equal(result.license,'CC0');
 assert.throws(()=>parseSource(sourceLocation('https://polyhaven.com/a/texture'),'<title>Texture</title>'));
});
test('source responses are bounded and errors retain source context',async()=>{
 await assert.rejects(()=>importSource(cyber,async()=>new Response('x'.repeat(2*1024*1024+1))),/too large/);
 await assert.rejects(()=>importSource(cyber,async()=>new Response('no',{status:404})),/404/);
});
