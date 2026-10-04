import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
const base=process.env.TANA_TEST_URL??'http://127.0.0.1:4321';
const source=process.env.TANA_CONVERTER_FIXTURE;
if(!source)throw new Error('Set TANA_CONVERTER_FIXTURE to a textured, animated model ZIP.');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/admin');
 const name='Conversion verification '+Date.now();await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Description',{exact:true}).fill('Private conversion test.');await page.getByLabel(/^3D model/).setInputFiles(resolve(source));await page.getByLabel(/^Thumbnail or GIF/).setInputFiles(resolve('public/sami.png'));
 const accept=await page.locator('input[name=model]').getAttribute('accept');assert.ok(accept.includes('.blend')&&accept.includes('.zip'));
 const queued=page.waitForResponse(r=>r.url().endsWith('/api/admin/assets')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save asset',exact:true}).click();const response=await queued;assert.equal(response.status(),202,await response.text());const{job}=await response.json();assert.ok(job.id);
 await expect(page.locator('#upload-progress')).toBeVisible();assert.equal(await page.locator('#upload-progress').getAttribute('value'),null);await expect(page.locator('#save-status')).toContainText(/Waiting|Converting|Validating/);await page.screenshot({path:'.tmp/admin-converting.png'});
 await expect(page.locator('#save-status')).toHaveText('Saved as a draft.',{timeout:180000});await expect(page.locator('#upload-progress')).toBeHidden();await expect(page.locator('#model-info')).toContainText('1 animations');await page.screenshot({path:'.tmp/admin-converted.png'});
 await page.reload();await expect(page.locator('#conversion-list')).toContainText(name);await expect(page.locator('#conversion-list')).toContainText('Ready');assert.deepEqual(errors,[]);
 const status=await(await fetch(base+'/api/admin/imports/'+job.id)).json();assert.equal(status.job.state,'ready');assert.equal(status.job.asset_id,job.id);
 console.log(JSON.stringify({ok:true,job:job.id,elapsed_ms:status.job.elapsed_ms,progressVisibleWhilePending:true,readyAfterReload:true}));
}finally{await browser.close();}
