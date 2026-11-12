import {MATERIAL_ROLES,ROLE_LABELS,roleMaterials,materialPresets,materialImage} from './material-roles.js?v=0.16.16';
export function mountMaterialPanel(host,studio,mesh,{notify=()=>{}}={}){
 let active='fabric';
 const valid=()=>host.isConnected&&studio.items.includes(mesh)&&studio.selected===mesh&&!mesh.userData.disposed;
 const visual=()=>mesh.getObjectByName('imported-visual');
 const render=()=>{
  if(!valid())return;
  const groups=roleMaterials(visual()),matches=groups.filter(e=>e.role===active);
  host.innerHTML='<div class="material-tabs" role="tablist" aria-label="بخش متریال">'+MATERIAL_ROLES.map(role=>`<button type="button" role="tab" id="material-tab-${role}" aria-controls="material-role-panel" aria-selected="${role===active}" tabindex="${role===active?0:-1}" data-role="${role}">${ROLE_LABELS[role]}</button>`).join('')+'</div><section role="tabpanel" id="material-role-panel" aria-labelledby="material-tab-'+active+'"></section><p class="sheet-tip" data-material-status role="status"></p>';
  const panel=host.querySelector('[role=tabpanel]'),status=host.querySelector('[data-material-status]');
  const setStatus=text=>{if(host.isConnected)status.textContent=text;};
  const apply=async style=>{
   if(!valid()){setStatus('آبجکت انتخاب‌شده عوض شده؛ پنل متریال را دوباره باز کن.');return;}
   setStatus('در حال بارگذاری تکسچر…');
   try{const ok=await studio.setMaterialStyle(active,style,mesh);if(!ok){setStatus('تغییر انجام نشد؛ انتخاب یا بخش متریال تغییر کرده است.');return;}if(valid()){render();host.querySelector('[data-material-status]').textContent='فقط متریال همین آبجکت تغییر کرد.';}}
   catch(error){setStatus(error.message||'بارگذاری تکسچر انجام نشد.');notify(error.message||'بارگذاری تکسچر انجام نشد.');}
  };
  if(!visual())panel.innerHTML='<p class="sheet-tip">مدل هنوز آماده نشده است.</p>';
  else if(!matches.length)panel.innerHTML='<p class="sheet-tip">این مدل متریال «'+ROLE_LABELS[active]+'» ندارد. نام متریال در فایل مدل باید شامل '+active+' باشد و UV داشته باشد.</p>';
  else{
   const presets=materialPresets(active),current=mesh.userData.materialStyles?.[active]?.source;
   panel.innerHTML='<div class="sofa-fabric-grid">'+presets.map((p,i)=>`<button type="button" data-preset="${i}" class="${current===p.source?'selected':''}" aria-pressed="${current===p.source}"><img src="${p.url}" alt="" width="120" height="90" loading="lazy"><span>${p.label}</span></button>`).join('')+'</div><label class="material-upload">انتخاب عکس از دستگاه<input type="file" accept="image/jpeg,image/png,image/webp" data-material-image></label><button type="button" class="material-reset">بازگشت این بخش به متریال اصلی</button>';
   if(current?.startsWith('data:')){const img=document.createElement('img');img.className='material-current';img.alt='تکسچر انتخاب‌شده';img.src=current;panel.append(img);}
   panel.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>void apply({source:presets[Number(button.dataset.preset)].source}));
   panel.querySelector('.material-reset').onclick=()=>void apply(null);
   panel.querySelector('[data-material-image]').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;setStatus('در حال سبک‌سازی عکس…');try{const style=await materialImage(file);if(valid()&&host.contains(event.target))await apply(style);}catch(error){setStatus(error.message||'خواندن عکس ممکن نشد.');}};
   if(visual().userData.legacyFabric&&!groups.some(e=>e.role!=='fabric'&&e.role))setStatus('مدل‌های قدیمی ممکن است فقط یک بخش پارچه داشته باشند. تغییر فقط روی آبجکت انتخاب‌شده است.');
  }
  const tabs=[...host.querySelectorAll('[role=tab]')];
  const choose=role=>{active=role;render();host.querySelector('[data-role='+role+']')?.focus();};
  tabs.forEach((tab,i)=>{tab.onclick=()=>choose(tab.dataset.role);tab.onkeydown=event=>{let next;if(event.key==='ArrowLeft')next=(i+1)%MATERIAL_ROLES.length;else if(event.key==='ArrowRight')next=(i+MATERIAL_ROLES.length-1)%MATERIAL_ROLES.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=MATERIAL_ROLES.length-1;if(next!==undefined){event.preventDefault();choose(MATERIAL_ROLES[next]);}};});
 };
 render();if(!visual())void mesh.userData.loadPromise?.then(()=>{if(valid())render();});
}
