import {CATALOG} from './catalog-data.js?v=0.16.16';
export function savedFootprints(scene){
 if(!scene||!Array.isArray(scene.items))return [];
 return scene.items.filter(m=>m&&m.hidden!==true&&CATALOG[m.index]&&Array.isArray(m.position)).map(m=>{
  const size=m.size||CATALOG[m.index].size;
  return {index:m.index,x:+m.position[0],z:+m.position[2],width:size[0],depth:size[2],rotation:m.rotation||0};
 });
}
export function savedPlanSvg(scene){
 const objects=savedFootprints(scene),architecture=scene?.architecture||{},floor=architecture.floor||[],walls=architecture.walls||[];
 const room='<rect x="8" y="8" width="304" height="218" rx="9" fill="#f3eee7" stroke="#c6baa9" stroke-width="3"/>';
 const points=[...floor,...walls.flatMap(w=>[{x:w.x1,z:w.z1},{x:w.x2,z:w.z2}])];
 if(!objects.length&&!points.length)return '<svg viewBox="0 0 320 234" xmlns="http://www.w3.org/2000/svg">'+room+'</svg>';
 const extent=objects.reduce((e,o)=>({minX:Math.min(e.minX,o.x-o.width*.7),maxX:Math.max(e.maxX,o.x+o.width*.7),
  minZ:Math.min(e.minZ,o.z-o.depth*.7),maxZ:Math.max(e.maxZ,o.z+o.depth*.7)}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
 for(const p of points){extent.minX=Math.min(extent.minX,p.x);extent.maxX=Math.max(extent.maxX,p.x);extent.minZ=Math.min(extent.minZ,p.z);extent.maxZ=Math.max(extent.maxZ,p.z);}
 const scale=Math.min(275/(extent.maxX-extent.minX||1),191/(extent.maxZ-extent.minZ||1),90);
 const cx=(extent.minX+extent.maxX)/2,cz=(extent.minZ+extent.maxZ)/2;
 const xy=p=>[160+(p.x-cx)*scale,117+(p.z-cz)*scale].map(v=>v.toFixed(1)).join(',');
 const surface=floor.length>=3?'<polygon points="'+floor.map(xy).join(' ')+'" fill="#c6ddd0" stroke="#6ba18b" stroke-width="1.8"/>':'';
 const edges=walls.map(w=>'<line x1="'+(160+(w.x1-cx)*scale).toFixed(1)+'" y1="'+(117+(w.z1-cz)*scale).toFixed(1)+'" x2="'+(160+(w.x2-cx)*scale).toFixed(1)+'" y2="'+(117+(w.z2-cz)*scale).toFixed(1)+'" stroke="#71867e" stroke-width="5" stroke-linecap="round"/>').join('');
 const items=objects.map(o=>{
  const x=160+(o.x-cx)*scale,y=117+(o.z-cz)*scale;
  const w=o.width*scale,d=o.depth*scale;
  const fill=[0,1,3].includes(o.index)?'#cab8a4':o.index===7?'#dfcfb7':[10,2,12,13].includes(o.index)?'#a78d73':'#9ea792';
  return '<g transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') rotate('+(o.rotation*180/Math.PI).toFixed(1)+')">'+
   '<rect x="'+(-w/2).toFixed(1)+'" y="'+(-d/2).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+d.toFixed(1)+'" rx="4" fill="'+fill+'" stroke="#7b6a5a" stroke-width="1.5"/>'+
   ([0,1,3].includes(o.index)?'<path d="M'+(-w*.42).toFixed(1)+' 0h'+(w*.84).toFixed(1)+'" stroke="#998472"/>':'')+'</g>';
 }).join('');
 return '<svg viewBox="0 0 320 234" role="img" aria-label="پلان چیدمان ذخیره‌شده" xmlns="http://www.w3.org/2000/svg">'+room+surface+edges+items+'</svg>';
}
