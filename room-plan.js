import {validPolygon} from './architecture-geometry.js?v=0.9.0';
// Chido room planner: metric model shared by 2D editing and the existing AR scene.
// Local X/Z coordinates; no independent renderer or camera is created here.
export const ROOM_SPECS=Object.freeze({
 win_tall_1:{label:'پنجره قدی ۱ متر',width:1,sill:.14,height:2.58,kind:'window',color:'#39a9df'},
 win_tall_25:{label:'پنجره قدی ۲٫۵ متر',width:2.5,sill:.14,height:2.58,kind:'window',color:'#2584ba'},
 win_std_2:{label:'پنجره ۲ متر · اوکابه ۱٫۱',width:2,sill:1.10,height:1.62,kind:'window',color:'#72bfdc'},
 door:{label:'در و راهرو',width:1,sill:0,height:2.22,kind:'door',color:'#df9d38'},
 kitchen:{label:'اپن آشپزخانه ۳ متر',width:3,sill:0,height:2.42,kind:'kitchen',color:'#40ae86'},
 tv:{label:'محل تلویزیون',width:2.2,sill:0,height:2.86,kind:'tv',color:'#936cc7'}
});
export const ROOM_WALLS=['north','south','west','east'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(x)=>Number.isFinite(Number(x))?Number(x):NaN;
const cm=n=>Math.round(n*100)/100;
export function defaultRoomPlan(){return {version:1,w:6.8,d:5.8,elements:[],hiddenWalls:[],tvChannel:'nature',tvOn:true,consoleFinish:'walnut',roomLook:{daylight:1,ibl:.42,plasterDetail:1},structureMode:'room'};}
export function wallLength(plan,wall){return wall==='north'||wall==='south'?plan.w:plan.d;}
export function wallAnchor(plan,wall,u){
 const x0=-plan.w/2,z0=-plan.d/2;
 if(wall==='north')return {x:x0+u,z:z0};
 if(wall==='south')return {x:x0+u,z:-z0};
 if(wall==='west')return {x:x0,z:z0+u};
 return {x:-x0,z:z0+u};
}
export function canPlaceRoomElement(plan,candidate,others=plan.elements){
 const s=ROOM_SPECS[candidate?.type];
 if(!s||!ROOM_WALLS.includes(candidate?.wall)||!Number.isFinite(candidate?.u))return {valid:false,reason:'آیتم معتبر نیست.'};
 if(plan.hiddenWalls?.includes(candidate.wall))return {valid:false,reason:'برای افزودن این آیتم، ابتدا دیوار حذف‌شده را بازگردان.'};
 const len=wallLength(plan,candidate.wall),half=s.width/2;
 if(s.width>len-.36||candidate.u-half<.18||candidate.u+half>len-.18)return {valid:false,reason:'فاصله از گوشه یا طول دیوار کافی نیست.'};
 for(const el of others){
  if(el.id===candidate.id)continue;
  const t=ROOM_SPECS[el.type];if(!t)continue;
  if(el.wall===candidate.wall&&Math.abs(el.u-candidate.u)<(s.width+t.width)/2+.15)return {valid:false,reason:'هم‌پوشانی با '+t.label};
  const opp={north:'south',south:'north',west:'east',east:'west'};
  if(el.wall===opp[candidate.wall]&&Math.abs(el.u-candidate.u)<(s.width+t.width)/2+.2){
   if((candidate.type==='tv'&&['door','kitchen'].includes(el.type))||
      (el.type==='tv'&&['door','kitchen'].includes(candidate.type)))return {valid:false,reason:'تلویزیون نمی‌تواند مقابل در، راهرو یا اپن باشد.'};
  }
 }
 return {valid:true,reason:''};
}
export function normalizeRoomPlan(raw){
 if(!raw||typeof raw!=='object')return null;
 const w=cm(number(raw.w)),d=cm(number(raw.d));
 if(!Number.isFinite(w)||!Number.isFinite(d)||w<3.5||d<3.5||w>14||d>14)return null;
 const hiddenWalls=raw.hiddenWalls??[];
 if(!Array.isArray(hiddenWalls)||hiddenWalls.length>4||hiddenWalls.some(wall=>!ROOM_WALLS.includes(wall))||new Set(hiddenWalls).size!==hiddenWalls.length)return null;
 const tvChannel=['nature','fireplace','abstract'].includes(raw.tvChannel)?raw.tvChannel:'nature';
 const consoleFinish=['walnut','nero','lacquer'].includes(raw.consoleFinish)?raw.consoleFinish:'walnut';
 const clampLook=(value,fallback,lo,hi)=>Number.isFinite(Number(value))?Math.max(lo,Math.min(hi,Number(value))):fallback;
 const roomLook={
  daylight:clampLook(raw.roomLook?.daylight,1,.45,2.1),
  ibl:clampLook(raw.roomLook?.ibl,.42,0,1.5),
  plasterDetail:clampLook(raw.roomLook?.plasterDetail,1,0,2)
 };
 const structureMode=['room','floor','walls'].includes(raw.structureMode)?raw.structureMode:'room';
 const plan={version:1,w,d,elements:[],hiddenWalls:[...hiddenWalls],tvChannel,tvOn:raw.tvOn!==false,consoleFinish,roomLook,structureMode};
 if(!Array.isArray(raw.elements)||raw.elements.length>48)return null;
 for(const item of raw.elements){
  if(!item||typeof item.id!=='string'||item.id.length>90||!ROOM_SPECS[item.type]||!ROOM_WALLS.includes(item.wall))return null;
  const el={id:item.id,type:item.type,wall:item.wall,u:cm(number(item.u))};
  if(!canPlaceRoomElement(plan,el,plan.elements).valid)return null;
  plan.elements.push(el);
 }
 const goodPoint=p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.z))&&Math.abs(Number(p.x))<=w/2+.01&&Math.abs(Number(p.z))<=d/2+.01;
 if(raw.floorPolygon!==undefined){
  if(!Array.isArray(raw.floorPolygon)||raw.floorPolygon.length<3||raw.floorPolygon.length>40||!raw.floorPolygon.every(goodPoint))return null;
  const points=raw.floorPolygon.map(p=>({x:cm(p.x),z:cm(p.z)}));
  if(!validPolygon(points))return null;
  plan.floorPolygon=points;
 }
 if(raw.wallSegments!==undefined){
  if(!Array.isArray(raw.wallSegments)||raw.wallSegments.length>40||
   raw.wallSegments.some(v=>!v||!goodPoint({x:v.x1,z:v.z1})||!goodPoint({x:v.x2,z:v.z2})||Math.hypot(v.x2-v.x1,v.z2-v.z1)<=.1))return null;
  plan.wallSegments=raw.wallSegments.map((v,i)=>({id:'free-wall-'+i,x1:cm(v.x1),z1:cm(v.z1),x2:cm(v.x2),z2:cm(v.z2)}));
 }
 return plan;
}
export function sizedRoomPlan(plan,w,d){
 const next={...plan,w:cm(number(w)),d:cm(number(d)),elements:[]};
 if(!Number.isFinite(next.w)||!Number.isFinite(next.d)||next.w<3.5||next.d<3.5||next.w>14||next.d>14)return null;
 // Do not silently truncate windows or move the user's architectural features.
 for(const item of plan.elements){
  if(!canPlaceRoomElement(next,item,next.elements).valid)return null;
  next.elements.push({...item});
 }
 return next;
}
export function roomPlanToArchitecture(plan,previous={}){
 const x=plan.w/2,z=plan.d/2;
 const floor=plan.structureMode==='walls'?[]:
  plan.structureMode==='floor'&&plan.floorPolygon?.length>=3?plan.floorPolygon.map(p=>({...p})):
  [{x:-x,z:-z},{x:x,z:-z},{x:x,z:z},{x:-x,z:z}];
 const walls=[
  {id:'room-north',x1:-x,z1:-z,x2:x,z2:-z},
  {id:'room-south',x1:-x,z1:z,x2:x,z2:z},
  {id:'room-west',x1:-x,z1:-z,x2:-x,z2:z},
  {id:'room-east',x1:x,z1:-z,x2:x,z2:z}
 ].filter(w=>plan.structureMode==='room'&&!plan.hiddenWalls?.includes(w.id.slice(5))).map(w=>({...w,height:3.0,thickness:.24}));
 if(plan.structureMode==='walls'&&Array.isArray(plan.wallSegments)){
  for(let i=0;i<plan.wallSegments.length;i++){
   const segment=plan.wallSegments[i];
   if(walls.length>=40)break;
   walls.push({...segment,id:'free-wall-'+i,height:3,thickness:.24});
  }
 }
 const windows=[],features=[];
 for(const el of plan.elements){
  const s=ROOM_SPECS[el.type];
  if(el.type==='tv'){features.push({id:el.id,kind:'tv',wall:el.wall,u:el.u,width:s.width});continue;}
  windows.push({id:el.id,hostId:'room-'+el.wall,along:el.u,width:s.width,
   height:s.height,sill:s.sill,kind:s.kind,wall:el.wall});
 }
 return {floor,walls,windows,features,structureMode:plan.structureMode||'room',designedRoom:true,roomLook:plan.roomLook||{daylight:1,ibl:.42,plasterDetail:1},tvSettings:{channel:plan.tvChannel||'nature',on:plan.tvOn!==false,consoleFinish:plan.consoleFinish||'walnut'},
  floorMaterial:previous.designedRoom?(previous.floorMaterial||'parquet-oak'):'parquet-oak',
  wallMaterial:previous.designedRoom?(previous.wallMaterial||'gemini-wall-warm'):'gemini-wall-warm'};
}

