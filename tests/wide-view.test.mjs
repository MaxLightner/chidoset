import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {WIDE_VIEW_FOV,verticalFovFromHorizontal,copyTrackedView} from '../wide-view.js';

test('normal, wide and ultra-wide are exact horizontal perspective angles',()=>{
 assert.deepEqual(Object.values(WIDE_VIEW_FOV),[60,84,100]);
 for(const aspect of [9/16,4/3,16/9]){
  for(const h of Object.values(WIDE_VIEW_FOV)){
   const v=verticalFovFromHorizontal(h,aspect);
   const actual=THREE.MathUtils.radToDeg(2*Math.atan(
    Math.tan(THREE.MathUtils.degToRad(v)/2)*aspect));
   assert.ok(Math.abs(actual-h)<1e-9);
  }
 }
 assert.throws(()=>verticalFovFromHorizontal(100,0),RangeError);
});

test('a tracked one-metre movement copies to virtual camera exactly',()=>{
 const cam=new THREE.PerspectiveCamera(60,1,.03,40);
 const pose=(x,y,z)=>({views:[{eye:'none',transform:{
  position:{x,y,z},orientation:{x:0,y:0,z:0,w:1}}}]});
 assert.equal(copyTrackedView(cam,pose(1,1.45,-2)),true);
 const before=cam.position.clone();
 assert.equal(copyTrackedView(cam,pose(2,1.45,-2)),true);
 assert.equal(cam.position.distanceTo(before),1);
 assert.deepEqual(cam.scale.toArray(),[1,1,1]);
 assert.equal(copyTrackedView(cam,null),false);
 assert.ok(cam.position.equals(new THREE.Vector3(2,1.45,-2)));
});

test('viewer position, direction and calibration are not changed by FOV',()=>{
 const camera=new THREE.PerspectiveCamera();
 const pose={transform:{position:{x:3,y:1.7,z:-1},orientation:{x:0,y:.382683432365,z:0,w:.923879532511}}};
 assert.equal(copyTrackedView(camera,pose),true);
 const position=camera.position.clone(),rotation=camera.quaternion.clone();
 for(const hfov of Object.values(WIDE_VIEW_FOV)){
  camera.aspect=9/16;camera.fov=verticalFovFromHorizontal(hfov,camera.aspect);
  camera.updateProjectionMatrix();
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(rotation));
 }
});

test('Wide View uses tracked pose for rendering and picking without changing XR projection',async()=>{
 const {readFileSync}=await import('node:fs');
 const studio=readFileSync(new URL('../studio.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(studio,/this\.wideView\.updatePose\(pose\)/);
 assert.match(studio,/if\(this\.wideView\?\.active\)return this\.wideView\.camera/);
 assert.match(studio,/this\.ray\.setFromCamera\(this\.pointer,this\.activeCamera\(\)\)/);
 assert.match(studio,/this\.wideView\?\.disable\(\)/);
 assert.match(html,/id="wideViewMode"/);
 assert.match(app,/studio\?\.setWideView\(mode\)/);
});
