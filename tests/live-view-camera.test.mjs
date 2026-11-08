import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {LiveViewCamera} from '../live-view-camera.js';
import {approvedLiveTopic} from '../live-broadcast.js';
import {readFileSync} from 'node:fs';

function fixture(){
 const scene=new THREE.Scene(),floorFrame=new THREE.Group(),root=new THREE.Group(),host={clientWidth:1100,clientHeight:630};
 scene.add(floorFrame);floorFrame.add(root);
 const camera=new THREE.PerspectiveCamera(48,host.clientWidth/host.clientHeight,.03,40);
 camera.position.set(5,4,6);
 const studio={scene,floorFrame,root,items:[],camera,host,onFrame:null};
 const add=(id,x,z)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());
  mesh.userData={id,product:{size:[1,1,1]}};mesh.position.set(x,.5,z);root.add(mesh);studio.items.push(mesh);return mesh;
 };
 return {studio,add};
}

test('browser camera uses tablet position and rotation, but an independent wider lens',()=>{
 const {studio,add}=fixture();add(1,-4,-3);add(2,5,2);
 const controller=new LiveViewCamera(studio);
 const pose={position:[0,1.55,0],quaternion:[0,1,0,0],sceneVisible:false,aspect:.52,projectionMatrix:new Array(16).fill(0)};
 assert.equal(controller.setPose(pose),true);
 assert.deepEqual(studio.camera.position.toArray(),pose.position);
 assert.deepEqual(studio.camera.quaternion.toArray(),pose.quaternion);
 assert.equal(studio.camera.fov,92);
 assert.equal(studio.root.visible,true);
 assert.equal(studio.scene.children.length,1,'no third-person tablet marker');
 assert.equal(controller.setFov(105),105);
 assert.equal(studio.camera.fov,105);
 assert.deepEqual(studio.camera.position.toArray(),pose.position);
 controller.dispose();
});

test('incoming tablet poses are interpolated instead of jumping the browser camera',()=>{
 const {studio}=fixture(),controller=new LiveViewCamera(studio);
 controller.setPose({position:[0,1.5,0],quaternion:[0,0,0,1]});
 controller.setPose({position:[1,1.5,0],quaternion:[0,0,0,1]});
 controller.tick(performance.now());
 assert.ok(studio.camera.position.x>0&&studio.camera.position.x<1.3);
 controller.dispose();
});

test('approval-specific broadcast topics do not use a predictable session name',()=>{
 const request='12345678-1234-4234-a234-123456789012',host='34567812-2234-4234-a234-123456789012';
 assert.equal(approvedLiveTopic(request,host),'chido-view-pose:'+request+':'+host);
 assert.equal(approvedLiveTopic(request,''),null);
 assert.notEqual(approvedLiveTopic(request,host),approvedLiveTopic('22345678-1234-4234-a234-123456789012',host));
});

test('tablet pose broadcasts frequently without reinitializing the viewer framebuffer',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),watch=readFileSync(new URL('../live-watch.js',import.meta.url),'utf8');
 const guest=readFileSync(new URL('../guest.js',import.meta.url),'utf8'),seller=readFileSync(new URL('../live-viewer.js',import.meta.url),'utf8');
 assert.match(app,/liveApproval\.broadcastPose\(state\)/);
 assert.match(app,/liveApproval\.broadcastTransforms/);
 assert.match(app,/lastLiveCameraPersist>=1800/);
 assert.match(watch,/\.on\('broadcast',\{event:'pose'\}/);
 assert.match(watch,/\.on\('broadcast',\{event:'transforms'\}/);
 assert.doesNotMatch(guest,/onCamera:state=>\{[^}]*resize\(/);
 assert.doesNotMatch(seller,/onCamera:state=>\{[^}]*resize\(/);
});
