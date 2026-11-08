import {ApprovedLiveWatch} from './live-watch.js?v=0.16.1';
import {watchMarkup,renderWatchState} from './live-watch-ui.js?v=0.16.1';
import {Studio} from './scene.js?v=0.16.1';
import {supabase,getMembership,findActiveLiveSession,createLiveSession,getLiveShareLink,withLiveTimeout} from './chido-cloud.js?v=0.16.1';
const $=selector=>document.querySelector(selector);
let studio=null,active=null,channel=null,link='',lastScene='',lastCamera=null,checking=false,stopping=false,watch=null,member=null,wantWatch=false;
const setStatus=value=>{$('#watchStatus').textContent=value;};

function fitHostAspect(state){
 const aspect=Number(state?.aspect);
 if(!Number.isFinite(aspect)||aspect<.4||aspect>3)return;
 const viewport=$('#viewport'),stage=viewport.parentElement;
 const width=stage.clientWidth,height=stage.clientHeight;
 if(width/Math.max(1,height)>aspect){viewport.style.width=(height*aspect)+'px';viewport.style.height=height+'px';}
 else{viewport.style.width=width+'px';viewport.style.height=(width/aspect)+'px';}
 viewport.style.inset='auto';viewport.style.maxWidth='100%';viewport.style.maxHeight='100%';
 viewport.style.left='50%';viewport.style.top='50%';viewport.style.transform='translate(-50%,-50%)';
}
async function showQr(url){
 link=url;$('#shareQr').textContent='در حال ساخت QR…';
 try{
  const QRCode=await import('https://esm.sh/qrcode@1.5.4');
  if(link!==url)return;
  $('#shareQr').innerHTML=await QRCode.toString(url,{type:'svg',width:240,margin:1,errorCorrectionLevel:'M'});
  $('#shareStatus').textContent='QR آمادهٔ اشتراک‌گذاری است.';
 }catch(error){$('#shareQr').textContent='تولید QR در دسترس نیست؛ لینک را کپی کن.';console.warn(error);}
}
async function connect(session){
 if(active?.id!==session.id){
  active=session;link='';lastCamera=null;
  void (async()=>{const url=session.url||await getLiveShareLink(session.id);if(active?.id===session.id)await showQr(url);})().catch(error=>{$('#shareStatus').textContent=error.message||'دریافت QR انجام نشد.';});
 }
 if(wantWatch&&(watch.sessionId!==session.id||!watch.request))await watch.start(session.id,member.user.id);
}
async function refresh(){
 if(checking||stopping||!studio)return;
 checking=true;
 try{
  let session=await findActiveLiveSession(member.user.id);
  if(!session){
   setStatus('در حال آماده‌سازی نشست جدید…');
   const initialCamera={...studio.cameraSnapshot(),timestamp:0,waiting:true};
   session=await createLiveSession({sceneState:{...studio.exportLiveState(),items:[],cloudProducts:[],architecture:{floor:[],walls:[],windows:[]}},cameraState:initialCamera,membership:member});
  }
  await connect(session);

 }catch(error){console.error('Seller live monitor',error);$('#shareStatus').textContent=error.message||'اتصال به نشست زنده برقرار نشد.';setStatus('اتصال ناموفق؛ تلاش مجدد تا چند لحظه دیگر');if(wantWatch&&!watch.request)watch.emit('error','آماده‌سازی نشست نمایش انجام نشد','ارتباط با سامانه برقرار نشد؛ تلاش دوباره را بزن.');}
 finally{checking=false;}
}
const watchStage=$('.watch-stage'),watchParent=watchStage.parentNode,watchNext=watchStage.nextSibling;
$('#showHere').onclick=async()=>{wantWatch=true;const dialog=$('#watchDialog');dialog.append(watchStage);if(!dialog.open)dialog.showModal();studio?.resize();await refresh();if(active&&watch&&['ended','rejected'].includes(watch.request?.status))await watch.retry();};
$('#closeWatch').onclick=()=>$('#watchDialog').close();
$('#watchDialog').addEventListener('close',()=>{wantWatch=false;watch?.stop();watchParent.insertBefore(watchStage,watchNext);fitHostAspect(lastCamera);studio?.resize();});
$('#renewLink').onclick=async()=>{await refresh();try{if(active){const url=link||await getLiveShareLink(active.id);await showQr(url);}}catch(error){$('#shareStatus').textContent=error.message||'دریافت لینک انجام نشد.';}};
$('#copyLink').onclick=async()=>{if(!link){$('#shareStatus').textContent='لینک هنوز آماده نیست.';return;}try{await navigator.clipboard.writeText(link);$('#shareStatus').textContent='لینک کپی شد.';}catch{$('#shareStatus').textContent='کپی خودکار ممکن نیست.';}};
$('#signOut').onclick=async()=>{stopping=true;await watch?.destroy();if(channel)await supabase.removeChannel(channel);studio?.destroy();await supabase.auth.signOut();localStorage.removeItem('chido-site-role');sessionStorage.removeItem('chido-site-role');location.replace('login.html?retry=1');};
window.addEventListener('pagehide',event=>{if(event.persisted)return;stopping=true;watch?.destroy();if(channel)void supabase.removeChannel(channel);studio?.destroy();});
window.addEventListener('pageshow',event=>{if(event.persisted)void refresh();});

try{
 member=await getMembership();
 if(member?.role!=='branch')location.replace('login.html?retry=1');
 else{
  $('#operatorName').textContent=(member.display_name||'عامل فروش')+' · '+(member.company?.name||'مجموعه');
  $('#viewerShell').hidden=false;$('#authStatus').textContent='';
  studio=new Studio($('#viewport'),()=>{});studio.events?.abort();studio.setPhotoMode(true);
  $('#waitingOverlay').innerHTML=watchMarkup;
  watch=new ApprovedLiveWatch(studio,{onState:state=>{renderWatchState($('#waitingOverlay'),state);setStatus(state.label);},onCamera:state=>{lastCamera=state;fitHostAspect(state);}});
  $('#waitingOverlay [data-watch-retry]').onclick=async()=>{if(watch.request)await watch.retry();else{wantWatch=true;await refresh();}};
  $('#showHere').disabled=false;
  await refresh();setInterval(()=>void refresh(),3000);
 }
}catch(error){$('#authStatus').textContent='اتصال به پنل عامل فروش انجام نشد. صفحه را دوباره بارگذاری کن.';console.error(error);}
