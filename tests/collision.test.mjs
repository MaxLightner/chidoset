import test from 'node:test';
import assert from 'node:assert/strict';
import {footprint,footprintsOverlap,moveWithoutOverlap,rotateWithoutOverlap,moveGroupWithoutOverlap,rotateGroupWithoutOverlap,nearestFreeFootprint,isFloorSolid,settleFootprintsBySize} from '../collision.js';
const box=(x,z,w=2,d=1,a=0)=>footprint([w,.85,d],x,z,a);

test('rotated footprints detect real contact',()=>{
 assert.equal(footprintsOverlap(box(0,0),box(2.5,0)),false);
 assert.equal(footprintsOverlap(box(0,0),box(1,0)),true);
 assert.equal(footprintsOverlap(box(0,0),box(1.1,0,.9,.5)),true);
});

test('fast dragging cannot pass through a sofa',()=>{
 const start=box(-3,0),blocker=box(0,0);
 const p=moveWithoutOverlap(start,{x:4,z:0},[blocker]);
 assert.ok(p.x<-1.99&&p.x>-2.1,JSON.stringify(p));
 assert.equal(footprintsOverlap({...start,...p},blocker),false);
});

test('furniture slides tangentially along obstacles',()=>{
 const m=box(-2.5,-1),wall=box(0,0,1,3);
 const p=moveWithoutOverlap(m,{x:2,z:1},[wall]);
 assert.ok(p.x<-1.5&&p.z>-1,JSON.stringify(p));
 assert.equal(footprintsOverlap({...m,...p},wall),false);
});

test('rotation is truncated at first contact',()=>{
 const m=box(0,0,2,1),o=box(0,1.3,.5,.5);
 const angle=rotateWithoutOverlap(m,Math.PI/2,[o]);
 assert.ok(angle>=0&&angle<Math.PI/2);
 assert.equal(footprintsOverlap({...m,angle},o),false);
});

test('new furniture relocates to free space or fails cleanly',()=>{
 const blocker=box(0,0),found=nearestFreeFootprint(box(0,0),[blocker]);
 assert.ok(found);
 assert.equal(footprintsOverlap(box(found.x,found.z),blocker),false);
 assert.equal(nearestFreeFootprint(box(0,0),[blocker],.1),null);
});

test('rugs and small decor are intentionally nonblocking',()=>{
 for(const idx of [4,5,7,14,16,21])assert.equal(isFloorSolid(idx),false);
 for(const idx of [0,1,2,3,8,9,10,11,12,13])assert.equal(isFloorSolid(idx),true);
});

test('deterministic 2000-case collision stress',()=>{
 let seed=155,failures=0;
 const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 for(let k=0;k<2000;k++){
  const moving=footprint([.8+random()*2,.7,.3+random()],-3+random(),-3+random(),random()*6.28);
  const blockers=Array.from({length:24},()=>footprint([.4+random()*1.8,.9,.3+random()*1.2],-2+random()*5,-2+random()*5,random()*6.28));
  const active=blockers.filter(b=>!footprintsOverlap(moving,b));
  const goal={x:moving.x+7*(random()-.5),z:moving.z+7*(random()-.5)};
  const moved=moveWithoutOverlap(moving,goal,blockers);
  if(active.some(b=>footprintsOverlap({...moving,...moved},b)))failures++;
  const turned=rotateWithoutOverlap(moving,moving.angle+(random()-.5)*1.56,blockers);
  if(active.some(b=>footprintsOverlap({...moving,angle:turned},b)))failures++;
 }
 assert.equal(failures,0);
});

test('linked dining table and chairs move as a collision-safe group',()=>{
 const table=box(0,0,1.5,.85),chair=box(0,1,.48,.47),blocker=box(2.5,1,.5,.5);
 const safe=moveGroupWithoutOverlap([table,chair],{x:4,z:0},[blocker]);
 assert.ok(safe.x>1.8&&safe.x<2.05,JSON.stringify(safe));
 assert.equal(footprintsOverlap({...chair,x:chair.x+safe.x,z:chair.z+safe.z},blocker),false);
});

test('linked chair rotation stops before hitting nearby sofa',()=>{
 const table=box(0,0,1.5,.85),chair=box(0,1,.48,.47),blocker=box(1.2,.4,.5,.5);
 const safe=rotateGroupWithoutOverlap([table,chair],Math.PI/2,[blocker]);
 assert.ok(safe>=0&&safe<Math.PI/2);
 const x=chair.x*Math.cos(safe)+chair.z*Math.sin(safe);
 const z=-chair.x*Math.sin(safe)+chair.z*Math.cos(safe);
 assert.equal(footprintsOverlap({...chair,x,z,angle:safe},blocker),false);
});

test('floor overlap settles by size, moving the smaller item further',()=>{
 const big={...box(0,0,2.4,.9),id:1},small={...box(.7,0,.4,.4),id:2};
 const [a,b]=settleFootprintsBySize([big,small]);
 assert.equal(footprintsOverlap({...big,...a},{...small,...b}),false);
 assert.ok(Math.hypot(b.x-small.x,b.z-small.z)>8*Math.hypot(a.x-big.x,a.z-big.z));
});
test('dining table and chairs remain a rigid group during settlement',()=>{
 const table={...box(0,0,1.5,.7),id:10,groupId:10},chair={...box(0,1,.48,.47),id:11,groupId:10},sofa={...box(0,.95,2,.8),id:12};
 const [a,b,d]=settleFootprintsBySize([table,chair,sofa]);
 assert.ok(Math.abs(b.x-a.x-(chair.x-table.x))<1e-6);
 assert.ok(Math.abs(b.z-a.z-(chair.z-table.z))<1e-6);
 assert.equal(footprintsOverlap({...chair,...b},{...sofa,...d}),false);
});
