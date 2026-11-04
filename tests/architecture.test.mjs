import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {SpatialState} from '../spatial.js';
import {snapPoint,validPolygon,nearestWall,normalizedWindow,windowIntersects,updateWindow,validArchitecture} from '../architecture-geometry.js';

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
