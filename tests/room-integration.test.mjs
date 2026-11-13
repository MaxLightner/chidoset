import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LiveMiniMap} from '../minimap.js';
import {defaultRoomPlan} from '../room-plan.js';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';
import {SpatialState} from '../spatial.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const pointer=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
const fakeStudio=()=>({
 roomPlan:defaultRoomPlan(),items:[],selected:null,
 setRoomPlan(next){this.roomPlan=next;return true;},
 select(){},moveRoomFurniture(){},changed(){}
});

test('selected room perimeter can resize by pointer while keeping width and depth live',()=>{
 const studio=fakeStudio(),editor=Object.create(LiveMiniMap.prototype);
 editor.expanded=true;editor.getStudio=()=>studio;
 editor.gesture={type:'wall',wall:'east',startX:0,startY:0,startW:6.8,startD:5.8,metersPerPixel:.01};
 editor.pointers=new Map([[1,{x:0,y:0}]]);
 editor.point=()=>({x:0,z:0});editor.render=()=>{};editor.syncRoomFields=()=>{};
 editor.move(pointer(1,100,0));
 assert.equal(studio.roomPlan.w,7.8);assert.equal(studio.roomPlan.d,5.8);
 editor.gesture={type:'wall',wall:'corner-north-west',startX:0,startY:0,startW:7.8,startD:5.8,metersPerPixel:.01};
 editor.move(pointer(1,50,20));
 assert.equal(studio.roomPlan.w,7.3);
 assert.equal(studio.roomPlan.d,5.6);
});

test('the four room sides and corners are interactive selection targets',()=>{
 const editor=Object.create(LiveMiniMap.prototype),plan=defaultRoomPlan();
 assert.equal(editor.nearWall({x:-3.4,z:0},plan),'west');
 assert.equal(editor.nearWall({x:3.4,z:0},plan),'east');
 assert.equal(editor.nearWall({x:0,z:-2.9},plan),'north');
 assert.equal(editor.nearWall({x:0,z:2.9},plan),'south');
 assert.equal(editor.nearWall({x:-3.4,z:-2.9},plan),'corner-north-west');
 assert.equal(editor.nearWall({x:0,z:0},plan),null);
});

test('apply dimensions updates the authoritative plan, refits the canvas and informs the user',()=>{
 const studio=fakeStudio(),values={'[data-room-width]':{value:'8.5'},'[data-room-depth]':{value:'6.2'}};
 const editor=Object.create(LiveMiniMap.prototype);
 editor.panel={querySelector:selector=>values[selector]};
 editor.getStudio=()=>studio;let fit=0,sync=0,message='';
 editor.fit=()=>fit++;editor.syncRoomFields=()=>sync++;
 editor.options={onToast:m=>message=m};
 editor.applyDimensions();
 assert.equal(studio.roomPlan.w,8.5);assert.equal(studio.roomPlan.d,6.2);
 assert.equal(fit,1);assert.equal(sync,1);assert.match(message,/8.50/);
});

test('offline plan drags use the room-local furniture transform without floor lock',()=>{
 const studio=fakeStudio();studio.items=[{userData:{id:9,product:{size:[1.8,.8,.9]}}}];
 let moved;
 studio.moveRoomFurniture=(...args)=>{moved=args;return true;};
 const editor=Object.create(LiveMiniMap.prototype);
 editor.expanded=true;editor.pointers=new Map([[1,{x:0,y:0}]]);
 editor.gesture={type:'furniture',id:9,dx:0,dz:0};
 editor.getStudio=()=>studio;editor.point=()=>({x:1.1,z:.7});editor.render=()=>{};
 editor.move(pointer(1,12,14));
 assert.deepEqual(moved,[9,1.1,.7]);
});

