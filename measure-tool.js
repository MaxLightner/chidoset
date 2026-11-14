import * as THREE from './vendor/three.module.js';

// A measuring line independent from the existing A/B layout-direction handles.
// Points are on the committed floor frame, and calibration is applied to readout.
export class MeasureTool{
 constructor(floorFrame,makeLabel){
  this.group=new THREE.Group();this.group.name='Independent AR measuring tape';floorFrame.add(this.group);
  this.a=null;this.b=null;this.active=false;this.correction=1;
  this.material=new THREE.MeshBasicMaterial({color:0xffc16f,depthTest:false,depthWrite:false});
  this.line=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,1,8),this.material);
  this.line.renderOrder=18;this.group.add(this.line);
  this.pointA=new THREE.Mesh(new THREE.SphereGeometry(.026,10,8),this.material);
  this.pointB=new THREE.Mesh(new THREE.SphereGeometry(.026,10,8),this.material);
  this.group.add(this.pointA,this.pointB);
  this.ticks=new THREE.Group();this.group.add(this.ticks);
  this.label=makeLabel('شروع اندازه‌گیری');this.labelBaseScale=this.label.scale.clone();this.group.add(this.label);this.label.renderOrder=19;
  this.update();
 }
 setActive(value){this.active=!!value;this.update();}
 clear(){this.a=null;this.b=null;this.update();}
 setPoint(point){
  if(!this.a||this.b){this.a=point.clone();this.b=null;}
  else this.b=point.clone();
  this.update();
  return this.distanceMeters();
 }
 distanceMeters(){return this.a&&this.b?this.a.distanceTo(this.b)/Math.max(this.correction,1e-6):null;}
 setCorrection(value){this.correction=value>0?value:1;this.update();}
 update(){
  this.group.visible=this.active;
  this.pointA.visible=!!this.a;this.pointB.visible=!!this.b;this.line.visible=!!this.b;
  for(const child of [...this.ticks.children]){this.ticks.remove(child);child.geometry.dispose();child.material.dispose();}
  // Keep the instruction readable; halve only the completed numeric distance label.
  this.label.scale.copy(this.labelBaseScale).multiplyScalar(this.b?.5:1);
  if(!this.a){this.label.visible=false;return;}
  this.pointA.position.copy(this.a);this.pointA.position.y=.03;
  if(!this.b){this.label.visible=true;this.label.position.copy(this.a).add(new THREE.Vector3(0,.21,0));if(this.label.userData.measure!=='نقطه دوم را لمس کن'){this.label.userData.measure='نقطه دوم را لمس کن';this.label.userData.updateText?.('نقطه دوم را لمس کن');}return;}
  const start=this.a.clone(),end=this.b.clone();start.y=end.y=.035;
  this.pointB.position.copy(end);
  const delta=end.clone().sub(start),len=delta.length(),up=new THREE.Vector3(0,1,0);
  this.line.position.copy(start).lerp(end,.5);this.line.quaternion.setFromUnitVectors(up,delta.clone().normalize());this.line.scale.set(1,len,1);
  const dir=delta.normalize(),perp=new THREE.Vector3(-dir.z,0,dir.x);
  const tickStep=.10*Math.max(this.correction,1e-6),count=Math.min(80,Math.floor(len/tickStep));
  for(let i=0;i<=count;i++){
   const along=tickStep*i;
   if(along>len+.001)break;
   const center=start.clone().addScaledVector(dir,along);
   const size=i%5===0?.065:.029;
   const geometry=new THREE.BufferGeometry().setFromPoints([
    center.clone().addScaledVector(perp,-size/2),center.clone().addScaledVector(perp,size/2)
   ]);
   const tick=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffc16f,depthTest:false}));
   tick.renderOrder=18;this.ticks.add(tick);
  }
  const cm=len/Math.max(this.correction,1e-6)*100;
  const next=`${cm.toFixed(1)} cm`;
  this.label.position.copy(start).lerp(end,.5).add(new THREE.Vector3(0,.18,0));
  if(this.label.userData.measure!==next){this.label.userData.measure=next;this.label.userData.updateText?.(next);}
  this.label.visible=true;
 }
 dispose(){
  for(const child of this.ticks.children){child.geometry.dispose();child.material.dispose();}
  this.line.geometry.dispose();this.pointA.geometry.dispose();this.pointB.geometry.dispose();
  this.material.dispose();this.label.material.map?.dispose();this.label.material.dispose();this.group.parent?.remove(this.group);
 }
}
