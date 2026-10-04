import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TANA_TEST_URL??'http://127.0.0.1:4321';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin');
 const publish=page.getByLabel('Publish in the public library');await expect(publish).toBeChecked();assert.equal(await page.getByLabel('Attribution',{exact:true}).count(),0);assert.equal(await page.getByText('Model conversions',{exact:true}).count(),0);
 const name='Package test '+Date.now();await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Description',{exact:true}).fill('A textured Blender package, saved unchanged for conversion in Studio.');
 await page.getByLabel(/^3D model/).setInputFiles('.tmp/ammo-box-source.zip');await page.getByLabel(/^Thumbnail or GIF/).setInputFiles('.tmp/ammo-box-preview.png');
 const responseWait=page.waitForResponse(r=>r.url()===base+'/api/admin/assets'&&r.request().method()==='POST');await page.getByRole('button',{name:'Save asset',exact:true}).click();
 const response=await responseWait;assert.equal(response.status(),201,await response.text());const {asset}=await response.json();assert.equal(asset.model_format,'zip');assert.equal(asset.model_bytes,17654907);
 await expect(page.getByRole('status')).toHaveText('Published. Your asset is now in the library.',{timeout:30000});await expect(page.locator('#model-info')).toContainText('converts when added in Studio');
 const download=await page.request.get(base+`/api/assets/${asset.id}/download`);assert.equal(download.headers()['content-type'],'application/zip');assert.equal((await download.body()).length,asset.model_bytes);
 await page.goto(base+'/assets/'+asset.slug);assert.equal(await page.locator('model-viewer').count(),0);await expect(page.locator('.source-preview')).toBeVisible();await expect(page.getByRole('link',{name:'Download ZIP'})).toBeVisible();
 // Editing a saved draft keeps it private; resetting the form restores public default.
 await page.goto(base+'/admin');await page.locator('#admin-search').fill(name);await page.locator('.asset-list-item').filter({hasText:name}).click();await publish.uncheck();await page.getByRole('button',{name:'Save asset',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Saved as a draft.');
 await page.reload();await page.locator('#admin-search').fill(name);await page.locator('.asset-list-item').filter({hasText:name}).click();await expect(publish).not.toBeChecked();
 await page.locator('#new-asset').click();await expect(publish).toBeChecked();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,id:asset.id,sourceBytes:asset.model_bytes,defaultPublic:true,sourceHosted:true,cloudConversion:false}));
}finally{await browser.close();}
