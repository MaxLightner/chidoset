import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {CATALOG,SpatialState} from '../spatial.js';
import {assetMetadata,ASSET_CATEGORIES,isLamp,isSofa} from '../asset-metadata.js';
import {savedPlanSvg,savedFootprints} from '../saved-plan.js';
import {Studio} from '../studio.js';
import {CUSHION_PRESETS} from '../sofa-cushions.js';
function fixture(){
 const s=Object.create(Studio.prototype);
 Object.assign(s,{model:new SpatialState(),root:new THREE.Group(),floorFrame:new THREE.Group(),ruler:new THREE.Group(),
 floorNet:new THREE.Group(),items:[],serial:0,photoMode:false,tracking:true,points:new Map(),
 measureTool:{group:new THREE.Group(),setCorrection(){},active:false},changed(){},
 makeLabel(){return new THREE.Sprite(new THREE.SpriteMaterial());}});
 s.floorFrame.add(s.root,s.ruler,s.floorNet);s.syncSpatial=()=>s.model.apply(s.floorFrame,s.root);return s;
}
test('catalog metadata gives every model a collision, footprint, category and placement',()=>{
 assert.equal(CATALOG.length,33);
 for(let i=0;i<CATALOG.length;i++){
  const m=assetMetadata(i);
  assert.ok(m.collision.size.every(n=>n>0),i);
  assert.ok(m.footprint2D.width>0&&m.footprint2D.depth>0);
  assert.ok(ASSET_CATEGORIES.some(c=>c.indexes.includes(i))||i===5);
 }
 for(const i of [2,9,10,12,13])assert.ok(assetMetadata(i).supportSurfaces.some(s=>s.kind==='horizontal'));
 for(const i of [0,1,3])assert.ok(assetMetadata(i).supportSurfaces.some(s=>s.kind==='seat'));
});
test('lamp styles are independently modeled and each uses an actual light and visible glow',()=>{
 const studio=fixture();
 for(const i of [6,14,15]){
  const lamp=studio.add(i);
  assert.equal(isLamp(i),true);
  let point=null,glow=null;
  lamp.traverse(child=>{if(child.isPointLight)point=child;if(child.name==='lamp-visible-glow')glow=child;});
  assert.ok(point&&glow);
  assert.equal(studio.setLampOn(true),true);
  assert.ok(point.intensity>=2,'lamp clearly on');
  assert.ok(glow.material.opacity>.2);
  assert.equal(studio.setLampOn(false),true);
  assert.equal(point.intensity,0);
 }
});
test('sofa pillows are children of furniture, near upright, and save/restore',()=>{
 const s=fixture(),m=s.add(0);
 assert.ok(CUSHION_PRESETS.length>=4);
 assert.ok(s.setSofaCushions('mixed'));
 assert.equal(m.userData.cushionGroup.children.length,2);
 for(const pillow of m.userData.cushionGroup.children)assert.ok(Math.abs(pillow.rotation.x)<.5);
 const saved=s.exportState(),restored=fixture();
 restored.restoreState(saved);
 assert.equal(restored.items[0].userData.cushionPreset,'mixed');
 assert.equal(restored.items[0].userData.cushionGroup.children.length,2);
});
test('moving A moves the entire project and persists its offset',()=>{
 const state=new SpatialState(),floor=new THREE.Group(),layout=new THREE.Group();
 state.apply(floor,layout);
 const start=layout.position.clone(),oldA=state.a.clone();
 const newA=new THREE.Vector3(1,0,1);
 state.moveA(newA);
 state.apply(floor,layout);
 assert.ok(layout.position.equals(start.add(newA.sub(oldA))));
 state.layoutOffset.set(2,0,-3);
 state.apply(floor,layout);
 assert.deepEqual(layout.position.toArray(),[2,0,-3]);
 const restored=new SpatialState();restored.restore(state.snapshot());
 assert.deepEqual(restored.layoutOffset.toArray(),[2,0,-3]);
});
test('a saved arrangement shows actual object locations in its own 2D top-view',()=>{
 const scene={items:[
  {index:0,position:[-1,.42,-2],rotation:0,size:[2.1,.85,.9]},
  {index:10,position:[1,.375,-1],rotation:Math.PI/2,size:[1.85,.75,.86]},
  {index:1,position:[5,.425,3],hidden:true}
 ]};
 assert.equal(savedFootprints(scene).length,2);
 const svg=savedPlanSvg(scene);
 assert.match(svg,/<svg/);
 assert.equal((svg.match(/<g transform=/g)||[]).length,2);
});
