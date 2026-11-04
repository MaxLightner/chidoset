// Metric, renderer-independent architectural editing for Chido.
// Coordinates are in the furniture root's X/Z plane, in metres.
export const cm = n => Math.round(Number(n)*100)/100;
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const wallLength = w => Math.hypot(w.x2-w.x1,w.z2-w.z1);
export function nearestWall(walls,p,max=.55){
 let found=null,nearest=max;
 for(const w of walls){
  const len=wallLength(w);if(len<.1)continue;
  const ux=(w.x2-w.x1)/len,uz=(w.z2-w.z1)/len;
  const along=Math.max(0,Math.min(len,(p.x-w.x1)*ux+(p.z-w.z1)*uz));
  const point={x:w.x1+ux*along,z:w.z1+uz*along},d=distance(point,p);
  if(d<nearest){nearest=d;found={wall:w,along,point,d};}
 }
 return found;
}
export function snapPoint(p,walls=[],radius=.14){
 let target=null,near=radius;
 for(const w of walls)for(const q of [{x:w.x1,z:w.z1},{x:w.x2,z:w.z2}]){
  const d=distance(p,q);if(d<near){target=q;near=d;}
 }
 return target?{...target}:{x:cm(p.x),z:cm(p.z)};
}
export function closestFloorEdge(p,floor,limit=.24){
 if(!Array.isArray(floor)||floor.length<2)return null;
 // Corners win over edge projections, so wall runs meet without tiny gaps.
 let corner=null,cornerDistance=.16;
 for(const v of floor){const d=distance(p,v);if(d<cornerDistance){corner=v;cornerDistance=d;}}
 if(corner)return {x:cm(corner.x),z:cm(corner.z)};
 let result=null,dist=limit;
 for(let i=0;i<floor.length;i++){
  const a=floor[i],b=floor[(i+1)%floor.length],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
  if(len2<.0001)continue;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len2));
  const q={x:cm(a.x+t*dx),z:cm(a.z+t*dz)};
  const d=distance(p,q);
  if(d<dist){dist=d;result=q;}
 }
 return result;
}
export function polygonArea(points){
 return points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.z-q.x*p.z;},0)/2;
}
function orientation(a,b,c){return (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);}
function intersect(a,b,c,d){
 const ab1=orientation(a,b,c),ab2=orientation(a,b,d),cd1=orientation(c,d,a),cd2=orientation(c,d,b);
 return ab1*ab2< -1e-8&&cd1*cd2< -1e-8;
}
export function validPolygon(points){
 if(!Array.isArray(points)||points.length<3||points.length>64||Math.abs(polygonArea(points))<.15)return false;
 for(let i=0;i<points.length;i++){
  if(distance(points[i],points[(i+1)%points.length])<.06)return false;
  for(let j=i+2;j<points.length;j++){
   if(i===0&&j===points.length-1)continue;
   if(intersect(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return false;
  }
 }
 return true;
}
export function normalizedWindow(raw,wall){
 const len=wallLength(wall);if(len<.65)throw Error('دیوار برای پنجره کوتاه است.');
 const margin=.12,width=Math.max(.3,Math.min(Number(raw.width)||1.2,len-2*margin));
 const height=Math.max(.3,Math.min(Number(raw.height)||1.2,wall.height-.25));
 const sill=Math.max(0,Math.min((raw.sill === undefined ? 0.9 : Number(raw.sill)),wall.height-height-.08));
 const along=Math.max(margin+width/2,Math.min(len-margin-width/2,(Number.isFinite(Number(raw.along)) ? Number(raw.along) : len/2)));
 return {...raw,hostId:wall.id,width:cm(width),height:cm(height),sill:cm(sill),along:cm(along)};
}
export function windowIntersects(candidate,others){
 return others.some(w=>w.id!==candidate.id&&w.hostId===candidate.hostId&&
  Math.abs(w.along-candidate.along)<(w.width+candidate.width)/2+.08);
}
export function updateWindow(win,wall,others,handle,along,y){
 const next={...win};
 const left=win.along-win.width/2,right=win.along+win.width/2,top=win.sill+win.height;
 if(handle==='left'){next.width=right-along;next.along=(right+along)/2;}
 else if(handle==='right'){next.width=along-left;next.along=(left+along)/2;}
 else if(handle==='top')next.height=y-win.sill;
 else if(handle==='bottom'){next.sill=y;next.height=top-y;}
 else if(handle==='centre'){next.along=along;next.sill=y-win.height/2;}
 else return win;
 if(!Number.isFinite(next.width)||next.width<.30||!Number.isFinite(next.height)||next.height<.30)return win;
 const updated=normalizedWindow(next,wall);
 if(Math.abs(updated.width-next.width)>.025||Math.abs(updated.height-next.height)>.025||windowIntersects(updated,others))return win;
 return updated;
}
export function validArchitecture(data){
 return !!data&&Array.isArray(data.floor)&&Array.isArray(data.walls)&&Array.isArray(data.windows)&&
  data.floor.length<=64&&data.walls.length<=80&&data.windows.length<=80;
}
