import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultRoomPlan,roomWallCollisionFootprints} from '../room-plan.js';
import {footprint,footprintsOverlap} from '../collision.js';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';

test('all four room walls have invisible real-size collision footprints',()=>{
 const plan=defaultRoomPlan(),walls=roomWallCollisionFootprints(plan);
 assert.equal(walls.length,4);
 assert.deepEqual(walls.map(w=>w.wall).sort(),['east','north','south','west']);
 assert.ok(walls.every(w=>w.visible===false&&w.height===3&&w.hz===.12));
 const sofa=footprint([2.1,.85,.9],0,-plan.d/2+.31,0);
 assert.ok(walls.some(w=>footprintsOverlap(sofa,w)));
});

test('door and kitchen floor-height openings do not create wall blockers',()=>{
 const plan={...defaultRoomPlan(),elements:[
  {id:'door-a',type:'door',wall:'north',u:3.4},
  {id:'kitchen-a',type:'kitchen',wall:'east',u:2.9},
  {id:'window-a',type:'win_std_2',wall:'south',u:3.4}
 ]};
 const walls=roomWallCollisionFootprints(plan);
 assert.equal(walls.filter(w=>w.wall==='north').length,2);
 assert.equal(walls.filter(w=>w.wall==='east').length,2);
 assert.equal(walls.filter(w=>w.wall==='south').length,1,'glass is a physical barrier to furniture');
 assert.equal(walls.some(w=>w.visible!==false),false);
 const northGap=footprint([.45,.85,.35],0,-plan.d/2,0);
 assert.equal(walls.some(w=>footprintsOverlap(northGap,w)),false,'open door must not collide at floor height');
});

test('deleting a wall also removes its invisible collider',()=>{
 const plan={...defaultRoomPlan(),hiddenWalls:['west']};
 assert.ok(roomWallCollisionFootprints(plan).every(w=>w.wall!=='west'));
 assert.equal(roomWallCollisionFootprints(plan).length,3);
});

test('Studio includes walls as deterministic obstacles during 2D and AR furniture motion',()=>{
 const studio=Object.create(Studio.prototype),plan=defaultRoomPlan(),root=new THREE.Group();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.1,.85,.9));
 Object.assign(studio,{
  roomPlan:plan,items:[],root,
  collisionObstacles:Studio.prototype.collisionObstacles,
 });
 const obstacles=studio.collisionObstacles();
 assert.equal(obstacles.length,4);
 assert.ok(obstacles.every(x=>x.kind==='wall'));
 assert.equal(typeof Studio.prototype.safeObjectMotion,'function');
});