// Exact rotated-rectangle bounds of existing furniture in a designed room.
// Parts are footprints in Studio root coordinates. Moving chairs keep their offset
// relative to the table, so the ENTIRE linked group remains within the walls.
export function constrainFurnitureToRoom(plan,parts,target,margin=.10){
 if(!plan||!Array.isArray(parts)||!parts.length)return target;
 const anchor=parts[0];if(!anchor)return null;
 let xMin=-Infinity,xMax=Infinity,zMin=-Infinity,zMax=Infinity;
 for(const part of parts){
  if(![part.x,part.z,part.hx,part.hz,part.angle].every(Number.isFinite))return null;
  const c=Math.abs(Math.cos(part.angle)),ss=Math.abs(Math.sin(part.angle));
  const radiusX=part.hx*c+part.hz*ss,radiusZ=part.hx*ss+part.hz*c;
  const offsetX=part.x-anchor.x,offsetZ=part.z-anchor.z;
  xMin=Math.max(xMin,-plan.w/2+margin+radiusX-offsetX);
  xMax=Math.min(xMax,plan.w/2-margin-radiusX-offsetX);
  zMin=Math.max(zMin,-plan.d/2+margin+radiusZ-offsetZ);
  zMax=Math.min(zMax,plan.d/2-margin-radiusZ-offsetZ);
 }
 if(xMin>xMax||zMin>zMax)return null;
 return {x:clamp(target.x,xMin,xMax),z:clamp(target.z,zMin,zMax)};
}

