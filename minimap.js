// CHIDO interactive floor plan. Uses the same live Studio objects and calibrated transform as AR.
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=n=>Number(n).toFixed(2);
export class LiveMiniMap {
 constructor(panel,getStudio){
  this.panel=panel;this.getStudio=getStudio;this.svg=panel.querySelector('svg');
  this.expanded=false;this.drag=null;this.bounds=null;
  panel.querySelector('[data-map-expand]').onclick=()=>{this.setExpanded(!this.expanded);};
  panel.querySelector('[data-map-add]').onclick=()=>{this.collapse();document.querySelector('#arAddTool')?.click();};
  panel.querySelector('[data-map-remove]').onclick=()=>{const s=getStudio();if(!s?.selected)return;if(confirm('آبجکت انتخاب‌شده از چیدمان حذف شود؟'))s.remove();this.render();};
  panel.querySelector('[data-map-left]').onclick=()=>{const s=getStudio();if(s?.selected)s.rotate(s.selected.rotation.y*180/Math.PI-45);};
  panel.querySelector('[data-map-right]').onclick=()=>{const s=getStudio();if(s?.selected)s.rotate(s.selected.rotation.y*180/Math.PI+45);};
  this.angleInput=panel.querySelector('[data-map-angle]');
  this.angleInput.oninput=value=>{
   const studio=getStudio();
   if(!studio?.selected)return;
   const next=Number(this.angleInput.value);
   if(Number.isFinite(next))studio.rotate(next);
  };
  this.svg.addEventListener('pointerdown',event=>this.start(event));
  this.svg.addEventListener('pointermove',event=>this.move(event));
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
   this.svg.addEventListener(name,()=>{this.drag=null;});
 }
 setExpanded(value){
  this.expanded=!!value;
  this.panel.classList.toggle('expanded',this.expanded);
  this.panel.querySelector('[data-map-expand]').textContent=this.expanded?'بستن نقشه':'•••';
  this.panel.querySelector('[data-map-expand]').setAttribute('aria-label',this.expanded?'بستن نقشه دوبعدی':'بازکردن نقشه دوبعدی');
  this.svg.setAttribute('aria-label',this.expanded?'پلان بزرگ؛ آبجکت‌ها را لمس یا جابه‌جا کن':'نمای بالای زنده از تمام آبجکت‌ها');
  this.drag=null;
  this.render();
 }
 collapse(){if(this.expanded)this.setExpanded(false);}
 point(event){
  const matrix=this.svg.getScreenCTM();
  if(!matrix)return null;
  const p=this.svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
  const local=p.matrixTransform(matrix.inverse());
  return {x:local.x/100,z:local.y/100};
 }
 start(event){
  if(!this.expanded){this.setExpanded(true);return;}
  const target=event.target.closest('[data-object-id]');
  if(!target)return;
  const studio=this.getStudio();if(!studio)return;
  const mesh=studio.items.find(m=>m.userData.id===Number(target.dataset.objectId));
  const point=this.point(event);if(!mesh||!point)return;
  studio.select(mesh);
  const pos=studio.planPosition(mesh);
  if(event.target.closest('[data-rotate-id]'))this.drag={type:'rotate',id:mesh.userData.id,cx:pos.x,cz:pos.z,start:Math.atan2(point.z-pos.z,point.x-pos.x),rotation:mesh.rotation.y};
  else this.drag={type:'move',id:mesh.userData.id,dx:pos.x-point.x,dz:pos.z-point.z};
  event.preventDefault();this.svg.setPointerCapture(event.pointerId);
 }
 move(event){
  if(!this.drag)return;
  const studio=this.getStudio(),point=this.point(event);if(!studio||!point)return;
  event.preventDefault();
  if(this.drag.type==='rotate'){
   const current=Math.atan2(point.z-this.drag.cz,point.x-this.drag.cx);
   let delta=current-this.drag.start;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;
   studio.rotate((this.drag.rotation+delta)*180/Math.PI);
  }else studio.moveObjectFromPlan(this.drag.id,point.x+this.drag.dx,point.z+this.drag.dz);
 }
 render(){
  const studio=this.getStudio();if(!studio||!this.svg)return;
  const state=studio.model,items=studio.items.map(mesh=>{
   const pos=studio.planPosition(mesh),[w,,d]=mesh.userData.product.size,k=state.correction;
   return {mesh,x:pos.x,z:pos.z,w:w*k,d:d*k,angle:mesh.rotation.y+state.layoutYaw};
  });
  const a=state.a,b=state.b;
  const limits=[{x:a.x,z:a.z,w:0,d:0},{x:b.x,z:b.z,w:0,d:0},...items];
  const minX=Math.min(...limits.map(x=>x.x-Math.max(x.w,x.d)*.72))-0.65;
  const maxX=Math.max(...limits.map(x=>x.x+Math.max(x.w,x.d)*.72))+0.65;
  const minZ=Math.min(...limits.map(x=>x.z-Math.max(x.w,x.d)*.72))-0.65;
  const maxZ=Math.max(...limits.map(x=>x.z+Math.max(x.w,x.d)*.72))+0.65;
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  const spanX=Math.max(4.5,maxX-minX),spanZ=Math.max(3.8,maxZ-minZ);
  const span=Math.max(spanX,spanZ*320/250);
  const width=span,height=span*250/320;
  const left=cx-width/2,top=cz-height/2;
  this.svg.setAttribute('viewBox',[num(left*100),num(top*100),num(width*100),num(height*100)].join(' '));
  let grid='';
  for(let x=Math.ceil(left);x<left+width;x++)grid+='<path d="M'+(x*100)+' '+(top*100)+'v'+(height*100)+'" stroke="#dad3c8" stroke-width="1"/>';
  for(let z=Math.ceil(top);z<top+height;z++)grid+='<path d="M'+(left*100)+' '+(z*100)+'h'+(width*100)+'" stroke="#dad3c8" stroke-width="1"/>';
  const length=Math.hypot(a.x-b.x,a.z-b.z)/Math.max(.001,state.correction);
  let marks='<path d="M'+(a.x*100)+' '+(a.z*100)+' L'+(b.x*100)+' '+(b.z*100)+'" stroke="#4b827c" stroke-width="3" stroke-dasharray="8 5"/>';
  for(const [letter,p] of [['A',a],['B',b]])marks+='<circle cx="'+(p.x*100)+'" cy="'+(p.z*100)+'" r="5" fill="#4b827c"/><text x="'+(p.x*100+8)+'" y="'+(p.z*100-9)+'" font-size="17" fill="#396d68">'+letter+'</text>';
  const objects=items.map(({mesh,x,z,w,d,angle})=>{
   const id=mesh.userData.id,index=mesh.userData.index,wall=index>=16&&index<=21;
   const isRug=index===7,selected=mesh===studio.selected;
   const color=selected?'#478a80':wall?'#a47b63':isRug?'#e2caa9':[0,1,3].includes(index)?'#bda691':'#879d8d';
   const caption=esc(mesh.userData.product.name);
   const label=this.expanded?'<text text-anchor="middle" y="'+(-d*50-8)+'" font-size="16" fill="#655749" transform="rotate('+(-angle*180/Math.PI)+')">'+caption+' · '+Math.round(w*100)+'×'+Math.round(d*100)+'</text>':'';
   const handle=this.expanded&&selected?'<path d="M0 '+(-d*50)+'V'+(-d*50-27)+'" stroke="#175e50" stroke-width="3"/><circle data-rotate-id="'+id+'" cx="0" cy="'+(-d*50-30)+'" r="14" fill="#f1c77b" stroke="#175e50" stroke-width="3"/><text x="0" y="'+(-d*50-24)+'" font-size="16" text-anchor="middle" fill="#175e50" pointer-events="none">↻</text>':'';
   return '<g data-object-id="'+id+'" aria-label="'+caption+'" transform="translate('+(x*100)+' '+(z*100)+') rotate('+(angle*180/Math.PI)+')" style="cursor:pointer;opacity:'+(mesh.visible?'1':'.4')+'">'+
    '<rect x="'+(-w*50)+'" y="'+(-d*50)+'" width="'+(w*100)+'" height="'+Math.max(wall?6:4,d*100)+'" rx="'+(isRug?1:4)+'" fill="'+color+'" stroke="'+(selected?'#245b53':'#786b60')+'" stroke-width="'+(selected?3:1.6)+'"'+(mesh.visible?'':' stroke-dasharray="4 3"')+'/>'+handle+label+'</g>';
  }).join('');
  this.svg.innerHTML='<rect x="'+(left*100)+'" y="'+(top*100)+'" width="'+(width*100)+'" height="'+(height*100)+'" fill="#f4efe7"/>'+grid+marks+objects;
  const measure=this.panel.querySelector('[data-map-measure]');
  if(measure)measure.textContent='A–B: '+(length*100).toLocaleString('fa-IR',{maximumFractionDigits:1})+' سانتی‌متر · '+items.length.toLocaleString('fa-IR')+' آبجکت';
  const selected=studio.selected;
  const angle=selected?Math.round(Math.atan2(Math.sin(selected.rotation.y),Math.cos(selected.rotation.y))*180/Math.PI/5)*5:0;
  this.angleInput.value=String(angle);
  this.angleInput.disabled=!selected;
  for(const key of ['[data-map-left]','[data-map-right]'])this.panel.querySelector(key).disabled=!selected;
  this.panel.querySelector('[data-map-remove]').disabled=!selected;
  this.panel.querySelector('[data-map-angle-value]').textContent=angle.toLocaleString('fa-IR')+'°';
  this.panel.querySelector('[data-map-selected]').textContent=selected?'انتخاب‌شده: '+selected.userData.product.name:'برای چرخش، یک آبجکت را در نقشه انتخاب کن';
 }
}
