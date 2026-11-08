import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';
import {modelCacheKey} from '../model-asset-cache.js';

function monitorFixture(){
 const studio=Object.create(Studio.prototype),adds=[],removes=[],styles=[];
 Object.assign(studio,{
  items:[],serial:0,root:new THREE.Group(),floorFrame:new THREE.Group(),
  model:{correction:1,restore(){}},measureTool:{setCorrection(){}},
  architecture:{data:{floor:[]},restore(){}},whiteFloor:{visible:false},
  syncSpatial(){},setGuides(){},select(){},changed(){},
  add(index,position,options){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
   mesh.userData={id:++this.serial,index,product:{size:options.size||[1,1,1]},fabric:options.fabric||'dark',materialStyles:options.materialStyles||{}};
   mesh.position.copy(position);this.root.add(mesh);this.items.push(mesh);adds.push(mesh);return mesh;
  },
  disposeObject(mesh){removes.push(mesh);mesh.userData.disposed=true;},
  setMaterialStyle(role,style,mesh){styles.push({role,style,id:mesh.userData.id});mesh.userData.materialStyles[role]=style||undefined;return Promise.resolve(true);}
 });
 return {studio,adds,removes,styles};
}
function item(id,x=0,styles={}){return {id,index:4,size:[1,1,1],position:[x,.5,0],rotation:0,color:'#ffffff',materialStyles:styles};}
function state(items){return {items,cloudProducts:[],spatial:{},architecture:{floor:[],walls:[],windows:[]},floorPose:new THREE.Matrix4().toArray()};}

test('live monitor inserts and moves an object without destroying its mesh',()=>{
 const {studio,adds,removes}=monitorFixture();
 assert.equal(studio.syncLiveState(state([item(7)])),true);
 const original=studio.items[0];
 studio.syncLiveState(state([item(7,2)]));
 assert.equal(studio.items[0],original);
 assert.equal(original.position.x,2);
 assert.equal(adds.length,1);
 assert.equal(removes.length,0);
 assert.equal(studio.root.visible,true);
});

test('live monitor keeps one model while updating its fabric and removes only deleted items',()=>{
 const {studio,adds,removes,styles}=monitorFixture();
 studio.syncLiveState(state([item(7),item(8,3)]));
 const kept=studio.items[0],removed=studio.items[1];
 studio.syncLiveState(state([item(7,1,{wood:{source:'wood:oak'}})]));
 assert.equal(studio.items.length,1);
 assert.equal(studio.items[0],kept);
 assert.equal(removes.length,1);
 assert.equal(removes[0],removed);
 assert.equal(adds.length,2);
 assert.deepEqual(styles.map(s=>s.style?.source),['wood:oak']);
});

test('persistent GLB cache uses a stable asset key without retaining signed tokens',()=>{
 const first='https://zeeztpblibcqtxompvxa.supabase.co/storage/v1/object/sign/chido-assets/models/sofa.glb?token=first';
 const renewed=first.replace('first','new-token');
 assert.equal(modelCacheKey(first),modelCacheKey(renewed));
 assert.notEqual(modelCacheKey(first),modelCacheKey(first.replace('sofa.glb','chair.glb')));
 assert.ok(!modelCacheKey(first).includes('token'));
});
