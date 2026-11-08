import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {LiveViewCamera,sceneOverviewBounds} from '../live-view-camera.js';
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

test('overview contains all furniture independent of tablet orientation and field of view',()=>{
 const {studio,add}=fixture();add(1,-4,-3);add(2,5,2);
 const bounds=sceneOverviewBounds(studio);
 assert.ok(bounds.min.x<-4&&bounds.max.x>5);
 const controller=new LiveViewCamera(studio);
 const firstPosition=studio.camera.position.clone();
 const pose={position:[0,1.55,0],quaternion:[0,1,0,0],sceneVisible:false,aspect:.52,projectionMatrix:new Array(16).fill(0)};
 assert.equal(controller.setPose(pose),true);
 assert.equal(controller.marker.visible,true);
 assert.deepEqual(controller.marker.position.toArray(),pose.position);
 assert.equal(studio.camera.fov,56);
 assert.deepEqual(studio.camera.position.toArray(),firstPosition.toArray(),'overview is independent of tablet pose');
 controller.setMode('follow');
 assert.equal(controller.marker.visible,false);
 assert.equal(studio.camera.fov,82);
 assert.deepEqual(studio.camera.position.toArray(),pose.position);
 controller.setMode('overview');
 assert.equal(controller.marker.visible,true);
 assert.equal(studio.camera.fov,56);
 controller.dispose();
});

test('overview also includes room floor corners and tall walls',()=>{
 const {studio}=fixture();
 studio.architecture={data:{floor:[{x:-2,z:-3},{x:8,z:-3},{x:8,z:4}],walls:[{x1:-2,z1:-3,x2:8,z2:-3,height:3.2}]}};
 const bounds=sceneOverviewBounds(studio);
 assert.ok(bounds.min.x<=-2&&bounds.max.x>=8);
 assert.ok(bounds.max.y>=3.2);
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
