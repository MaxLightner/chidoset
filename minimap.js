// Full-screen room editor built on Chido's existing Studio and live furniture scene.
// The 2D canvas only edits spatial/architecture data. No second 3D engine.
import * as THREE from './vendor/three.module.js';
import {ROOM_SPECS,defaultRoomPlan,canPlaceRoomElement,sizedRoomPlan,wallLength,wallAnchor} from './room-plan.js?v=0.18.8';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=n=>Number(n).toFixed(2);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const len=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
export class LiveMiniMap{
 constructor(panel,getStudio,options={}){
  this.panel=panel;this.getStudio=getStudio;this.options=options;this.svg=panel.querySelector('svg');
  this.expanded=false;this.tool='select';this.selectedArch=null;this.selectedWall=null;
  this.zoom=1;this.panX=0;this.panZ=0;this.viewport=null;this.viewportLock=null;
  this.pointers=new Map();this.gesture=null;
  this.angleInput=panel.querySelector('[data-map-angle]');
  panel.querySelector('[data-map-expand]').onclick=()=>this.setExpanded(!this.expanded);
  panel.querySelector('[data-map-add]').onclick=()=>this.addFurniture();
  panel.querySelector('[data-map-remove]').onclick=()=>this.removeSelected();
  panel.querySelector('[data-map-left]').onclick=()=>{const studio=getStudio();if(studio?.selected)studio.rotate(studio.selected.rotation.y*180/Math.PI-45);};
  panel.querySelector('[data-map-right]').onclick=()=>{const studio=getStudio();if(studio?.selected)studio.rotate(studio.selected.rotation.y*180/Math.PI+45);};
  this.angleInput.oninput=()=>{const studio=getStudio();if(!studio?.selected)return;const next=Number(this.angleInput.value);if(Number.isFinite(next))studio.rotate(next);};
  panel.querySelector('[data-plan-create]').onclick=()=>this.applyDimensions();
  const toolSelect=panel.querySelector('[data-plan-tool-select]');
  if(toolSelect)toolSelect.onchange=()=>{this.tool=toolSelect.value;this.selectedArch=null;this.selectedWall=null;this.updateTools();};
  panel.querySelectorAll('[data-plan-tool]').forEach(btn=>btn.onclick=()=>{
   this.tool=this.tool===btn.dataset.planTool?'select':btn.dataset.planTool;
   this.selectedArch=null;this.selectedWall=null;this.updateTools();
  });
  panel.querySelector('[data-plan-add]').onclick=()=>this.addFurniture();
  panel.querySelector('[data-plan-delete]').onclick=()=>this.removeSelected();
  panel.querySelector('[data-plan-zoom-in]').onclick=()=>this.zoomBy(1.25);
  panel.querySelector('[data-plan-zoom-out]').onclick=()=>this.zoomBy(.8);
  panel.querySelector('[data-plan-fit]').onclick=()=>this.fit();
  panel.querySelector('[data-plan-3d]').onclick=()=>this.options.on3D?.();
  panel.querySelector('[data-plan-start-ar]').onclick=()=>this.options.onStartAR?.();
  panel.querySelector('[data-plan-floor]').onclick=()=>this.options.onFloor?.();
  panel.querySelector('[data-plan-wall]').onclick=()=>this.options.onWall?.();
  panel.querySelector('[data-plan-templates]').onclick=()=>this.options.onTemplates?.();
  this.svg.addEventListener('pointerdown',e=>this.start(e));
  this.svg.addEventListener('pointermove',e=>this.move(e));
  for(const kind of ['pointerup','pointercancel','lostpointercapture'])
   this.svg.addEventListener(kind,e=>this.end(e));
  this.svg.addEventListener('wheel',e=>{
   if(!this.expanded)return;e.preventDefault();
   this.zoomBy(e.deltaY<0?1.15:1/1.15);
  },{passive:false});
  panel.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&this.expanded){e.preventDefault();this.setExpanded(false);}
   if((e.key==='Delete'||e.key==='Backspace')&&this.expanded&&e.target.tagName!=='INPUT'){e.preventDefault();this.removeSelected();}
  });
 }
 updateTools(){
  this.panel.querySelectorAll('[data-plan-tool]').forEach(b=>b.classList.toggle('active',b.dataset.planTool===this.tool));
  const menu=this.panel.querySelector('[data-plan-tool-select]');if(menu)menu.value=this.tool;
 }
 syncRoomFields(){
  const s=this.getStudio(),p=s?.roomPlan;
  if(p){
   this.panel.querySelector('[data-room-width]').value=num(p.w);
   this.panel.querySelector('[data-room-depth]').value=num(p.d);
  }
  const models=this.options.getProducts?.()||[];
  const select=this.panel.querySelector('[data-plan-model]');
  if(select&&models.length){
   const previous=select.value;
   select.innerHTML=models.map(({index,name})=>'<option value="'+index+'">'+esc(name)+'</option>').join('');
   if(models.some(item=>String(item.index)===previous))select.value=previous;
  }
 }
 setExpanded(value){
  this.expanded=!!value;
  this.panel.classList.toggle('expanded',this.expanded);
  this.panel.querySelector('[data-map-expand]').textContent=this.expanded?'بستن':'▣';
  this.panel.querySelector('[data-map-expand]').setAttribute('aria-label',this.expanded?'بستن پلان':'باز کردن پلان');
  const wasExpanded=this.pointers.size>=0&&this._previousExpanded===true;
  this._previousExpanded=this.expanded;
  this.pointers.clear();this.gesture=null;
  if(this.expanded){this.syncRoomFields();this.updateTools();this.fit();}
  else{this.render();if(wasExpanded&&this.options.onClose)this.options.onClose();}
 }
 collapse(){this.setExpanded(false);}
 fit(){this.zoom=1;this.panX=0;this.panZ=0;this.viewportLock=null;this.render();}
 zoomBy(factor){
  const before=this.zoom;this.zoom=clamp(this.zoom*factor,.55,7);
  if(this.viewportLock){
   const v=this.viewportLock,scale=this.zoom/Math.max(.001,before);
   const width=v.width/scale,height=v.height/scale;
   this.viewportLock={left:v.left+(v.width-width)/2,top:v.top+(v.height-height)/2,width,height};
  }
  this.render();
 }
 applyDimensions(){
  const s=this.getStudio();if(!s)return;
  const w=Number(this.panel.querySelector('[data-room-width]').value);
  const d=Number(this.panel.querySelector('[data-room-depth]').value);
  const next=s.roomPlan?sizedRoomPlan(s.roomPlan,w,d):sizedRoomPlan(defaultRoomPlan(),w,d);
  if(!next||!s.setRoomPlan(next)){this.options.onToast?.('ابعاد معتبر نیست یا پنجره‌ها و درها در ابعاد جدید جا نمی‌شوند.');this.syncRoomFields();return;}
  this.syncRoomFields();this.fit();
  this.options.onToast?.('ابعاد اتاق اعمال شد: '+num(next.w)+' × '+num(next.d)+' متر');
 }
 closestWall(point,plan,type=this.tool){
  const walls=[
   {wall:'north',distance:Math.abs(point.z+plan.d/2),u:point.x+plan.w/2},
   {wall:'south',distance:Math.abs(point.z-plan.d/2),u:point.x+plan.w/2},
   {wall:'west',distance:Math.abs(point.x+plan.w/2),u:point.z+plan.d/2},
   {wall:'east',distance:Math.abs(point.x-plan.w/2),u:point.z+plan.d/2}
  ].sort((a,b)=>a.distance-b.distance);
  const win=walls[0];
  if(win.distance>.8)return null;
  const spec=ROOM_SPECS[type]||ROOM_SPECS.tv;
  win.u=clamp(Math.round(win.u*10)/10,spec.width/2+.18,wallLength(plan,win.wall)-spec.width/2-.18);
  return win;
 }
 roomElementAt(point,plan){
  if(!plan)return null;
  // Larger touch zone around an opening. This wins over both wall resize and pan.
  let closest=null,min=Infinity;
  for(const el of plan.elements){
   const anchor=wallAnchor(plan,el.wall,el.u),spec=ROOM_SPECS[el.type];if(!spec)continue;
   const vertical=el.wall==='east'||el.wall==='west';
   const across=vertical?Math.abs(point.x-anchor.x):Math.abs(point.z-anchor.z);
   const along=vertical?Math.abs(point.z-anchor.z):Math.abs(point.x-anchor.x);
   if(across>.46||along>spec.width/2+.20)continue;
   const score=across+Math.max(0,along-spec.width/2)*2;
   if(score<min){closest=el;min=score;}
  }
  return closest;
 }
 nearRoomEdge(point,plan){
  if(!plan)return false;
  const d=.72,hw=plan.w/2,hd=plan.d/2;
  if(Math.abs(point.x)>hw+d||Math.abs(point.z)>hd+d)return false;
  return Math.min(Math.abs(Math.abs(point.x)-hw),Math.abs(Math.abs(point.z)-hd))<d;
 }
 nearWall(point,plan){
  if(!plan)return null;
  const delta=.20;
  const edges=[['west',Math.abs(point.x+plan.w/2)],['east',Math.abs(point.x-plan.w/2)],['north',Math.abs(point.z+plan.d/2)],['south',Math.abs(point.z-plan.d/2)]];
  const nearby=edges.filter(([,d])=>d<=delta).map(([name])=>name);
  if(!nearby.length)return null;
  if(nearby.length>1)return 'corner-'+nearby.sort().join('-');
  const wall=nearby[0];
  if(['west','east'].includes(wall)&&Math.abs(point.z)>plan.d/2+delta)return null;
  if(['north','south'].includes(wall)&&Math.abs(point.x)>plan.w/2+delta)return null;
  return wall;
 }
 point(event){
  const matrix=this.svg.getScreenCTM();if(!matrix)return null;
  const p=this.svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
  const q=p.matrixTransform(matrix.inverse());return {x:q.x/100,z:q.y/100};
 }
 addFurniture(){
  const s=this.getStudio();if(!s||s.items.length>=24){this.options.onToast?.('حداکثر ۲۴ آبجکت قابل افزودن است.');return;}
  const index=Number(this.panel.querySelector('[data-plan-model]').value);
  if(!Number.isInteger(index)||!this.options.getProducts?.().some(p=>p.index===index))return;
  const previous=s.selected;
  try{
   const mesh=s.add(index,new THREE.Vector3(0,0,0));
   if(!s.tryPlaceNew(mesh,previous,3))return;
   s.select(mesh);s.changed();this.tool='select';this.updateTools();this.render();
  }catch(e){this.options.onToast?.('افزودن مدل ممکن نشد: '+(e.message||e));}
 }
 removeSelected(){
  const s=this.getStudio();if(!s)return;
  if(this.selectedArch&&s.roomPlan){
   const plan={...s.roomPlan,elements:s.roomPlan.elements.filter(e=>e.id!==this.selectedArch)};
   s.setRoomPlan(plan);this.selectedArch=null;this.render();return;
  }
  if(this.selectedWall&&s.roomPlan){
   const wall=this.selectedWall;
   if(!['north','south','west','east'].includes(wall)){this.options.onToast?.('برای حذف، روی خود دیوار بزن نه گوشه.');return;}
   const next=new Set(s.roomPlan.hiddenWalls||[]);
   if(!next.has(wall)&&s.roomPlan.elements.some(el=>el.wall===wall)){
    this.options.onToast?.('ابتدا درها و پنجره‌های این دیوار را حذف کن.');return;
   }
   if(next.has(wall))next.delete(wall);else next.add(wall);
   s.setRoomPlan({...s.roomPlan,hiddenWalls:[...next]});this.render();return;
  }
  if(s.selected){s.remove();this.render();}
 }
 turn(delta){
  const s=this.getStudio();if(s?.selected)s.rotate((s.selected.rotation.y*180/Math.PI)+delta);
 }
 start(e){
  if(!this.expanded){this.setExpanded(true);return;}
  e.preventDefault();e.stopPropagation();
  this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  try{this.svg.setPointerCapture(e.pointerId);}catch{}
  if(this.pointers.size===2){
   const [a,b]=[...this.pointers.values()];
   const angle=Math.atan2(b.y-a.y,b.x-a.x),distance=len(a,b);
   const s=this.getStudio();
   if(s?.selected&&this.gesture?.type==='furniture'){
    this.gesture={type:'twist',id:s.selected.userData.id,startAngle:angle,rotation:s.selected.rotation.y};
   }else this.gesture={type:'pinch',distance,zoom:this.zoom,panX:this.panX,panZ:this.panZ,
    view:this.viewportLock?{...this.viewportLock}:null,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};
   return;
  }
  if(this.pointers.size>2)return;
  const s=this.getStudio(),point=this.point(e);
  if(!s||!point)return;
  if(this.tool!=='select'){
   const plan=s.roomPlan||defaultRoomPlan(),snap=this.closestWall(point,plan);
   if(!snap){this.options.onToast?.('برای قرار دادن آیتم، روی دیوار بزن.');this.gesture=null;return;}
   const candidate={id:'room-'+Date.now()+'-'+Math.floor(Math.random()*10000),type:this.tool,wall:snap.wall,u:snap.u};
   const check=canPlaceRoomElement(plan,candidate);
   if(!check.valid){this.options.onToast?.(check.reason);return;}
   s.setRoomPlan({...plan,elements:[...plan.elements,candidate]});
   // Keep the chosen opening tool active for repeated placement; switch to
   // «انتخاب» only when the user explicitly taps that tool.
   this.selectedArch=candidate.id;this.selectedWall=null;
   this.render();return;
  }
  const arch=e.target.closest('[data-plan-el]');
  if(s.roomPlan){
   const el=(arch?s.roomPlan.elements.find(x=>x.id===arch.dataset.planEl):null)||this.roomElementAt(point,s.roomPlan);
   if(el){s.select(null);this.selectedArch=el.id;this.selectedWall=null;this.gesture={type:'architecture',id:el.id,startX:e.clientX,startY:e.clientY,moved:false};this.render();return;}
  }
  const furniture=e.target.closest('[data-object-id]');
  if(furniture){
   const mesh=s.items.find(m=>m.userData.id===Number(furniture.dataset.objectId));
   if(mesh){
    s.select(mesh);this.selectedArch=null;this.selectedWall=null;
    const pos=s.roomPlan?{x:mesh.position.x,z:mesh.position.z}:s.planPosition(mesh);
    this.gesture={type:'furniture',id:mesh.userData.id,dx:pos.x-point.x,dz:pos.z-point.z};
    this.render();return;
   }
  }
  const wall=this.nearWall(point,s.roomPlan);
  if(wall){
   s.select(null);this.selectedArch=null;this.selectedWall=wall;
   const matrix=this.svg.getScreenCTM(),scale=1/(Math.max(.001,Math.abs(matrix?.a||1))*100);
   this.viewportLock=this.viewport?{...this.viewport}:this.viewportLock;
   this.gesture={type:'wall',wall,startX:e.clientX,startY:e.clientY,
    startW:s.roomPlan.w,startD:s.roomPlan.d,metersPerPixel:scale};
   this.render();return;
  }
  s.select(null);this.selectedArch=null;this.selectedWall=null;
  if(this.nearRoomEdge(point,s.roomPlan)){this.gesture=null;this.render();return;}
  this.gesture={type:'pan',x:e.clientX,y:e.clientY,panX:this.panX,panZ:this.panZ,
    view:this.viewportLock?{...this.viewportLock}:null,
    sx:this.viewport?.width||6,sz:this.viewport?.height||5,
    pixelWidth:Math.max(1,this.svg.clientWidth),pixelHeight:Math.max(1,this.svg.clientHeight)};
  this.render();
 }
 move(e){
  if(!this.expanded||!this.pointers.has(e.pointerId))return;
  e.preventDefault();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const s=this.getStudio(),g=this.gesture;if(!g||!s)return;
  if(this.pointers.size===2){
   const [a,b]=[...this.pointers.values()];
   if(g.type==='twist'){
    const mesh=s.items.find(m=>m.userData.id===g.id);
    if(!mesh)return;
    let delta=Math.atan2(b.y-a.y,b.x-a.x)-g.startAngle;
    delta=Math.atan2(Math.sin(delta),Math.cos(delta));
    s.select(mesh);s.rotate((g.rotation+delta)*180/Math.PI);
   }else if(g.type==='pinch'){
    this.zoom=clamp(g.zoom*len(a,b)/Math.max(20,g.distance),.55,7);
    const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    if(g.view){
     const w=g.view.width*g.zoom/this.zoom,h=g.view.height*g.zoom/this.zoom;
     const px=Math.max(1,this.svg.clientWidth),py=Math.max(1,this.svg.clientHeight);
     this.viewportLock={
      left:g.view.left+g.cx/px*g.view.width-cx/px*w,
      top:g.view.top+g.cy/py*g.view.height-cy/py*h,width:w,height:h
     };
    }else{
     this.panX=g.panX-(cx-g.cx)/Math.max(1,this.svg.clientWidth)*(this.viewport?.width||6);
     this.panZ=g.panZ-(cy-g.cy)/Math.max(1,this.svg.clientHeight)*(this.viewport?.height||5);
    }
    this.render();
   }
   return;
  }
  if(this.pointers.size!==1)return;
  const p=this.point(e);if(!p)return;
  if(g.type==='wall'&&s.roomPlan){
   const dx=(e.clientX-g.startX)*g.metersPerPixel,dz=(e.clientY-g.startY)*g.metersPerPixel;
   let w=g.startW,d=g.startD;
   if(g.wall.includes('east'))w+=dx;
   if(g.wall.includes('west'))w-=dx;
   if(g.wall.includes('south'))d+=dz;
   if(g.wall.includes('north'))d-=dz;
   w=clamp(Math.round(w*10)/10,3.5,14);d=clamp(Math.round(d*10)/10,3.5,14);
   const next=sizedRoomPlan(s.roomPlan,w,d);
   if(next&&s.setRoomPlan(next)){this.syncRoomFields();this.render();}
  }else if(g.type==='furniture'){
   const mesh=s.items.find(m=>m.userData.id===g.id);
   if(!mesh)return;
   let x=p.x+g.dx,z=p.z+g.dz;
   if(s.roomPlan){
    const [w,,d]=mesh.userData.product.size,halfX=Math.min(s.roomPlan.w/2-.2,w/2+.1),halfZ=Math.min(s.roomPlan.d/2-.2,d/2+.1);
    x=clamp(x,-s.roomPlan.w/2+halfX,s.roomPlan.w/2-halfX);
    z=clamp(z,-s.roomPlan.d/2+halfZ,s.roomPlan.d/2-halfZ);
   }
   if(s.roomPlan)s.moveRoomFurniture(g.id,x,z);
   else s.moveObjectFromPlan(g.id,x,z);
  }else if(g.type==='architecture'&&s.roomPlan){
   if(Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>8)g.moved=true;
   if(!g.moved)return;
   const el=s.roomPlan.elements.find(x=>x.id===g.id);
   if(!el)return;
   const snap=this.closestWall(p,s.roomPlan,el.type);if(!snap)return;
   const candidate={...el,wall:snap.wall,u:snap.u};
   if(canPlaceRoomElement(s.roomPlan,candidate).valid){
    s.setRoomPlan({...s.roomPlan,elements:s.roomPlan.elements.map(x=>x.id===el.id?candidate:x)});
    this.render();
   }
  }else if(g.type==='pan'){
   if(g.view){
    this.viewportLock={...g.view,
     left:g.view.left-(e.clientX-g.x)/g.pixelWidth*g.view.width,
     top:g.view.top-(e.clientY-g.y)/g.pixelHeight*g.view.height};
   }else{
    this.panX=g.panX-(e.clientX-g.x)/g.pixelWidth*g.sx;
    this.panZ=g.panZ-(e.clientY-g.y)/g.pixelHeight*g.sz;
   }
   this.render();
  }
 }
 end(e){
  if(!this.pointers.has(e.pointerId))return;
  this.pointers.delete(e.pointerId);
  try{this.svg.releasePointerCapture(e.pointerId);}catch{}
  // TV controls are exclusively opened by tapping its 3D panel in Studio.
  // Avoid stale one-finger drags after a two-finger twist/pinch.
  this.gesture=null;
 }
 render(){
  const studio=this.getStudio();if(!studio||!this.svg)return;
  const state=studio.model,plan=studio.roomPlan;
  const items=studio.items.map(mesh=>{
   const pos=plan?{x:mesh.position.x,z:mesh.position.z}:studio.planPosition(mesh),[w,,d]=mesh.userData.product.size,k=plan?1:state.correction;
   return {mesh,x:pos.x,z:pos.z,w:w*k,d:d*k,angle:mesh.rotation.y+(plan?0:state.layoutYaw)};
  });
  const a=state.a,b=state.b;
  const lim=plan?[{x:-plan.w/2,z:-plan.d/2,w:0,d:0},{x:plan.w/2,z:plan.d/2,w:0,d:0}]:
   [{x:a.x,z:a.z,w:0,d:0},{x:b.x,z:b.z,w:0,d:0},...items];
  const minX=Math.min(...lim.map(v=>v.x-Math.max(v.w,v.d)*.7))-.75;
  const maxX=Math.max(...lim.map(v=>v.x+Math.max(v.w,v.d)*.7))+.75;
  const minZ=Math.min(...lim.map(v=>v.z-Math.max(v.w,v.d)*.7))-.75;
  const maxZ=Math.max(...lim.map(v=>v.z+Math.max(v.w,v.d)*.7))+.75;
  const baseX=(minX+maxX)/2,baseZ=(minZ+maxZ)/2;
  const span=Math.max(4.5,maxX-minX,(maxZ-minZ)*320/250)/this.zoom;
  const width=this.viewportLock?.width??span,height=this.viewportLock?.height??span*250/320;
  // Resizing walls changes the room geometry, not the user camera/zoom.
  const left=this.viewportLock?.left??baseX+this.panX-width/2;
  const top=this.viewportLock?.top??baseZ+this.panZ-height/2;
  this.viewport={width,height,left,top};
  this.svg.setAttribute('viewBox',[num(left*100),num(top*100),num(width*100),num(height*100)].join(' '));
  let grid='';
  for(let x=Math.ceil(left);x<left+width;x++)grid+='<path d="M'+x*100+' '+top*100+'v'+height*100+'" stroke="#e0d9cf" stroke-width="1"/>';
  for(let z=Math.ceil(top);z<top+height;z++)grid+='<path d="M'+left*100+' '+z*100+'h'+width*100+'" stroke="#e0d9cf" stroke-width="1"/>';
  let architecture='';
  if(plan){
   const x=-plan.w*50,z=-plan.d*50;
   const wallPaths=[
    {side:'north',d:'M'+x+' '+z+'H'+(x+plan.w*100)},
    {side:'south',d:'M'+x+' '+(z+plan.d*100)+'H'+(x+plan.w*100)},
    {side:'west',d:'M'+x+' '+z+'V'+(z+plan.d*100)},
    {side:'east',d:'M'+(x+plan.w*100)+' '+z+'V'+(z+plan.d*100)}
   ];
   const perimeter=wallPaths.map(({side,d})=>{
    const removed=plan.hiddenWalls?.includes(side),selected=this.selectedWall===side;
    return '<path d="'+d+'" fill="none" stroke="'+(selected?'#24886b':removed?'#a8b2a9':'#697477')+
     '" stroke-width="'+(selected?30:removed?9:23)+'" '+(removed?'stroke-dasharray="19 15" ':'')+'pointer-events="none"/>';
   }).join('');
   architecture='<rect x="'+x+'" y="'+z+'" width="'+plan.w*100+'" height="'+plan.d*100+'" fill="#f6f3ed"/>'+perimeter+
    '<path d="M'+x+' '+(z-45)+'h'+plan.w*100+'" stroke="#778a83" stroke-width="1.5"/>'+
    '<text x="0" y="'+(z-60)+'" font-size="19" fill="#495b55" text-anchor="middle">'+num(plan.w)+' m</text>'+
    '<text x="'+(x-48)+'" y="0" font-size="19" fill="#495b55" text-anchor="middle" transform="rotate(-90 '+(x-48)+' 0)">'+num(plan.d)+' m</text>';
   for(const element of plan.elements){
    const spec=ROOM_SPECS[element.type],anchor=wallAnchor(plan,element.wall,element.u);
    const vertical=element.wall==='east'||element.wall==='west',length=spec.width*100;
    const isTV=element.type==='tv',selected=this.selectedArch===element.id;
    const x0=anchor.x*100,y0=anchor.z*100;
    architecture+='<g data-plan-el="'+esc(element.id)+'" style="cursor:grab">'+
      '<rect x="'+(x0-(vertical?11:length/2))+'" y="'+(y0-(vertical?length/2:11))+'" width="'+(vertical?22:length)+'" height="'+(vertical?length:22)+'" rx="2" fill="'+(isTV?'#bd91db':spec.color)+'" stroke="'+(selected?'#1e3b33':'#f9fafb')+'" stroke-width="'+(selected?6:3)+'"/>'+
      '<text x="'+x0+'" y="'+(y0+(vertical?-length/2-20:-22))+'" font-size="15" fill="#3a4c48" text-anchor="middle" pointer-events="none">'+esc(spec.label)+'</text></g>';
   }
  }
  const lengthAB=Math.hypot(a.x-b.x,a.z-b.z)/Math.max(.001,state.correction);
  const marks=plan?'':'<path d="M'+a.x*100+' '+a.z*100+'L'+b.x*100+' '+b.z*100+'" stroke="#4b827c" stroke-width="2.5" stroke-dasharray="8 5"/>'+
    '<circle cx="'+a.x*100+'" cy="'+a.z*100+'" r="5" fill="#4b827c"/><circle cx="'+b.x*100+'" cy="'+b.z*100+'" r="5" fill="#4b827c"/>';
  const objects=items.map(({mesh,x,z,w,d,angle})=>{
   const id=mesh.userData.id,index=mesh.userData.index,wall=index>=16&&index<=21;
   const selected=mesh===studio.selected,isRug=index===7;
   const color=selected?'#478a80':wall?'#a47b63':isRug?'#e2caa9':[0,1,3,22,23,24].includes(index)?'#bda691':'#879d8d';
   const title=esc(mesh.userData.product.name),caption=this.expanded?'<text text-anchor="middle" y="'+(-d*50-12)+'" font-size="16" fill="#655749" transform="rotate('+(-angle*180/Math.PI)+')">'+title+'</text>':'';
   return '<g data-object-id="'+id+'" aria-label="'+title+'" transform="translate('+x*100+' '+z*100+') rotate('+angle*180/Math.PI+')" style="cursor:grab;opacity:'+(mesh.visible?1:.4)+'">'+
    '<rect x="'+(-w*50)+'" y="'+(-d*50)+'" width="'+w*100+'" height="'+Math.max(wall?6:4,d*100)+'" rx="'+(isRug?1:4)+'" fill="'+color+'" stroke="'+(selected?'#245b53':'#786b60')+'" stroke-width="'+(selected?4:1.6)+'"/>'+caption+'</g>';
  }).join('');
  this.svg.innerHTML='<rect x="'+left*100+'" y="'+top*100+'" width="'+width*100+'" height="'+height*100+'" fill="#eee9e0"/>'+grid+architecture+marks+objects;
  const measure=this.panel.querySelector('[data-map-measure]');
  if(measure)measure.textContent=(plan?num(plan.w)+' × '+num(plan.d)+' متر · ':'A—B '+num(lengthAB)+' متر · ')+items.length.toLocaleString('fa-IR')+' مدل · '+Math.round(this.zoom*100)+'٪';
  const selected=studio.selected;
  const angle=selected?Math.round(Math.atan2(Math.sin(selected.rotation.y),Math.cos(selected.rotation.y))*180/Math.PI):0;
  this.angleInput.value=String(angle);this.angleInput.disabled=!selected;
  for(const key of ['[data-map-left]','[data-map-right]'])this.panel.querySelector(key).disabled=!selected;
  const arch=plan?.elements.find(el=>el.id===this.selectedArch);
  this.panel.querySelector('[data-map-remove]').disabled=!selected&&!arch&&!this.selectedWall;
  const deleteBtn=this.panel.querySelector('[data-plan-delete]');
  deleteBtn.disabled=!selected&&!arch&&!this.selectedWall;
  deleteBtn.textContent=this.selectedWall&&plan?.hiddenWalls?.includes(this.selectedWall)?'↶ بازگرداندن دیوار':this.selectedWall?'× حذف دیوار':'× حذف';
  this.panel.querySelector('[data-map-angle-value]').textContent=angle.toLocaleString('fa-IR')+'°';
  this.panel.querySelector('[data-map-selected]').textContent=arch?ROOM_SPECS[arch.type].label+' · '+num(arch.u)+' متر روی دیوار '+arch.wall:
   this.selectedWall?'دیوار '+this.selectedWall+' · برای تغییر ابعاد بکش':
   selected?selected.userData.product.name:'یک آیتم یا دیوار را انتخاب و جابه‌جا کن؛ چرخش مبل با دو انگشت';
 }
}
