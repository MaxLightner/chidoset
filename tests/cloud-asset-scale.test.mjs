import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FURNITURE_SIZE_FACTOR,sizeForAsset,sourceSizeForAsset} from '../furniture-scale.js';

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
 assert.doesNotMatch(loader,/visual\.scale\.set\(size\[0\]/);
 assert.match(loader,/if\(!uploaded&&\[28,29\]/);
 assert.match(studio,/mesh\.scale\.multiplyScalar\(cloud\?1:FURNITURE_SIZE_FACTOR\)/);
 assert.match(studio,/cloudAssetSizeContract:'authored-v1'/);
 assert.match(studio,/legacyCloud:state\.cloudAssetSizeContract!=='authored-v1'/);
});
