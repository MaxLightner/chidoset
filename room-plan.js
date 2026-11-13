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
export function defaultRoomPlan(){return {version:1,w:6.8,d:5.8,elements:[],hiddenWalls:[]};}
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
 const plan={version:1,w,d,elements:[],hiddenWalls:[...hiddenWalls]};
 if(!Array.isArray(raw.elements)||raw.elements.length>48)return null;
 for(const item of raw.elements){
  if(!item||typeof item.id!=='string'||item.id.length>90||!ROOM_SPECS[item.type]||!ROOM_WALLS.includes(item.wall))return null;
  const el={id:item.id,type:item.type,wall:item.wall,u:cm(number(item.u))};
  if(!canPlaceRoomElement(plan,el,plan.elements).valid)return null;
  plan.elements.push(el);
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
 const floor=[{x:-x,z:-z},{x:x,z:-z},{x:x,z:z},{x:-x,z:z}];
 const walls=[
  {id:'room-north',x1:-x,z1:-z,x2:x,z2:-z},
  {id:'room-south',x1:-x,z1:z,x2:x,z2:z},
  {id:'room-west',x1:-x,z1:-z,x2:-x,z2:z},
  {id:'room-east',x1:x,z1:-z,x2:x,z2:z}
 ].filter(w=>!plan.hiddenWalls?.includes(w.id.slice(5))).map(w=>({...w,height:3.10,thickness:.24}));
 const windows=[],features=[];
 for(const el of plan.elements){
  const s=ROOM_SPECS[el.type];
  if(el.type==='tv'){features.push({id:el.id,kind:'tv',wall:el.wall,u:el.u,width:s.width});continue;}
  windows.push({id:el.id,hostId:'room-'+el.wall,along:el.u,width:s.width,
   height:s.height,sill:s.sill,kind:s.kind,wall:el.wall});
 }
 return {floor,walls,windows,features,
  floorMaterial:previous.floorMaterial||'ceramic-cream',
  wallMaterial:previous.wallMaterial||'wall-ivory'};
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
