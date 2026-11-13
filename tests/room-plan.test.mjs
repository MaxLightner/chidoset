import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultRoomPlan,normalizeRoomPlan,sizedRoomPlan,canPlaceRoomElement,roomPlanToArchitecture,wallAnchor,constrainFurnitureToRoom} from '../room-plan.js';

test('default rectangular room builds a closed four-wall, metric architecture',()=>{
 const plan=defaultRoomPlan(),arch=roomPlanToArchitecture(plan);
 assert.equal(arch.floor.length,4);
 assert.equal(arch.walls.length,4);
 assert.equal(arch.windows.length,0);
 assert.equal(arch.features.length,0);
 assert.equal(arch.walls[0].height,3);
 assert.deepEqual(wallAnchor(plan,'north',0),{x:-3.4,z:-2.9});
});
test('windows of different sizes and sill heights map correctly',()=>{
 const plan={version:1,w:8,d:7,elements:[
  {id:'win1',wall:'west',u:1.6,type:'win_tall_1'},
  {id:'win2',wall:'north',u:4,type:'win_tall_25'},
  {id:'win3',wall:'south',u:4,type:'win_std_2'}
 ]};
 const normalized=normalizeRoomPlan(plan);
 assert.ok(normalized);
 const arch=roomPlanToArchitecture(normalized);
 assert.equal(arch.windows.length,3);
 assert.equal(arch.windows.find(x=>x.id==='win3').sill,1.1);
 assert.equal(arch.windows.find(x=>x.id==='win2').width,2.5);
});
test('same-wall overlaps and corner clearance reject geometry',()=>{
 const plan=defaultRoomPlan();
 const a={id:'x',wall:'north',u:2,type:'door'};
 assert.equal(canPlaceRoomElement(plan,a).valid,true);
 plan.elements.push(a);
 assert.equal(canPlaceRoomElement(plan,{id:'y',wall:'north',u:2.4,type:'win_tall_1'}).valid,false);
 assert.equal(canPlaceRoomElement(plan,{id:'z',wall:'north',u:.2,type:'win_std_2'}).valid,false);
});
test('TV can face a window but not aligned doorway or kitchen opening',()=>{
 const plan={version:1,w:8,d:7,elements:[{id:'tv',wall:'north',u:4,type:'tv'}]};
 assert.equal(canPlaceRoomElement(plan,{id:'window',wall:'south',u:4,type:'win_tall_25'}).valid,true);
 assert.equal(canPlaceRoomElement(plan,{id:'door',wall:'south',u:4,type:'door'}).valid,false);
 assert.equal(canPlaceRoomElement(plan,{id:'kitchen',wall:'south',u:4,type:'kitchen'}).valid,false);
 const arch=roomPlanToArchitecture(plan);
 assert.deepEqual(arch.features.map(x=>x.kind),['tv']);
});
test('door and kitchen create actual 3D openings, not painted wall objects',()=>{
 const plan={version:1,w:8,d:7,elements:[
  {id:'door',wall:'north',u:1.8,type:'door'},
  {id:'kitchen',wall:'east',u:3.4,type:'kitchen'}
 ]};
 const arch=roomPlanToArchitecture(normalizeRoomPlan(plan));
 assert.deepEqual(arch.windows.map(x=>x.kind),['door','kitchen']);
 assert.equal(arch.windows[0].sill,0);
 assert.equal(arch.windows[1].width,3);
});
test('resizing never silently shrinks an existing opening',()=>{
 const plan={version:1,w:8,d:7,elements:[{id:'big',wall:'north',u:6.3,type:'win_tall_25'}]};
 assert.equal(sizedRoomPlan(plan,4,7),null);
 assert.equal(sizedRoomPlan(plan,9,7).w,9);
 assert.equal(normalizeRoomPlan({...plan,w:12,elements:[{...plan.elements[0],u:Infinity}]}),null);
});

test('rotated sofa stays within wall clearance when dragged',()=>{
 const plan=defaultRoomPlan();
 const sofa={x:0,z:0,hx:1.2,hz:.55,angle:Math.PI/4};
 const p=constrainFurnitureToRoom(plan,[sofa],{x:10,z:10});
 const radius=1.2*Math.SQRT1_2+.55*Math.SQRT1_2;
 assert.ok(p.x+radius<=plan.w/2-.099);
 assert.ok(p.z+radius<=plan.d/2-.099);
 assert.equal(constrainFurnitureToRoom({w:1,d:1},[sofa],{x:0,z:0}),null);
});
test('linked table and chairs must stay inside as a group',()=>{
 const plan=defaultRoomPlan();
 const table={x:0,z:0,hx:.7,hz:.5,angle:0};
 const chair={x:1.3,z:0,hx:.35,hz:.4,angle:0};
 const point=constrainFurnitureToRoom(plan,[table,chair],{x:10,z:0});
 assert.ok(point.x+1.3+.35<=plan.w/2-.099);
});


test('selected perimeter wall can be removed without losing the rectangular floor',()=>{
 const plan=defaultRoomPlan();plan.hiddenWalls=['east'];
 const checked=normalizeRoomPlan(plan);
 assert.ok(checked);
 const arch=roomPlanToArchitecture(checked);
 assert.equal(arch.floor.length,4);
 assert.equal(arch.walls.length,3);
 assert.equal(arch.walls.some(w=>w.id==='room-east'),false);
 assert.equal(canPlaceRoomElement(checked,{id:'win',wall:'east',u:2,type:'win_tall_1'}).valid,false);
 assert.equal(normalizeRoomPlan({...plan,elements:[{id:'win',type:'win_tall_1',wall:'east',u:2}]}),null);
 assert.equal(roomPlanToArchitecture({...checked,hiddenWalls:[]}).walls.length,4);
});
