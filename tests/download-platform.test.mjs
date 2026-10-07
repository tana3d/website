import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDownloadPlatform } from '../src/lib/download-platform.ts';
const macUA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15';
const macHints=architecture=>({userAgent:macUA,userAgentData:{platform:'macOS',getHighEntropyValues:async()=>({architecture,bitness:'64'})}});
test('Intel and Apple Silicon are selected from explicit client hints, not the misleading Mac UA',async()=>{
  assert.equal(await detectDownloadPlatform(macHints('x86')),'darwin-x64');
  assert.equal(await detectDownloadPlatform(macHints('arm')),'darwin-arm64');
});
test('Safari, Firefox and denied or empty hints require an explicit Mac choice',async()=>{
  assert.equal(await detectDownloadPlatform({userAgent:macUA}),null);
  assert.equal(await detectDownloadPlatform({userAgent:macUA.replace('Safari/605.1.15','Firefox/140.0')}),null);
  assert.equal(await detectDownloadPlatform(macHints('')),null);
  const nav=macHints('arm');nav.userAgentData.getHighEntropyValues=async()=>{throw new Error('Denied');};
  assert.equal(await detectDownloadPlatform(nav),null);
});
test('phones and iPads using desktop Mac UA never receive a desktop recommendation',async()=>{
  for(const nav of [{userAgent:macUA,maxTouchPoints:5},{userAgent:'Linux; Android 16'},{userAgent:'iPhone OS 26'},{...macHints('arm'),userAgentData:{mobile:true,platform:'macOS'}}])
    assert.equal(await detectDownloadPlatform(nav),null);
});
test('64-bit Linux and Windows are detected; unsupported ARM and 32-bit systems stay unselected',async()=>{
  assert.equal(await detectDownloadPlatform({userAgent:'Linux x86_64'}),'linux-x64');
  assert.equal(await detectDownloadPlatform({userAgent:'Windows NT 10.0; Win64; x64'}),'win32-x64');
  for(const platform of ['Linux','Windows']) {
    const nav={userAgent:platform,userAgentData:{platform,getHighEntropyValues:async()=>({architecture:'x86',bitness:'64'})}};
    assert.equal(await detectDownloadPlatform(nav),platform==='Linux'?'linux-x64':'win32-x64');
    for(const [architecture,bitness] of [['arm','64'],['x86','32']]) {
      nav.userAgentData.getHighEntropyValues=async()=>({architecture,bitness});
      assert.equal(await detectDownloadPlatform(nav),null);
    }
  }
});
