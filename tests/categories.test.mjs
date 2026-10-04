import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { CATEGORIES,metadata } from '../src/lib/validation.ts';
import { categoryName } from '../src/lib/types.ts';
test('category migration preserves models, sources, counts and subtype tags',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(await readFile('migrations/0001_library.sql','utf8'));db.exec(await readFile('migrations/0002_download_counts.sql','utf8'));
 db.prepare(`INSERT INTO assets(id,slug,name,category,license,tags,model_key,model_bytes,preview_key,poster_key,source_url,downloads) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('car','car','Car','vehicles','CC0','["street"]','assets/car/model.glb',123,'assets/car/p.png','assets/car/p.png','https://creator.example/car',7);
 db.exec(await readFile('migrations/0003_asset_categories.sql','utf8'));
 const row=db.prepare('SELECT * FROM assets').get();assert.equal(row.category,'props');assert.deepEqual(JSON.parse(row.tags),['street','vehicles']);assert.equal(row.downloads,7);assert.equal(row.model_bytes,123);assert.equal(row.source_url,'https://creator.example/car');
 db.prepare("UPDATE assets SET category='scenes'").run();assert.throws(()=>db.prepare("UPDATE assets SET category='vehicles'").run());
 assert.deepEqual(CATEGORIES,['props','characters','scenes']);assert.equal(categoryName('props'),'Objects');assert.equal(categoryName('scenes'),'Scenes');db.close();
});
