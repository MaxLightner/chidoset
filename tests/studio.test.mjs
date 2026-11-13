import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';
import {SpatialState,CATALOG} from '../spatial.js';
import {FloorScanner,floorCandidates} from '../surfaces.js';
import {AnchorStabilizer} from '../anchor-rig.js';
function fixture(){const s=Object.create(Studio.prototype);Object.assign(s,{model:new SpatialState(),scanner:new FloorScanner(),root:new THREE.Group(),floorFrame:new THREE.Group(),floorNet:new THREE.Group(),ruler:new THREE.Group(),items:[],serial:0,changed(){},onStatus(){},points:new Map(),tracking:true,photoMode:false,session:null,gesture:null,anchorGeneration:0,anchorNodes:[],anchorCandidates:[],anchorPending:false,anchorActive:false,anchorRig:new AnchorStabilizer(),scanMarkers:new THREE.Group(),revealStart:null,debugView:{note(){},tick(){}}});s.floorFrame.add(s.root,s.ruler,s.floorNet);s.scaleLabels=()=>{};s.makeLabel=()=>new THREE.Sprite(new THREE.SpriteMaterial());s.syncSpatial=()=>s.model.apply(s.floorFrame,s.root);s.seed();s.syncSpatial();s.pointOnFloor=e=>new THREE.Vector3(e.clientX,0,e.clientY);return s;}
const target={setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}};
const hit=matrix=>({getPose:()=>({transform:{matrix:matrix.elements}})});

