import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {SpatialState} from '../spatial.js';
import {snapPoint,closestFloorEdge,validPolygon,nearestWall,normalizedWindow,windowIntersects,updateWindow,validArchitecture} from '../architecture-geometry.js';
import {ArchitectureLayer} from '../architecture.js';
import {FLOOR_FINISHES,WALL_FINISHES,finishMaterial,finishTextures} from '../architecture-materials.js';

const wall={id:'wall-1',x1:0,z1:0,x2:5,z2:0,height:3,thickness:.12};
test('floor polygon accepts concave rooms but rejects self-intersections and tiny areas',()=>{
 assert.equal(validPolygon([{x:0,z:0},{x:3,z:0},{x:3,z:2},{x:1,z:1},{x:0,z:2}]),true);
 assert.equal(validPolygon([{x:0,z:0},{x:2,z:2},{x:0,z:2},{x:2,z:0}]),false);
 assert.equal(validPolygon([{x:0,z:0},{x:.1,z:0},{x:.1,z:.1}]),false);
});
test('walls snap to connected endpoints and maintain centimetre precision',()=>{
 assert.deepEqual(snapPoint({x:5.05,z:.02},[wall]),{x:5,z:0});
 assert.deepEqual(snapPoint({x:2.348,z:1.123},[wall]),{x:2.35,z:1.12});
 const picked=nearestWall([wall],{x:2.3,z:.14},.5);
 assert.equal(picked.wall.id,'wall-1');assert.ok(Math.abs(picked.along-2.3)<.001);
});
test('fixed frame windows clamp to host wall and reject overlap',()=>{
 const a=normalizedWindow({id:'a',hostId:'wall-1',along:1.2,width:1,height:1.2,sill:.9},wall);
 const b=normalizedWindow({id:'b',hostId:'wall-1',along:2.1,width:1,height:1.2,sill:.9},wall);
 assert.equal(windowIntersects(b,[a]),true);
 const c=normalizedWindow({id:'c',hostId:'wall-1',along:4.2,width:1,height:1.2,sill:.9},wall);
 assert.equal(windowIntersects(c,[a]),false);
 const resized=updateWindow(a,wall,[a],'right',1.8,1.5);
 assert.ok(resized.width>a.width);
 assert.equal(updateWindow(a,wall,[a],'bottom',a.along,2.5),a);
});
test('the reference A moves the project and B changes its heading without a separate move tool',()=>{
 const s=new SpatialState();
 s.layoutOffset.set(.4,0,.2);
 s.moveA(new THREE.Vector3(1,0,2));
 assert.equal(s.a.x,1);assert.equal(s.layoutOffset.x,1.4);
 const before=s.layoutYaw;
 s.moveB(new THREE.Vector3(1,0,-2));
 assert.ok(Math.abs(s.layoutYaw-before)>1);
 const previous=s.correction;
 s.calibrate(.5);
 assert.notEqual(s.correction,previous);
 s.resetCalibration();assert.equal(s.correction,1);
});
test('scene architecture snapshots use bounded polygon, wall and window arrays',()=>{
 assert.equal(validArchitecture({floor:[],walls:[],windows:[]}),true);
 assert.equal(validArchitecture({floor:[],walls:[]}),false);
});

test('architectural floor edges attract new wall endpoints within 24 cm',()=>{
 const floor=[{x:0,z:0},{x:4,z:0},{x:4,z:3},{x:0,z:3}];
 assert.deepEqual(closestFloorEdge({x:1.23,z:.12},floor),{x:1.23,z:0});
 assert.equal(closestFloorEdge({x:2,z:.35},floor),null);
});
test('wall preview requires confirmation and cancellation never commits',()=>{
 const a=new ArchitectureLayer(new THREE.Group(),()=>{});
 a.setMode('floor');for(const p of [{x:0,z:0},{x:4,z:0},{x:4,z:3},{x:0,z:3}])a.tap(p);
 assert.equal(a.finish(),true);
 a.setMode('wall');a.tap({x:.04,z:.1});a.tap({x:3.1,z:.08});
 assert.equal(a.data.walls.length,0,'preview must not create a permanent wall');
 assert.equal(a.confirmWall(),true);assert.equal(a.data.walls.length,1);
 assert.equal(a.data.walls[0].z1,0);assert.equal(a.data.walls[0].z2,0);
 a.tap({x:4,z:1});a.cancelPlacement();
 assert.equal(a.data.walls.length,1,'cancel discards second preview');
 a.dispose();
});
test('floor, wall and window surfaces are selectable and deletable',()=>{
 const a=new ArchitectureLayer(new THREE.Group(),()=>{});
 a.restore({floor:[{x:0,z:0},{x:3,z:0},{x:3,z:2},{x:0,z:2}],walls:[{id:'wall-1',x1:0,z1:0,x2:3,z2:0,height:3,thickness:.12}],windows:[]});
 const ray=new THREE.Raycaster(new THREE.Vector3(1,2,1),new THREE.Vector3(0,-1,0));
 a.root.updateWorldMatrix(true,true);
 assert.equal(a.pickSurface(ray),true);assert.equal(a.selectedSurface().kind,'floor');
 assert.equal(a.setSelectedFinish('carpet-olive'),true);assert.equal(a.data.floorMaterial,'carpet-olive');
 assert.equal(a.deleteSelected(),true);assert.deepEqual(a.data.floor,[]);
 const wallRay=new THREE.Raycaster(new THREE.Vector3(1,1,2),new THREE.Vector3(0,0,-1));
 a.root.updateWorldMatrix(true,true);
 assert.equal(a.pickSurface(wallRay),true);assert.equal(a.selectedSurface().kind,'wall');
 assert.equal(a.setSelectedFinish('wall-grey'),true);
 assert.equal(a.deleteSelected(),true);assert.equal(a.data.walls.length,0);
 a.dispose();
});
test('ceramic and woven carpet use opaque metre-tileable PBR colour and normal maps',()=>{
 assert.ok(FLOOR_FINISHES.length>=10);assert.ok(WALL_FINISHES.length>=8);
 const originalPresets=FLOOR_FINISHES.filter(f=>f.kind==='ceramic'||f.kind==='carpet');
 assert.equal(originalPresets.length,6);
 for(const f of originalPresets){
  const mat=finishMaterial(f.id),maps=finishTextures(f.id);
  assert.equal(mat.transparent,false);assert.equal(mat.opacity,1);
  assert.ok(maps.map.image.data.length>=256*256*4);
  assert.equal(maps.normalMap.wrapS,THREE.RepeatWrapping);
  assert.ok(mat.normalMap);
  mat.dispose();
 }
});
