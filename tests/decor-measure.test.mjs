import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createDecor} from '../decor.js';
import {MeasureTool} from '../measure-tool.js';
import {CATALOG} from '../spatial.js';

test('every room/decor catalog object has a sane metric size',()=>{
 assert.equal(CATALOG.length,33);
 for(const item of CATALOG){
  assert.ok(item.size.length===3&&item.size.every(v=>Number.isFinite(v)&&v>0),item.name);
 }
});
test('procedural decor is lightweight real Three.js mesh with a selectable surface',()=>{
 for(let i=4;i<22;i++){
  const obj=createDecor(i,CATALOG[i].size,'#b8a99d');
  assert.equal(obj.isMesh,true,'catalog index '+i);
  assert.ok(obj.geometry.attributes.position.count>0);
  assert.ok(obj.material.isMaterial);
  obj.traverse(child=>{child.geometry?.dispose();child.material?.dispose?.();});
 }
});
test('the AR tape measures two distinct positions independently of layout handles',()=>{
 const floor=new THREE.Group();
 const tool=new MeasureTool(floor,()=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial());sprite.userData.updateText=()=>{};return sprite;});
 tool.setActive(true);
 assert.equal(tool.distanceMeters(),null);
 tool.setPoint(new THREE.Vector3(0,0,0));
 assert.equal(tool.distanceMeters(),null);
 tool.setPoint(new THREE.Vector3(1.2,0,0));
 assert.ok(Math.abs(tool.distanceMeters()-1.2)<1e-8);
 tool.setCorrection(1.5);
 assert.ok(Math.abs(tool.distanceMeters()-.8)<1e-8);
 tool.clear();assert.equal(tool.distanceMeters(),null);
 tool.dispose();
});
