import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {readRecovery,saveRecovery,filterPublishedScene} from '../app-recovery.js';
import {readFileSync} from 'node:fs';
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
test('no procedural contact-shadow rectangles are generated under models',()=>{
 const source=readFileSync(new URL('../studio.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/addContactShadow|createSofaShadow|isSofaShadowProduct|sofa-shadow\\.js/);
 assert.match(source,/enableShadowCasting/);
});
test('Reinhard mapping and the front fill follow the camera without adding a shadow pass',()=>{
 class Effects extends EnvironmentEffects{async loadIBL(){}}
 const scene=new THREE.Scene(),renderer={shadowMap:{}},effects=new Effects(scene,renderer),camera=new THREE.PerspectiveCamera();
 camera.position.set(3,2,1);camera.lookAt(0,0,-3);camera.updateMatrixWorld();effects.updateCameraLight(camera);
 assert.equal(renderer.toneMapping,THREE.ReinhardToneMapping);assert.equal(effects.cameraFill.castShadow,false);assert.ok(effects.cameraFill.position.distanceTo(camera.position)<1e-8);
 assert.ok(effects.cameraFill.target.position.clone().sub(camera.position).normalize().dot(camera.getWorldDirection(new THREE.Vector3()))>.9999);
});