test('XR scanner controls remain distinct from explicit room placement',()=>{
 const app=read('app.js'),studio=read('studio.js'),html=read('index.html'),css=read('room-designer.css');
 for(const id of ['confirmFloor','roomPlaceActions','placeDesignedRoom','editDesignedRoom','arDock','arMiniMap'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/classList\.remove\('room-design-offline','floor-ready'\)/);
 assert.match(app,/\$\('#roomPlaceActions'\)\.hidden=!report\.placed/);
 assert.match(app,/\$\('#placeDesignedRoom'\)\.onclick=/);
 assert.match(studio,/placeDesignedRoom\(\)/);
 assert.match(studio,/this\.root\.visible=t>\.68&&!this\.roomPendingPlacement/);
 assert.match(css,/#overlay \.room-place-actions\[hidden\]/);
 assert.doesNotMatch(app,/roomAutoCoverAfterScan/);
});


test('dragging a room wall freezes pan and viewbox at the original world-space zoom',()=>{
 const studio=fakeStudio();
 const editor=Object.create(LiveMiniMap.prototype);
 editor.expanded=true;editor.tool='select';editor.getStudio=()=>studio;
 editor.viewport={width:9,height:7,left:-4.5,top:-3.5};editor.viewportLock=null;
 editor.pointers=new Map();editor.selectedArch=null;editor.selectedWall=null;
 editor.svg={getScreenCTM:()=>({a:1}),setPointerCapture(){},releasePointerCapture(){}};
 editor.point=()=>({x:studio.roomPlan.w/2,z:0});
 editor.render=()=>{};editor.syncRoomFields=()=>{};
 const e={pointerId:1,clientX:0,clientY:0,preventDefault(){},stopPropagation(){},target:{closest(){return null;}}};
 editor.start(e);
 assert.equal(editor.gesture.type,'wall');
 assert.deepEqual(editor.viewportLock,{width:9,height:7,left:-4.5,top:-3.5});
 const locked={...editor.viewportLock};
 editor.move(pointer(1,100,0));
 assert.deepEqual(editor.viewportLock,locked,'wall geometry may change but the viewport must not zoom or move');
 editor.end({...e,type:'pointerup'});
 assert.deepEqual(editor.viewportLock,locked,'camera must also stay fixed when wall gesture ends');
 editor.zoomBy(1.25);
 assert.ok(editor.viewportLock.width<locked.width,'deliberate user zoom must remain functional');
 editor.fit();
 assert.equal(editor.viewportLock,null,'fit explicitly resets the camera framing');
});

test('A/B calibration multiplies both architectural room and furniture by the same world-space factor',()=>{
 const model=new SpatialState(),root=new THREE.Group(),floorFrame=new THREE.Group();
 floorFrame.add(root);
 const architecture=new THREE.Group(),furniture=new THREE.Group();
 root.add(architecture,furniture);
 const room=new THREE.Mesh(new THREE.BoxGeometry(6.8,.14,5.8));
 const sofa=new THREE.Mesh(new THREE.BoxGeometry(2.1,.85,.9));
 architecture.add(room);furniture.add(sofa);
 const fake=Object.create(Studio.prototype);
 Object.assign(fake,{
  session:{},model,root,floorFrame,roomPlan:defaultRoomPlan(),
  roomPendingPlacement:true,floorNet:{visible:true},
  flushRoomGeometry(){},changed(){},
  syncSpatial(){this.model.apply(this.floorFrame,this.root);}
 });
 // Four tracked metres between A and B correspond to two real metres.
 model.calibrate(2);
 const originalCorrection=model.correction;
 assert.equal(originalCorrection,2);
 const ok=fake.placeDesignedRoom();
 assert.equal(ok,true);
 assert.equal(model.correction,2,'placing the room must not reset calibrated A/B scale');
 assert.equal(model.actualLength,2);
 assert.equal(root.scale.x,2);
 assert.equal(root.scale.y,2);
 assert.equal(root.scale.z,2);
 floorFrame.updateMatrixWorld(true);
 const worldRoomWidth=new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3()).x;
 const worldSofaWidth=new THREE.Box3().setFromObject(sofa).getSize(new THREE.Vector3()).x;
 assert.ok(Math.abs(worldRoomWidth-13.6)<.00001);
 assert.ok(Math.abs(worldSofaWidth-4.2)<.00001);
 assert.ok(Math.abs(worldSofaWidth/worldRoomWidth-2.1/6.8)<1e-10,
  'sofa/room proportions must remain identical in world space');
 // Recalibration afterward still applies to the entire shared room subtree.
 model.calibrate(4);
 fake.syncSpatial();
 floorFrame.updateMatrixWorld(true);
 const roomAfter=new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3()).x;
 const sofaAfter=new THREE.Box3().setFromObject(sofa).getSize(new THREE.Vector3()).x;
 assert.ok(Math.abs(roomAfter-6.8)<.00001);
 assert.ok(Math.abs(sofaAfter-2.1)<.00001);
});
