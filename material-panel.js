import {modelMaterialSlots,materialPresets,ROLE_LABELS} from './material-roles.js?v=0.18.7';

// Exactly one toolbar icon per GLB material. This is only the thumbnail strip
// opened by that icon; there are NO category/slot tabs inside it and no upload.
export function materialSlotDescriptors(mesh){
 if(!mesh)return [];
 if(!mesh.userData?.imported)return [{id:0,name:'رنگ',role:'fabric'}];
 const visual=mesh.getObjectByName('imported-visual');
 return modelMaterialSlots(visual).map((slot,id)=>({id,name:slot.name,role:slot.role}));
}
export function renderMaterialSlotThumbnails(host,studio,mesh,slotIndex,{notify=()=>{}}={}){
 const descriptor=materialSlotDescriptors(mesh)[slotIndex];
 host.replaceChildren();
 if(!descriptor)return;
 const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const presets=materialPresets(descriptor.role);
 const chosen=mesh.userData.materialSlotStyles?.[slotIndex]?.source;
 const rail=document.createElement('div');rail.className='material-slot-thumbnails';rail.setAttribute('aria-label',descriptor.name);
 rail.innerHTML=presets.map((preset,i)=>'<button type="button" data-preset="'+i+'" class="'+(chosen===preset.source?'selected':'')+'" title="'+escape(preset.label)+'">'+
  '<img src="'+escape(preset.url)+'" alt="" loading="lazy"><small>'+escape(preset.label)+'</small></button>').join('')+
  '<button type="button" data-slot-reset title="بازگرداندن متریال اصلی"><span class="material-original-swatch">↺</span><small>اصلی</small></button>';
 host.append(rail);
 const status=document.createElement('small');status.className='material-slot-status';status.setAttribute('role','status');host.append(status);
 let requestVersion=0;
 const apply=async style=>{
  const version=++requestVersion;
  status.textContent='در حال اعمال…';
  try{
   const ok=await studio.setMaterialSlotStyle(slotIndex,style,mesh);
   if(version!==requestVersion||!host.isConnected||studio.selected!==mesh)return;
   status.textContent=ok?'':'متریال قابل تغییر نیست';
   if(ok){
    rail.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('selected',!!style&&presets[Number(b.dataset.preset)].source===style.source));
   }
  }catch(error){
   if(version!==requestVersion)return;
   status.textContent='اعمال نشد';
   notify(error?.message||'تکسچر بارگذاری نشد');
  }
 };
 rail.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{
  const preset=presets[Number(button.dataset.preset)];if(preset)void apply({source:preset.source});
 });
 rail.querySelector('[data-slot-reset]').onclick=()=>void apply(null);
}

// Older, non-AR material dialog integration: no nested material selection.
export function mountMaterialPanel(host,studio,mesh,options={}){
 renderMaterialSlotThumbnails(host,studio,mesh,0,options);
}
