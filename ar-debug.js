import * as THREE from './vendor/three.module.js';

// Diagnostic-only instrumentation. No modifications to FloorScanner, world transforms,
// placement logic, or AnchorStabilizer. Sampling is throttled for older phones.
const COLORS=[0x45d6ff,0xffbf56,0xb28cff,0x71e4a1,0xff7c9f,0xf6e475,0x8dc6ff,0xff9175];
const round=(v,n=3)=>Number.isFinite(v)?Number(v.toFixed(n)):null;
const vec=p=>p?[round(p.x),round(p.y),round(p.z)]:null;
const angle=n=>round(Math.acos(Math.min(1,Math.max(-1,Math.abs(n.y))))*180/Math.PI,1);
const area=points=>{let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a.x*b.z-b.x*a.z;}return round(Math.abs(sum)/2,2);};

export class ARDebugView{
 constructor(scene){
  this.scene=scene;this.group=new THREE.Group();this.group.name='AR diagnostic planes and anchors';scene.add(this.group);
  this.planes=new Map();this.nextPlaneId=1;
  this.anchorGeometry=new THREE.SphereGeometry(.045,12,8);
  this.anchorMarkers=Array.from({length:5},(_,i)=>{
   const mesh=new THREE.Mesh(this.anchorGeometry,new THREE.MeshBasicMaterial({color:0xed63db,depthTest:false,depthWrite:false}));
   mesh.renderOrder=24;mesh.visible=false;mesh.name='Debug anchor '+(i+1);this.group.add(mesh);return mesh;
  });
  this.visible=true;this.group.visible=true;this.samples=[];this.events=[];
  this.lastRecord=0;this.lastState=null;this.planeAvailability='unknown';this.startedAt=null;
  this.onUpdate=null;
 }
 setVisible(show){this.visible=!!show;this.group.visible=this.visible;}
 start(){
  this.startedAt=new Date().toISOString();this.samples=[];this.events=[];this.lastRecord=0;this.lastState=null;
  this.nextPlaneId=1;this.clearPlanes();this.note('AR session started');
 }
 note(name,detail=null){
  this.events.push({time:new Date().toISOString(),event:name,...(detail?{detail}:{})});
  if(this.events.length>120)this.events.shift();
 }
 clearPlanes(){
  for(const entry of this.planes.values())this.removePlane(entry);
  this.planes.clear();
 }
 removePlane(entry){
  this.group.remove(entry.group);
  entry.mesh?.geometry.dispose();entry.outline?.geometry.dispose();
  entry.mesh?.material.dispose();entry.outline?.material.dispose();
 }
 makePlane(plane,points){
  const id=this.nextPlaneId++;
  const group=new THREE.Group();group.matrixAutoUpdate=false;
  const color=COLORS[(id-1)%COLORS.length];
  const mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.16,depthTest:false,depthWrite:false}));
  const outline=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color,transparent:true,opacity:1,depthTest:false,depthWrite:false}));
  mesh.renderOrder=20;outline.renderOrder=21;group.add(mesh,outline);
  this.group.add(group);
  const entry={id,group,mesh,outline,changed:null,stats:null};
  this.planes.set(plane,entry);
  this.rebuild(entry,points);
  return entry;
 }
 rebuild(entry,points){
  if(points.length<3||points.length>160)return;
  // XRPlane polygon vertices are expressed in planeSpace, with x/z in the plane.
  const shape=new THREE.Shape();
  points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));
  shape.closePath();
  const geo=new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2);
  const path=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,.007,p.z)));
  entry.mesh.geometry.dispose();entry.outline.geometry.dispose();
  entry.mesh.geometry=geo;entry.outline.geometry=path;
 }
 tick(frame,referenceSpace,studio,time){
  if(!this.startedAt||time-this.lastRecord<480)return;
  this.lastRecord=time;
  let viewer=null;
  try{viewer=frame.getViewerPose(referenceSpace)?.transform?.position||null;}catch{}
  const detected=frame.detectedPlanes;
  const supports=detected!==undefined&&detected!==null;
  this.planeAvailability=supports?'available':'unavailable';
  const live=new Set(),planeSummaries=[];
  if(supports){
   try{
    for(const plane of detected){
     const points=Array.from(plane.polygon||[]);
     let pose=null;try{pose=frame.getPose(plane.planeSpace,referenceSpace);}catch{}
     if(!pose||points.length<3)continue;
     live.add(plane);
     let entry=this.planes.get(plane);
     if(!entry)entry=this.makePlane(plane,points);
     if(entry.changed!==plane.lastChangedTime){this.rebuild(entry,points);entry.changed=plane.lastChangedTime;}
     entry.group.matrix.fromArray(pose.transform.matrix);
     entry.group.visible=true;
     const matrix=new THREE.Matrix4().fromArray(pose.transform.matrix);
     const center=new THREE.Vector3().setFromMatrixPosition(matrix);
     const normal=new THREE.Vector3(0,1,0).transformDirection(matrix);
     const info={id:entry.id,y:round(center.y),tiltDeg:angle(normal),areaM2:area(points),orientation:plane.orientation||'unknown',vertices:points.length,position:vec(center)};
     entry.stats=info;planeSummaries.push(info);
    }
    for(const [plane,entry] of this.planes)if(!live.has(plane)){this.removePlane(entry);this.planes.delete(plane);}
   }catch(error){this.planeAvailability='error: '+(error.name||'unknown');}
  }else this.clearPlanes();
  planeSummaries.sort((a,b)=>a.y-b.y);
  const anchors=[];
  for(let i=0;i<this.anchorMarkers.length;i++){
   const node=studio.anchorNodes[i],marker=this.anchorMarkers[i];
   marker.visible=false;
   if(!node)continue;
   let pose=null;try{pose=frame.getPose(node.anchor.anchorSpace,referenceSpace);}catch{}
   const tracked=frame.trackedAnchors?frame.trackedAnchors.has(node.anchor):!!pose;
   if(pose&&tracked){
    marker.position.set(pose.transform.position.x,pose.transform.position.y,pose.transform.position.z);
    marker.visible=true;
   }
   anchors.push({id:node.id,tracked,position:pose?vec(pose.transform.position):null});
  }
  const hits=(studio.scanner.currentHits||[]).slice(0,16).map(h=>({point:vec(h.point),accepted:h.accepted===true}));
  const sample={
   seconds:round((Date.now()-Date.parse(this.startedAt))/1000,1),
   tracking:!!viewer,camera:vec(viewer),
   floor:{locked:studio.model.locked,y:studio.model.locked?round(studio.model.origin.y):round(studio.scanner.point?.y),hitReady:studio.scanner.ready,raw:studio.scanner.rawHits,valid:studio.scanner.validHits,inliers:studio.scanner.inlierHits,scanPoint:vec(studio.scanner.point),hits},
   planesApi:this.planeAvailability,planeCount:planeSummaries.length,planes:planeSummaries.slice(0,16),
   anchors,anchorState:studio.anchorState,anchorYaw:round(studio.model.anchorYaw,4),
   floorOrigin:vec(studio.model.origin),
   floorCorrection:studio.initialFloorOrigin?round(studio.model.origin.y-studio.initialFloorOrigin[1]):null
  };
  this.lastState=sample;this.samples.push(sample);
  if(this.samples.length>720)this.samples.shift();
  this.onUpdate?.(sample);
 }
 exportLog(){
  return {type:'chidoset-diagnostics',version:'0.2.6',startedAt:this.startedAt,exportedAt:new Date().toISOString(),platform:navigator.userAgent,notes:'XR tracking-space coordinates in metres. No camera images/audio captured. Unsupported Plane Detection appears as unavailable.',events:this.events,samples:this.samples};
 }
 summary(){
  const s=this.lastState;
  if(!s)return 'در انتظار اولین فریم تشخیصی…';
  const p=s.planes;
  const lines=[
   'Tracking: '+(s.tracking?'OK':'LOST')+' · '+s.seconds+'s',
   'Camera Y: '+(s.camera?s.camera[1].toFixed(3):'—')+' m',
   'Floor: '+(s.floor.locked?'LOCKED':'SCANNING')+' · Y='+(s.floor.y??'—')+' m',
   'Hits: '+s.floor.raw+' raw / '+s.floor.valid+' valid / '+s.floor.inliers+' cluster',
   'Planes API: '+s.planesApi+' · '+s.planeCount+' detected',
   ...p.slice(0,6).map(v=>'P'+v.id+'  Y='+v.y+'m  tilt='+v.tiltDeg+'°  area='+v.areaM2+'m²'),
   'Anchors: '+s.anchors.filter(a=>a.tracked).length+'/'+s.anchors.length+' · '+s.anchorState,
   'Anchor Y correction: '+(s.floorCorrection===null?'—':round(s.floorCorrection*100,1)+'cm')
  ];
  if(s.planeCount>6)lines.push('… '+(s.planeCount-6)+' other planes in JSON');
  if(s.planesApi==='unavailable')lines.push('Plane Detection not exposed by this browser/session');
  return lines.join('\n');
 }
 dispose(){
  this.clearPlanes();
  for(const m of this.anchorMarkers){this.group.remove(m);m.material.dispose();}
  this.anchorGeometry.dispose();this.scene.remove(this.group);
 }
}
