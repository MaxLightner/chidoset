import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FURNITURE_SIZE_FACTOR,sizeForAsset,sourceSizeForAsset} from '../furniture-scale.js';
import {registerCloudProducts,getCloudProduct} from '../cloud-product-registry.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} differs from ${expected}`);
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('new cloud assets keep physical dimensions through duplicate and scene restore',()=>{
 const metres=[2.3,.9,.95];
 assert.deepEqual(sizeForAsset(metres,{cloud:true}),metres);
 assert.deepEqual(sourceSizeForAsset(metres,{cloud:true}),metres);
 assert.deepEqual(sizeForAsset(sourceSizeForAsset(metres,{cloud:true}),{cloud:true}),metres);
});

test('demo scale correction remains but historical cloud saves migrate to authored size',()=>{
 const metres=[2.3,.9,.95],scaled=sizeForAsset(metres);
 scaled.forEach((value,i)=>near(value,metres[i]*FURNITURE_SIZE_FACTOR));
 sourceSizeForAsset(scaled).forEach((value,i)=>near(value,metres[i]));
 sourceSizeForAsset(scaled,{cloud:true,legacyCloud:true,storedScale:FURNITURE_SIZE_FACTOR}).forEach((value,i)=>near(value,metres[i]));
});

test('cloud loader and studio do not scale authored GLBs',()=>{
 const loader=source('imported-models.js'),studio=source('studio.js');
 assert.match(loader,/if\(uploaded&&!uploaded\.authoredScale\)/);
 assert.match(loader,/if\(!uploaded&&\[28,29\]/);
 assert.match(studio,/mesh\.scale\.multiplyScalar\(authoredCloud\?1:FURNITURE_SIZE_FACTOR\)/);
 assert.match(studio,/cloudAssetSizeContract:'authored-v1'/);
 assert.match(studio,/legacyCloud:state\.cloudAssetSizeContract!=='authored-v1'/);
});

test('new private Storage GLBs are recognized as 1:1 authored assets even before live_glb_path is assigned',()=>{
 const item={catalog_index:930,name:'Production model',size_m:[1.8,.9,.9],asset_path:'storage://chido-assets/models/example.glb',
 asset_url:'https://zeeztpblibcqtxompvxa.supabase.co/storage/v1/object/sign/chido-assets/models/example.glb?token=test',metadata:{category:'seating'}};
 registerCloudProducts([item]);
 assert.equal(getCloudProduct(930).authoredScale,true);
 const source=readFileSync(new URL('../chido-cloud.js',import.meta.url),'utf8');
 assert.match(source,/row\.live_glb_path\|\|String\(row\.asset_path/);
});
