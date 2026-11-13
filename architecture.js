import * as THREE from './vendor/three.module.js';
import {cm,distance,wallLength,nearestWall,snapPoint,closestFloorEdge,validPolygon,normalizedWindow,windowIntersects,updateWindow,validArchitecture} from './architecture-geometry.js?v=0.9.0';
import {finishMaterial,applyMetricFloorUV,FLOOR_FINISHES,WALL_FINISHES,floorFinish} from './architecture-materials.js?v=0.18.7';
import {FloorReflection} from './floor-reflection.js';
import {geminiFloorMaterial,geminiConsoleMaterial,makeGeminiTVScreenMaterial,setGeminiTVChannel,setGeminiTVOn} from './gemini-room-materials.js?v=0.18.7';

const axis=new THREE.Vector3(0,1,0);
const point=(x,z)=>new THREE.Vector3(x,.012,z);
export class ArchitectureLayer {
 constructor(root,changed){
  this.root=root;this.changed=changed;this.group=new THREE.Group();this.group.name='Chido architecture';root.add(this.group);
  this.data={floor:[],walls:[],windows:[],floorMaterial:'ceramic-cream',wallMaterial:'wall-ivory'};this.mode=null;this.draft=[];this.wallStart=null;
  this.wallPreview=null;this.hoverPoint=null;this.selectedRef=null;this.selectedWindow=null;
  this.previewGroup=new THREE.Group();this.previewGroup.name='Architectural placement preview';root.add(this.previewGroup);
  this.handles=[];this.serial=0;this.reflectionAllowed=true;this.refresh();
 }
 attachRenderer(renderer,scene){this.reflection=new FloorReflection(renderer,scene);this.refresh();}
 setReflectionAllowed(value){const enabled=!!value;if(this.reflectionAllowed===enabled)return;this.reflectionAllowed=enabled;this.reflection?.detach();if(enabled&&this.floorMesh&&floorFinish(this.data.floorMaterial).kind==='ceramic')this.reflection?.attach(this.floorMesh,this.group);}
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
  mesh.rotation.y=-Math.atan2(uz,ux);mesh.userData.archWindow=owner;mesh.userData.archKind=owner?'window':'wall';mesh.userData.archId=owner||w.id;
  if(!owner&&mat.normalMap&&mat.map){
   // Plaster micro-detail is anchored to physical metres: long wall segments
   // must not stretch a single texture across their entire length.
   const geometry=mesh.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
   const rx=Math.max(.01,mat.map.repeat?.x||1),ry=Math.max(.01,mat.map.repeat?.y||1);
   for(let i=0;i<positions.count;i++){
    const nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i));
    const u=nx>.5?positions.getZ(i):positions.getX(i);
    const v=ny>.5?positions.getZ(i):positions.getY(i);
    uv.setXY(i,u/(.75*rx),v/(.75*ry));
   }
   uv.needsUpdate=true;
  }
  if(!owner)mesh.layers.enable(2); // visible in normal scene and in the wall-only GTAO mask
  group.add(mesh);return mesh;
 }
 makeGeminiWindow(parent,wall,opening){
  const length=wallLength(wall),ux=(wall.x2-wall.x1)/length,uz=(wall.z2-wall.z1)/length;
  const group=new THREE.Group();
  group.position.set(wall.x1+ux*opening.along,0,wall.z1+uz*opening.along);
  group.rotation.y=-Math.atan2(uz,ux);
  const width=opening.width,sill=opening.sill,height=opening.height,depth=wall.thickness+.02,thick=.055;
  const face=['north','east'].includes(opening.wall)?1:-1;
  const frameMat=new THREE.MeshStandardMaterial({color:0x1b1e23,roughness:.35,metalness:.78});
  const bar=(w,h,d,x,y,z)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),frameMat);
   mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  };
  bar(width,thick,depth,0,sill+height-thick/2,0);
  bar(width,thick,depth,0,sill+thick/2,0);
  bar(thick,height,depth,-width/2+thick/2,sill+height/2,0);
  bar(thick,height,depth,width/2-thick/2,sill+height/2,0);
  const divisions=width>=2.2?3:2;
  for(let i=1;i<divisions;i++)bar(.038,height,depth*.8,-width/2+width*i/divisions,sill+height/2,0);
  const glassMat=new THREE.MeshPhysicalMaterial({color:0xf5fbff,transparent:true,opacity:.052,
   roughness:.018,metalness:0,reflectivity:.88,envMapIntensity:1.65,
   clearcoat:.9,clearcoatRoughness:.045,side:THREE.DoubleSide,depthWrite:false});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(width-thick*2,height-thick*2),glassMat);
  glass.position.y=sill+height/2;group.add(glass);
  const curtainMat=new THREE.MeshStandardMaterial({color:0xf7f3eb,roughness:.92,
   transparent:true,opacity:.39,side:THREE.DoubleSide});
  const curtainW=Math.min(.42,width*.25),curtainH=2.92;
  const curtainGeo=new THREE.PlaneGeometry(curtainW,curtainH,10,4);
  const pos=curtainGeo.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*36)*.025);
  curtainGeo.computeVertexNormals();
  const curtain=new THREE.Mesh(curtainGeo,curtainMat);
  curtain.position.set(-width/2+curtainW*.4,curtainH/2+.05,face*(wall.thickness/2+.08));
  curtain.castShadow=true;group.add(curtain);
  group.userData.archWindow=opening.id;
  parent.add(group);
 }
 makeGeminiKitchen(parent,wall,opening){
  const length=wallLength(wall),ux=(wall.x2-wall.x1)/length,uz=(wall.z2-wall.z1)/length;
  const group=new THREE.Group();
  group.position.set(wall.x1+ux*opening.along,0,wall.z1+uz*opening.along);
  group.rotation.y=-Math.atan2(uz,ux);
  const face=['north','east'].includes(opening.wall)?1:-1;
  const W=opening.width,H=opening.height,depth=wall.thickness;
  const part=(geo,mat,x,y,z,cast=false)=>{
   const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,face*z);
   mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  const baseMat=new THREE.MeshStandardMaterial({color:0x3b281c,roughness:.45});
  const topMat=new THREE.MeshPhysicalMaterial({color:0xf4f1ea,roughness:.18,metalness:.03,
   clearcoat:.6,clearcoatRoughness:.15});
  const counterW=W-.06,counterH=.92,counterD=.68;
  part(new THREE.BoxGeometry(counterW-.1,counterH-.05,counterD-.06),baseMat,0,(counterH-.05)/2,.08,true);
  part(new THREE.BoxGeometry(counterW,.055,counterD),topMat,0,counterH-.025,.08,true);
  for(const x of [-counterW/2+.028,counterW/2-.028])
   part(new THREE.BoxGeometry(.055,counterH,counterD),topMat,x,counterH/2,.08,true);
  const seatMat=new THREE.MeshStandardMaterial({color:0xc89d6c,roughness:.65});
  const metal=new THREE.MeshStandardMaterial({color:0x1e2024,roughness:.35,metalness:.8});
  const gold=new THREE.MeshStandardMaterial({color:0xd4af37,roughness:.25,metalness:.85});
  for(const x of [-.85,0,.85]){
   part(new THREE.CylinderGeometry(.17,.16,.06,20),seatMat,x,.66,.54,true);
   part(new THREE.CylinderGeometry(.02,.025,.64,12),metal,x,.32,.54);
   part(new THREE.CylinderGeometry(.14,.15,.02,16),metal,x,.01,.54);
   part(new THREE.CylinderGeometry(.005,.005,.58,8),metal,x,H-.29,.08);
   part(new THREE.ConeGeometry(.11,.14,20),gold,x,H-.60,.08);
  }
  const backD=2.1,marble=geminiFloorMaterial('marble'),plaster=finishMaterial(this.data.wallMaterial);
  part(new THREE.BoxGeometry(W+.6,.1,backD),marble,0,-.05,-backD/2-depth/2);
  part(new THREE.BoxGeometry(W+.6,.12,backD),plaster,0,3.16,-backD/2-depth/2);
  part(new THREE.BoxGeometry(W+.6,3.1,.15),plaster,0,1.55,-backD-depth/2);
  const cabinet=new THREE.MeshStandardMaterial({color:0xe6dfd3,roughness:.35});
  part(new THREE.BoxGeometry(W,.88,.58),cabinet,0,.44,-backD+.22);
  part(new THREE.BoxGeometry(W,.72,.36),baseMat,0,2.12,-backD+.12);
  // No artificial kitchen point source: window daylight and global sky fill it.
  group.userData.archKind='kitchen';group.userData.archId=opening.id;
  parent.add(group);
 }
 applyRoomLookSettings(look){
  if(!this.data.designedRoom)return false;
  this.data.roomLook={...(this.data.roomLook||{}),...look};
  const daylight=this.data.roomLook.daylight??1;
  const detail=this.data.roomLook.plasterDetail??1;
  this.group.traverse(node=>{
   if(node.userData?.roomWindowLight)node.intensity=node.userData.roomBaseIntensity*daylight;
   if(node.userData?.archKind==='wall'&&node.material?.normalScale)
    node.material.normalScale.set(.56*detail,.56*detail);
  });
  return true;
 }
 pickTelevision(ray){
  if(!this.data.designedRoom||!this.group.visible)return null;
  const tvGroups=[];
  this.group.traverse(node=>{if(node.userData?.archKind==='tv'&&node.userData?.archId)tvGroups.push(node);});
  if(!tvGroups.length)return null;
  const hits=ray.intersectObjects(tvGroups,true);
  for(const hit of hits){
   let node=hit.object;
   while(node&&node!==this.group){
    if(node.userData?.archKind==='tv')return node.userData.archId;
    node=node.parent;
   }
  }
  return null;
 }
 makeGeminiTelevision(container,wall,feature){
  // The panel geometry, proportions and surfaces follow the original Gemini
  // 85-inch TV feature wall, but live in Chido's tracked architecture group.
  const length=wallLength(wall),ux=(wall.x2-wall.x1)/length,uz=(wall.z2-wall.z1)/length;
  const group=new THREE.Group();
  group.position.set(wall.x1+ux*feature.u,0,wall.z1+uz*feature.u);
  group.rotation.y=-Math.atan2(uz,ux);
  // Wall normals depend on both the wall ordering and which side is interior.
  const front=['north','east'].includes(feature.wall)?1:-1;
  const z=v=>front*v;
  const panelW=feature.width||2.2,offset=wall.thickness/2;
  const piece=(width,height,depth,x,y,frontDepth,mat,cast=false)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat.clone());
   mesh.position.set(x,y,z(offset+frontDepth));mesh.castShadow=cast;mesh.receiveShadow=true;
   group.add(mesh);return mesh;
  };
  const walnut=new THREE.MeshStandardMaterial({color:0x4b2f1d,roughness:.48});
  const count=Math.max(5,Math.floor(panelW/.065));
  for(let i=0;i<count;i++){
   const sx=-panelW/2+.032+i*panelW/count;
   piece(.036,2.92,.03,sx,1.54,.015,walnut,true);
  }
  const halo=new THREE.MeshStandardMaterial({color:0xffdfb0,emissive:0xffc670,emissiveIntensity:1.5,roughness:.5});
  const slab=new THREE.MeshStandardMaterial({color:0x1d2025,roughness:.32,metalness:.1});
  const bezel=new THREE.MeshStandardMaterial({color:0x0e1014,roughness:.25,metalness:.7});
  const gold=new THREE.MeshStandardMaterial({color:0xd4af37,roughness:.24,metalness:.88});
  const soundbar=new THREE.MeshStandardMaterial({color:0x181a1f,roughness:.4,metalness:.4});
  const consoleMat=geminiConsoleMaterial(this.data.tvSettings?.consoleFinish||'walnut');
  const slabW=panelW*.78,slabY=1.48,slabH=1.65;
  piece(slabW+.04,slabH+.04,.018,0,slabY,.032,halo);
  piece(slabW,slabH,.032,0,slabY,.048,slab,true);
  const tvW=Math.min(1.88,panelW*.85),tvH=tvW*9/16;
  piece(tvW+.03,tvH+.03,.035,0,slabY+.03,.075,bezel,true);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(tvW,tvH),makeGeminiTVScreenMaterial());
  screen.position.set(0,slabY+.03,z(offset+.095));
  if(front<0)screen.rotation.y=Math.PI;
  group.add(screen);
  const conW=panelW*.92,conD=.42;
  piece(conW,.34,conD,0,.34,conD/2+.02,consoleMat,true);
  piece(conW-.04,.016,.012,0,.34,conD+.024,gold);
  piece(conW*.52,.065,.09,-.12,.54,conD*.55,soundbar,true);
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(.11,20,16),gold.clone());
  sphere.position.set(conW*.32,.62,z(offset+conD*.52));sphere.castShadow=true;group.add(sphere);
  for(const material of [walnut,halo,slab,bezel,gold,soundbar,consoleMat])material.dispose();
  group.userData.archKind='tv';group.userData.archId=feature.id;
  container.add(group);
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
   let geo,surface;
   if(this.data.designedRoom&&floor.length===4){
    // Gemini uses a solid 14cm floor slab with its texture over 0..1 UVs.
    const width=Math.abs(floor[1].x-floor[0].x),depth=Math.abs(floor[2].z-floor[1].z);
    geo=new THREE.BoxGeometry(width+.4,.14,depth+.4);
    const material=finishMaterial(this.data.floorMaterial);
    applyMetricFloorUV(geo,this.data.floorMaterial,material);
    surface=new THREE.Mesh(geo,material);
    surface.position.y=-.07;
   }else{
    const shape=new THREE.Shape();floor.forEach((p,i)=>i?shape.lineTo(p.x,p.z):shape.moveTo(p.x,p.z));shape.closePath();
    geo=new THREE.ShapeGeometry(shape);geo.rotateX(Math.PI/2);
    const material=finishMaterial(this.data.floorMaterial);
    applyMetricFloorUV(geo,this.data.floorMaterial,material);
    surface=new THREE.Mesh(geo,material);surface.position.y=-.008;
   }
   surface.receiveShadow=!this.data.designedRoom;surface.renderOrder=-2;surface.userData.archKind='floor';surface.userData.archId='floor';
   this.group.add(surface);this.floorMesh=surface;
  }
  if(!floor.length)this.floorMesh=null;
  if(this.data.designedRoom&&floor.length===4){
   const width=Math.abs(floor[1].x-floor[0].x),depth=Math.abs(floor[2].z-floor[1].z),height=3.0;
   const plaster=finishMaterial(this.data.wallMaterial);
   const roof=new THREE.Mesh(new THREE.BoxGeometry(width+.6,.12,depth+.6),plaster.clone());
   roof.position.y=height+.06;roof.castShadow=false;roof.receiveShadow=true;this.group.add(roof);
   // Daytime room: cove is subtle trim, not a nighttime emissive light.
   const cove=new THREE.MeshStandardMaterial({color:0xf8f5ef,emissive:0xffffff,emissiveIntensity:.015,roughness:.93,metalness:0});
   for(const [x,z,w,d] of [[0,-depth/2,width-.15,.045],[0,depth/2,width-.15,.045],[-width/2,0,.045,depth-.15],[width/2,0,.045,depth-.15]]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.1,w),.018,Math.max(.1,d)),cove.clone());
    bar.position.set(x,height-.06,z);bar.castShadow=false;bar.receiveShadow=false;this.group.add(bar);
   }
   cove.dispose();plaster.dispose();
   // Ambient daylight makes window-free rooms readable without artificial
   // overhead or point-light hot spots on the parquet.
   const daylight=new THREE.HemisphereLight(0xe8f3ff,0xc2b6a2,1.0+(.2*(this.data.roomLook?.daylight||1)));
   this.group.add(daylight);
   // Each actual glazed opening is a daylight source. Directions point from
   // outdoors through the opening into the room, rather than from the ceiling.
   const glazed=this.data.windows.filter(o=>o.kind==='window');
   for(const window of glazed.slice(0,4)){
    const wall=this.data.walls.find(w=>w.id===window.hostId);if(!wall)continue;
    const length=wallLength(wall);if(length<.1)continue;
    const dx=(wall.x2-wall.x1)/length,dz=(wall.z2-wall.z1)/length;
    const x=wall.x1+dx*window.along,z=wall.z1+dz*window.along;
    const inward={'north':[0,1],'south':[0,-1],'west':[1,0],'east':[-1,0]}[window.wall]||[0,1];
    const baseIntensity=Math.min(6.5,4.0+window.width*.65);
    const sun=new THREE.DirectionalLight(0xeef6ff,baseIntensity*(this.data.roomLook?.daylight||1));
    sun.userData.roomWindowLight=true;sun.userData.roomBaseIntensity=baseIntensity;
    const atY=Math.min(height-.2,window.sill+window.height*.62);
    sun.position.set(x-inward[0]*1.3,atY+.65,z-inward[1]*1.3);
    sun.target.position.set(x+inward[0]*Math.min(2.4,width*.5),1.0,z+inward[1]*Math.min(2.4,depth*.5));
    sun.castShadow=false;this.group.add(sun,sun.target);
   }
  }
  if(this.data.tvSettings){setGeminiTVChannel(this.data.tvSettings.channel||'nature');setGeminiTVOn(this.data.tvSettings.on!==false);}
  const frameMat=new THREE.MeshStandardMaterial({color:0x8d9799,roughness:.54,metalness:.32});
  for(const w of this.data.walls){
   const len=wallLength(w);if(len<.1)continue;
   const wallMat=finishMaterial(w.material||this.data.wallMaterial);
   if(this.data.designedRoom){
    // Keep Gemini's procedural plaster normal/roughness. Opposing walls
    // have slightly different reflectance, as a real daylight interior does.
    const side=w.id.replace(/^room-/,'');
    const daylightFactors={north:1.06,south:.90,west:1.0,east:.86};
    wallMat.color.multiplyScalar(daylightFactors[side]||.985);
    wallMat.roughness=Math.min(.93,Math.max(.74,wallMat.roughness+.025));
    if(wallMat.normalScale)wallMat.normalScale.set(.56*(this.data.roomLook?.plasterDetail??1),.56*(this.data.roomLook?.plasterDetail??1));
   }
   const openings=this.data.windows.filter(o=>o.hostId===w.id).sort((a,b)=>a.along-b.along);
   const container=new THREE.Group();container.userData.wallId=w.id;this.group.add(container);
   let before=0;
   for(const o of openings){
    const left=Math.max(0,o.along-o.width/2),right=Math.min(len,o.along+o.width/2);
    this.makeBox(container,w,before,left,0,w.height,w.thickness,wallMat);
    this.makeBox(container,w,left,right,0,o.sill,w.thickness,wallMat);
    this.makeBox(container,w,left,right,o.sill+o.height,w.height,w.thickness,wallMat);
    // Reuse the application's AR architecture renderer for authored rooms.
    if(o.kind==='window'&&this.data.designedRoom)this.makeGeminiWindow(container,w,o);
    else if(o.kind==='window'){
     const glass=new THREE.MeshPhysicalMaterial({color:'#e9f7ff',roughness:.06,metalness:.02,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
     this.makeBox(container,w,left+.045,right-.045,o.sill+.045,o.sill+o.height-.045,.018,glass,o.id);
     glass.dispose();
    }
    if(o.kind==='kitchen'&&this.data.designedRoom)this.makeGeminiKitchen(container,w,o);
    else if(o.kind==='door'||o.kind==='kitchen'){
     const len=wallLength(w),ux=(w.x2-w.x1)/len,uz=(w.z2-w.z1)/len;
     const cx=w.x1+ux*o.along,cz=w.z1+uz*o.along;
     const normal={north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]}[o.wall]||[0,0];
     const depth=o.kind==='door'?1.55:2.10;
     const hallwayWidth=o.width+(o.kind==='door'?1.0:.55);
     const hallwayFloor=new THREE.Mesh(new THREE.BoxGeometry(hallwayWidth,.10,depth),finishMaterial(this.data.designedRoom?'stone-marble':'ceramic-cream'));
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
      if(this.data.designedRoom){
       const brass=new THREE.MeshStandardMaterial({color:0xd4af37,roughness:.25,metalness:.88});
       const knob=this.makeBox(container,w,right-.25,right-.12,1.01,1.035,.11,brass,o.id);
       if(knob){knob.position.x+=normal[0]*.13;knob.position.z+=normal[1]*.13;}
       brass.dispose();
      }
      doorMat.dispose();
     }else{
      const base=new THREE.MeshStandardMaterial({color:'#5a493d',roughness:.54});
      const top=new THREE.MeshPhysicalMaterial({color:'#f0e8dc',roughness:.24,metalness:.02,clearcoat:.35});
      this.makeBox(container,w,left+.04,right-.04,0,.89,.62,base);
      this.makeBox(container,w,left,right,.89,.95,.70,top);
      base.dispose();top.dispose();
     }
    }
    if(!this.data.designedRoom||!['window','kitchen'].includes(o.kind)){
     const edge=Math.min(.05,o.width/8,o.height/8),t=w.thickness+.02;
     this.makeBox(container,w,left,left+edge,o.sill,o.sill+o.height,t,frameMat,o.id);
     this.makeBox(container,w,right-edge,right,o.sill,o.sill+o.height,t,frameMat,o.id);
     this.makeBox(container,w,left,right,o.sill,o.sill+edge,t,frameMat,o.id);
     this.makeBox(container,w,left,right,o.sill+o.height-edge,o.sill+o.height,t,frameMat,o.id);
    }
    before=right;
   }
   this.makeBox(container,w,before,len,0,w.height,w.thickness,wallMat);
   for(const feature of this.data.features||[]){
    if(feature.kind==='tv'&&feature.wall===w.id.replace(/^room-/,'')&&Number.isFinite(feature.u)){
     this.makeGeminiTelevision(container,w,feature);
    }
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
  if(this.reflectionAllowed&&this.floorMesh&&floorFinish(this.data.floorMaterial).kind==='ceramic')this.reflection?.attach(this.floorMesh,this.group);
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
