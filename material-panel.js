import {modelMaterialSlots,materialPresets,materialImage,ROLE_LABELS} from './material-roles.js?v=0.16.23';

// Material slots 1..N are taken from the model's actual glTF materials. A
// fabric/wood role selects the correct *catalogue* of thumbnails, not which
// materials are edited. Thus two fabric materials remain independently editable.
export function mountMaterialPanel(host,studio,mesh,{notify=()=>{}}={}){
 let active=-1,requestVersion=0;
 const icons={fabric:'🧵',wood:'🪵',metal:'⚙️',glass:'◈'};
 const valid=()=>host.isConnected&&studio.items.includes(mesh)&&studio.selected===mesh&&!mesh.userData.disposed;
 const visual=()=>mesh.getObjectByName('imported-visual');
 const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const render=()=>{
  if(!valid())return;
  const slots=modelMaterialSlots(visual());
  if(active>=slots.length)active=-1;
  host.innerHTML='<div class="material-slot-layout"><nav class="material-slot-buttons" aria-label="اسلات‌های واقعی متریال"></nav><section class="material-slot-options" aria-live="polite"></section></div><p class="sheet-tip material-slot-status" role="status"></p>';
  const buttons=host.querySelector('.material-slot-buttons'),panel=host.querySelector('.material-slot-options'),status=host.querySelector('.material-slot-status');
  const setStatus=message=>{if(valid()&&host.contains(status))status.textContent=message;};
  if(!visual()){buttons.innerHTML='<small>مدل در حال بارگذاری است…</small>';return;}
  if(!slots.length){panel.innerHTML='<small>این مدل متریال قابل تغییر ندارد.</small>';return;}
  buttons.innerHTML=slots.map((slot,i)=>'<button type="button" data-slot="'+i+'" aria-pressed="'+(active===i)+'" title="'+escape(slot.name)+'">'+
   '<span class="role-icon" aria-hidden="true">'+(icons[slot.role]||'◩')+'</span>'+
   '<span>متریال '+(i+1)+'</span><small>'+escape(slot.name)+'</small></button>').join('');
  if(active<0){panel.innerHTML='<p class="sheet-tip">برای دیدن تکسچرهای هر بخش، شماره همان متریال را انتخاب کن.</p>';}
  else{
   const slot=slots[active],presets=materialPresets(slot.role);
   const current=mesh.userData.materialSlotStyles?.[active]?.source;
   panel.innerHTML='<div class="material-slot-heading">'+(icons[slot.role]||'◩')+' '+escape(slot.name)+' · '+escape(ROLE_LABELS[slot.role]||'متریال')+'</div>'+
    '<div class="material-slot-thumbnails">'+presets.map((p,i)=>'<button type="button" data-preset="'+i+'" class="'+(current===p.source?'selected':'')+'" aria-pressed="'+(current===p.source)+'">'+
    '<img src="'+escape(p.url)+'" alt="" width="104" height="82" loading="lazy"><span>'+escape(p.label)+'</span></button>').join('')+'</div>'+
    '<div class="material-slot-footer"><label>انتخاب تکسچر شخصی<input type="file" accept="image/jpeg,image/png,image/webp" data-material-image></label>'+
    '<button type="button" data-material-reset>بازگردانی متریال اصلی</button></div>';
   const apply=async style=>{
    const index=active,version=++requestVersion;
    setStatus('در حال اعمال متریال '+(index+1)+'…');
    try{
     const applied=await studio.setMaterialSlotStyle(index,style,mesh);
     if(!valid()||version!==requestVersion||active!==index)return;
     if(!applied){setStatus('این اسلات در مدل قابل تغییر نیست.');return;}
     render();host.querySelector('.material-slot-status').textContent='فقط متریال '+(index+1)+' تغییر کرد.';
    }catch(error){if(version!==requestVersion)return;setStatus(error.message||'بارگذاری این تکسچر انجام نشد.');notify(error.message||'خطای متریال');}
   };
   panel.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>void apply({source:presets[Number(button.dataset.preset)].source}));
   panel.querySelector('[data-material-reset]').onclick=()=>void apply(null);
   panel.querySelector('[data-material-image]').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    setStatus('در حال کوچک‌سازی تصویر…');
    try{const style=await materialImage(file);if(valid())await apply(style);}
    catch(error){setStatus(error.message||'تکسچر خوانده نشد.');}
   };
  }
  buttons.querySelectorAll('[data-slot]').forEach(button=>button.onclick=()=>{
   const next=Number(button.dataset.slot);
   active=active===next?-1:next;
   requestVersion++;render();
  });
 };
 render();
 if(!visual())void mesh.userData.loadPromise?.then(()=>{if(valid())render();});
}
