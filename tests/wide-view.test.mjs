import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {WIDE_VIEW_FOV,NATURAL_VERTICAL_CAP,verticalFovFromHorizontal,wideViewProjection,copyTrackedView} from '../wide-view.js';

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
 assert.match(app,/studio\?\.setWideView\(mode,\{natural:/);
 assert.match(html,/id="wideNatural" checked/);
});


test('Natural portrait framing limits the extreme vertical angle without camera scaling',()=>{
 for(const aspect of [9/19.5,9/16,3/4]){
  const natural=Object.keys(WIDE_VIEW_FOV).map(mode=>{
   const raw=wideViewProjection(mode,aspect,false);
   const comfortable=wideViewProjection(mode,aspect,true);
   assert.ok(Math.abs(raw.horizontal-WIDE_VIEW_FOV[mode])<1e-9);
   assert.ok(comfortable.vertical<=NATURAL_VERTICAL_CAP[mode]+1e-9);
   assert.ok(comfortable.vertical<=raw.vertical+1e-9);
   assert.ok(comfortable.horizontal<=raw.horizontal+1e-9);
   assert.ok(Math.abs(2*Math.atan(Math.tan(comfortable.vertical*Math.PI/360)*aspect)*180/Math.PI-comfortable.horizontal)<1e-9);
   return comfortable.horizontal;
  });
  assert.ok(natural[0]<natural[1]&&natural[1]<natural[2]);
 }
 for(const aspect of [1,4/3,16/9]){
  for(const mode of Object.keys(WIDE_VIEW_FOV)){
   const natural=wideViewProjection(mode,aspect,true);
   assert.ok(Math.abs(natural.horizontal-WIDE_VIEW_FOV[mode])<1e-9);
   assert.equal(natural.limited,false);
  }
 }
 assert.throws(()=>wideViewProjection('unknown',9/16),RangeError);
});

test('Natural and precise projection preserve identical tracked pose and 1:1 scale',()=>{
 const camera=new THREE.PerspectiveCamera();
 const pose={views:[{eye:'none',transform:{position:{x:2,y:1.55,z:-3},orientation:{x:0,y:0,z:0,w:1}}}]};
 assert.equal(copyTrackedView(camera,pose),true);
 const position=camera.position.clone(),rotation=camera.quaternion.clone();
 for(const natural of [true,false])for(const mode of Object.keys(WIDE_VIEW_FOV)){
  const projection=wideViewProjection(mode,9/19.5,natural);
  camera.aspect=9/19.5;camera.fov=projection.vertical;camera.updateProjectionMatrix();
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(rotation));
  assert.deepEqual(camera.scale.toArray(),[1,1,1]);
 }
});
