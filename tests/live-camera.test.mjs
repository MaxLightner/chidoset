import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';

function cameraFixture(camera=new THREE.PerspectiveCamera(48,1,.03,40)){
 const studio=Object.create(Studio.prototype);
 Object.assign(studio,{camera,floorFrame:new THREE.Group(),root:new THREE.Group(),model:{locked:true},tracking:true,host:{clientWidth:800,clientHeight:600,getBoundingClientRect:()=>({width:800,height:600})},renderer:{setSize(){}}});
 return studio;
}

test('guest preserves off-center XR projection and camera pose through resizing',()=>{
 const host=cameraFixture();
 host.camera.projectionMatrix.makePerspective(-.03,.045,.055,-.025,.03,40);
 host.camera.position.set(2,1.7,-3);host.camera.rotation.set(.1,.4,0);
 const state=host.cameraSnapshot();
 const guest=cameraFixture();assert.equal(guest.applyExternalCameraState(state),true);
 guest.resize();
 assert.deepEqual(guest.camera.projectionMatrix.toArray(),state.projectionMatrix);
 assert.deepEqual(guest.camera.position.toArray(),state.position);
 assert.deepEqual(guest.camera.quaternion.toArray(),state.quaternion);
 assert.ok(Math.abs(state.aspect-0.9375)<1e-9);
 const identity=guest.camera.projectionMatrix.clone().multiply(guest.camera.projectionMatrixInverse);
 identity.elements.forEach((v,i)=>assert.ok(Math.abs(v-(i%5===0?1:0))<1e-10));
});

test('live state preserves the tracked floor without contaminating reusable official layouts',()=>{
 const host=cameraFixture();host.floorFrame=new THREE.Group();host.floorFrame.position.set(2,-.7,-4);host.floorFrame.rotation.y=.4;
 host.exportState=()=>({spatial:{},items:[]});
 const live=host.exportLiveState();assert.equal(host.exportState().floorPose,undefined);
 const guest=cameraFixture();guest.floorFrame=new THREE.Group();guest.restoreState=()=>{};
 guest.restoreLiveState(live);
 live.floorPose.forEach((v,i)=>assert.ok(Math.abs(v-guest.floorFrame.matrixWorld.elements[i])<1e-10));
});

test('nonfinite guest camera pose is rejected',()=>{
 const guest=cameraFixture();assert.equal(guest.applyExternalCameraState({position:[NaN,0,0],quaternion:[0,0,0,1]}),false);
});

test('browser monitor uses tracked pose but its own wide lens, full canvas and no AR visibility mask',()=>{
 const guest=cameraFixture();guest.root=new THREE.Group();guest.root.visible=false;guest.floorFrame=new THREE.Group();
 const state={position:[1,1.6,-2],quaternion:[0,0,0,1],aspect:.55,sceneVisible:false,
  projectionMatrix:new Array(16).fill(0),floorPose:new THREE.Matrix4().makeTranslation(2,-.1,1).toArray()};
 assert.equal(guest.applyViewerCameraState(state),true);
 guest.resize();
 assert.deepEqual(guest.camera.position.toArray(),state.position);
 assert.deepEqual(guest.camera.quaternion.toArray(),state.quaternion);
 assert.equal(guest.camera.fov,72);
 assert.equal(guest.camera.aspect,800/600);
 assert.equal(guest.camera.far,100);
 assert.equal(guest.root.visible,true);
 assert.notDeepEqual(guest.camera.projectionMatrix.toArray(),state.projectionMatrix);
 assert.equal(guest.floorFrame.position.x,2);
});
