import * as THREE from './vendor/three.module.js';

// The viewer is a complete 3D scene, not a crop of the tablet's XR framebuffer.
// Overview fits every placed object and shows the tablet as a moving 3D marker.
// Following the tablet is an optional, wider-angle camera mode.
export function sceneOverviewBounds(studio){
 studio.floorFrame.updateMatrixWorld(true);
 const box=new THREE.Box3(),point=new THREE.Vector3(),scale=new THREE.Vector3();
 for(const item of studio.items){
  if(!item.visible)continue;
  item.getWorldPosition(point);item.getWorldScale(scale);
  const size=item.userData.product?.size||[1,1,1];
  const radius=Math.max(.1,Math.hypot(...size)*.5*Math.max(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z)));
  box.expandByPoint(new THREE.Vector3(point.x-radius,point.y-radius,point.z-radius));
  box.expandByPoint(new THREE.Vector3(point.x+radius,point.y+radius,point.z+radius));
 }
 // Include room geometry too; a guest should not lose a wall or a corner
 // merely because the tablet is pointing toward the opposite side.
 const architecture=studio.architecture?.data;
 for(const corner of architecture?.floor||[])if(Number.isFinite(corner.x)&&Number.isFinite(corner.z)){
  box.expandByPoint(studio.root.localToWorld(new THREE.Vector3(corner.x,0,corner.z)));
 }
 for(const wall of architecture?.walls||[])for(const [x,z] of [[wall.x1,wall.z1],[wall.x2,wall.z2]])if(Number.isFinite(x)&&Number.isFinite(z)){
  box.expandByPoint(studio.root.localToWorld(new THREE.Vector3(x,0,z)));
  box.expandByPoint(studio.root.localToWorld(new THREE.Vector3(x,Number(wall.height)||3,z)));
 }
 if(box.isEmpty()){
  studio.floorFrame.getWorldPosition(point);
  box.setFromCenterAndSize(point,new THREE.Vector3(3,1.5,3));
 }
 return box;
}

export class LiveViewCamera{
 constructor(studio){
  this.studio=studio;this.mode='overview';this.pose=null;this.targetPosition=new THREE.Vector3();this.targetQuaternion=new THREE.Quaternion();this.hasTarget=false;
  this.marker=new THREE.Group();this.marker.name='viewer-tablet-position';this.marker.visible=false;
  const body=new THREE.Mesh(new THREE.BoxGeometry(.13,.18,.075),new THREE.MeshBasicMaterial({color:0x1f8d66,depthTest:false}));
  const direction=new THREE.Mesh(new THREE.ConeGeometry(.095,.28,3),new THREE.MeshBasicMaterial({color:0xefa94c,depthTest:false}));
  direction.rotation.x=-Math.PI/2;direction.position.z=-.23;
  this.marker.add(body,direction);studio.scene.add(this.marker);
  this.previousFrame=studio.onFrame;
  studio.onFrame=(time,frame)=>{this.tick();this.previousFrame?.(time,frame);};
  this.fitOverview(true);
 }
 setMode(mode){
  if(!['overview','follow'].includes(mode))return;
  this.mode=mode;this.marker.visible=mode==='overview'&&!!this.pose;
  this.hasTarget=false;
  if(mode==='overview')this.fitOverview(true);
  else if(this.pose)this.setPose(this.pose);
 }
 setPose(state){
  if(!Array.isArray(state?.position)||state.position.length!==3||!state.position.every(Number.isFinite)||!Array.isArray(state.quaternion)||state.quaternion.length!==4||!state.quaternion.every(Number.isFinite))return false;
  this.pose=state;this.marker.position.fromArray(state.position);this.marker.quaternion.fromArray(state.quaternion);
  this.marker.visible=this.mode==='overview';
  if(Array.isArray(state.floorPose)&&state.floorPose.length===16&&state.floorPose.every(Number.isFinite)){
   new THREE.Matrix4().fromArray(state.floorPose).decompose(this.studio.floorFrame.position,this.studio.floorFrame.quaternion,this.studio.floorFrame.scale);
   this.studio.floorFrame.updateMatrixWorld(true);
  }
  this.studio.root.visible=true;
  if(this.mode==='follow'){
   this.studio.camera.fov=82;this.studio.camera.zoom=1;this.studio.camera.near=.02;this.studio.camera.far=100;
   this.targetPosition.fromArray(state.position);this.targetQuaternion.fromArray(state.quaternion);
   if(!this.hasTarget){this.studio.camera.position.copy(this.targetPosition);this.studio.camera.quaternion.copy(this.targetQuaternion);this.hasTarget=true;}
   this.studio.camera.updateProjectionMatrix();
  }
  return true;
 }
 fitOverview(immediate=false){
  if(this.mode!=='overview')return;
  const bounds=sceneOverviewBounds(this.studio),center=bounds.getCenter(new THREE.Vector3());
  const radius=Math.max(1.3,bounds.getBoundingSphere(new THREE.Sphere()).radius);
  const camera=this.studio.camera,aspect=Math.max(.3,this.studio.host.clientWidth/Math.max(1,this.studio.host.clientHeight));
  const fov=56,vertical=THREE.MathUtils.degToRad(fov),horizontal=2*Math.atan(Math.tan(vertical/2)*aspect);
  const distance=Math.max(3,radius/Math.sin(Math.min(vertical,horizontal)/2)*1.28);
  const direction=new THREE.Vector3(.86,.65,1).normalize();
  this.targetPosition.copy(center).addScaledVector(direction,distance);
  const lookCamera=new THREE.PerspectiveCamera();lookCamera.position.copy(this.targetPosition);lookCamera.lookAt(center);
  this.targetQuaternion.copy(lookCamera.quaternion);
  camera.fov=fov;camera.zoom=1;camera.near=.02;camera.far=Math.max(100,distance+radius*3);camera.updateProjectionMatrix();
  if(immediate||!this.hasTarget){camera.position.copy(this.targetPosition);camera.quaternion.copy(this.targetQuaternion);this.hasTarget=true;camera.updateMatrixWorld(true);}
 }
 tick(){
  if(!this.hasTarget)return;
  const camera=this.studio.camera,alpha=this.mode==='follow'?.48:.14;
  if(camera.position.distanceToSquared(this.targetPosition)>1e-8)camera.position.lerp(this.targetPosition,alpha);
  if(1-Math.abs(camera.quaternion.dot(this.targetQuaternion))>1e-7)camera.quaternion.slerp(this.targetQuaternion,alpha);
  camera.updateMatrixWorld(true);
 }
 dispose(){
  this.studio.onFrame=this.previousFrame;
  this.marker.removeFromParent();this.marker.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
 }
}