// Invisible, metre-based SAT footprints for solid walls; these shapes never
// enter THREE.Scene and thus cannot create shadows, AO, depth or reflections.
// Open doors and kitchen openings have no floor-height barrier. Glass windows
// remain walls to floor-standing furniture, even if their glass is transparent.
export function roomWallCollisionFootprints(plan,{thickness=.24}={}){
 if(!plan||!Number.isFinite(plan.w)||!Number.isFinite(plan.d))return [];
 if(plan.structureMode==='floor')return [];
 if(plan.structureMode==='walls')return (plan.wallSegments||[]).map((w,i)=>{
  const dx=w.x2-w.x1,dz=w.z2-w.z1;
  return {x:(w.x1+w.x2)/2,z:(w.z1+w.z2)/2,angle:Math.atan2(dz,dx),
   hx:Math.hypot(dx,dz)/2,hz:thickness/2,wall:'free-'+i,kind:'wall',height:3,visible:false};
 });
 const colliders=[],hidden=new Set(plan.hiddenWalls||[]);
 const walls=[
  ['north',plan.w,-plan.d/2,0],
  ['south',plan.w,plan.d/2,0],
  ['west',plan.d,-plan.w/2,Math.PI/2],
  ['east',plan.d,plan.w/2,Math.PI/2]
 ];
 for(const [side,length,edge,angle] of walls){
  if(hidden.has(side))continue;
  const gaps=(plan.elements||[])
   .filter(el=>el.wall===side&&['door','kitchen'].includes(el.type))
   .map(el=>{const width=ROOM_SPECS[el.type]?.width||0;return [el.u-width/2,el.u+width/2]})
   .sort((a,b)=>a[0]-b[0]);
  const segments=[];
  let begin=0;
  for(const [left,right] of gaps){
   if(left>begin+.025)segments.push([begin,left]);
   begin=Math.max(begin,right);
  }
  if(begin<length-.025)segments.push([begin,length]);
  for(const [a,b] of segments){
   if(b-a<.025)continue;
   const along=(a+b)/2-length/2;
   // Axis 0 points along X for north/south, and along Z for east/west.
   // A half-width in that axis represents the whole physical wall segment.
   colliders.push({
    x:angle?edge:along,z:angle?along:edge,
    angle,hx:(b-a)/2,hz:thickness/2,
    wall:side,kind:'wall',height:3.0,visible:false
   });
  }
 }
 return colliders;
}
