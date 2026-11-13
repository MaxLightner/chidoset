import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';
import {SpatialState} from '../spatial.js';
import {FURNITURE_SIZE_FACTOR} from '../furniture-scale.js';

function studioFixture(){
 const s=Object.create(Studio.prototype);
 Object.assign(s,{
  model:new SpatialState(),root:new THREE.Group(),floorFrame:new THREE.Group(),
  floorNet:new THREE.Group(),ruler:new THREE.Group(),items:[],serial:0,photoMode:false,measureTool:{setCorrection(){},group:new THREE.Group(),active:false},
  makeLabel(){return new THREE.Sprite(new THREE.SpriteMaterial());},changed(){}
 });
 s.floorFrame.add(s.root,s.ruler,s.floorNet);s.syncSpatial=()=>s.model.apply(s.floorFrame,s.root);return s;
}
for(const count of [2,4,6,8]){
 test(`dining layout for ${count} people has matching chairs and metric table dimensions`,()=>{
  const s=studioFixture();s.seed('calm','ناهارخوری',count);
  const table=s.items.find(i=>i.userData.index===10);
  const chairs=s.items.filter(i=>i.userData.index===11);
  assert.ok(table);assert.equal(table.userData.capacity,count);
  assert.equal(chairs.length,count);
  assert.ok(table.userData.product.size[0]>=1.05*FURNITURE_SIZE_FACTOR&&table.userData.product.size[0]<=2.35*FURNITURE_SIZE_FACTOR);
  const snapshot=s.exportState();
  const r=studioFixture();r.restoreState(snapshot);
  assert.equal(r.items.find(i=>i.userData.index===10).userData.capacity,count);
  assert.equal(r.items.find(i=>i.userData.index===10).userData.product.size[0],table.userData.product.size[0]);
 });
}
