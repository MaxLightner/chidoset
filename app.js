import {mountMaterialPanel} from './material-panel.js?v=0.14.0';
import {instanceMaterialMap,applyInstanceMaterialMap} from './material-roles.js?v=0.14.0';
import {rememberAccount,accountName} from './auth-storage.js';
import {readRecovery,saveRecovery,clearRecovery,filterPublishedScene} from './app-recovery.js';
import {runtimeHealth,recordRuntime,recordRuntimeError} from './runtime-health.js?v=0.14.0';
import {StudioCache,sceneStateKey} from './studio-cache.js';
import {endXRSession} from './xr-end.js';
import {accountLogin} from './account-login.js';
import {explainXR,requestARSession} from './xr.js?v=0.5.4';
import {photos,savePhoto,removePhoto} from './storage.js?v=0.12.2';
import {CAMERA_RATIOS,CAMERA_PHOTO_KIND,isCameraPhoto,effectiveCameraRatio} from './camera-capture.js?v=0.5.4';
import {RUG_STYLES,rugPreviewDataUrl} from './rug-textures.js?v=0.5.4';
import {allowedCapacities,layoutOptions,buildLayout,layoutSummary,layoutPreviewSvg} from './layout-templates.js?v=0.5.4';
import {readDraft,saveDraft,clearDraft,listCustomLayouts,saveCustomLayout,overwriteCustomLayout,removeCustomLayout} from './layout-storage.js?v=0.5.4';
import {ASSET_CATEGORIES,RUG_SIZE_PRESETS,isLamp,isSofa,isTable,isWallArt,variantsFor,categoryForIndex} from './asset-metadata.js?v=0.12.0';
import {savedPlanSvg} from './saved-plan.js?v=0.8.0';
import {FLOOR_FINISHES,WALL_FINISHES,finishPreviewDataUrl} from './architecture-materials.js';
import {LiveMiniMap} from './minimap.js?v=0.5.4';
import {CUSHION_PRESETS} from './sofa-cushions.js?v=0.5.4';
import {getCloudProduct,getCloudProductInfo,cloudProductList,cloudProductInfoList} from './cloud-product-registry.js';
import {supabase,activateBranch,signIn,signInShowroom,getMembership,loadCompanySets,loadDemoLibrary,saveOfficialLayout,saveOfficialColorway,createLiveSession,publishLiveScene,publishLiveCamera,stopLiveSession,updateDeviceHeartbeat,logActivity,getCompanyDashboard,requestOfficialLayout,archiveOfficialLayout,archiveOfficialColorway} from './chido-cloud.js?v=0.12.3';
const studioCache=new StudioCache();
const studioOwner=()=>cloudMembership?cloudMembership.company_id+':'+cloudMembership.user.id:'';
const $=s=>document.querySelector(s),app=$('#app'),fa=n=>n.toLocaleString('fa-IR');
let studio,Scene,palette,space='پذیرایی',layout='empty',supported=false,routeVersion=0,photoURLs=[],savedItems=[],arReport=null,sceneMemory=null,arStarting=false,lastXRErrorReport='',activeSavedLayoutId=null;
const minimap=new LiveMiniMap($('#arMiniMap'),()=>studio);
let chidoMenuOpen=false;
let pendingARSession=null,calibrationPrompted=false;
let homeExitRequested=false,homeExitBusy=false,homeExitFallback=null;
const themes=[
 {name:'کرم و چوب',colors:['#cfbeaa','#c9bdae','#aa9882','#d7c8b4']},
 {name:'آبی و کرم',colors:['#7a9196','#d7c5b2','#879fa2','#c3b7a9']},
 {name:'سبز زیتونی',colors:['#909c84','#d4c6b4','#adba9d','#b6a793']}
];
let themeIndex=0,styleChoice='مینیمال',previewEnabled=false,peopleCount=5;
let cloudMembership=null,cloudSets=[],demoLibrary=[],activeCloudSetId=null,activeCloudLayout=null,activeCloudColorway=null,activeLiveSession=null;
let liveSceneTimer=null,lastLiveCameraSent=0,liveCameraBusy=false,liveCameraQueued=null;
let appSessionLogged=false,lastHeartbeatAt=0;
const catalogImages=[
 ['کاناپه','<rect x="14" y="24" width="74" height="46" rx="10"/><path d="M16 38h70M32 42v25m37-25v25"/>'],
 ['تک‌نفره','<rect x="27" y="20" width="48" height="54" rx="10"/><path d="M28 40h46"/>'],
 ['میز جلو مبلی','<rect x="14" y="31" width="74" height="32" rx="6"/><path d="M27 31v32m48-32v32"/>'],
 ['صندلی','<rect x="27" y="20" width="48" height="54" rx="10"/><path d="M28 40h46"/>'],
 ['گلدان','<path d="M39 71h24l7-35H33zM51 35V12m0 23-15-14m15 9 18-13"/><path d="M33 22q15-20 18 9M70 17q-20-5-19 13"/>'],
 ['کوسن','<rect x="22" y="23" width="58" height="49" rx="14"/><path d="M29 30q23 12 44 0m-44 34q23-12 44 0"/>'],
 ['آباژور','<path d="M36 24h30l9 29H27zM51 53v25M33 79h36"/>'],
 ['فرش','<rect x="13" y="20" width="77" height="60" rx="3"/><path d="M22 26h59v48H22zM51 34l19 16-19 16-19-16z"/>'],
 ['تخت خواب','<rect x="20" y="12" width="60" height="76" rx="4"/><rect x="25" y="25" width="50" height="54" rx="5"/><rect x="27" y="30" width="21" height="15" rx="4"/><rect x="52" y="30" width="21" height="15" rx="4"/>'],
 ['میز کار','<rect x="13" y="25" width="74" height="40" rx="3"/><path d="M22 66v14m56-14v14M25 35h20v20H25z"/>'],
 ['میز ناهارخوری','<rect x="20" y="22" width="60" height="58" rx="8"/><path d="M31 13h38M31 88h38M11 36v30m78-30v30"/>'],
 ['صندلی ناهارخوری','<rect x="29" y="20" width="42" height="58" rx="5"/><path d="M29 36h42M36 68h28"/>'],
 ['میز عسلی مربعی','<rect x="25" y="24" width="50" height="50" rx="5"/><path d="M36 33h28v32H36z"/>'],
 ['میز جلو مبلی مربعی بزرگ','<rect x="13" y="13" width="74" height="74" rx="6"/><path d="M27 27h46v46H27z"/>'],
 ['آباژور رومیزی','<path d="M34 38h32l8 22H26zM50 60v20M37 83h26"/>'],
 ['آباژور سه‌پایه','<path d="M36 22h28l12 30H24zM50 52L27 87M50 52v35m0-35 23 35"/>'],
 ['تابلو عمودی کوچک','<rect x="33" y="12" width="34" height="77"/><path d="M40 57l10-22 11 15"/>'],
 ['تابلو افقی کوچک','<rect x="16" y="31" width="68" height="38"/><path d="M23 61l16-21 21 17 13-20"/>'],
 ['تابلو مربع','<rect x="24" y="21" width="52" height="55"/><path d="M30 70l14-27 14 10 10-19"/>'],
 ['تابلو افقی بزرگ','<rect x="8" y="28" width="84" height="46"/><path d="M14 68l25-27 19 14 20-21"/>'],
 ['تابلو عمودی بزرگ','<rect x="28" y="8" width="44" height="84"/><path d="M33 82l20-28 14 13"/>'],
 ['تابلو سه‌تکه','<rect x="5" y="24" width="28" height="59"/><rect x="37" y="13" width="28" height="70"/><rect x="69" y="24" width="26" height="59"/>']
,
 ['آباژور رومیزی','<path d="M34 19h32l7 27H27zM50 47v27M34 77h32"/>'],
 ['آباژور سه پایه','<path d="M31 20h38l6 30H25zM50 50L28 81m22-31v34m0-34 22 31"/>'],
 ['تابلو عمودی کوچک','<rect x="27" y="13" width="46" height="76" rx="2"/><path d="M34 72l12-24 13 8 7-23"/>'],
 ['تابلو افقی کوچک','<rect x="11" y="26" width="78" height="47" rx="2"/><path d="M19 65l20-25 17 15 22-21"/>'],
 ['تابلو مربعی','<rect x="21" y="21" width="58" height="58" rx="2"/><path d="M28 69l13-25 16 12 15-22"/>'],
 ['تابلو افقی بزرگ','<rect x="7" y="24" width="86" height="50" rx="2"/><path d="M14 65l25-25 18 12 29-17"/>'],
 ['تابلو عمودی بزرگ','<rect x="28" y="7" width="44" height="86" rx="2"/><path d="M33 80l12-28 15 11 8-29"/>'],
 ['تابلو چند تکه','<rect x="8" y="22" width="24" height="57"/><rect x="38" y="14" width="24" height="71"/><rect x="68" y="22" width="24" height="57"/>']];
catalogImages.splice(22,10,
 ['مبل سه‌نفره پارچه‌ای تیره',catalogImages[0][1]],
 ['مبل دونفره پارچه‌ای تیره',catalogImages[0][1]],
 ['مبل تک‌نفره پارچه‌ای تیره',catalogImages[1][1]],
 ['میز جلو مبلی چوب و فلز',catalogImages[2][1]],
 ['میز عسلی چوب و فلز',catalogImages[12][1]],
 ['میز دکوری شیشه‌ای',catalogImages[12][1]],
 ['آباژور رومیزی کریستالی',catalogImages[14][1]],
 ['چراغ ایستاده فلزی',catalogImages[6][1]],
 ['شمعدان دکوری',catalogImages[4][1]],
 ['فرش پتینه طوسی',catalogImages[7][1]]
);
function objectIcon(index){return `<svg viewBox="0 0 100 100" class="object-icon" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${catalogImages[index]?.[1]||''}</svg>`;}
function planSketch(kind){return layoutPreviewSvg(buildLayout({room:space,kind,capacity:peopleCount}));}
const sofa=`<path d="M83 184V143q0-15 17-15h123q17 0 17 15v41M83 158H64q-11 0-11 12v51h215v-51q0-12-12-12h-16M78 183h165v24H78zM64 221v15m192-15v15M159 133v46M79 190l-17-22m184 22 13-22"/>`;
const sketches={
 living:sofa+`<path d="M285 221v-99m-26 0h52l-12-39h-29zM282 221h27M77 261h183l28-20H105z"/>`,
 dining:`<path d="M67 151h209l-22 24H47zM65 177v78m192-78v78M91 150v-55h49v55m-44-27h38M188 150V95h49v55m-43-27h38M103 196v61m-38-72h55v25H65m135-25h55v25h-55m2 0v47m49-47v47"/>`,
 bedroom:`<path d="M62 215v-92q0-13 14-13h179q13 0 13 13v92M60 167h211l19 50H42zM42 217v24m248-24v24M79 152v-25h68v25zm95 0v-25h68v25zM47 228h237M80 168l-6 41m171-41 9 41"/>`,
 office:`<path d="M54 160h225v13H54zM70 174v78m190-78v78M111 157V98h105v59m-57-2v-18m-18 18h36M143 190h56v27h-56zM171 218v28m-26 9 26-9 27 9M145 188v-30m51 30v-30"/>`,
 phone:`<rect x="103" y="45" width="128" height="228" rx="19"/><path d="M146 59h43M144 256h44M120 115v-20h20m55 0h20v20m0 87v20h-20m-55 0h-20v-20M147 150l21-12 24 12v29l-24 13-21-13zm0 0 21 14 24-14m-24 14v28"/>`,
 gallery:`<rect x="55" y="70" width="220" height="170" rx="4"/><path d="m65 222 58-68 47 45 34-33 61 56M76 54h213v167"/><circle cx="220" cy="117" r="15"/>`
};
function svg(kind='living'){return `<svg viewBox="0 0 330 300" class="sketch" aria-hidden="true">${sketches[kind]||sketches.living}</svg>`;}
function heroArt(){return `<svg viewBox="0 0 600 520" class="sketch" aria-hidden="true"><g stroke="#c4c8b8" stroke-width=".8"><path d="M60 380l260 86 236-106-234-85zM60 380V133l262-67 234 68v226M322 66v209M77 374l245 79 218-98"/><path d="M91 153l119-30v119L91 272zM151 138v118m-60-48 119-34"/></g><g transform="translate(57 110)"><path d="M73 215v-81q0-18 18-16l157 19q19 2 19 18v78M73 157l-35-5q-13-2-13 14v73l244 43 94-45v-68q0-12-11-9l-36 16M25 194l242 39 96-44M44 198v25l222 39 76-36v-28M267 233v49M52 244v23m194 12v22m95-54v21M75 164l190 30 48-18M171 133v45"/><path stroke="#9aa18d" d="M26 191l241 38 94-44m-286-25 189 30 45-17"/></g><path d="M328 389l76-33 75 23-77 36zM328 389v12l74 28 77-35v-15M338 403v25m126-26v25M401 429v14"/><path d="M443 286v-109m-35 0h70l-17-55h-39zM427 293l17-7 18 7M443 122v-12"/><path d="M499 332v-49m-17 41q-30-8-26-34 27-3 43 33m1-18q-3-30 21-41 18 24-21 41M481 331h38l-6 38h-25z"/><path stroke="#c2c6b7" d="m100 411 218 66 210-96M90 422l227 69m49-31 143-64"/><path stroke="#9da58f" d="M281 77l10 10m-15 4 11-2M75 310l-15 7m13-16-4 12"/></svg>`;}
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',4500);}
function footer(){return `<footer class="foot"><span>خانه، به سلیقهٔ تو.</span><span dir="ltr">CHIDO · 0.7.0</span></footer>`;}
function heading(step,title,sub,back){return `<div class="page-heading"><div><span class="eyebrow">${step}</span><h1>${title}</h1><p>${sub}</p></div>${back?`<a class="back" href="#${back}">بازگشت ←</a>`:''}</div>`;}
async function full(){if(document.fullscreenElement){await document.exitFullscreen();return;}if(!document.documentElement.requestFullscreen){toast('مرورگر شما تمام‌صفحه را پشتیبانی نمی‌کند.');return;}try{await document.documentElement.requestFullscreen();}catch{toast('ورود به تمام‌صفحه ممکن نشد؛ می‌توانی ادامه بدهی.');}}
$('#fullscreen').onclick=full;document.addEventListener('fullscreenchange',()=>$('#fullscreen').textContent=document.fullscreenElement?'خروج از تمام‌صفحه ↙':'تمام‌صفحه ⛶');
async function support(){try{supported=!!(isSecureContext&&navigator.xr&&await navigator.xr.isSessionSupported('immersive-ar'));}catch{supported=false;}return supported;}
async function loadScene(){if(!Scene){const m=await import('./scene.js?v=0.14.0');Scene=m.Studio;palette=m.palette;}}
let draftTimer=null;
function currentSceneRecord(){
 if(!studio)return null;
 return {scene:studio.exportState(),setId:activeCloudSetId,room:space,layout,capacity:peopleCount,style:styleChoice,theme:themeIndex};
}
function persistDraft(){
 if(!studio||studio.ownerKey!==studioOwner())return;
 try{saveRecovery(cloudMembership,currentSceneRecord());}catch(error){console.warn('Draft save unavailable',error);}
}
function scheduleDraftSave(){
 clearTimeout(draftTimer);
 draftTimer=setTimeout(persistDraft,500);
}
function loadSceneRecord(record){
 if(!record?.scene)return;
 activeSavedLayoutId=record.id||null;if(record.setId)activeCloudSetId=record.setId;
 sceneMemory=record.scene;space=record.room||'پذیرایی';layout=record.layout||'empty';
 peopleCount=Number(record.capacity)||5;styleChoice=record.style||'مینیمال';themeIndex=record.theme||0;
}
window.addEventListener('pagehide',()=>{persistDraft();if(activeLiveSession)void stopLiveSession(activeLiveSession.id);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)persistDraft();});
function updateObjects(){if(!studio)return;const buttons=studio.items.map(m=>`<button data-object="${m.userData.id}" class="${m===studio.selected?'selected':''}">${m.userData.product.name}</button>`).join('');for(const selector of ['#objects']){const el=$(selector);if(el){el.innerHTML=buttons||'<small>یک قطعه اضافه کن.</small>';el.querySelectorAll('[data-object]').forEach(b=>b.onclick=()=>studio.select(studio.items.find(m=>m.userData.id===+b.dataset.object)));}}
 const mesh=studio.selected,label=mesh?mesh.userData.product.name+' · '+mesh.userData.product.size.map(v=>fa(Math.round(v*100))).join(' × ')+' سانتی‌متر':'یک قطعه را لمس کن';for(const id of ['selection','arSelection']){const el=$('#'+id);if(el)el.textContent=label;}
 const rotation=$('#rotation');if(rotation)rotation.value=mesh?Math.round(mesh.rotation.y*180/Math.PI)%360:0;
 for(const id of ['rotate','delete','rotation']){const el=$('#'+id);if(el)el.disabled=!mesh;}for(const id of ['selectedARTools']){const el=$('#'+id);if(el)el.hidden=!mesh;}
 updateMeasurements();minimap.render();scheduleDraftSave();if(activeLiveSession)scheduleLiveScenePublish();}
