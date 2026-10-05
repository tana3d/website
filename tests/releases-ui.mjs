// Run against an isolated local site with .tmp/ui-release.json seeded into
// its LOCAL R2 store. Fixture installers are never uploaded to production.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.TANA_TEST_URL;
if(!base||!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Use an isolated local TANA_TEST_URL.');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/download');
 await expect(page.getByRole('link',{name:'Download for macOS Apple Silicon'})).toBeVisible();
 await expect(page.locator('.cta .meta')).toContainText('Version 0.1.23');
 await expect(page.locator('.files li')).toHaveCount(4);
 await page.getByText('Checksums and source code',{exact:true}).click();
 await expect(page.locator('.release-details code')).toHaveCount(4);
 await expect(page.getByRole('link',{name:'blender-4.5.14.tar.xz'})).toBeVisible();
 await page.screenshot({path:'.tmp/releases-download.png',fullPage:true});
 const href=await page.locator('.cta .big').getAttribute('href'),url=base+new URL(href).pathname;
 const full=await page.request.get(url);assert.equal(full.status(),200);assert.equal((await full.body()).toString(),'0123456789');
 const partial=await page.request.get(url,{headers:{Range:'bytes=4-'}});assert.equal(partial.status(),206);assert.equal((await partial.body()).toString(),'456789');assert.equal(partial.headers()['content-range'],'bytes 4-9/10');
 const head=await page.request.head(url);assert.equal(head.status(),200);assert.equal(head.headers()['content-length'],'10');
 await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.locator('.cta .big')).toBeVisible();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Download page fits a phone');
 assert.deepEqual(errors,[]);
 console.log('Passed: live R2 manifest rendering, desktop/mobile downloads, source/checksum disclosure, streaming, resume and HEAD.');
}finally{await browser.close();}
