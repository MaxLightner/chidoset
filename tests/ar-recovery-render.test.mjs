import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {readRecovery,saveRecovery,filterPublishedScene} from '../app-recovery.js';
import {roundedShadowAlpha,modelLocalBounds,createSofaShadow,isSofaShadowProduct} from '../sofa-shadow.js';
import {EnvironmentEffects} from '../effects.js';
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('recovery isolates both company and user and keeps seller data in tab storage',()=>{
 globalThis.localStorage=store();globalThis.sessionStorage=store();
 const manager={company_id:'a',user:{id:'one'},role:'company_admin'},seller={...manager,user:{id:'two'},role:'branch'};
 const record={scene:{spatial:{locked:true},items:[{index:22}]}};
 saveRecovery(manager,record);saveRecovery(seller,record);
 assert.equal(readRecovery({...manager,company_id:'b'}),null);assert.equal(readRecovery({...manager,user:{id:'other'}}),null);
 globalThis.sessionStorage=store();assert.equal(readRecovery(seller),null);assert.equal(readRecovery(manager).scene.items[0].index,22);
});
test('refresh recovery rejects procedural or unpublished models and stale embedded catalog URLs',()=>{
 const item={position:[0,.5,-1],rotation:0};const scene={spatial:{locked:true},items:[{...item,index:0},{...item,index:22},{...item,index:33}],cloudProducts:[{catalog_index:33,asset_url:'old'}]};
 const filtered=filterPublishedScene(scene,new Set([0,22]));assert.deepEqual(filtered.items,[{...item,index:22}]);assert.deepEqual(filtered.cloudProducts,[]);assert.equal(scene.items.length,3);
});
test('v15 rounded shadow stays transparent at all plane edges, even for a narrow sofa',()=>{
 for(const [w,d] of [[2.4,.9],[.7,.7],[4,.4]]){
  assert.equal(roundedShadowAlpha(0,0,w,d),.88);
  for(const x of [-1.2*w,1.2*w])for(const z of [-1.2*d,0,1.2*d])assert.equal(roundedShadowAlpha(x,z,w,d),0);
  for(const z of [-1.2*d,1.2*d])assert.equal(roundedShadowAlpha(0,z,w,d),0);
  const shadow=createSofaShadow(w,d,-.5);assert.equal(shadow.geometry.parameters.width,w*2.4);assert.equal(shadow.material.depthWrite,false);assert.equal(shadow.material.toneMapped,false);assert.equal(shadow.userData.labVersion,15);
 }
});
test('model footprint stays local to the sofa when its parent moves and rotates',()=>{
 const root=new THREE.Group(),visual=new THREE.Mesh(new THREE.BoxGeometry(2,1,.8),new THREE.MeshBasicMaterial());visual.position.set(.2,-.1,.3);root.add(visual);root.position.set(8,2,-9);root.rotation.y=1.2;
 const box=modelLocalBounds(root,visual),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 assert.ok(size.distanceTo(new THREE.Vector3(2,1,.8))<1e-6);assert.ok(center.distanceTo(visual.position)<1e-6);
});
test('Reinhard mapping and the front fill follow the camera without adding a shadow pass',()=>{
 class Effects extends EnvironmentEffects{async loadIBL(){}}
 const scene=new THREE.Scene(),renderer={shadowMap:{}},effects=new Effects(scene,renderer),camera=new THREE.PerspectiveCamera();
 camera.position.set(3,2,1);camera.lookAt(0,0,-3);camera.updateMatrixWorld();effects.updateCameraLight(camera);
 assert.equal(renderer.toneMapping,THREE.ReinhardToneMapping);assert.equal(effects.cameraFill.castShadow,false);assert.ok(effects.cameraFill.position.distanceTo(camera.position)<1e-8);
 assert.ok(effects.cameraFill.target.position.clone().sub(camera.position).normalize().dot(camera.getWorldDirection(new THREE.Vector3()))>.9999);
});

test('all three real sofa models receive the decal while tables and lamps do not',()=>{
 for(const index of [22,23,24])assert.equal(isSofaShadowProduct(index),true);
 for(const index of [25,26,27,28,29,30,31])assert.equal(!!isSofaShadowProduct(index),false);
 assert.equal(isSofaShadowProduct(47,{name:'مبل جدید',metadata:{category:'seating'}}),true);
});
