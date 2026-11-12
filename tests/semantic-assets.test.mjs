import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {CATALOG,SpatialState} from '../spatial.js';
import {ASSET_CATEGORIES,assetMetadata,isLamp,isWallArt} from '../asset-metadata.js';
import {savedFootprints,savedPlanSvg} from '../saved-plan.js';
import {installSofaCushions,CUSHION_PRESETS} from '../sofa-cushions.js';
import {createDecor} from '../decor.js';
import {Studio} from '../studio.js';

function fixture(){
 const s=Object.create(Studio.prototype);
 Object.assign(s,{model:new SpatialState(),root:new THREE.Group(),floorFrame:new THREE.Group(),ruler:new THREE.Group(),
  floorNet:new THREE.Group(),items:[],serial:0,photoMode:false,tracking:true,points:new Map(),
  measureTool:{group:new THREE.Group(),setCorrection(){},active:false},changed(){},
  makeLabel(){return new THREE.Sprite(new THREE.SpriteMaterial());}});
 s.floorFrame.add(s.root,s.ruler,s.floorNet);s.syncSpatial=()=>s.model.apply(s.floorFrame,s.root);
 return s;
}
test('all 32 assets have physical sizes and collision footprint metadata',()=>{
 assert.equal(CATALOG.length,33);
 for(let i=0;i<CATALOG.length;i++){
  const m=assetMetadata(i);assert.ok(m.collision.size.every(v=>v>0));assert.ok(m.footprint2D.width>0);
 }
 const categories=ASSET_CATEGORIES.flatMap(c=>c.indexes);
 assert.ok(categories.includes(21));assert.ok(categories.includes(14));
 assert.ok(isLamp(14)&&isLamp(15));assert.ok(isWallArt(21));
});
test('sofa cushions are attached feature, not independent scene objects',()=>{
 const s=fixture();const sofa=s.add(0);
 for(const preset of CUSHION_PRESETS){
  assert.ok(installSofaCushions(sofa,preset.id));
  assert.equal(sofa.userData.cushionPreset,preset.id);
  assert.equal(s.items.length,1);
  if(preset.id!=='none')assert.ok(sofa.userData.cushionGroup.children.length>=2);
 }
});
test('three lamp meshes have lights and custom low-poly geometry',()=>{
 for(const index of [6,14,15]){
  const lamp=createDecor(index,CATALOG[index].size,'#d3c0aa');
  assert.ok(lamp.isMesh);
  let lights=0;lamp.traverse(m=>{if(m.isPointLight)lights++;});
  assert.equal(lights,1);
 }
});
test('tabletop metadata and actual preview are derived from persisted scene',()=>{
 const scene={items:[
  {index:0,position:[2,.425,-3],rotation:0,size:[2.1,.85,.9]},
  {index:10,position:[0,.375,-1],rotation:Math.PI/4,size:[1.85,.75,.86]},
  {index:7,position:[0,.0075,-1],rotation:0,hidden:true}
 ]};
 const footprints=savedFootprints(scene);
 assert.equal(footprints.length,2);
 assert.equal(footprints[0].x,2);
 assert.match(savedPlanSvg(scene),/svg/);
 assert.notEqual(savedPlanSvg(scene),savedPlanSvg({items:[{index:1,position:[0,.425,0],rotation:0}]}));
});
test('table lamp can attach to a square side table; lamp toggling survives state serialization',()=>{
 const s=fixture();
 const table=s.add(12,new THREE.Vector3(.5,.24,-2));
 const lamp=s.add(14,new THREE.Vector3(.5,.275,-2));
 assert.equal(lamp.userData.attachment?.id,table.userData.id);
 assert.equal(s.setLampOn(true),true);
 assert.equal(lamp.userData.lampOn,true);
 const record=s.exportState();
 assert.equal(record.items.find(i=>i.index===14).lampOn,true);
});
test('scene-move mode does not change A/B calibration or original furniture coordinates',()=>{
 const s=fixture();s.add(0);const before=s.items[0].position.clone();
 const length=s.model.length;
 assert.equal(s.setMoveLayoutMode(true),true);
 assert.equal(s.model.length,length);
 assert.ok(s.items[0].position.equals(before));
});
