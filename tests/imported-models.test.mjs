import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CATALOG} from '../spatial.js';
import {IMPORTED_MODELS,isImportedNoShadow,isImportedLight,configureSofaTexture} from '../imported-models.js';
import * as THREE from '../vendor/three.module.js';
import {isFloorSolid} from '../collision.js';
import {isLamp,isRug,assetMetadata,categoryForIndex,variantsFor,SHEEN_CHAIR_SAMPLE} from '../asset-metadata.js';
import {Studio} from '../studio.js';

test('all eleven included GLBs are present, binary and valid',()=>{
 assert.equal(CATALOG.length,32);
 assert.equal(Object.keys(IMPORTED_MODELS).length,11);
 for(const [key,model] of Object.entries(IMPORTED_MODELS)){
  const index=Number(key);
  const url=new URL('../assets/chido/'+model.file,import.meta.url);
  const bytes=readFileSync(fileURLToPath(url));
  assert.equal(bytes.toString('ascii',0,4),'glTF',model.file);
  assert.equal(bytes.readUInt32LE(4),2,model.file);
  assert.equal(bytes.readUInt32LE(8),bytes.byteLength,model.file);
  const jsonLength=bytes.readUInt32LE(12);
  assert.equal(bytes.toString('ascii',16,20),'JSON',model.file);
  const document=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
  assert.ok(document.meshes?.length>0,model.file);
  const size=CATALOG[index]?.size||[.85,.9,.85];
  assert.ok(size.every(n=>n>0),model.file);
  assert.deepEqual(assetMetadata(index,size).collision.size,[...size]);
 }
});
test('imported lights and rug use existing app power and collision exemptions',()=>{
 assert.ok(isLamp(28)&&isLamp(29));
 assert.ok(isImportedLight(29));
 assert.equal(isFloorSolid(22),true);
 assert.equal(isFloorSolid(25),true);
 assert.equal(isFloorSolid(28),false,'table lamp must overlap table footprint to snap onto its top');
 assert.equal(isFloorSolid(29),true);
 assert.equal(isFloorSolid(30),true);
 assert.equal(isFloorSolid(31),false);
 assert.ok(isRug(31));
 for(const index of [28,29,30,31])assert.equal(isImportedNoShadow(index),true);
 assert.equal(isImportedNoShadow(22),false);
 assert.equal(categoryForIndex(31),'rugs');
});

test('SheenChair can be placed using the + marker, resized by catalog metadata, and swapped with a seat',()=>{
 assert.equal(IMPORTED_MODELS[1000].file,'SheenChair.glb');
 assert.deepEqual(assetMetadata(1000).collision.size,[...SHEEN_CHAIR_SAMPLE.size]);
 assert.equal(categoryForIndex(1000),'seating');
 assert.ok(variantsFor(1000).includes(1000));
 assert.ok(isFloorSolid(1000),'sample chair needs the same floor collision handling as other seats');
 const fake={
  placementPoint:{x:1.2,z:-1.1},selected:null,
  add(index,position){assert.equal(index,1000);assert.equal(position.y,SHEEN_CHAIR_SAMPLE.size[1]/2);return {userData:{index,product:SHEEN_CHAIR_SAMPLE}};},
  tryPlaceNew(){return true;}
 };
 assert.equal(Studio.prototype.addAtMarker.call(fake,1000).userData.index,1000);
 const file=readFileSync(fileURLToPath(new URL('../assets/chido/SheenChair.glb',import.meta.url)));
 const document=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
 assert.ok(document.extensionsUsed.includes('KHR_materials_sheen'));
 assert.ok(document.materials.some(material=>material.extensions?.KHR_materials_sheen));
 assert.ok(document.extensionsUsed.includes('KHR_materials_variants'));
 assert.deepEqual(document.extensions.KHR_materials_variants.variants.map(v=>v.name),['Mango Velvet','Peacock Velvet']);
 assert.ok(readFileSync(fileURLToPath(new URL('../assets/chido/thumbs/1000.jpg',import.meta.url))).byteLength>10000);
});

test('external AO follows the native GLB UV orientation, not a vertically flipped atlas',()=>{
 const ao=configureSofaTexture(new THREE.Texture(),'sofa-ao.jpg',4);
 const fabric=configureSofaTexture(new THREE.Texture(),'dark-fabric.jpg',4);
 assert.equal(ao.flipY,false);
 assert.equal(fabric.flipY,false);
 assert.equal(ao.colorSpace,THREE.NoColorSpace);
 assert.equal(fabric.colorSpace,THREE.SRGBColorSpace);
 assert.equal(ao.wrapS,THREE.ClampToEdgeWrapping);
 assert.equal(ao.wrapT,THREE.ClampToEdgeWrapping);
 assert.equal(ao.repeat.x,1);
 assert.equal(ao.repeat.y,1);
 assert.equal(fabric.wrapS,THREE.RepeatWrapping);
 assert.equal(fabric.wrapT,THREE.RepeatWrapping);
 assert.equal(fabric.repeat.x,4);
 assert.equal(fabric.repeat.y,4);
});
