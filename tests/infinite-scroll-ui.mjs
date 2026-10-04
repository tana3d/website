import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// Real local D1/R2 and server-rendered pages, with one simulated network failure.
const base = process.env.TANA_TEST_URL ?? 'http://127.0.0.1:4321';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Use a local test database.');
const created = [];
const browser = await chromium.launch({headless:true});
const preview = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPRsAAAAASUVORK5CYII=','base64');
let json = JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[]}],nodes:[]});
json += ' '.repeat((4-json.length%4)%4);
const model = Buffer.alloc(20+json.length);
[0x46546c67,2,model.length,json.length,0x4e4f534a].forEach((n,i)=>model.writeUInt32LE(n,i*4));
model.write(json,20);
try {
  for(let i=0;i<7;i++) {
    const form = new FormData();
    for(const [key,value] of Object.entries({name:`Scroll check ${Date.now()} ${i}`,description:'Local pagination fixture.',category:'props',license:'CC0',published:'1',tile_size:['small','hero','vert'][i%3],colour:'#ccddee'})) form.set(key,value);
    form.set('model',new File([model],'fixture.glb'));
    form.set('preview',new File([preview],'preview.png'));
    const response = await fetch(base+'/api/admin/assets',{method:'POST',headers:{Origin:base},body:form});
    assert.equal(response.status,201,await response.clone().text());
    created.push((await response.json()).asset);
  }
  const page = await browser.newPage({viewport:{width:1000,height:650}});
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.__transitions=0;const original=document.startViewTransition?.bind(document);if(original)document.startViewTransition=(...args)=>{window.__transitions++;return original(...args);};});
  const home=base+'/?limit=2';
  const failureRoute = '**/?limit=2&page=2';
  await page.route(failureRoute,route=>route.abort());
  await page.goto(home);
  const tiles=page.locator('[data-asset-id]');
  await expect(tiles).toHaveCount(2);
  const initialIds=await tiles.evaluateAll(items=>items.map(item=>item.dataset.assetId));
  await page.locator('[data-library-loader]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-library-status]')).toContainText('Couldn’t load');
  await expect(tiles).toHaveCount(2);
  await expect(page.locator('[data-load-more]')).toHaveText('Try again');
  await page.unroute(failureRoute);
  await page.locator('[data-load-more]').click();
  await expect(page.locator('[data-library-loader]')).not.toHaveAttribute('data-page','1');
  for(let i=0;i<10;i++) {
    const done=await page.locator('[data-library-loader]').evaluate(el=>el.dataset.page===el.dataset.pages);
    if(done)break;
    const prior=await page.locator('[data-library-loader]').getAttribute('data-page');
    await page.locator('[data-library-loader]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-library-loader]')).not.toHaveAttribute('data-page',prior);
  }
  const total=(await(await fetch(base+'/api/assets')).json()).total;
  await expect(tiles).toHaveCount(total);
  const ids=await tiles.evaluateAll(items=>items.map(item=>item.dataset.assetId));
  assert.equal(new Set(ids).size,total);
  assert.deepEqual(ids.slice(0,2),initialIds);
  assert.equal(await page.locator('.wrapper > *').first().getAttribute('data-pinned'),'true');
  await expect(page.locator('[data-pinned]')).toHaveCount(1);
  await expect(page.locator('[data-load-more]')).toBeHidden();
  await expect(page.locator('[data-library-status]')).toContainText('end of the library');
  assert.equal(await tiles.last().evaluate(el=>getComputedStyle(el).viewTransitionName),`asset-${ids.at(-1)}`);
  await tiles.last().locator('a').click();
  await expect(page.locator('[data-library-loader]')).toHaveCount(0);
  await page.goBack();
  await expect(tiles).toHaveCount(total);
  assert.deepEqual(await tiles.evaluateAll(items=>items.map(item=>item.dataset.assetId)),ids);
  assert.ok(await page.evaluate(()=>window.__transitions)>0,'Asset navigation uses View Transitions');
  await page.reload();
  await expect(tiles).toHaveCount(2);
  await page.setViewportSize({width:390,height:650});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(home);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('Passed: batches, retry, deduplication, pinned first card, stable loaded order, end, back restoration, View Transitions, fresh reload and mobile.');
} finally {
  await browser.close();
  for(const asset of created) {
    const form=new FormData();
    for(const key of ['name','slug','description','category','license','tile_size','colour'])form.set(key,asset[key]);
    form.set('published','0');
    const response=await fetch(base+'/api/admin/assets/'+asset.id,{method:'PUT',headers:{Origin:base},body:form});
    assert.equal(response.status,200,await response.text());
  }
}