function updateMeasurements(){if(!studio)return;const m=studio.measurement();for(const id of ['measurement','arMeasurement']){const el=$('#'+id);if(el)el.textContent=`A—B: ${fa(m.measuredCm)} سانتی‌متر اندازه‌گیری‌شده · ضریب ${fa(m.scale)} · طول اصلاح‌شده ${fa(m.correctedCm)} سانتی‌متر`;}}
function calibrationControls(prefix=''){return `<div class="calibration-controls"><p class="measurement" id="${prefix?'arMeasurement':'measurement'}"></p><label for="${prefix}actual">طول واقعی A—B (۱۰۰ تا ۱۰۰۰ سانتی‌متر)</label><div class="input-row"><input id="${prefix}actual" type="number" inputmode="decimal" min="100" max="1000" step="0.1" placeholder="مثلاً ۱۰۰"><button id="${prefix}calibrate">کالیبره کن</button><button id="${prefix}resetScale">۱:۱</button></div><small>A کل صحنه را جابه‌جا می‌کند و B جهت آن را تعیین می‌کند.</small></div>`;}
function bindCalibration(prefix=''){const initial=studio.measurement();if(initial.actualCm!==null)$('#'+prefix+'actual').value=initial.actualCm;const fail=fn=>()=>{try{fn();}catch(error){toast(error.message);}};$('#'+prefix+'calibrate').onclick=fail(()=>{studio.calibrate($('#'+prefix+'actual').value);$('#abCalibrationSheet').hidden=true;toast('مقیاس و مرجع پروژه تنظیم شد.');});$('#'+prefix+'resetScale').onclick=()=>studio.resetCalibration();}
function snapshotItems(){savedItems=studio?studio.items.map(m=>({id:m.userData.id,name:m.userData.product.name,price:m.userData.price,color:'#'+m.material.color.getHexString()})):savedItems;}
function uploadControl(){return `<label class="upload">بارگذاری تصویر +<input id="upload" type="file" accept="image/png,image/jpeg,image/webp" multiple></label>`;}
async function uploadFiles(e){const files=[...e.target.files];if(files.length>20){toast('هر بار حداکثر ۲۰ تصویر بارگذاری کن.');return;}let count=0;for(const f of files){if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>15*1024*1024){toast('فقط PNG، JPEG و WebP تا ۱۵ مگابایت پذیرفته می‌شود.');continue;}try{const img=await createImageBitmap(f);img.close();await savePhoto(f,'تصویر بارگذاری‌شده');count++;}catch{toast('تصویر خوانده یا ذخیره نشد؛ فضای مرورگر را بررسی کن.');}}if(count){toast(`${fa(count)} تصویر به گالری اضافه شد.`);await render();}e.target.value='';}
function openLayoutForScanning(kind,record=null){
 if(record)loadSceneRecord(record);
 else{layout=kind;sceneMemory=null;activeSavedLayoutId=null;clearDraft();clearRecovery(cloudMembership);}
 previewEnabled=false;
 // Start immersive permission request inside the original click event.
 // Awaiting route rendering before this call loses the browser's user activation.
 $('#overlay').hidden=false;$('#scanReadiness').hidden=false;$('#scanStage').textContent='در حال بارگذاری موتور و درخواست دسترسی دوربین…';$('#scanProgress').value=0;
 pendingARSession=requestARSession(navigator.xr,$('#overlay'),false,{light:true,depth:true});
 pendingARSession.catch(()=>{}); // Render handles the actual rejection.
 location.hash='studio';
}
let membershipCheckedAt=0;
function updateAccountHeader(){
 const identity=$('#appIdentity'),member=cloudMembership;
 identity.hidden=!member;
 $('#arIdentity').textContent=member?`${member.display_name||accountName('chido-auth-v1')||member.user?.email?.split('@')[0]||'کاربر'} · ${member.company?.name||'مجموعه'}`:'';
 identity.textContent=member?`${member.display_name||accountName('chido-auth-v1')||member.user?.user_metadata?.display_name||member.user?.email?.split('@')[0]||'کاربر'} · ${member.company?.name||'مجموعه'}`:'';
 $('#appSignOut').hidden=!member;
 $('#companyLink').hidden=member?.role!=='company_admin';
 document.body.dataset.signedIn=String(!!member);
}
$('#appSignOut').onclick=async()=>{if(studio?.session)return;const {error}=await supabase.auth.signOut();if(error){toast('خروج انجام نشد. دوباره تلاش کن.');return;}clearRecovery(cloudMembership);if(studio){const departing=studio;studio=null;departing.destroy();}studioCache.drop();cloudMembership=null;membershipCheckedAt=0;appSessionLogged=false;sceneMemory=null;clearDraft();location.hash='welcome';void render();};
async function render({reuseCatalog=false}={}){const version=++routeVersion;let route=location.hash.slice(1)||'welcome';
 recordRuntime('route-start',studio?.renderer,['welcome','studio','spaces','layouts','entry','gallery','invoice'].includes(route)?route:'other');
 if(studio?.session){if(location.hash!=='#studio')history.replaceState(null,'',location.pathname+location.search+'#studio');return;}
 if(route==='access'){route='welcome';history.replaceState(null,'',location.pathname+location.search+'#welcome');}
 document.body.dataset.route=route;
 if(!reuseCatalog&&(!cloudMembership||Date.now()-membershipCheckedAt>60000)){
  try{cloudMembership=await getMembership();membershipCheckedAt=Date.now();}catch(error){console.warn('Chido account check failed',error);}
 }
 if(version!==routeVersion)return;
 if(studioCache.entry&&studioCache.entry.owner!==studioOwner()){sceneMemory=null;activeCloudSetId=null;activeCloudLayout=null;activeCloudColorway=null;}
 updateAccountHeader();
 if(!cloudMembership&&route!=='welcome'){location.hash='welcome';return;}
 if(cloudMembership){
  if(!appSessionLogged){appSessionLogged=true;void logActivity(cloudMembership,'app_opened',{role:cloudMembership.role});}
  if(cloudMembership.role==='branch'&&Date.now()-lastHeartbeatAt>60000){lastHeartbeatAt=Date.now();void updateDeviceHeartbeat(cloudMembership);}
 }
 closeChidoMenu();minimap.collapse();
 if(studio){
  const previous=studio;
  try{if(previous.ownerKey===studioOwner()){persistDraft();snapshotItems();sceneMemory=previous.exportState();}else{sceneMemory=null;activeCloudSetId=null;activeCloudLayout=null;activeCloudColorway=null;}}catch(error){console.warn('Scene snapshot before navigation',error);}
  studio=null;
  recordRuntime('park-start',previous.renderer);studioCache.park(previous,previous.ownerKey);recordRuntime('park-complete',previous.renderer);
 }
 photoURLs.forEach(URL.revokeObjectURL);photoURLs=[];
 if(route==='welcome'){
  app.innerHTML=`<section class="welcome-screen"><div class="welcome-title"><h1>CHIDO</h1><p>خانه را جور دیگری ببینید</p></div><img class="welcome-photo" src="assets/welcome.webp" width="853" height="1280" fetchpriority="high" alt="صندلی کرم و گلدان در فضایی آرام">${cloudMembership?`<div class="welcome-bottom"><button class="primary" id="welcome">ورود به نمایشگاه <span>→</span></button><button class="quick-ar" id="quickAR">ادامه چیدمان ↗</button><button class="quick-ar quick-empty" id="startEmpty">＋ ایجاد صحنه خالی</button></div>`:`<form id="accountLoginForm" class="entry-login"><h2>ورود به اپ چیدو</h2><label for="accountUsername">نام کاربری</label><input id="accountUsername" name="username" autocomplete="username" dir="ltr" required maxlength="254"><label for="accountPassword">رمز عبور</label><input id="accountPassword" name="password" type="password" autocomplete="current-password" dir="ltr" required maxlength="128"><label class="remember-line"><input id="appRemember" type="checkbox" checked> مرا به خاطر بسپار</label><button class="primary" type="submit">ورود به اپلیکیشن</button><p id="accessMessage" role="status" aria-live="polite"></p></form>`}</section>`;
  recordRuntime('home-dom-ready');
  if(!cloudMembership){
   $('#accountUsername').value=accountName('chido-auth-v1');
   $('#appRemember').checked=localStorage.getItem('chido-auth-v1-remember')!=='no';
   $('#accountLoginForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter,message=$('#accessMessage');button.disabled=true;message.textContent='در حال ورود…';try{const username=$('#accountUsername').value,result=await accountLogin(username,$('#accountPassword').value);if(result.role==='central')throw Error('حساب مدیر مرکزی از «ورود به سایت» وارد می‌شود.');rememberAccount('chido-auth-v1',$('#appRemember').checked,username);const {error}=await supabase.auth.setSession(result.session);if(error)throw error;cloudMembership=await getMembership();if(!cloudMembership)throw Error('دسترسی مجموعه فعال نیست.');membershipCheckedAt=Date.now();await updateDeviceHeartbeat(cloudMembership);await render();}catch(error){if(message.isConnected)message.textContent=error.message||'ورود انجام نشد.';}finally{button.disabled=false;}};
  }else{
   $('#welcome').onclick=()=>{location.hash='spaces';};
   const draft=readRecovery(cloudMembership);
   $('#quickAR').hidden=!draft;
   $('#quickAR').onclick=()=>{loadSceneRecord(draft);location.hash='studio';};
   $('#startEmpty').onclick=()=>{layout='empty';sceneMemory=null;activeSavedLayoutId=null;previewEnabled=false;clearDraft();clearRecovery(cloudMembership);location.hash='studio';};
  }
  return;
 }
 if(route==='spaces'){
  const rooms=[['living','پذیرایی','برای کنار هم بودن'],['dining','ناهارخوری','دور یک میز، کنار هم'],['dining','آشپزخانه','میز غذاخوری و دورهمی'],['bedroom','اتاق خواب','گوشه‌ای برای آرامش'],['office','فضای کار','جایی برای ایده‌های تازه']];
  try{cloudSets=await loadCompanySets(cloudMembership.company_id);demoLibrary=await loadDemoLibrary(cloudMembership);}catch(error){console.warn('Chido company catalog unavailable',error);cloudSets=[];demoLibrary=[];toast('دریافت کتابخانه مدل‌ها انجام نشد.');}
  if(version!==routeVersion)return;
  if(activeCloudSetId&&!cloudSets.some(item=>item.id===activeCloudSetId))activeCloudSetId=null;
  const activeSet=cloudSets.find(item=>item.id===activeCloudSetId)||null;
  const variants=layoutOptions(space),saved=cloudMembership?.role==='branch'?[]:listCustomLayouts().filter(record=>record.room===space);
  app.innerHTML=`<section class="page rooms-page rooms-integrated">
  ${heading('چیدو / چیدمان','برای کدام فضا چیدمان می‌خواهی؟','یکی از طرح‌ها را انتخاب کن یا از یک فضای خالی شروع کن.','welcome')}
  <div class="cards room-choice" aria-label="دسته‌بندی چیدمان">
  ${rooms.map(([key,name,description])=>`<div class="room-tab-cell"><button type="button" class="card ${name===space?'selected':''}" data-space="${name}" aria-pressed="${name===space}">${svg(key)}<strong>${name}</strong><small>${description}</small></button><button type="button" class="room-tab-add" data-new-space="${name}" aria-label="ایجاد چیدمان جدید در ${name}">＋</button></div>`).join('')}
  </div>
  <section class="company-set-section">
   <div class="company-set-heading"><div><h3>ست‌های رسمی شرکت</h3><small>مجموعه‌های آماده‌شده و منتشرشده برای این حساب</small></div><span class="cloud-count">${cloudSets.length} ست</span></div>
   <div class="company-set-grid">${cloudSets.map(set=>`<button class="company-set-card ${set.id===activeCloudSetId?'selected':''}" data-cloud-set="${set.id}"><strong>${set.name}</strong><small>${set.products.length} محصول · ${set.layouts.length} چیدمان · ${set.colorways.length} رنگ‌بندی</small><span>انتخاب ست ←</span></button>`).join('')||'<div class="cloud-empty">هنوز ستی برای این شرکت منتشر نشده است.</div>'}</div>
  </section>
  ${activeSet?`<section class="company-set-detail"><div class="company-set-heading"><div><h3>${activeSet.name}</h3><small>${activeSet.description||'چیدمان‌ها و رنگ‌بندی‌های رسمی این ست'}</small></div><button data-cloud-set-clear>همه ست‌ها</button></div><div class="cloud-layout-grid">${activeSet.layouts.map(item=>`<button class="cloud-layout-card" data-cloud-layout="${item.id}"><strong>${item.name}</strong><small>${item.room} · ${item.capacity} نفر</small><span>بازکردن در AR ←</span></button>`).join('')||'<div class="cloud-empty">برای این ست هنوز چیدمان رسمی ذخیره نشده است.</div>'}</div>${cloudMembership?.role==='company_admin'?'<button class="cloud-new-layout" data-new-cloud-layout>＋ ساخت چیدمان رسمی جدید در AR</button>':'<button class="cloud-new-layout" data-request-cloud-layout>درخواست چیدمان جدید از مدیر شرکت</button>'}</section>`:''}
  ${saved.length&&!cloudSets.length?`<section class="saved-section"><h3>چیدمان‌های ذخیره‌شده</h3><div class="saved-layout-grid">
  ${saved.map(record=>`<div class="saved-plan-card"><button data-saved-layout="${record.id}" class="saved-plan-open"><div class="saved-plan-image">${savedPlanSvg(record.scene)}</div><strong>${record.name.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</strong></button><button class="saved-plan-delete" data-remove-layout="${record.id}" aria-label="حذف چیدمان ذخیره‌شده">×</button></div>`).join('')}
  </div></section>`:''}
  ${cloudSets.length?'':`<section class="preset-layouts"><h3 class="layout-section-title">چیدمان‌های ${space}</h3><div class="layout-feed">
  ${variants.map(({id,title,description})=>`<button class="layout-photo-card" data-layout="${id}"><div class="layout-image floor-plan-card">${layoutPreviewSvg(buildLayout({room:space,kind:id,capacity:peopleCount}))}</div><div class="layout-caption"><strong>${title}</strong><small>${description}</small><span>←</span></div></button>`).join('')}
  </div></section>`}</section>`;
  document.querySelectorAll('[data-cloud-set]').forEach(btn=>btn.onclick=()=>{activeCloudSetId=btn.dataset.cloudSet;activeCloudLayout=null;activeCloudColorway=null;render();});
  document.querySelectorAll('[data-cloud-set-clear]').forEach(btn=>btn.onclick=()=>{activeCloudSetId=null;activeCloudLayout=null;render();});
  document.querySelectorAll('[data-cloud-layout]').forEach(btn=>btn.onclick=()=>{
   const set=cloudSets.find(item=>item.id===activeCloudSetId),record=set?.layouts.find(item=>item.id===btn.dataset.cloudLayout);if(!set||!record)return;
   activeCloudSetId=set.id;activeCloudLayout=record;activeCloudColorway=null;space=record.room||space;peopleCount=Number(record.capacity)||5;layout=record.template_kind||'empty';
   if(record.scene_state)openLayoutForScanning(layout,{id:record.id,scene:record.scene_state,room:space,layout,capacity:peopleCount});
   else{sceneMemory=null;openLayoutForScanning(layout);}
  });
  document.querySelectorAll('[data-new-cloud-layout]').forEach(btn=>btn.onclick=()=>{if(cloudMembership?.role!=='company_admin')return;activeCloudLayout=null;activeCloudColorway=null;layout='empty';sceneMemory=null;openLayoutForScanning('empty');});
  document.querySelectorAll('[data-request-cloud-layout]').forEach(btn=>btn.onclick=()=>showArSheet('request-layout'));
  document.querySelectorAll('[data-space]').forEach(btn=>btn.onclick=()=>{space=btn.dataset.space;peopleCount=allowedCapacities(space)[0];render();});
  document.querySelectorAll('[data-new-space]').forEach(btn=>btn.onclick=()=>{space=btn.dataset.newSpace;peopleCount=allowedCapacities(space)[0];if(!activeCloudSetId&&cloudSets.length)activeCloudSetId=cloudSets[0].id;activeCloudLayout=null;activeCloudColorway=null;layout='empty';sceneMemory=null;openLayoutForScanning('empty');});
  document.querySelectorAll('[data-layout]').forEach(btn=>btn.onclick=()=>openLayoutForScanning(btn.dataset.layout));
  document.querySelectorAll('[data-saved-layout]').forEach(btn=>btn.onclick=()=>{const record=listCustomLayouts().find(x=>x.id===btn.dataset.savedLayout);if(record)openLayoutForScanning(record.layout||'empty',record);});
  document.querySelectorAll('[data-remove-layout]').forEach(btn=>btn.onclick=()=>{removeCustomLayout(btn.dataset.removeLayout);render();});
  return;
 }
 if(route==='layouts'){history.replaceState(null,'',location.pathname+location.search+'#spaces');return render();}
 if(route==='detail'){app.innerHTML=`<section class="page detail-page"><a class="back" href="#spaces">بازگشت ←</a><img class="detail-photo" src="assets/living.webp" alt="چیدمان مبلمان کرم در فضای نشیمن"><div class="dots"><i></i><i></i><i></i></div><h1>${layout==='social'?'چیدمان صمیمی':layout==='light'?'چیدمان سبک و روشن':'چیدمان کلاسیک ۱'}</h1><p>یک ایده برای ${space}؛ با ترکیبی از حجم‌های متنوع و رنگ‌های طبیعی.</p><p class="prototype-note">در پیش‌نمایش، مدل‌های منتشرشدهٔ مجموعه بارگذاری می‌شوند.</p><button id="continueLayout" class="primary">ادامهٔ چیدمان و ویرایش <span>→</span></button></section>`;$('#continueLayout').onclick=()=>location.hash='studio';return;}
 if(route==='entry'){app.innerHTML=`<section class="page">${heading('۰۳ / ورود به تجربه','حالا در خانه‌ات ببین.','چند قدم تا امتحان کردن چیدمان فاصله داری.','layouts')}<div class="entry"><div><h2>فضای واقعی، انتخاب تازه</h2><p>در محیطی روشن، گوشی را آرام به سمت کف بگیر. پس از نمایش کف پیشنهادی، «تثبیت این کف» را بزن و خط A–B را روی یک طول معلوم بگذار.</p><div id="support" class="notice">در حال بررسی سازگاری مرورگر…</div><div class="entry-actions"><button id="enterAR" class="primary" disabled>ورود به AR ↗</button><button id="preview">محیط آزمایشی</button></div><p>نیازمند Android Chrome، گوشی سازگار با ARCore، اتصال امن و اجازهٔ دسترسی به دوربین. ورود به AR فقط با لمس دکمه انجام می‌شود.</p></div><div class="entry-illustration">${svg('phone')}</div></div><div class="notice">در مرورگرهای سازگار، کپچر داخلی چیدو تصویر دوربین واقعی و مدل‌های سه‌بعدی را مستقیماً در گالری ثبت می‌کند.</div></section>${footer()}`;$('#preview').onclick=()=>location.hash='studio';await support();if(version!==routeVersion)return;$('#support').textContent=supported?'AR در این مرورگر در دسترس است. مجوزها و ردیابی هنگام شروع بررسی می‌شوند.':'AR در این دستگاه یا مرورگر در دسترس نیست. محیط آزمایشی را باز کن، یا با Chrome روی Android سازگار امتحان کن.';$('#enterAR').disabled=!supported;$('#enterAR').onclick=()=>{location.hash='studio';toast('محیط آماده می‌شود؛ سپس «شروع AR» را بزن.');};return;}
 if(route==='studio'){app.innerHTML=`<section class="ar-launch">
 <div id="viewport" class="viewport ar-launch-stage"><div class="launch-placeholder onboarding"><div class="launch-mark">CHIDO · AR</div><div class="launch-plan">${layout==='empty'?'<span class="blank-layout-placeholder">＋ صحنه خالی</span>':planSketch(layout)}</div><h2>${layout==='empty'?'صحنه خالی برای چیدمان جدید':'سه حرکت تا دیدن چیدمان'}</h2>
 <div class="onboard-steps">
  <div><span>۱</span><p><strong>دوربین رو به کف</strong><small>فرش یا سطح زمین را داخل تصویر نگه دار.</small></p></div>
  <div><span>۲</span><p><strong>حرکت آرام چپ و راست</strong><small>تا دایره سبز روی کف ظاهر شود.</small></p></div>
  <div><span>۳</span><p><strong>تثبیت و تنظیم جهت</strong><small>کف را تأیید کن و خط A—B را هم‌راستا با اتاق بگذار.</small></p></div>
 </div></div></div>
 <section id="launchLoading" class="launch-loading" role="status"><strong id="launchStage">در حال بارگذاری ابزارهای چیدو…</strong><progress id="launchProgress" value="0" max="3"></progress><small>۱. موتور سه‌بعدی · ۲. ابزارها و صحنه · ۳. نشست واقعیت افزوده</small></section>
  <div class="launch-actions"><button id="startAR" class="primary" disabled>در حال بررسی واقعیت افزوده…</button><div class="launch-alternatives"><a href="#spaces">تغییر چیدمان</a><button id="preview3D">پیش‌نمایش سه‌بعدی</button></div></div>
 </section>`;
 try{
  if(!reuseCatalog)await refreshCloudSets();if(version!==routeVersion)return;await loadScene();if(version!==routeVersion)return;
  $('#launchProgress').value=1;$('#launchStage').textContent='موتور سه‌بعدی آماده شد؛ در حال ساخت ابزارها…';
  const parked=studioCache.take(studioOwner());
  if(parked){studio=parked;studio.resume($('#viewport'));}else studio=new Scene($('#viewport'),updateObjects);studio.ownerKey=studioOwner();
  $('#startAR').hidden=false;$('#startAR').disabled=true;$('#launchLoading').hidden=false;$('#viewport').classList.toggle('show-preview',previewEnabled);$('#preview3D').textContent=previewEnabled?'بستن پیش‌نمایش':'پیش‌نمایش سه‌بعدی';
  $('#launchProgress').value=2;$('#launchStage').textContent='ابزارها و صحنه آماده‌اند؛ در انتظار دوربین و نشست AR…';
  if(!sceneMemory){const recovered=readRecovery(cloudMembership);if(recovered)loadSceneRecord(recovered);}
  const allowed=publishedCatalogIndexes(),safeScene=filterPublishedScene(sceneMemory,allowed);
  if(safeScene){if(!parked||sceneStateKey(safeScene)!==sceneStateKey(studio.exportState())){studio.clear();studio.restoreState(safeScene);}if(safeScene.items.length!==sceneMemory.items.length)toast('مدل‌های قدیمی یا خارج از مجموعه از این پیش‌نمایش کنار گذاشته شدند.');}
  else{layout='empty';studio.seed('empty',space,peopleCount);}
  persistDraft();
  studio.onEnd=()=>{
   try{
    if(activeLiveSession)void endLiveShare(true);
    resetWideViewControls();closeChidoMenu();minimap.collapse();setPhotoMode(false);closeArSheet();
    $('#arDock').hidden=true;$('#objectQuick').hidden=true;$('#scanReadiness').hidden=true;
    $('#measureHint').hidden=true;$('#arMiniMap').hidden=true;$('#abInline').hidden=true;$('#arBottomActions').hidden=true;$('#abCalibrationSheet').hidden=true;$('#arArchitectureActions').hidden=true;$('#arSurfaceActions').hidden=true;
   }catch(error){recordRuntimeError('exit-ui-error',error);console.warn('AR controls cleanup',error);}
    $('#overlay').hidden=true;
    // Home navigation must run even if an optional AR tool failed to close.
    arStarting=false;pendingARSession=null;
    if(homeExitRequested)queueMicrotask(finishChidoHomeExit);
    else queueMicrotask(()=>{
     // Keep the same WebGL context, models and textures. Rebuilding here stalls real phones.
     if(location.hash!=='#studio')return;
     $('#overlay').hidden=true;$('#startAR').hidden=false;$('#startAR').disabled=false;$('#startAR').textContent='شروع دوباره AR ↗';
     $('#launchLoading').hidden=true;$('#viewport').classList.toggle('show-preview',previewEnabled);persistDraft();
    });
   };
  studio.onPhotoTap=()=>{};
  studio.onHint=toast;
  studio.onWideViewError=message=>{resetWideViewControls();toast(message);};
  studio.onWideViewReset=resetWideViewControls;
  studio.onWideViewProjection=projection=>{
   if($('#wideViewMode')?.value!=='ar')showWideProjection(projection);
  };
   studio.architecture.onSelectionChange=updateArchitectureSelection;
  studio.onLiveChange=()=>{minimap.render();updateArchitectureSelection();};
   studio.onABPosition=point=>{const el=$('#abInline');if(!point||!studio?.session||studio.photoMode){el.hidden=true;return;}el.hidden=false;el.style.left=Math.max(72,Math.min(innerWidth-72,point.x))+'px';el.style.top=Math.max(88,Math.min(innerHeight-125,point.y))+'px';$('#abLengthButton').textContent='A—B · '+Math.round(studio.measurement().correctedCm).toLocaleString('fa-IR')+' cm ✎';};
  studio.onSelectionScreen=()=>{
    const quick=$('#objectQuick'),selected=studio?.selected;
    if(!quick)return;
    const show=!!selected&&!!studio.session&&studio.placed&&!studio.photoMode&&!chidoMenuOpen&&!$('#chidoMenuHome').disabled&&$('#arToolSheet').hidden&&!studio.placementEnabled;
    quick.hidden=!show;
    if(!show)return;
    $('#quickProps').title=selected.userData.index===7?'تنظیمات فرش':'ویژگی‌های آبجکت';
    $('#quickProps').setAttribute('aria-label',$('#quickProps').title);
    updateLampPowerControl();
   };
  studio.debugView.onUpdate=()=>{if(debugEnabled)refreshDebugPanel();};
  studio.setMeasureHandler((m,awaitSecond)=>$('#measureReadout').textContent=awaitSecond?'نقطه دوم را روی کف لمس کن':m===null?'نقطه اول را روی کف لمس کن':m.toFixed(2)+' متر');
 }catch(error){
  // A rejected renderer or module import must not leave a camera session or loading overlay active.
  $('#overlay').hidden=true;
  $('#launchLoading').hidden=true;
  $('#launchStage').textContent='بارگذاری محیط سه‌بعدی ناموفق بود.';
  $('#viewport').textContent='محیط سه‌بعدی آماده نشد: '+(error?.message||'خطای نامشخص');
  const session=pendingARSession;pendingARSession=null;
  if(session)void Promise.resolve(session).then(s=>s?.end?.()).catch(()=>{});
  console.error(error);$('#startAR').disabled=false;$('#startAR').textContent='تلاش دوباره';$('#startAR').onclick=()=>void render({reuseCatalog:true});return;
 }
 bindCalibration('ar');
 $('#preview3D').onclick=()=>{previewEnabled=!previewEnabled;$('#viewport').classList.toggle('show-preview',previewEnabled);$('#preview3D').textContent=previewEnabled?'بستن پیش‌نمایش':'پیش‌نمایش سه‌بعدی';};
 const autoSession=pendingARSession;
 if(!autoSession)await support();if(version!==routeVersion)return;
 $('#startAR').textContent=supported?'شروع اسکن کف و ورود به AR ↗':'بررسی دسترسی به AR';
 $('#startAR').disabled=false;$('#startAR').onclick=()=>startAR(false);
 if(autoSession){pendingARSession=null;$('#startAR').hidden=true;void startAR(false,autoSession);}else{$('#launchLoading').hidden=true;}
 return;}
 if(route==='gallery'){app.innerHTML=`<section class="page">${heading('گالری شخصی','قاب‌هایی از خانهٔ تو','ایده‌هایی که دوست داری، اینجا نگه دار.','welcome')}<div class="no-print">${uploadControl()}<button class="gallery-realistic-preview" type="button" data-realistic-demo>رئالیستیک کردن عکس <small>به‌زودی</small></button></div><div class="notice">تصاویر فقط در همین مرورگر و همین نشانی، روی دستگاه تو ذخیره می‌شوند. با پاک کردن داده‌های سایت حذف می‌شوند؛ تصویرهای مهم را دانلود کن.</div><div id="images" class="images"></div></section>${footer()}`;$('#upload').onchange=uploadFiles;try{const list=(await photos()).sort((a,b)=>b.date-a.date);if(version!==routeVersion)return;if(!list.length){$('#images').className='empty-gallery';$('#images').innerHTML=`${svg('gallery')}<h2>اولین قاب، منتظر توست.</h2><p>از محیط AR کپچر داخلی بگیر یا تصویر دلخواهت را بارگذاری کن.</p><a href="#spaces" class="back">شروع یک چیدمان ←</a>`;}else for(const p of list){const url=URL.createObjectURL(p.blob);photoURLs.push(url);const el=document.createElement('article');el.className='image-card';el.innerHTML=`<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="تصویر ذخیره‌شدهٔ چیدمان"></a><p>${p.kind}<br>${new Date(p.date).toLocaleString('fa-IR')}</p><a href="${url}" download="chido-${p.id}.${p.blob.type==='image/webp'?'webp':p.blob.type==='image/jpeg'?'jpg':'png'}">دانلود ↓</a><button type="button" class="gallery-realistic-preview" data-realistic-demo>رئالیستیک کردن <small>آزمایشی</small></button><button data-photo-delete>حذف</button>`;el.querySelector('[data-photo-delete]').onclick=async()=>{try{await removePhoto(p.id);render();}catch{toast('حذف تصویر انجام نشد.');}};$('#images').append(el);}document.querySelectorAll('[data-realistic-demo]').forEach(b=>b.onclick=()=>toast('رئالیستیک کردن تصویر فعلاً نمایشی است؛ پردازشی انجام نمی‌شود.'));}catch{$('#images').textContent='دسترسی به گالری ممکن نیست؛ ذخیره‌سازی مرورگر را فعال کن.';}updateCount();return;}
 if(route==='invoice'){const total=savedItems.reduce((s,m)=>s+m.price,0);app.innerHTML=`<section class="page">${heading('برآورد اولیه','پیش‌فاکتور آزمایشی','فقط برای بررسی تجربهٔ انتخاب؛ فاقد اعتبار خرید.','studio')}<div class="invoice"><div class="page-heading"><a class="brand" href="#welcome">CHIDO</a><span class="step">${new Date().toLocaleDateString('fa-IR')}<br>واحد: تومان</span></div><table><thead><tr><th>حجم نمونه</th><th>رنگ</th><th>تعداد</th><th>مبلغ فرضی</th></tr></thead><tbody>${savedItems.map(m=>`<tr><td>${m.name||'قطعه'} ${fa(m.id)}</td><td><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${m.color}"></span></td><td>۱</td><td>${fa(m.price)}</td></tr>`).join('')||'<tr><td colspan="4">هنوز باکسی انتخاب نشده است.</td></tr>'}</tbody><tfoot><tr><td colspan="3">جمع آزمایشی</td><td>${fa(total)} تومان</td></tr></tfoot></table><p>قیمت‌ها کاملاً فرضی‌اند. مالیات، ارسال و خدمات محاسبه نشده است. این صفحه سفارش یا پرداخت ایجاد نمی‌کند.</p></div><button id="print" class="primary no-print" style="margin-top:20px">چاپ / دریافت PDF</button></section>${footer()}`;$('#print').onclick=()=>window.print();return;}
 location.hash='welcome';
}
let arSheetMode=null;
$('#arSettingsBin').append($('#arSettings'));
function closeArSheet(){
 const settings=$('#arSettings');if(settings.parentElement===$('#arSheetContent'))$('#arSettingsBin').append(settings);
 settings.open=false;settings.hidden=true;
 $('#arToolSheet').hidden=true;arSheetMode=null;
 if(studio?.architecture?.mode&&!studio?.photoMode)$('#arArchitectureActions').hidden=false;
 studio?.setPlacementEnabled(false);
}
// A preset set is an initial layout, never a permission boundary for the catalog.
function publishedCatalogIndexes(){return new Set([1000,...[...cloudSets.flatMap(set=>set.products),...demoLibrary].map(product=>product.catalog_index)]);}
function getActiveCloudSet(){return cloudSets.find(item=>item.id===activeCloudSetId)||null;}
function updateCloudControls(){
 const hasSet=!!activeCloudSetId,manager=cloudMembership?.role==='company_admin';
 const save=$('#arBottomSave'),open=$('#arBottomOpen'),color=$('#arColorwayTool'),share=$('#arShareSession');
 if(save)save.hidden=!(manager&&hasSet);
 if(open){open.hidden=!hasSet;open.textContent='چیدمان‌های رسمی';}
 if(color)color.hidden=!hasSet;
 if(share)share.hidden=false;
 const menuSave=$('#chidoMenuSave'),menuSaved=$('#chidoMenuSaved');
 if(menuSave)menuSave.hidden=!(manager&&hasSet);
 if(menuSaved)menuSaved.hidden=!hasSet;
}
async function applyCloudColorway(record){
 if(!studio||!record)return;
 const map=record.material_map||{};
 if(map.version===2){try{const count=await applyInstanceMaterialMap(studio,map);activeCloudColorway=record;toast(count?'رنگ‌بندی روی نمونه‌های مربوط در صحنه اعمال شد.':'آبجکت‌های این رنگ‌بندی در صحنه نیستند.');}catch(error){toast(error.message||'بارگذاری متریال کامل نشد.');}return;}
 let changed=0;
 for(const mesh of studio.items){
  const spec=map[String(mesh.userData.index)];if(!spec)continue;
  if(spec.fabric&&[22,23,24].includes(mesh.userData.index))studio.setSofaFabric(spec.fabric,mesh);
  else if(spec.color)mesh.traverse(node=>{
   if(!node.isMesh||!node.material)return;
   const materials=Array.isArray(node.material)?node.material:[node.material];
   for(const material of materials)if(material.color)material.color.set(spec.color);
  });
  changed++;
 }
 activeCloudColorway=record;
 if(changed)toast('رنگ‌بندی «'+record.name+'» اعمال شد؛ این تغییر هنوز ذخیره نشده است.');
 else toast('آبجکت‌های مربوط به این رنگ‌بندی در صحنه نیستند.');
}
function currentMaterialMap(){return instanceMaterialMap(studio?.items||[]);}
function scheduleLiveScenePublish(){
 if(!activeLiveSession||!studio)return;
 clearTimeout(liveSceneTimer);
 liveSceneTimer=setTimeout(()=>{
  if(activeLiveSession&&studio)publishLiveScene(activeLiveSession.id,studio.exportLiveState()).catch(error=>console.warn('Live scene sync failed',error));
 },160);
}
function liveCameraFrame(time){
 if(!activeLiveSession||!studio?.session||!studio.placed||time-lastLiveCameraSent<110||liveCameraBusy)return;
 const state=studio.cameraSnapshot();if(!state)return;
 liveCameraBusy=true;lastLiveCameraSent=time;
 publishLiveCamera(activeLiveSession.id,state).catch(error=>console.warn('Live camera sync failed',error)).finally(()=>{liveCameraBusy=false;});
}
async function beginLiveShare(){
 if(!studio?.session||!studio.placed){toast('ابتدا AR را اجرا و کف را تثبیت کن.');return;}
 if(activeLiveSession){$('#liveShareDialog')?.showModal();return;}
 const button=$('#arShareSession');if(button)button.disabled=true;
 try{
  await refreshCloudSets();
  activeLiveSession=await createLiveSession({sceneState:studio.exportLiveState(),cameraState:studio.cameraSnapshot()});
  studio.onFrame=liveCameraFrame;
  $('#liveShareUrl').textContent=activeLiveSession.url;
  $('#liveShareQr').innerHTML='<span>در حال ساخت QR…</span>';
  $('#liveShareDialog').showModal();
  try{const QRCode=await import('https://esm.sh/qrcode@1.5.4');$('#liveShareQr').innerHTML=await QRCode.toString(activeLiveSession.url,{type:'svg',width:240,margin:1,errorCorrectionLevel:'M'});}
  catch(error){console.warn('QR module unavailable',error);$('#liveShareQr').innerHTML='<span>QR در دسترس نیست؛ لینک را کپی کن.</span>';}
  await logActivity(cloudMembership,'live_session_started',{session_id:activeLiveSession.id});
 }catch(error){console.error(error);toast(error.message||'ساخت نمایش زنده انجام نشد.');}
 finally{if(button)button.disabled=false;}
}
async function endLiveShare(silent=false){
 const current=activeLiveSession;if(!current)return;
 try{await stopLiveSession(current.id);}catch(error){
  console.warn('Live session revoke failed',error);
  toast('پایان نمایش ثبت نشد؛ دوباره تلاش کن. لینک تا پایان زمان اعتبار فعال می‌ماند.');
  return false;
 }
 activeLiveSession=null;clearTimeout(liveSceneTimer);liveSceneTimer=null;
 if(studio)studio.onFrame=null;
 const dialog=$('#liveShareDialog');if(dialog?.open)dialog.close();
 if(!silent)toast('نمایش زنده پایان یافت.');
 return true;
}
async function refreshCloudSets(){
 if(!cloudMembership)return;
 cloudSets=await loadCompanySets(cloudMembership.company_id);
 demoLibrary=await loadDemoLibrary(cloudMembership);
 const set=getActiveCloudSet();if(set){activeCloudLayout=set.layouts.find(x=>x.id===activeCloudLayout?.id)||activeCloudLayout;activeCloudColorway=set.colorways.find(x=>x.id===activeCloudColorway?.id)||activeCloudColorway;}
}
function showArSheet(mode){
 if(!studio||!studio.placed)return;
 if(arSheetMode===mode){closeArSheet();return;}
 closeArSheet();$('#abCalibrationSheet').hidden=true;$('#arArchitectureActions').hidden=true;arSheetMode=mode;
 const body=$('#arSheetContent'),title=$('#arSheetTitle');body.innerHTML='';
 const selected=studio.selected;
 if(mode==='add'||mode==='replace'){
  const replacing=mode==='replace';
  title.textContent=replacing?'تعویض مدل با حفظ جایگاه':'انتخاب مدل برای نشانگر +';
  if(!replacing)studio.setPlacementEnabled(true);
  const activeSet=getActiveCloudSet(),allowedProducts=publishedCatalogIndexes();
  const categories=ASSET_CATEGORIES.map(c=>({...c,indexes:[...new Set([...c.indexes.filter(i=>!getCloudProductInfo(i)?.metadata.category||getCloudProductInfo(i).metadata.category===c.id),...cloudProductInfoList().filter(p=>(p.catalog_index<32||getCloudProduct(p.catalog_index))&&p.metadata.category===c.id).map(p=>p.catalog_index)])]}));
  const groups=replacing&&selected?
   categories.map(c=>({...c,indexes:variantsFor(selected.userData.index).filter(i=>c.indexes.includes(i)&&(!allowedProducts||allowedProducts.has(i)))})).filter(c=>c.indexes.length):
   categories.map(c=>({...c,indexes:c.indexes.filter(i=>i!==5&&(!allowedProducts||allowedProducts.has(i)))})).filter(c=>c.indexes.length);
  body.innerHTML=`<div class="ar-category-tabs">${groups.map((c,i)=>`<button data-category="${c.id}" class="${i===0?'selected':''}">${c.label}</button>`).join('')}</div>
   <div class="ar-object-grid" id="categoryObjects"></div>
   <small class="sheet-tip">${replacing?'جایگاه و رنگ مدل تا حد ممکن حفظ می‌شود.':'نشانگر + روی کف، محل مدل جدید را نشان می‌دهد؛ قبل از انتخاب مدل دوربین را به جای دلخواه بگیر.'}</small>
   ${groups.some(c=>c.id==='wall-art')?'<small class="sheet-tip">تابلوها فعلاً روی یک صفحه عمودی مجازی در موقعیت تقریبی قرار می‌گیرند؛ تشخیص خودکار دیوار واقعی نیاز به WebXR Plane Detection دارد.</small>':''}`;
  function populate(category){
   const group=groups.find(c=>c.id===category)||groups[0];if(!group)return;
   const holder=body.querySelector('#categoryObjects');holder.innerHTML=group.indexes.map(i=>{const cloud=getCloudProduct(i)||getCloudProductInfo(i),name=(i===1000?'SheenChair':cloud?.name||catalogImages[i]?.[0]||'مدل').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<button data-add-object="${i}" class="catalog-tile"><span class="catalog-preview">${i===1000||(cloud&&i>=32&&!cloud.thumbnail_url)?'<span class="catalog-no-preview">◈<small>مدل سه‌بعدی</small></span>':`<img src="${cloud?.thumbnail_url||`assets/chido/thumbs/${i}.jpg?v=0.7.0`}" width="192" height="192" loading="lazy" decoding="async" alt="پیش‌نمایش ${name}">`}</span><span class="catalog-name">${name}</span></button>`;}).join('');
   body.querySelectorAll('[data-category]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.category===group.id));
   holder.querySelectorAll('[data-add-object]').forEach(btn=>btn.onclick=()=>{
    if(studio.items.length>=24&&!replacing){toast('به محدودیت ۲۴ آبجکت رسیدی.');return;}
    const i=Number(btn.dataset.addObject);if(!publishedCatalogIndexes().has(i))return;const mesh=replacing?studio.replaceSelected(i):studio.addAtMarker(i);
    if(!mesh){toast('فضای کافی برای این مدل نیست؛ ابتدا آبجکت‌ها را جابه‌جا کن.');return;}
    closeArSheet();toast('«'+(catalogImages[i]?.[0]||'مدل')+'» انتخاب شد.');
   });
  }
  body.querySelectorAll('[data-category]').forEach(btn=>btn.onclick=()=>populate(btn.dataset.category));
  populate(groups[0]?.id);
 }else if(mode==='colors'){
  const surface=studio.architecture?.selectedSurface();
  if(surface&&['floor','wall'].includes(surface.kind)){
   const options=surface.kind==='floor'?FLOOR_FINISHES:WALL_FINISHES;
   const current=surface.kind==='floor'?studio.architecture.data.floorMaterial:studio.architecture.data.walls.find(w=>w.id===surface.id)?.material||studio.architecture.data.wallMaterial;
   title.textContent=surface.kind==='floor'?'تکسچر و رنگ کف':'تکسچر و رنگ دیوار';
   body.innerHTML=`<div class="architecture-finish-grid">${options.map(f=>`<button data-architecture-finish="${f.id}" class="${current===f.id?'selected':''}"><img src="${finishPreviewDataUrl(f.id)}" alt="بافت ${f.label}"><span>${f.label}</span></button>`).join('')}</div><small class="sheet-tip">سرامیک ۱×۱ متر؛ موکت بافت‌دار؛ بازتاب محیطی کف سرامیکی فعال است.</small>`;
   body.querySelectorAll('[data-architecture-finish]').forEach(btn=>btn.onclick=()=>{
    if(studio.architecture.setSelectedFinish(btn.dataset.architectureFinish)){
     body.querySelectorAll('[data-architecture-finish]').forEach(b=>b.classList.toggle('selected',b===btn));
    }
   });
  }else if(selected?.userData.index===31){
    title.textContent='متریال فرش';body.innerHTML='<p class="sheet-tip">فرش واردشده تکسچر اختصاصی دارد و رنگ آن از فایل GLB خوانده می‌شود.</p>';
   }else if(selected?.userData.index===7){
   title.textContent='طرح و رنگ فرش';
   body.innerHTML=`<div class="rug-grid">${RUG_STYLES.map(r=>`<button data-rug="${r.id}" class="${selected.userData.rugStyle===r.id?'selected':''}"><img src="${rugPreviewDataUrl(r.id)}" alt="${r.name}"><span>${r.name}</span></button>`).join('')}</div>`;
   body.querySelectorAll('[data-rug]').forEach(btn=>btn.onclick=()=>{studio.setRugStyle(btn.dataset.rug);body.querySelectorAll('[data-rug]').forEach(b=>b.classList.toggle('selected',b===btn));});
  }else if(selected?.userData.imported){
   title.textContent='متریال · '+selected.userData.product.name;
   mountMaterialPanel(body,studio,selected,{notify:toast});
  }else{
   title.textContent=selected?'رنگ و جنس · '+selected.userData.product.name:'ابتدا آبجکت را انتخاب کن';
   const colors=[...themes[themeIndex].colors,'#b6bca2','#70858b','#b79c85','#ae8574','#546356','#5f5753','#efe8df'];
   body.innerHTML=`<div class="ar-color-grid">${colors.map((c,i)=>`<button data-material="${c}" title="${c}" aria-label="رنگ ${i+1}" style="--swatch:${c}"><span></span></button>`).join('')}</div>`;
   body.querySelectorAll('[data-material]').forEach(btn=>btn.onclick=()=>{if(!studio.selected)return;studio.color(btn.dataset.material);});
  }
 }else if(mode==='objects'){
  title.textContent='اشیای داخل چیدمان · '+fa(studio.items.length);
  body.innerHTML=`<div class="ar-object-list">${studio.items.map(m=>`<div class="ar-list-row ${m===selected?'selected':''}">
    <button class="ar-list-select" data-select-id="${m.userData.id}">${objectIcon(m.userData.index)}<span>${m.userData.product.name}</span></button>
    <button data-show-id="${m.userData.id}" aria-label="${m.visible?'پنهان کردن':'نمایش دادن'}">${m.visible?'◉':'◌'}</button>
    <button data-delete-id="${m.userData.id}" aria-label="حذف">×</button>
   </div>`).join('')}</div><small class="sheet-tip">با ◉ نمایش را خاموش یا روشن کن؛ × آبجکت را حذف می‌کند. برای ذخیره از پنل پایین استفاده کن.</small>`;
  const refresh=()=>{closeArSheet();showArSheet('objects');};
  body.querySelectorAll('[data-select-id]').forEach(btn=>btn.onclick=()=>{studio.select(studio.items.find(m=>m.userData.id===Number(btn.dataset.selectId)));refresh();});
  body.querySelectorAll('[data-show-id]').forEach(btn=>btn.onclick=()=>{const id=Number(btn.dataset.showId),mesh=studio.items.find(m=>m.userData.id===id);studio.setItemVisible(id,!mesh.visible);refresh();});
  body.querySelectorAll('[data-delete-id]').forEach(btn=>btn.onclick=()=>{const item=studio.items.find(m=>m.userData.id===Number(btn.dataset.deleteId));if(item){studio.select(item);studio.remove();}refresh();});
 }else if(mode==='features'){
  if(!selected){title.textContent='ابتدا یک مدل انتخاب کن';return;}
  const i=selected.userData.index;
  title.textContent='تغییر مدل و ویژگی‌های '+selected.userData.product.name;
  if(isSofa(i)){
   body.innerHTML=`<p class="feature-caption">تعداد نشیمن</p><div class="feature-options">${[1,2,3].map(n=>`<button data-sofa-seats="${n}" class="${selected.userData.seats===n?'selected':''}">${fa(n)} نفره</button>`).join('')}</div>
   <p class="feature-caption">کوسن روی مبل</p><div class="feature-options">${CUSHION_PRESETS.map(p=>`<button data-cushion="${p.id}" class="${selected.userData.cushionPreset===p.id?'selected':''}">${p.name}</button>`).join('')}</div>`;
   body.querySelectorAll('[data-sofa-seats]').forEach(btn=>btn.onclick=()=>{if(!studio.setSofaSeats(+btn.dataset.sofaSeats)){toast('برای این ابعاد فضای کافی وجود ندارد.');return;}closeArSheet();showArSheet('features');});
   body.querySelectorAll('[data-cushion]').forEach(btn=>btn.onclick=()=>{studio.setSofaCushions(btn.dataset.cushion);closeArSheet();showArSheet('features');});
  }else if(i===10){
   body.innerHTML=`<p class="feature-caption">تعداد نفرات و صندلی‌های همراه</p><div class="feature-options">${[2,4,6,8].map(n=>`<button data-seats="${n}" class="${selected.userData.capacity===n?'selected':''}">${fa(n)} نفره</button>`).join('')}</div>`;
   body.querySelectorAll('[data-seats]').forEach(btn=>btn.onclick=()=>{if(!studio.setDiningCapacity(+btn.dataset.seats)){toast('برای این ابعاد فضای کافی وجود ندارد.');return;}closeArSheet();showArSheet('features');});
  }else if(isLamp(i)){
   body.innerHTML=`<p class="feature-caption">نوع آباژور</p><div class="feature-options">${[6,14,15,28,29].map(id=>`<button data-lamp="${id}" class="${i===id?'selected':''}">${catalogImages[id][0]}</button>`).join('')}</div>`;
   body.querySelectorAll('[data-lamp]').forEach(btn=>btn.onclick=()=>{if(!studio.replaceSelected(+btn.dataset.lamp)){toast('فضای کافی برای این مدل وجود ندارد.');return;}closeArSheet();showArSheet('features');});
  }else if(i===31){
    body.innerHTML='<p class="sheet-tip">این فرش با ابعاد اصلی ۳۰۰ × ۲۰۰ سانتی‌متر و تکسچر GLB نمایش داده می‌شود. سایه و کالیژن ندارد.</p>';
   }else if(i===7){
    title.textContent='تنظیمات فرش · ابعاد و طرح';
    const size=selected.userData.product.size;
    body.innerHTML=`<p class="feature-caption">ابعاد فرش (متر)</p><div class="feature-options rug-sizes">${RUG_SIZE_PRESETS.map(p=>`<button data-rug-size="${p.id}" class="${Math.abs(size[0]-p.size[0])<.01&&Math.abs(size[2]-p.size[2])<.01?'selected':''}">${p.label}</button>`).join('')}</div><p class="feature-caption">طرح و رنگ فرش</p><div class="rug-grid">${RUG_STYLES.map(r=>`<button data-rug="${r.id}" class="${selected.userData.rugStyle===r.id?'selected':''}"><img src="${rugPreviewDataUrl(r.id)}" alt="${r.name}"><span>${r.name}</span></button>`).join('')}</div><small class="sheet-tip">ابعاد واقعی و طرح فرش همراه چیدمان ذخیره می‌شوند.</small>`;
    body.querySelectorAll('[data-rug-size]').forEach(btn=>btn.onclick=()=>{const preset=RUG_SIZE_PRESETS.find(p=>p.id===btn.dataset.rugSize);if(preset&&studio.setRugSize(preset.size)){closeArSheet();showArSheet('features');}else toast('برای این اندازه فرش فضای کافی نیست.');});
    body.querySelectorAll('[data-rug]').forEach(btn=>btn.onclick=()=>{if(studio.setRugStyle(btn.dataset.rug))body.querySelectorAll('[data-rug]').forEach(b=>b.classList.toggle('selected',b===btn));});
   }
   else if(isTable(i)||isWallArt(i)){
   const variants=variantsFor(i);body.innerHTML=`<p class="feature-caption">اندازه و شکل مدل</p><div class="feature-options">${variants.map(id=>`<button data-variant="${id}" class="${i===id?'selected':''}">${catalogImages[id]?.[0]||'مدل'}</button>`).join('')}</div>${isWallArt(i)?'<label class="wall-art-upload">تصویر تابلو <input type="file" id="artImageFile" accept="image/jpeg,image/png,image/webp"></label><small class="sheet-tip">تصویر شخصی در همین دستگاه و همراه چیدمان ذخیره می‌شود.</small>':''}`;
   body.querySelectorAll('[data-variant]').forEach(btn=>btn.onclick=()=>{if(!studio.replaceSelected(+btn.dataset.variant)){toast('فضای کافی برای این مدل وجود ندارد.');return;}closeArSheet();showArSheet('features');});
    if(isWallArt(i))$('#artImageFile').onchange=async event=>{try{const file=event.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('فایل تصویر معتبر نیست یا بیش از ۸ مگابایت است.');const picture=await createImageBitmap(file),ratio=selected.userData.product.size[0]/selected.userData.product.size[1],canvas=document.createElement('canvas');canvas.width=Math.min(640,Math.round(480*ratio));canvas.height=Math.round(canvas.width/ratio);const context=canvas.getContext('2d');if(!context)throw Error('دسترسی به Canvas ممکن نیست.');const scale=Math.max(canvas.width/picture.width,canvas.height/picture.height),w=picture.width*scale,h=picture.height*scale;context.drawImage(picture,(canvas.width-w)/2,(canvas.height-h)/2,w,h);picture.close?.();if(!studio.setWallArtImage(canvas.toDataURL('image/jpeg',.72),selected))throw Error('تصویر ذخیره نشد.');toast('تصویر تابلو عوض شد.');}catch(error){toast(error.message||'تغییر تصویر ممکن نشد.');}};
  }else body.innerHTML='<p class="sheet-tip">رنگ، چرخش، جابه‌جایی و تعویض مدل در دسترس است.</p>';
 }else if(mode==='request-layout'){
  const set=getActiveCloudSet();title.textContent='درخواست چیدمان جدید';
  body.innerHTML='<p class="sheet-tip">توضیح بده چه ترکیب یا حالت جدیدی برای این ست لازم داری. مدیر شرکت درخواست را بررسی می‌کند.</p><textarea id="cloudLayoutRequestText" rows="4" maxlength="800" placeholder="مثلاً یک چیدمان L شکل با فضای بیشتر برای میز جلو مبلی…"></textarea><button id="sendCloudLayoutRequest" class="primary">ارسال درخواست</button>';
  $('#sendCloudLayoutRequest').onclick=async()=>{
   const description=$('#cloudLayoutRequestText').value.trim();if(description.length<5){toast('توضیح درخواست کوتاه است.');return;}
   try{await requestOfficialLayout({setId:set.id,description});closeArSheet();toast('درخواست برای مدیر شرکت ارسال شد.');}
   catch(error){toast(error.message||'ارسال درخواست انجام نشد.');}
  };
 }else if(mode==='cloud-layouts'){
  const set=getActiveCloudSet();title.textContent='چیدمان‌های رسمی';
  body.innerHTML=set?'<div class="cloud-sheet-list">'+set.layouts.map(item=>`<div class="cloud-sheet-row-wrap"><button class="cloud-sheet-row" data-open-cloud-layout="${item.id}"><strong>${item.name}</strong><small>${item.room} · ${item.capacity} نفر</small></button>${cloudMembership?.role==='company_admin'?'<button class="cloud-archive" data-archive-cloud-layout="'+item.id+'">آرشیو</button>':''}</div>`).join('')+'</div>':'<p class="sheet-tip">ست فعالی انتخاب نشده است.</p>';
  body.querySelectorAll('[data-open-cloud-layout]').forEach(btn=>btn.onclick=()=>{
   const record=set.layouts.find(item=>item.id===btn.dataset.openCloudLayout);if(!record)return;
   activeCloudLayout=record;space=record.room||space;peopleCount=Number(record.capacity)||5;layout=record.template_kind||'empty';
   if(record.scene_state){studio.clear();sceneMemory=filterPublishedScene(record.scene_state,publishedCatalogIndexes());if(sceneMemory)studio.restoreState(sceneMemory);}
   else{studio.clear();studio.seed('empty',space,peopleCount);}
   minimap.render();closeArSheet();toast('چیدمان رسمی باز شد.');
  });
  body.querySelectorAll('[data-archive-cloud-layout]').forEach(btn=>btn.onclick=async()=>{
   if(!confirm('این چیدمان از فهرست رسمی خارج شود؟'))return;
   try{await archiveOfficialLayout(btn.dataset.archiveCloudLayout);await refreshCloudSets();showArSheet('cloud-layouts');toast('چیدمان آرشیو شد.');}
   catch(error){toast(error.message||'آرشیو چیدمان انجام نشد.');}
  });
 }else if(mode==='colorways'){
  const set=getActiveCloudSet();title.textContent='رنگ‌بندی‌های رسمی ست';
  body.innerHTML=set?'<div class="cloud-sheet-list">'+set.colorways.map(item=>`<div class="cloud-sheet-row-wrap"><button class="cloud-sheet-row" data-apply-cloud-colorway="${item.id}"><strong>${item.name}</strong><small>اعمال روی محصولات این ست</small></button>${cloudMembership?.role==='company_admin'?'<button class="cloud-archive" data-archive-cloud-colorway="'+item.id+'">آرشیو</button>':''}</div>`).join('')+'</div>':'<p class="sheet-tip">ست فعالی انتخاب نشده است.</p>';
  body.querySelectorAll('[data-apply-cloud-colorway]').forEach(btn=>btn.onclick=()=>{const record=set.colorways.find(item=>item.id===btn.dataset.applyCloudColorway);if(record){applyCloudColorway(record);closeArSheet();}});
  body.querySelectorAll('[data-archive-cloud-colorway]').forEach(btn=>btn.onclick=async()=>{
   if(!confirm('این رنگ‌بندی از فهرست رسمی خارج شود؟'))return;
   try{await archiveOfficialColorway(btn.dataset.archiveCloudColorway);await refreshCloudSets();showArSheet('colorways');toast('رنگ‌بندی آرشیو شد.');}
   catch(error){toast(error.message||'آرشیو رنگ‌بندی انجام نشد.');}
  });
 }else if(mode==='save'&&cloudMembership?.role==='company_admin'&&activeCloudSetId){
  const set=getActiveCloudSet();title.textContent='ذخیره رسمی در '+(set?.name||'ست');
  body.innerHTML=`<section class="cloud-save-section"><h3>چیدمان</h3><label>نام چیدمان<input id="cloudLayoutName" maxlength="70" value="${(activeCloudLayout?.name||'').replaceAll('"','&quot;')}" placeholder="مثلاً چیدمان هفت‌نفره"></label><button id="saveCloudLayoutNew" class="primary">ذخیره به‌عنوان چیدمان جدید</button>${activeCloudLayout?'<button id="saveCloudLayoutUpdate">به‌روزرسانی همین چیدمان رسمی</button>':''}</section><section class="cloud-save-section"><h3>رنگ‌بندی</h3><label>نام رنگ‌بندی<input id="cloudColorwayName" maxlength="70" value="${(activeCloudColorway?.name||'').replaceAll('"','&quot;')}" placeholder="مثلاً آبی نفتی"></label><button id="saveCloudColorway" class="primary">ذخیره رنگ‌بندی فعلی</button></section><small class="sheet-tip">ذخیره فقط با فشردن دکمه انجام می‌شود. جابه‌جایی و تغییر رنگ به‌تنهایی هیچ نسخه رسمی جدیدی نمی‌سازد.</small>`;
  const saveLayout=async overwrite=>{
   const name=$('#cloudLayoutName').value.trim();if(!name){toast('نام چیدمان را وارد کن.');return;}
   try{const saved=await saveOfficialLayout({setId:activeCloudSetId,layoutId:overwrite?activeCloudLayout?.id:null,name,room:space,templateKind:layout,capacity:peopleCount,sceneState:studio.exportState()});activeCloudLayout=saved;await refreshCloudSets();closeArSheet();toast('چیدمان رسمی ذخیره شد.');}
   catch(error){toast(error.message||'ذخیره چیدمان انجام نشد.');}
  };
  $('#saveCloudLayoutNew').onclick=()=>saveLayout(false);
  if($('#saveCloudLayoutUpdate'))$('#saveCloudLayoutUpdate').onclick=()=>saveLayout(true);
  $('#saveCloudColorway').onclick=async()=>{
   const name=$('#cloudColorwayName').value.trim();if(!name){toast('نام رنگ‌بندی را وارد کن.');return;}
   try{const saved=await saveOfficialColorway({setId:activeCloudSetId,colorwayId:activeCloudColorway?.id||null,name,materialMap:currentMaterialMap()});activeCloudColorway=saved;await refreshCloudSets();closeArSheet();toast('رنگ‌بندی رسمی ذخیره شد.');}
   catch(error){toast(error.message||'ذخیره رنگ‌بندی انجام نشد.');}
  };
 }else if(mode==='save'||mode==='saved'){
   title.textContent=mode==='save'?'ذخیره چیدمان':'چیدمان‌های ذخیره‌شده';
   const saved=listCustomLayouts().filter(x=>x.room===space);
   const name=activeSavedLayoutId?saved.find(x=>x.id===activeSavedLayoutId)?.name:'';
   body.innerHTML=(mode==='save'?'<p class="sheet-tip">چیدمان در حافظه همین مرورگر ذخیره می‌شود. برای برگشت، بدون خروج از AR چیدمان را از فهرست باز کن.</p><div class="custom-save-row"><input id="saveArrangementName" maxlength="70" placeholder="نام چیدمان" value="'+(name||'').replaceAll('"','&quot;')+'"><button id="saveArrangementConfirm">ذخیره به‌عنوان جدید</button></div>'+(activeSavedLayoutId?'<button id="overwriteArrangement">به‌روزرسانی چیدمان فعلی</button>':''):'')+
    '<div class="ar-save-list">'+(saved.map(x=>'<div class="ar-save-list-row"><strong>'+x.name.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</strong><button data-open-ar-layout="'+x.id+'">بازکردن</button><button data-remove-ar-layout="'+x.id+'" aria-label="حذف">×</button></div>').join('')||'<small class="sheet-tip">چیدمان ذخیره‌شده‌ای برای این فضا وجود ندارد.</small>')+'</div>';
   const doSave=(overwrite=false)=>{try{const label=$('#saveArrangementName')?.value||name||'چیدمان '+space;
      const record={...currentSceneRecord(),name:label};
      const result=overwrite?overwriteCustomLayout(activeSavedLayoutId,record):saveCustomLayout(record);
      activeSavedLayoutId=result.id;toast('«'+result.name+'» ذخیره شد.');closeArSheet();
    }catch(error){console.warn(error);toast('ذخیره انجام نشد؛ فضای حافظه مرورگر را بررسی کن.');}};
   if($('#saveArrangementConfirm'))$('#saveArrangementConfirm').onclick=()=>doSave(false);
   if($('#overwriteArrangement'))$('#overwriteArrangement').onclick=()=>doSave(true);
   body.querySelectorAll('[data-open-ar-layout]').forEach(btn=>btn.onclick=()=>{
     const data=listCustomLayouts().find(x=>x.id===btn.dataset.openArLayout);
     if(!data)return;loadSceneRecord(data);sceneMemory=filterPublishedScene(data.scene,publishedCatalogIndexes());studio.clear();if(sceneMemory)studio.restoreState(sceneMemory);minimap.render();closeArSheet();toast('چیدمان در محیط AR باز شد.');
   });
   body.querySelectorAll('[data-remove-ar-layout]').forEach(btn=>btn.onclick=()=>{
     if(activeSavedLayoutId===btn.dataset.removeArLayout)activeSavedLayoutId=null;
     removeCustomLayout(btn.dataset.removeArLayout);closeArSheet();showArSheet(mode);
   });
  }else if(mode==='architecture'){
  title.textContent='ابزارهای فضا';
  const a=studio.architecture,chosen=a.selected();
  body.innerHTML=`<div class="feature-options architecture-tool-list">
   ${[['floor','کف چندضلعی'],['wall','دیوار پیوسته'],['window','پنجره ثابت · فقط فریم']].map(([key,label])=>`<button data-architecture-mode="${key}" class="${a.mode===key?'selected':''}">${label}</button>`).join('')}
  </div><small class="sheet-tip">کف: رأس‌ها را به ترتیب لمس کن و اتمام را بزن. دیوار: نقطه شروع و انتهای هر قطعه را لمس کن. پنجره فقط روی دیوار نصب می‌شود.</small>
  ${chosen?`<div class="window-editor"><strong>ابعاد پنجره انتخاب‌شده (متر)</strong>
    ${[['width','عرض'],['height','ارتفاع'],['sill','ارتفاع از کف'],['along','موقعیت روی دیوار']].map(([key,label])=>`<label>${label}<input data-window-edit="${key}" type="number" min="0" step=".01" value="${chosen[key].toFixed(2)}"></label>`).join('')}
    <button id="architectureDeleteWindow">حذف پنجره</button></div>`:''}`;
  body.querySelectorAll('[data-architecture-mode]').forEach(button=>button.onclick=()=>{
   const mode=a.setMode(button.dataset.architectureMode);closeArSheet();$('#arArchitectureActions').hidden=!mode;
   $('#arArchitectureConfirm').hidden=mode!=='wall';$('#arArchitectureCancel').hidden=mode!=='wall';$('#arArchitectureFinish').hidden=mode==='wall';
   $('#arArchitectureHint').textContent=mode==='floor'?'کف · رأس‌ها را ثبت کن':mode==='wall'?'دیوار · ابتدا A سپس B':mode==='window'?'پنجره · دیوار را لمس کن':'';
   if(mode)toast('ابزار «'+button.textContent+'» فعال شد.');
  });
  body.querySelectorAll('[data-window-edit]').forEach(input=>input.onchange=()=>{
   try{if(!a.editSelected({[input.dataset.windowEdit]:Number(input.value)}))throw Error('ابعاد یا موقعیت با دیوار سازگار نیست.');closeArSheet();showArSheet('architecture');}
   catch(error){toast(error.message);}
  });
  if(chosen)body.querySelector('#architectureDeleteWindow').onclick=()=>{a.removeSelected();closeArSheet();};
 }else if(mode==='settings'){
  title.textContent='تنظیمات نور و ردیابی AR';
  const details=$('#arSettings');details.hidden=false;details.open=true;body.append(details);
  const status=document.createElement('p');status.className='xr-status';status.textContent='عمق: '+(arReport?.depth||'نامشخص')+' · نور: '+(arReport?.light||'نامشخص');body.append(status);
 }
 $('#arToolSheet').hidden=false;
}
$('#abLengthButton').onclick=()=>{$('#abCalibrationSheet').hidden=false;$('#aractual').value=studio?.measurement().actualCm||Math.round(studio?.measurement().correctedCm||100);};
$('#abCalibrationClose').onclick=()=>{$('#abCalibrationSheet').hidden=true;};
$('#arCalibrationTool').onclick=()=>{closeArSheet();$('#arArchitectureActions').hidden=true;$('#abCalibrationSheet').hidden=!$('#abCalibrationSheet').hidden;};
function updateArchitectureSelection(){
 const selected=studio?.architecture?.selectedSurface(),bar=$('#arSurfaceActions');if(!bar)return;
 bar.hidden=!selected||!studio?.session||!studio?.placed||studio.photoMode;
 if(!selected)return;
 $('#arSurfaceName').textContent=selected.kind==='floor'?'کف':selected.kind==='wall'?'دیوار':'پنجره';
 $('#arSurfaceMaterial').hidden=selected.kind==='window';
}
$('#arSurfaceMaterial').onclick=()=>showArSheet('colors');
$('#arSurfaceDelete').onclick=()=>{
 const s=studio?.architecture?.selectedSurface();if(!s)return;
 if(studio.architecture.deleteSelected()){closeArSheet();toast('سطح انتخاب‌شده حذف شد.');}
};
$('#arArchitectureTool').onclick=()=>showArSheet('architecture');
$('#arArchitectureConfirm').onclick=()=>{if(!studio?.architecture.confirmWall()){toast('دو نقطه معتبر برای دیوار مشخص کن.');return;}toast('دیوار ثبت شد؛ برای ادامه نقطه بعدی را انتخاب کن.');};
$('#arArchitectureCancel').onclick=()=>{studio?.architecture.cancelPlacement();$('#arArchitectureActions').hidden=true;toast('ترسیم دیوار لغو شد.');};
$('#arArchitectureFinish').onclick=()=>{if(!studio?.architecture.finish()){toast('برای ساخت کف، سه رأس معتبر و بدون تقاطع لازم است.');return;}$('#arArchitectureActions').hidden=true;toast('ابزار معماری بسته شد.');};
$('#arArchitectureUndo').onclick=()=>{if(!studio?.architecture.undo())toast('نقطه‌ای برای بازگشت نیست.');};
$('#arSheetClose').onclick=closeArSheet;
$('#arAddTool').onclick=()=>showArSheet('add');
$('#arMaterialTool').onclick=()=>showArSheet('colors');
$('#quickCopy').onclick=()=>{if(studio?.items.length>=24){toast('حد آبجکت‌ها ۲۴ است.');return;}const item=studio?.duplicateSelected();toast(item?'نسخه دوم کنار آبجکت قبلی ساخته شد.':'در اطراف آبجکت فضای کافی برای کپی وجود ندارد.');};
$('#quickChange').onclick=()=>showArSheet('replace');
$('#quickProps').onclick=()=>showArSheet('features');
$('#quickRotate').onclick=()=>studio?.rotate();
function updateLampPowerControl(){
 const button=$('#quickPower'),mesh=studio?.selected;
 if(!button)return;
 const lamp=!!mesh&&isLamp(mesh.userData.index);
 button.hidden=!lamp;
 if(!lamp)return;
 const on=!!mesh.userData.lampOn;
 button.setAttribute('aria-pressed',String(on));
 button.setAttribute('aria-label',on?'خاموش کردن آباژور':'روشن کردن آباژور');
 button.title=on?'خاموش کردن آباژور':'روشن کردن آباژور';
 button.classList.toggle('is-on',on);
 button.innerHTML='<span aria-hidden="true">'+(on?'☀':'⏻')+'</span><small>'+(on?'روشن':'خاموش')+'</small>';
}
$('#quickPower').onclick=()=>{if(!studio?.selected||!isLamp(studio.selected.userData.index))return;const on=!studio.selected.userData.lampOn;if(studio.setLampOn(on))updateLampPowerControl();};
$('#quickDelete').onclick=()=>{studio?.remove();};
$('#arListTool').onclick=()=>showArSheet('objects');
$('#arBottomSave').onclick=()=>{if(cloudMembership?.role!=='company_admin'||!activeCloudSetId){toast('ذخیره رسمی فقط برای مدیر شرکت و داخل یک ست فعال است.');return;}showArSheet('save');};
$('#arBottomOpen').onclick=()=>showArSheet(activeCloudSetId?'cloud-layouts':'saved');
$('#arColorwayTool').onclick=()=>showArSheet('colorways');
$('#arShareSession').onclick=beginLiveShare;
$('#liveShareClose').onclick=()=>$('#liveShareDialog').close();
$('#liveShareCopy').onclick=async()=>{try{await navigator.clipboard.writeText(activeLiveSession?.url||$('#liveShareUrl').textContent);toast('لینک نمایش کپی شد.');}catch{toast('کپی خودکار ممکن نیست؛ لینک را دستی انتخاب کن.');}};
$('#liveShareStop').onclick=()=>endLiveShare(false);
$('#arSettingsTool').onclick=()=>showArSheet('settings');
$('#arPhotoTool').onclick=()=>setPhotoMode(true);
$('#arRulerTool').onclick=()=>{
 if(!studio||!studio.placed)return;
 studio.setMoveLayoutMode(false);
 closeArSheet();
 const active=studio.setMeasureActive(!studio.measureTool.active);
 $('#arRulerTool').setAttribute('aria-pressed',String(active));$('#measureHint').hidden=!active;
 $('#measureReadout').textContent=active?'نقطه اول را روی کف لمس کن':'';
 if(active)toast('روی دو نقطه از کف لمس کن؛ فاصله برحسب متر نمایش داده می‌شود.');
};
$('#measureClear').onclick=()=>{studio?.clearMeasure();$('#measureReadout').textContent='نقطه اول را روی کف لمس کن';};
function handleARReport(report){
 arReport=report;refreshDebugPanel();
 const scanBox=$('#scanReadiness');
 scanBox.hidden=report.placed;
 if(!report.placed){
  let progress=12,label='راه‌اندازی ردیابی…';
  if(report.tracking){progress=35;label='دوربین آماده است؛ آرام به سمت کف حرکت بده';}
  if(report.scanHits>0){progress=60;label='برخورد با سطح ثبت شد؛ بررسی نقاط کف';}
  if(report.validHits>0){progress=78;label='نقاط افقی دریافت شدند';}
  if(report.hit){progress=100;label='کف پیشنهادی آماده است؛ تثبیت را بزن';}
  $('#scanProgress').value=progress;
  $('#scanPercent').textContent=fa(progress)+'٪';
  $('#scanStage').textContent=label;
 }
 $('#objectQuick').hidden=!report.placed||!studio?.selected;

 const scanInfo=(!report.placed&&report.scanDrop!==null)?` · raw ${report.scanHits} · valid ${report.validHits} · cluster ${report.inlierHits} · vertical ${report.scanDrop.toFixed(2)}m · ray ${report.scanDistance.toFixed(2)}m`:'';
 $('#diagnostics').textContent=`${report.objects} objects · visible ${report.visible} · ${report.fps} FPS · tracking ${report.tracking?'OK':'LOST'} · hit ${report.placed?'LOCKED':report.hit?'READY':'SEARCH'} · placed ${report.placed?'YES':'NO'} · anchor ${report.anchor} · light ${report.light} · depth ${report.depth}${scanInfo}`;
 $('#confirmFloor').hidden=report.placed;$('#confirmFloor').disabled=!report.hit||!report.tracking;
 $('#confirmFloor').textContent=report.hit?'تثبیت کف و ورود به چیدمان':'در حال شناسایی کف…';
 $('#arEditControls').hidden=true;
 $('#arSettings').hidden=!(report.placed&&arSheetMode==='settings');
 $('#arDock').hidden=!report.placed;$('#arMiniMap').hidden=!report.placed;$('#arBottomActions').hidden=!report.placed;updateCloudControls();if(report.placed){minimap.render();if(!calibrationPrompted){calibrationPrompted=true;$('#abCalibrationSheet').hidden=false;}}else $('#abInline').hidden=true;
 $('#arDock').classList.toggle('ready',report.placed);
 const wideSelect=$('#wideViewMode');wideSelect.disabled=!report.placed||!studio?.hasOverlay;
 $('#wideNatural').disabled=wideSelect.disabled;
 if(!report.placed)resetWideViewControls();
 $('#overlay').classList.toggle('floor-ready',report.placed);
 if(!report.placed){closeArSheet();$('#measureHint').hidden=true;}
 updateMeasurements();
}
async function startAR(basic=false,incomingSession=null){if(!studio||studio.session||arStarting)return;arStarting=true;calibrationPrompted=false;const launchingStudio=studio;const button=$('#startAR');button.disabled=true;$('#arError').close();try{$('#overlay').hidden=false;$('#confirmFloor').hidden=false;$('#confirmFloor').disabled=true;$('#arEditControls').hidden=true;$('#arDock').hidden=true;$('#objectQuick').hidden=true;$('#scanReadiness').hidden=false;$('#scanProgress').value=12;$('#scanStage').textContent='راه‌اندازی AR…';$('#scanPercent').textContent='۱۲٪';closeArSheet();$('#arSettings').hidden=true;$('#arStatus').textContent='در حال شناسایی کف…';resetWideViewControls();const result=await launchingStudio.startAR(message=>$('#arStatus').textContent=message,handleARReport,basic,{light:!basic&&$('#lightEnabled').checked,depth:!basic&&$('#depthEnabled').checked},incomingSession);if(studio!==launchingStudio||!launchingStudio.session)return;if(!result.hasOverlay)$('#overlay').hidden=true;$('#launchProgress').value=3;$('#launchStage').textContent='نشست AR آماده شد؛ کف را اسکن کن.';studio.setDebugVisible(debugEnabled);updateObjects();}catch(error){if(studio!==launchingStudio)return;$('#overlay').hidden=true;$('#arDock').hidden=true;button.hidden=false;$('#launchStage').textContent='ورود به AR ناموفق بود؛ جزئیات را بررسی کن.';const failure=explainXR(error);lastXRErrorReport=JSON.stringify({version:'0.4.1',mode:basic?'basic':'full',stage:failure.stage,name:failure.name,message:failure.detail,secureContext:isSecureContext,webXR:!!navigator.xr,supportCheck:supported,userAgent:navigator.userAgent},null,2);$('#arErrorMessage').textContent=failure.message;$('#arErrorDetails').textContent=lastXRErrorReport;$('#arError').showModal();console.error(error);}finally{arStarting=false;button.disabled=false;}}
function resetWideViewControls(){
 const select=$('#wideViewMode');if(select){select.value='ar';select.disabled=true;}
 const natural=$('#wideNatural');if(natural)natural.disabled=true;
 const hint=$('#wideViewHint');if(hint)hint.textContent='نمای دوربین واقعی · بدون تغییر مقیاس';
}
function showWideProjection({horizontal,requestedHorizontal,limited}){
 const actual=Math.round(horizontal);
 $('#wideViewHint').textContent=limited
  ?`طبیعی · دید افقی ${actual}° (از ${requestedHorizontal}°) · ارتفاع واقعی ثابت`
  :`دید افقی ${actual}° · Pose زنده XR · مقیاس ۱:۱`;
}
function applyWideMode(){
 const select=$('#wideViewMode'),mode=select.value;
 const outcome=studio?.setWideView(mode,{natural:$('#wideNatural').checked})||
  {ok:false,reason:'جلسه AR فعال نیست.'};
 if(!outcome.ok){select.value=studio?.wideMode||'ar';toast(outcome.reason);return;}
 if(mode==='ar')$('#wideViewHint').textContent='تصویر دوربین واقعی · ردیابی AR';
 else showWideProjection({horizontal:outcome.hfov,requestedHorizontal:outcome.requestedHfov,limited:outcome.limited});
}
$('#wideViewMode').onchange=applyWideMode;
$('#wideNatural').onchange=()=>{if(studio?.session&&studio.wideMode!=='ar')applyWideMode();};
let debugEnabled=false;
function refreshDebugPanel(){
 const panel=$('#arDebugPanel');if(!panel||panel.hidden||!studio)return;
 $('#debugReadout').textContent=studio.debugView.summary();
}
function setDebug(enabled){
 debugEnabled=!!enabled;
 $('#arDebugPanel').hidden=!debugEnabled;
 
 studio?.setDebugVisible(debugEnabled);
 if(debugEnabled)refreshDebugPanel();
}
function saveDebugJSON(){
 if(!studio)return;
 const data={...studio.debugExport(),runtime:runtimeHealth()};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;
 a.download='chido-ar-diagnostics-'+Date.now()+'.json';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
 toast('گزارش JSON ذخیره شد؛ آن را در گفتگو بفرست.');
}
function openGitHubDebugIssue(){
 if(!studio)return;
 const data=studio.debugExport(),last=studio.debugView.lastState;
 const body=['## CHIDO AR diagnostic report','Version: v0.3.4','Started: '+(data.startedAt||'unknown'),'','### Latest readout','```',studio.debugView.summary(),'```','','### Events','```',JSON.stringify(data.events.slice(-12),null,2),'```','','### Device test notes','(Describe whether the floor was above or below the carpet.)','','The full time-series log is available via the Save JSON button. Attach it manually if needed.'].join('\\n');
 const url='https://github.com/MaxLightner/tolica-ar/issues/new?title='+encodeURIComponent('AR floor detection debug report')+'&body='+encodeURIComponent(body);
 window.open(url,'_blank','noopener');
}

$('#debugHide').onclick=()=>setDebug(false);
$('#debugSave').onclick=saveDebugJSON;
$('#debugGithub').onclick=openGitHubDebugIssue;
let cameraObjectURLs=[],cameraBusy=false,cameraActive=false;
function cameraPhotoURL(blob){
 const url=URL.createObjectURL(blob);cameraObjectURLs.push(url);return url;
}
function clearCameraURLs(){cameraObjectURLs.forEach(URL.revokeObjectURL);cameraObjectURLs=[];}
async function cameraShots(){
 // Imported images, device gallery photos and earlier uploads are not shown here.
 return (await photos()).filter(photo=>isCameraPhoto(photo)).sort((a,b)=>b.date-a.date);
}
async function updateCameraLast(){
 if(!cameraActive)return;
 try{
  const latest=(await cameraShots())[0],image=$('#cameraLastImage'),placeholder=$('#cameraLastPlaceholder');
  clearCameraURLs();
  image.hidden=!latest;placeholder.hidden=!!latest;
  if(latest)image.src=cameraPhotoURL(latest.blob);else image.removeAttribute('src');
 }catch{cameraNotice('دسترسی به عکس‌های چیدو ممکن نیست.');}
}
function cameraNotice(message){
 const el=$('#cameraNotice');el.textContent=message;el.hidden=false;
}
function setPhotoMode(enabled){
 if(!studio)return;
 cameraActive=!!enabled;
 if($('#cameraFallback'))$('#cameraFallback').hidden=true;
 if(enabled){
  minimap.collapse();
  closeArSheet();
  $('#cameraGallery').hidden=true;
  $('#cameraMode').classList.remove('gallery-open','capturing');
  $('#cameraNotice').hidden=true;
  studio.setPlacementEnabled(false);
 }
 studio.setPhotoMode(enabled);
 $('#overlay').classList.toggle('photography',enabled);
 $('#cameraMode').hidden=!enabled;if(enabled){$('#abCalibrationSheet').hidden=true;$('#arArchitectureActions').hidden=true;}else if(studio?.architecture?.mode){$('#arArchitectureActions').hidden=false;}
 $('#objectQuick').hidden=true;
 $('#arMiniMap').hidden=enabled||!studio.placed;
 $('#arBottomActions').hidden=enabled||!studio.placed;
 if(enabled)$('#abInline').hidden=true;
 if(enabled){updateCameraLast();setCameraRatio();}else{
  $('#cameraGallery').hidden=true;
  $('#cameraMode').classList.remove('gallery-open','capturing');
  clearCameraURLs();
 }
 updateArchitectureSelection();
}
function setCameraRatio(){
 const selected=effectiveCameraRatio($('#cameraRatio').value,window.innerWidth,window.innerHeight);
 const ratio=CAMERA_RATIOS[selected]||4/3;
 $('#cameraFraming').style.setProperty('--frame-ratio',String(ratio));
 $('#cameraFraming').style.setProperty('--frame-inverse-ratio',String(1/ratio));
 $('#cameraRatio').setAttribute('aria-label','نسبت تصویر عکس · '+selected);
 const effective=$('#cameraRatioEffective');if(effective)effective.textContent='خروجی: '+selected;
}
$('#cameraRatio').onchange=setCameraRatio;
window.addEventListener('resize',()=>{if(cameraActive)setCameraRatio();});
$('#cameraClose').onclick=()=>setPhotoMode(false);
$('#cameraGalleryBack').onclick=()=>{
 $('#cameraGallery').hidden=true;$('#cameraMode').classList.remove('gallery-open');
};
$('#cameraLast').onclick=()=>openCameraGallery();
async function openCameraGallery(){
 if(!cameraActive)return;
 $('#cameraGallery').hidden=false;$('#cameraMode').classList.add('gallery-open');
 const host=$('#cameraGalleryItems');host.replaceChildren();
 try{
  const shots=await cameraShots();
  if(!cameraActive||$('#cameraGallery').hidden)return;
  $('#cameraGalleryCount').textContent=fa(shots.length);
  if(!shots.length){
   host.textContent='هنوز عکسی با شاتر چیدو ثبت نشده است.';
   return;
  }
  for(const record of shots){
   const card=document.createElement('article');card.className='camera-shot-card';
   const img=document.createElement('img');img.src=cameraPhotoURL(record.blob);img.alt='عکس چیدو';
   const actions=document.createElement('div');actions.className='camera-shot-actions';
   const download=document.createElement('a');download.textContent='ذخیره در دستگاه';download.href=img.src;
   download.download='chido-'+record.id+(record.blob.type==='image/webp'?'.webp':record.blob.type==='image/png'?'.png':'.jpg');
   const del=document.createElement('button');del.textContent='حذف';del.onclick=async()=>{
    if(!confirm('این عکس از گالری چیدو حذف شود؟'))return;
    await removePhoto(record.id);await updateCameraLast();await openCameraGallery();
   };
   const demo=document.createElement('button');demo.type='button';demo.className='gallery-realistic-preview';demo.textContent='رئالیستیک کردن · به‌زودی';demo.onclick=()=>toast('این دکمه فعلاً نمایشی است؛ پردازش تصویر انجام نمی‌شود.');actions.append(download,demo,del);card.append(img,actions);host.append(card);
  }
 }catch{host.textContent='گالری چیدو در این مرورگر در دسترس نیست.';}
}
$('#cameraImport').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024){cameraNotice('فرمت یا حجم عکس مناسب نیست.');return;}
 try{await savePhoto(file,CAMERA_PHOTO_KIND);await updateCameraLast();$('#cameraFallback').hidden=true;cameraNotice('عکس در گالری خصوصی چیدو ذخیره شد.');}
 catch{cameraNotice('ذخیره عکس ممکن نشد.');}
 finally{e.target.value='';}
};
$('#cameraShutter').onclick=async()=>{
 if(!studio?.session||!cameraActive||cameraBusy)return;
 cameraBusy=true;$('#cameraShutter').disabled=true;$('#cameraNotice').hidden=true;
 try{
  // WebXR Raw Camera Access: compose the camera frame with actual rendered furniture.
  // No display capture, screen-share prompt or OS screenshot is used.
  const blob=await studio.capturePhoto(effectiveCameraRatio($('#cameraRatio').value,window.innerWidth,window.innerHeight));
  if(!cameraActive)return;
  await savePhoto(blob,CAMERA_PHOTO_KIND);
  await updateCameraLast();
  $('#cameraShutter').classList.add('flash');
  setTimeout(()=>$('#cameraShutter').classList.remove('flash'),240);
  cameraNotice('کپچر داخلی با مبلمان در گالری چیدو ذخیره شد.');
 }catch(error){
  cameraNotice(error?.message||'کپچر داخلی عکس انجام نشد.');
  $('#cameraFallback').hidden=false;
 }finally{
  $('#cameraMode').classList.remove('capturing');
  cameraBusy=false;$('#cameraShutter').disabled=false;
 }
};
$('#closeARError').onclick=()=>$('#arError').close();$('#basicAR').onclick=()=>startAR(true);$('#copyARError').onclick=async()=>{try{await navigator.clipboard.writeText(lastXRErrorReport);toast('گزارش کپی شد.');}catch{toast('از جزئیات خطا عکس بگیر.');}};
function closeChidoMenu(){
 chidoMenuOpen=false;
 $('#chidoMenuSheet').hidden=true;
 $('#chidoMenuBlank').dataset.confirm='';
 $('#chidoMenuBlank').textContent='＋ ایجاد صحنه خالی';
 $('#homeAR').setAttribute('aria-expanded','false');
}
function toggleChidoMenu(){
 if(!studio?.session)return;
 if(chidoMenuOpen){closeChidoMenu();return;}
 chidoMenuOpen=true;
 $('#chidoMenuSheet').hidden=false;
 $('#homeAR').setAttribute('aria-expanded','true');
 minimap.collapse();closeArSheet();$('#objectQuick').hidden=true;
}
$('#overlay').addEventListener('beforexrselect',event=>event.preventDefault());
$('#homeAR').onclick=toggleChidoMenu;
$('#chidoMenuContinue').onclick=closeChidoMenu;
$('#chidoMenuSaved').onclick=()=>{closeChidoMenu();if(!studio?.placed){toast('ابتدا کف را تثبیت کن.');return;}showArSheet(activeCloudSetId?'cloud-layouts':'saved');};
$('#chidoMenuSave').onclick=()=>{closeChidoMenu();if(cloudMembership?.role!=='company_admin'||!activeCloudSetId){toast('ذخیره رسمی فقط برای مدیر شرکت و داخل یک ست فعال است.');return;}if(!studio?.placed){toast('ابتدا کف را تثبیت کن.');return;}showArSheet('save');};
$('#chidoMenuBlank').onclick=()=>{
 if(!studio?.placed){toast('ابتدا کف را تثبیت کن.');return;}
 const button=$('#chidoMenuBlank');
 if(studio.items.length&&button.dataset.confirm!=='yes'){
  button.dataset.confirm='yes';button.textContent='تأیید پاک کردن چیدمان و شروع صحنه خالی';return;
 }
 layout='empty';activeSavedLayoutId=null;sceneMemory=null;clearDraft();clearRecovery(cloudMembership);studio.clear();
 closeChidoMenu();minimap.render();toast('صحنه خالی آماده است؛ مبلمان جدید اضافه کن.');
};
function finishChidoHomeExit(){
 recordRuntime('home-exit-check',studio?.renderer,'requested='+homeExitRequested+' session='+!!studio?.session);
 if(!homeExitRequested||studio?.session||studio?.renderer.xr.isPresenting)return;
 homeExitRequested=false;homeExitBusy=false;
 if(homeExitFallback!==null){clearTimeout(homeExitFallback);homeExitFallback=null;}
 $('#chidoMenuHome').disabled=false;
 $('#overlay').hidden=true;
 // Navigate only after the native XR event has returned and Studio has finished cleanup.
 history.replaceState(null,'',location.pathname+location.search+'#welcome');
 recordRuntime('home-navigation-start',studio?.renderer);
 void render({reuseCatalog:true}).then(()=>{
  recordRuntime('home-render-returned');
  requestAnimationFrame(()=>recordRuntime('home-animation-frame'));
  for(const delay of [1000,3000,8000])setTimeout(()=>recordRuntime('post-exit-alive',null,'delay='+delay+' visible='+document.visibilityState+' home='+!!document.querySelector('.welcome-screen')),delay);
 }).catch(error=>{
  recordRuntimeError('home-render-error',error);
  console.error('CHIDO home render failed',error);
  $('#app').innerHTML='<section class="page"><h1>چیدو</h1><p>نمای اصلی بارگذاری نشد.</p><button type="button" id="retryChidoHome">بازکردن صفحه اصلی</button></section>';
  $('#retryChidoHome').onclick=()=>render();
 });
}
$('#chidoMenuHome').onclick=async()=>{
 recordRuntime('menu-home-click',studio?.renderer,'busy='+homeExitBusy+' session='+!!studio?.session);
 if(homeExitBusy)return;
 if(!studio?.session){
  homeExitRequested=true;finishChidoHomeExit();return;
 }
 homeExitRequested=true;homeExitBusy=true;
 studio.exitToHome=true;
 try{persistDraft();sceneMemory=studio.exportState();}catch(error){console.warn('Snapshot on AR exit',error);}
 closeChidoMenu();
 const running=studio.session;
 $('#chidoMenuHome').disabled=true;
 try{recordRuntime('session-end-call',studio.renderer);await endXRSession(running);recordRuntime('session-end-resolved',studio?.renderer);}
 catch(error){
  recordRuntimeError('session-end-rejected',error);
  console.warn('XR exit request',error);
  if(studio?.session===running&&!studio.renderer.xr.isPresenting)studio.endSession();
  if(studio?.sessionEndTimer!=null)return;
  if(studio?.session===running){
   studio.exitToHome=false;
   homeExitBusy=false;
   $('#chidoMenuHome').disabled=false;
   toast('مرورگر هنوز پایان AR را تأیید نکرده؛ می‌توانی دوباره خروج را بزنی.');
   return;
  }
 }
 // Some WebXR implementations resolve end() before dispatching the end event.
 if(!homeExitRequested)return;
 if(studio?.session!==running){finishChidoHomeExit();return;}
 homeExitFallback=setTimeout(()=>{
  homeExitFallback=null;
  if(!homeExitRequested)return;
  if(studio?.session===running&&!studio.renderer.xr.isPresenting){
   try{studio.endSession();}catch(error){console.warn('WebXR end-event recovery',error);}
  }
  if(!studio?.session)finishChidoHomeExit();
  else if(studio.sessionEndTimer==null){
   if(studio)studio.exitToHome=false;
   homeExitBusy=false;
   $('#chidoMenuHome').disabled=false;
   toast('در انتظار پایان نشست مرورگر؛ پس از پایان، صفحه اصلی باز می‌شود.');
  }
 },1400);
};$('#resetAR').onclick=async()=>{try{$('#whiteFloorDialog').hidden=true;$('#abCalibrationSheet').hidden=true;$('#arArchitectureActions').hidden=true;studio?.architecture?.setMode(null);calibrationPrompted=false;await studio?.beginScan();$('#arSettings').open=false;$('#confirmFloor').hidden=false;$('#confirmFloor').disabled=true;$('#arEditControls').hidden=true;$('#arSettings').hidden=true;}catch(error){toast('اسکن دوباره اجرا نشد.');}};$('#confirmFloor').onclick=()=>{if(studio?.confirmFloor()){calibrationPrompted=true;$('#abCalibrationSheet').hidden=false;}};$('#rescanFloor').onclick=async()=>{try{$('#whiteFloorDialog').hidden=true;await studio?.beginScan();$('#arSettings').open=false;}catch(error){toast('اسکن دوباره راه‌اندازی نشد؛ از AR خارج شو و دوباره وارد شو.');}};
$('#whiteFloorYes').onclick=()=>{studio?.setWhiteFloor(true);$('#whiteFloorDialog').hidden=true;};
$('#whiteFloorNo').onclick=()=>{studio?.setWhiteFloor(false);$('#whiteFloorDialog').hidden=true;};
$('#rotateAR').onclick=()=>{if(studio?.selected)studio.rotate();};$('#deleteAR').onclick=()=>studio?.remove();$('#colorAR').onclick=()=>{if(studio?.selected){const current='#'+studio.selected.material.color.getHexString();studio.color(palette[(palette.indexOf(current)+1)%palette.length]);}};$('#addAR').onclick=()=>{if(studio.items.length>=16){toast('حد آزمون این نسخه ۱۶ قطعه است.');return;}const index=Number($('#arProduct').value);if(publishedCatalogIndexes().has(index))studio.add(index);};$('#closePhoto').onclick=()=>$('#photoHelp').close();
async function updateCount(){try{$('#galleryCount').textContent=fa((await photos()).length);}catch{$('#galleryCount').textContent='—';}}
async function showModes(){$('#modeSheet').showModal();await support();$('#modeSupport').textContent=supported?'AR در مرورگر شما در دسترس است؛ مجوز دوربین هنگام شروع پرسیده می‌شود.':'AR در این دستگاه در دسترس نیست؛ مدل ساده را امتحان کنید.';$('#chooseAR').disabled=!supported;}
$('#closeMode').onclick=()=>$('#modeSheet').close();$('#chooseSimple').onclick=()=>{$('#modeSheet').close();location.hash='studio';};$('#chooseAR').onclick=()=>{$('#modeSheet').close();location.hash='studio';toast('برای ورود به دوربین، «شروع AR» را بزنید.');};
window.addEventListener('hashchange',()=>{void render();window.scrollTo(0,0);});render();updateCount();