test('plan movement supports precise button controls without a drag gesture',()=>{const s=fixture(),mesh=s.items[0];s.items=[mesh];s.selected=mesh;const p=s.planPosition(mesh);assert.equal(s.moveObjectFromPlan(mesh.userData.id,p.x+.2,p.z),true);const moved=s.planPosition(mesh);assert.ok(Math.abs(moved.x-p.x-.2)<1e-8);assert.ok(Math.abs(moved.z-p.z)<1e-8);});
test('scanning checks all surfaces, prefers the lowest candidate and excludes walls',()=>{const floor=new THREE.Matrix4().makeTranslation(0,0,-1),table=new THREE.Matrix4().makeTranslation(0,.8,-1),wall=new THREE.Matrix4().makeRotationX(Math.PI/2);const candidates=floorCandidates([hit(wall),hit(table),hit(floor)],{},new THREE.Vector3(0,1.5,0));assert.equal(candidates.length,2);assert.equal(candidates[0].point.y,0);});
test('floor confidence requires independent spatial samples rather than repeated frames',()=>{const scanner=new FloorScanner(),viewer=new THREE.Vector3(0,1.5,0),floor=hit(new THREE.Matrix4().makeTranslation(0,0,-1));for(let i=0;i<20;i++)scanner.update([floor],[],{},viewer,i*10);assert.equal(scanner.ready,false);scanner.update([floor],[hit(new THREE.Matrix4().makeTranslation(.4,0,-1)),hit(new THREE.Matrix4().makeTranslation(-.4,0,-1))],{},viewer,400);assert.equal(scanner.ready,true);});
test('confirming floor keeps scanning for distributed anchors and locks horizontal origin',()=>{const s=fixture();let canceled=0;s.hitSource={cancel(){canceled++;}};s.model.locked=false;s.scanner.ready=true;s.scanner.point=new THREE.Vector3(1,-1,-2);assert.equal(s.confirmFloor(),true);assert.equal(canceled,0);assert.ok(s.hitSource);assert.equal(s.needsAnchor,true);assert.equal(s.placed,true);assert.ok(s.model.origin.equals(new THREE.Vector3(1,-1,-2)));assert.equal(s.floorFrame.rotation.x,0);});
test('locked floor never requests new hit-test results, even when camera sees a table',()=>{const s=fixture();s.session={};s.renderer={xr:{getReferenceSpace:()=>({})},render(){}};s.scene={};s.camera={};s.effects={update(){},lightState:'ثابت',depthState:'خاموش'};s.updateAnchor=()=>{};s.frames=0;s.lastReport=0;s.onReport=()=>{};s.lastReportState='';s.anchorState='ثابت';s.fps=0;s.scanner.ready=false;s.model.lock(new THREE.Vector3(0,-1,0));s.frame(100,{getViewerPose:()=>({}),getHitTestResults:()=>{throw Error('must not run once locked');}});assert.equal(s.model.origin.y,-1);});
test('one-finger dragging preserves initial grab offset and object height',()=>{const s=fixture();const object=s.items[0];s.items=[object];object.position.set(2,object.userData.height/2,3);const p=new THREE.Vector3(4,0,5);s.selected=object;s.points.set(1,{clientX:4,clientY:5});s.gesture={kind:'object',offset:object.position.clone().sub(s.rootLocal(p))};const original=object.position.clone();s.drag({pointerId:1,clientX:4,clientY:5,preventDefault(){}},target);assert.ok(object.position.equals(original));s.drag({pointerId:1,clientX:5,clientY:6,preventDefault(){}},target);const dx=object.position.x-original.x,dz=object.position.z-original.z;assert.ok(dx>0&&dz>0,'moves toward touch point');assert.ok(Math.abs(dx-dz)<1e-8,'grab offset preserved in both axes');assert.ok(Math.hypot(dx,dz)<=.6500001,'one update cannot jump more than 65cm');assert.equal(object.position.y,object.userData.height/2);});
test('two-finger rotation ignores pinch distance and never alters correction or dimensions',()=>{const s=fixture();s.model.calibrate(2);s.syncSpatial();s.selected=s.items[0];s.items=[s.selected];const initialRotation=s.selected.rotation.y;s.points.set(1,{clientX:0,clientY:0});s.points.set(2,{clientX:1,clientY:0});s.startTwist(target);s.drag({pointerId:2,clientX:2,clientY:0,preventDefault(){}},target);assert.equal(s.selected.rotation.y,initialRotation);s.drag({pointerId:2,clientX:0,clientY:-2,preventDefault(){}},target);assert.ok(Math.abs(s.selected.rotation.y-initialRotation-Math.PI/2)<1e-8);assert.equal(s.model.correction,2);assert.equal(s.root.scale.x,2);assert.equal(s.selected.geometry.parameters.width,2.1);assert.equal(CATALOG[0].size[0],2.1);});
test('photo mode hides guides while furniture never creates floating dimension labels',()=>{const s=fixture();assert.ok(s.items.every(m=>m.userData.label===null));s.setPhotoMode(true);assert.equal(s.floorNet.visible,false);assert.equal(s.ruler.visible,false);assert.ok(s.items.every(m=>!m.userData.edges.visible));s.setPhotoMode(false);assert.equal(s.floorNet.visible,true);assert.equal(s.ruler.visible,true);assert.ok(s.items.every(m=>m.userData.label===null));});
test('late anchor creation is discarded when the floor is reselected',async()=>{
 const s=fixture();s.session={};s.needsAnchor=true;s.initialFloorOrigin=[0,0,0];s.anchorCandidates=[new THREE.Vector3(0,0,0)];
 let resolveAnchor,deleted=false;const original=globalThis.XRRigidTransform;
 globalThis.XRRigidTransform=class{constructor(p){this.position=p;}};
 try{
  s.updateAnchor({createAnchor:()=>new Promise(resolve=>resolveAnchor=resolve),getHitTestResults:()=>[],getViewerPose:()=>null},{},0);
  s.dropAnchor();
  resolveAnchor({delete(){deleted=true;}});
  await Promise.resolve();assert.equal(deleted,true);assert.equal(s.anchorNodes.length,0);
 }finally{globalThis.XRRigidTransform=original;}
});
test('optional-anchor failure keeps the fixed-floor fallback working',()=>{
 const s=fixture();s.session={};s.needsAnchor=true;s.initialFloorOrigin=[0,0,0];s.anchorCandidates=[new THREE.Vector3(0,0,0)];
 const original=globalThis.XRRigidTransform;globalThis.XRRigidTransform=class{};
 try{
  s.updateAnchor({createAnchor(){throw Error('unsupported');},getHitTestResults:()=>[],getViewerPose:()=>null},{},0);
  assert.equal(s.anchorPending,false);assert.equal(s.placed,true);
 }finally{globalThis.XRRigidTransform=original;}
});
