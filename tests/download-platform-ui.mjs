import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium, expect } from '@playwright/test';
const source=await readFile(new URL('../src/lib/download-platform.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  const fixture=`<select data-download-picker><option value="">Choose your computer</option>
    <option value="darwin-arm64" data-url="https://tana.gg/apple.dmg">macOS Apple Silicon</option>
    <option value="darwin-x64" data-url="https://tana.gg/intel.dmg">macOS Intel</option>
    <option value="linux-x64" data-url="https://tana.gg/linux.AppImage">Linux</option></select>
    <a data-primary-download href="#studio-downloads"><span data-download-label>Choose your download</span></a>`;
  for(const architecture of ['x86','arm',null]) {
    await page.setContent(fixture);
    await page.addScriptTag({content:`{const exports={};${compiled}
      exports.setupDownloadPicker(document,{userAgent:'Macintosh; Intel Mac OS X 10_15_7',
      userAgentData:${architecture?`{platform:'macOS',getHighEntropyValues:async()=>({architecture:'${architecture}'})}`:'undefined'}});}`});
    const platform=architecture==='x86'?'darwin-x64':architecture==='arm'?'darwin-arm64':'';
    await expect(page.locator('select')).toHaveValue(platform);
    await expect(page.locator('[data-primary-download]')).toHaveAttribute('href',architecture==='x86'?'https://tana.gg/intel.dmg':architecture==='arm'?'https://tana.gg/apple.dmg':'#studio-downloads');
    await page.locator('select').selectOption('darwin-x64');
    await expect(page.locator('[data-download-label]')).toHaveText('Download for macOS Intel');
    await expect(page.locator('[data-primary-download]')).toHaveAttribute('href','https://tana.gg/intel.dmg');
  }
  await page.setContent(fixture);
  await page.addScriptTag({content:`{const exports={};${compiled}
    exports.setupDownloadPicker(document,{userAgent:'Macintosh',userAgentData:{platform:'macOS',
      getHighEntropyValues:()=>new Promise(resolve=>window.finishDetection=resolve)}});}`});
  await page.locator('select').selectOption('darwin-x64');
  await page.evaluate(()=>window.finishDetection({architecture:'arm'}));
  await expect(page.locator('select')).toHaveValue('darwin-x64');
  await expect(page.locator('[data-primary-download]')).toHaveAttribute('href','https://tana.gg/intel.dmg');
  console.log('Download UI passed: Intel, Apple Silicon, unknown Mac, manual selection and late hints.');
} finally {await browser.close();}
