import * as THREE from './vendor/three.module.js';
import {cm,distance,wallLength,nearestWall,snapPoint,closestFloorEdge,validPolygon,normalizedWindow,windowIntersects,updateWindow,validArchitecture} from './architecture-geometry.js?v=0.9.0';
import {finishMaterial,FLOOR_FINISHES,WALL_FINISHES,floorFinish} from './architecture-materials.js';
import {FloorReflection} from './floor-reflection.js';

const axis=new THREE.Vector3(0,1,0);
const point=(x,z)=>new THREE.Vector3(x,.012,z);
export class ArchitectureLayer {
 constructor(root,changed){
  this.root=root;this.changed=changed;this.group=new THREE.Group();this.group.name='Chido architecture';root.add(this.group);
  this.data={floor:[],walls:[],windows:[],floorMaterial:'ceramic-cream',wallMaterial:'wall-ivory'};this.mode=null;this.draft=[];this.wallStart=null;
  this.wallPreview=null;this.hoverPoint=null;this.selectedRef=null;this.selectedWindow=null;
  this.previewGroup=new THREE.Group();this.previewGroup.name='Architectural placement preview';root.add(this.previewGroup);
  this.handles=[];this.serial=0;this.refresh();
 }
 attachRenderer(renderer,scene){this.reflection=new FloorReflection(renderer,scene);this.refresh();}
 snapshot(){return structuredClone(this.data);}
 restore(data){
  if(!validArchitecture(data))return;
  this.data={floorMaterial:'ceramic-cream',wallMaterial:'wall-ivory',...structuredClone(data)};this.serial=Math.max(0,...this.data.walls.concat(this.data.windows).map(x=>Number(String(x.id).split('-').pop())||0));
  this.mode=null;this.draft=[];this.wallStart=null;this.wallPreview=null;this.hoverPoint=null;this.selectedWindow=null;this.selectedRef=null;this.refresh();this.onSelectionChange?.();
 }
 setMode(mode){
  this.mode=this.mode===mode?null:mode;this.draft=[];this.wallStart=null;this.wallPreview=null;this.hoverPoint=null;this.refresh();
  return this.mode;
 }
 snap(p){const walls=snapPoint(p,this.data.walls);return closestFloorEdge(walls,this.data.floor)||walls;}
 tap(p){
  if(!this.mode)return false;
  p=this.snap(p);
  if(this.mode==='floor'){
   if(this.draft.length>=3&&distance(p,this.draft[0])<.22)return this.finish();
   if(this.draft.length&&distance(p,this.draft[this.draft.length-1])<.06)return false;
   if(this.draft.length>=64)return false;
   this.draft.push(p);this.refresh();return true;
  }
  if(this.mode==='wall'){
   if(!this.wallStart){this.wallStart=p;this.wallPreview=null;this.refresh();return true;}
   if(distance(p,this.wallStart)<.1)return false;
   this.wallPreview=p;this.refresh();return true;
  }
    if(this.mode==='window'){
   const match=nearestWall(this.data.walls,p,.48);if(!match)return false;
   const w=match.wall;let next;
   try{next=normalizedWindow({id:'window-'+(++this.serial),along:match.along,width:1.2,height:1.2,sill:.9},w);}
   catch{return false;}
   if(windowIntersects(next,this.data.windows))return false;
   this.data.windows.push(next);this.selectedWindow=next.id;this.selectedRef={kind:'window',id:next.id};this.refresh();this.onSelectionChange?.();this.changed?.();return true;
  }
  return false;
 }
 // A preview is committed only after the dedicated confirmation button.
 confirmWall(){
  if(this.mode!=='wall'||!this.wallStart||!this.wallPreview)return false;
  const a=this.wallStart,b=this.wallPreview;
  if(distance(a,b)<.1||this.data.walls.length>=80)return false;
  const exists=this.data.walls.some(w=>(distance(a,{x:w.x1,z:w.z1})<.02&&distance(b,{x:w.x2,z:w.z2})<.02)||(distance(b,{x:w.x1,z:w.z1})<.02&&distance(a,{x:w.x2,z:w.z2})<.02));
  if(!exists)this.data.walls.push({id:'wall-'+(++this.serial),x1:a.x,z1:a.z,x2:b.x,z2:b.z,height:3,thickness:.12});
  this.wallStart=b;this.wallPreview=null;this.hoverPoint=null;this.refresh();this.changed?.();return true;
 }
 cancelPlacement(){this.draft=[];this.wallStart=null;this.wallPreview=null;this.hoverPoint=null;this.mode=null;this.refresh();}
 hover(point){
  if(!['floor','wall'].includes(this.mode))return;
  const next=point?this.snap(point):null;
  if(!next&&this.hoverPoint===null)return;
  if(next&&this.hoverPoint&&distance(next,this.hoverPoint)<.015)return;
  this.hoverPoint=next;this.drawPreview();
 }
 drawPreview(){
  while(this.previewGroup.children.length){
   const o=this.previewGroup.children[0];this.previewGroup.remove(o);
   o.traverse(n=>{n.geometry?.dispose();if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose());});
  }
  if(!this.mode)return;
  const p=this.wallPreview||this.hoverPoint;
  if(p){
   const marker=new THREE.Mesh(new THREE.TorusGeometry(.12,.012,8,32).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0x3de5b2,depthTest:false}));
   marker.position.set(p.x,.025,p.z);marker.renderOrder=46;this.previewGroup.add(marker);
  }
  if(this.mode==='wall'&&this.wallStart){
   const a=this.wallStart,b=p||a;
   const anchor=new THREE.Mesh(new THREE.SphereGeometry(.056,10,8),new THREE.MeshBasicMaterial({color:0xffbb78,depthTest:false}));
   anchor.position.set(a.x,.048,a.z);anchor.renderOrder=46;this.previewGroup.add(anchor);
   const len=distance(a,b);if(len>.05){
    const preview=new THREE.Mesh(new THREE.BoxGeometry(len,3,.12),new THREE.MeshBasicMaterial({color:0x7eceb4,transparent:true,opacity:.35,depthWrite:false}));
    preview.position.set((a.x+b.x)/2,1.5,(a.z+b.z)/2);
    preview.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);preview.renderOrder=20;this.previewGroup.add(preview);
   }
  }
 }
 selectedSurface(){return this.selectedRef;}
 clearSurface(){if(!this.selectedRef&&!this.selectedWindow)return;this.selectedRef=null;this.selectedWindow=null;this.refresh();this.onSelectionChange?.();}
 pickSurface(ray){
  const hits=ray.intersectObjects(this.group.children,true);
  const hit=hits.find(h=>h.object.userData.archKind);
  if(!hit)return false;
  const {archKind:kind,archId:id}=hit.object.userData;
  this.selectedRef={kind,id};this.selectedWindow=kind==='window'?id:null;
  this.refresh();this.onSelectionChange?.();return true;
 }
 setSelectedFinish(id){
  const selected=this.selectedRef;if(!selected)return false;
  if(selected.kind==='floor'&&FLOOR_FINISHES.some(x=>x.id===id))this.data.floorMaterial=id;
  else if(selected.kind==='wall'&&WALL_FINISHES.some(x=>x.id===id)){
   const w=this.data.walls.find(w=>w.id===selected.id);if(!w)return false;w.material=id;
  }else return false;
  this.refresh();this.changed?.();return true;
 }
 deleteSelected(){
  const selected=this.selectedRef;if(!selected)return false;
  if(selected.kind==='floor')this.data.floor=[];
  else if(selected.kind==='wall'){
   this.data.walls=this.data.walls.filter(w=>w.id!==selected.id);
   this.data.windows=this.data.windows.filter(w=>w.hostId!==selected.id);
  }else if(selected.kind==='window')this.data.windows=this.data.windows.filter(w=>w.id!==selected.id);
  else return false;
  this.selectedRef=null;this.selectedWindow=null;this.refresh();this.onSelectionChange?.();this.changed?.();return true;
 }
 finish(){
  if(this.mode==='floor'&&this.draft.length){
   if(!validPolygon(this.draft))return false;
   this.data.floor=this.draft.map(x=>({...x}));this.changed?.();
  }
  this.draft=[];this.wallStart=null;this.wallPreview=null;this.hoverPoint=null;this.mode=null;this.refresh();return true;
 }
 undo(){
  if(this.mode==='floor'&&this.draft.length)this.draft.pop();
  else if(this.mode==='wall'&&this.wallPreview){this.wallPreview=null;}
  else if(this.mode==='wall'&&this.wallStart){this.wallStart=null;}
  else if(this.mode==='wall'&&this.data.walls.length){const removed=this.data.walls.pop();this.data.windows=this.data.windows.filter(w=>w.hostId!==removed.id);this.changed?.();}
  else if(this.mode==='window'&&this.data.windows.length){this.data.windows.pop();this.selectedWindow=null;this.changed?.();}
  else return false;
  this.refresh();return true;
 }
 selected(){return this.data.windows.find(w=>w.id===this.selectedWindow)||null;}
 editSelected(values){
  const old=this.selected(),wall=this.data.walls.find(w=>w.id===old?.hostId);if(!wall)return false;
  const next=normalizedWindow({...old,...values},wall);
  if(windowIntersects(next,this.data.windows))return false;
  Object.assign(old,next);this.refresh();this.changed?.();return true;
 }
 removeSelected(){
  if(!this.selectedWindow)return false;
  this.data.windows=this.data.windows.filter(w=>w.id!==this.selectedWindow);
  this.selectedWindow=null;this.selectedRef=null;this.refresh();this.onSelectionChange?.();this.changed?.();return true;
 }
 makeBox(group,w,a,b,y0,y1,thickness,mat,owner=null){
  if(b-a<.002||y1-y0<.002)return;
  const len=wallLength(w),ux=(w.x2-w.x1)/len,uz=(w.z2-w.z1)/len,along=(a+b)/2;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(b-a,y1-y0,thickness),mat.clone());
  mesh.position.set(w.x1+ux*along,(y0+y1)/2,w.z1+uz*along);
  mesh.rotation.y=-Math.atan2(uz,ux);mesh.userData.archWindow=owner;mesh.userData.archKind=owner?'window':'wall';mesh.userData.archId=owner||w.id;group.add(mesh);return mesh;
 }
 refresh(){
  this.reflection?.detach();this.floorMesh=null;
  while(this.group.children.length){
   const object=this.group.children[0];this.group.remove(object);
   object.traverse(n=>{n.geometry?.dispose();const m=n.material;if(m)for(const a of Array.isArray(m)?m:[m])a.dispose();});
  }
  this.handles=[];
  const floor=this.data.floor;
  if(floor.length>=3&&validPolygon(floor)){
   const shape=new THREE.Shape();floor.forEach((p,i)=>i?shape.lineTo(p.x,p.z):shape.moveTo(p.x,p.z));shape.closePath();
   const geo=new THREE.ShapeGeometry(shape);geo.rotateX(Math.PI/2);
   const surface=new THREE.Mesh(geo,finishMaterial(this.data.floorMaterial));
   surface.position.y=-.008;surface.receiveShadow=true;surface.renderOrder=-1;surface.userData.archKind='floor';surface.userData.archId='floor';this.group.add(surface);
   this.floorMesh=surface;
  }
  if(!floor.length)this.floorMesh=null;
  const frameMat=new THREE.MeshStandardMaterial({color:0x8d9799,roughness:.54,metalness:.32});
  for(const w of this.data.walls){
   const len=wallLength(w);if(len<.1)continue;
   const wallMat=finishMaterial(w.material||this.data.wallMaterial);
   const openings=this.data.windows.filter(o=>o.hostId===w.id).sort((a,b)=>a.along-b.along);
   const container=new THREE.Group();container.userData.wallId=w.id;this.group.add(container);
   let before=0;
   for(const o of openings){
    const left=Math.max(0,o.along-o.width/2),right=Math.min(len,o.along+o.width/2);
    this.makeBox(container,w,before,left,0,w.height,w.thickness,wallMat);
    this.makeBox(container,w,left,right,0,o.sill,w.thickness,wallMat);
    this.makeBox(container,w,left,right,o.sill+o.height,w.height,w.thickness,wallMat);
    // Reuse the application's AR architecture renderer for authored rooms.
    if(o.kind==='window'){
     const glass=new THREE.MeshPhysicalMaterial({color:'#e9f7ff',roughness:.06,metalness:.02,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
     this.makeBox(container,w,left+.045,right-.045,o.sill+.045,o.sill+o.height-.045,.018,glass,o.id);
     glass.dispose();
    }
    if(o.kind==='door'||o.kind==='kitchen'){
     const len=wallLength(w),ux=(w.x2-w.x1)/len,uz=(w.z2-w.z1)/len;
     const cx=w.x1+ux*o.along,cz=w.z1+uz*o.along;
     const normal={north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]}[o.wall]||[0,0];
     const depth=o.kind==='door'?1.55:2.10;
     const hallwayWidth=o.width+(o.kind==='door'?1.0:.55);
     const hallwayFloor=new THREE.Mesh(new THREE.BoxGeometry(hallwayWidth,.10,depth),finishMaterial('ceramic-cream'));
     hallwayFloor.position.set(cx+normal[0]*(depth/2+.14),-.05,cz+normal[1]*(depth/2+.14));
     hallwayFloor.rotation.y=-Math.atan2(uz,ux);
     hallwayFloor.receiveShadow=true;container.add(hallwayFloor);
     const back=new THREE.Mesh(new THREE.BoxGeometry(hallwayWidth,w.height,.14),wallMat.clone());
     back.rotation.y=-Math.atan2(uz,ux);
     back.position.set(cx+normal[0]*(depth+.14),w.height/2,cz+normal[1]*(depth+.14));
     back.receiveShadow=true;container.add(back);
     if(o.kind==='door'){
      const doorMat=new THREE.MeshStandardMaterial({color:'#634732',roughness:.52});
      const leaf=this.makeBox(container,w,left+.06,right-.06,.035,o.height-.05,.055,doorMat,o.id);
      if(leaf){leaf.position.x+=normal[0]*.055;leaf.position.z+=normal[1]*.055;leaf.castShadow=true;}
      doorMat.dispose();
     }else{
      const base=new THREE.MeshStandardMaterial({color:'#5a493d',roughness:.54});
      const top=new THREE.MeshPhysicalMaterial({color:'#f0e8dc',roughness:.24,metalness:.02,clearcoat:.35});
      this.makeBox(container,w,left+.04,right-.04,0,.89,.62,base);
      this.makeBox(container,w,left,right,.89,.95,.70,top);
      base.dispose();top.dispose();
     }
    }
    const edge=Math.min(.05,o.width/8,o.height/8),t=w.thickness+.02;
    this.makeBox(container,w,left,left+edge,o.sill,o.sill+o.height,t,frameMat,o.id);
    this.makeBox(container,w,right-edge,right,o.sill,o.sill+o.height,t,frameMat,o.id);
    this.makeBox(container,w,left,right,o.sill,o.sill+edge,t,frameMat,o.id);
    this.makeBox(container,w,left,right,o.sill+o.height-edge,o.sill+o.height,t,frameMat,o.id);
    before=right;
   }
   this.makeBox(container,w,before,len,0,w.height,w.thickness,wallMat);
   for(const feature of this.data.features||[]){
    if(feature.kind!=='tv'||feature.wall!==w.id.replace(/^room-/,'')||!Number.isFinite(feature.u))continue;
    const pos=feature.u,half=(feature.width||2.2)/2;
    const panelMat=new THREE.MeshStandardMaterial({color:'#534131',roughness:.46,metalness:.02});
    const screenMat=new THREE.MeshStandardMaterial({color:'#161b20',roughness:.12,metalness:.12,emissive:'#244c64',emissiveIntensity:.48});
    const consoleMat=new THREE.MeshPhysicalMaterial({color:'#74533b',roughness:.3,metalness:.02,clearcoat:.28});
    const slab=this.makeBox(container,w,pos-half,pos+half,.1,2.96,.065,panelMat);
    const screen=this.makeBox(container,w,pos-.91,pos+.91,1.12,2.18,.08,screenMat);
    const consoleBox=this.makeBox(container,w,pos-1.0,pos+1.0,.22,.53,.42,consoleMat);
    const nx=feature.wall==='west'?1:feature.wall==='east'?-1:0;
    const nz=feature.wall==='north'?1:feature.wall==='south'?-1:0;
    for(const [mesh,offset] of [[slab,.16],[screen,.22],[consoleBox,.39]]){
     if(mesh){mesh.position.x+=nx*offset;mesh.position.z+=nz*offset;mesh.castShadow=true;mesh.receiveShadow=true;}
    }
    panelMat.dispose();screenMat.dispose();consoleMat.dispose();
   }
   wallMat.dispose();
  }
  frameMat.dispose();
  const guideMat=new THREE.LineBasicMaterial({color:0x42ad8e,depthTest:false});
  const pts=this.mode==='floor'?this.draft:this.mode==='wall'&&this.wallStart?[this.wallStart]:[];
  if(pts.length){
   const points=pts.map(p=>point(p.x,p.z));if(this.mode==='floor'&&pts.length>2)points.push(point(pts[0].x,pts[0].z));
   if(points.length>=2){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),guideMat.clone());line.renderOrder=30;this.group.add(line);}
   for(const p of pts){const mark=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),new THREE.MeshBasicMaterial({color:0x32b990,depthTest:false}));mark.position.copy(point(p.x,p.z));mark.renderOrder=30;this.group.add(mark);}
  }
  guideMat.dispose();
  const selected=this.selected();
  if(selected){
   const w=this.data.walls.find(w=>w.id===selected.hostId);if(w){
    const len=wallLength(w),ux=(w.x2-w.x1)/len,uz=(w.z2-w.z1)/len,off=w.thickness/2+.07;
    const p=(along,y)=>new THREE.Vector3(w.x1+ux*along-uz*off,y,w.z1+uz*along+ux*off);
    for(const [name,along,y] of [
     ['left',selected.along-selected.width/2,selected.sill+selected.height/2],
     ['right',selected.along+selected.width/2,selected.sill+selected.height/2],
     ['top',selected.along,selected.sill+selected.height],
     ['bottom',selected.along,selected.sill],
     ['centre',selected.along,selected.sill+selected.height/2]
    ]){
     const m=new THREE.Mesh(new THREE.SphereGeometry(.065,12,10),new THREE.MeshBasicMaterial({color:name==='centre'?0xffc27d:0x4fcfa9,depthTest:false}));
     m.position.copy(p(along,y));m.renderOrder=35;m.userData.archHandle=name;this.group.add(m);this.handles.push(m);
    }
   }
  }
  this.drawPreview();
  if(this.floorMesh&&floorFinish(this.data.floorMaterial).kind==='ceramic')this.reflection?.attach(this.floorMesh,this.group);
 }
 pickHandle(e,target,camera){
  if(!this.handles.length)return null;
  this.root.updateWorldMatrix(true,true);
  const rect=target.getBoundingClientRect();let best=null,min=42;
  for(const m of this.handles){
   const p=m.getWorldPosition(new THREE.Vector3()).project(camera);
   if(p.z< -1||p.z>1)continue;
   const d=Math.hypot(rect.left+(p.x+1)*rect.width/2-e.clientX,rect.top+(1-p.y)*rect.height/2-e.clientY);
   if(d<min){min=d;best=m.userData.archHandle;}
  }
  return best;
 }
 pickWindow(ray){
  const hits=ray.intersectObjects(this.group.children,true);
  const found=hits.find(h=>h.object.userData.archWindow);
  const id=found?.object.userData.archWindow;
  if(!id)return false;
  this.selectedWindow=id;this.selectedRef={kind:'window',id};this.refresh();this.onSelectionChange?.();return true;
 }
 dragHandle(handle,worldRay){
  const win=this.selected(),w=this.data.walls.find(w=>w.id===win?.hostId);if(!w)return false;
  this.root.updateWorldMatrix(true,false);
  const localRay=worldRay.clone().applyMatrix4(this.root.matrixWorld.clone().invert());
  const len=wallLength(w),ux=(w.x2-w.x1)/len,uz=(w.z2-w.z1)/len;
  const normal=new THREE.Vector3(-uz,0,ux);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(w.x1,0,w.z1));
  const hit=localRay.intersectPlane(plane,new THREE.Vector3());if(!hit)return false;
  const along=(hit.x-w.x1)*ux+(hit.z-w.z1)*uz;
  const next=updateWindow(win,w,this.data.windows,handle,along,hit.y);
  if(next===win)return false;
  Object.assign(win,next);this.refresh();this.changed?.();return true;
 }
 dispose(){this.reflection?.dispose();this.reflection=null;this.root.remove(this.group);this.root.remove(this.previewGroup);this.data={floor:[],walls:[],windows:[]};}
}
