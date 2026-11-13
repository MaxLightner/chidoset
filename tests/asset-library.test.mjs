import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {assetPath,acceptAssetLibrary,libraryThumbnail,librarySwatch,libraryHidden} from '../asset-library.js';
const doc=JSON.parse(readFileSync(new URL('../assets/library/index.json',import.meta.url)));
test('shared index resolves real existing model and swatch paths',()=>{
 assert.equal(acceptAssetLibrary(doc),18);
 assert.match(libraryThumbnail(32),/^assets\/library\/models\//);
 assert.match(librarySwatch('fabric','dark'),/^assets\/library\/materials\/fabric\//);
 for(const item of doc.items)for(const path of Object.values(item.files))assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
test('invalid paths do not replace the live index and archived models hide from new selections',()=>{
 for(const path of ['../secret','https://example.com/a','assets/library/../secret','assets/library/%2e%2e/x','assets/library/x?token=x'])assert.equal(assetPath(path),null);
 const bad=structuredClone(doc);bad.items[0].files.glb='../secret';assert.throws(()=>acceptAssetLibrary(bad));assert.ok(libraryThumbnail(32));
 const archive=structuredClone(doc);archive.items.find(i=>i.catalog_index===32).status='archived';acceptAssetLibrary(archive);assert.equal(libraryHidden(32),true);acceptAssetLibrary(doc);
});
