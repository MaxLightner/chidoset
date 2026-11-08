import {Studio} from './scene.js?v=0.14.0';
import {supabase,getMembership,findActiveLiveSession,createLiveSession,getLiveShareLink} from './chido-cloud.js?v=0.12.4';
const $=selector=>document.querySelector(selector);
let studio=null,active=null,channel=null,link='',lastScene='',lastCamera=null,checking=false,stopping=false;
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
function applyScene(state){
 if(!studio||!state)return;
 const serialized=JSON.stringify(state);
 if(serialized===lastScene)return;
 studio.clear();studio.restoreLiveState(state);studio.select(null);studio.setPhotoMode(true);
 lastScene=serialized;
}
function applyCamera(state){
 if(!studio||!state)return;
 if(lastCamera&&Number(state.timestamp)<Number(lastCamera.timestamp))return;
 lastCamera=state;
 if(Number(state.timestamp)>0){
  fitHostAspect(state);studio.applyExternalCameraState(state);
  $('#waitingOverlay').hidden=true;setStatus('متصل به تصویر سه‌بعدی تبلت');
 }else{$('#waitingOverlay').hidden=false;setStatus('منتظر ورود تبلت به AR و تثبیت کف');}
}
async function readLatest(sessionId){
 const [scene,camera]=await Promise.all([
  supabase.from('live_session_scenes').select('scene_state').eq('session_id',sessionId).single(),
  supabase.from('live_session_cameras').select('camera_state').eq('session_id',sessionId).single()
 ]);
 if(scene.error)throw scene.error;if(camera.error)throw camera.error;
 applyScene(scene.data.scene_state);applyCamera(camera.data.camera_state);
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
 if(active?.id===session.id)return;
 if(channel){await supabase.removeChannel(channel);channel=null;}
 active=session;lastScene='';lastCamera=null;
 $('#waitingOverlay').hidden=false;
 setStatus('در حال دریافت نشست زنده…');
 const guestUrl=session.url||await getLiveShareLink(session.id);
 await showQr(guestUrl);
 await readLatest(session.id);
 channel=supabase.channel('chido-seller-monitor-'+session.id)
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_session_scenes',filter:'session_id=eq.'+session.id},payload=>applyScene(payload.new?.scene_state))
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_session_cameras',filter:'session_id=eq.'+session.id},payload=>applyCamera(payload.new?.camera_state))
  .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setStatus('اتصال قطع شده؛ در حال تلاش مجدد…');});
}
async function refresh(){
 if(checking||stopping||!studio)return;
 checking=true;
 try{
  let session=await findActiveLiveSession();
  if(!session){
   setStatus('در حال آماده‌سازی نشست جدید…');
   const initialCamera={...studio.cameraSnapshot(),timestamp:0,waiting:true};
   session=await createLiveSession({sceneState:studio.exportLiveState(),cameraState:initialCamera});
  }
  await connect(session);
  await readLatest(session.id);
  $('#shareStatus').textContent=link?'QR آمادهٔ اشتراک‌گذاری است.':'';
 }catch(error){console.error('Seller live monitor',error);$('#shareStatus').textContent=error.message||'اتصال به نشست زنده برقرار نشد.';setStatus('اتصال ناموفق؛ تلاش مجدد تا چند لحظه دیگر');}
 finally{checking=false;}
}
$('#showHere').onclick=()=>{$('#watchPanel').classList.add('focused');$('#watchPanel').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('#watchPanel').classList.remove('focused'),2000);};
$('#renewLink').onclick=()=>void refresh();
$('#copyLink').onclick=async()=>{if(!link){$('#shareStatus').textContent='لینک هنوز آماده نیست.';return;}try{await navigator.clipboard.writeText(link);$('#shareStatus').textContent='لینک کپی شد.';}catch{$('#shareStatus').textContent='کپی خودکار ممکن نیست.';}};
$('#signOut').onclick=async()=>{stopping=true;if(channel)await supabase.removeChannel(channel);studio?.destroy();await supabase.auth.signOut();localStorage.removeItem('chido-site-role');sessionStorage.removeItem('chido-site-role');location.replace('login.html?retry=1');};
window.addEventListener('pagehide',()=>{stopping=true;if(channel)void supabase.removeChannel(channel);studio?.destroy();});

try{
 const member=await getMembership();
 if(member?.role!=='branch')location.replace('login.html?retry=1');
 else{
  $('#operatorName').textContent=member.display_name||'عامل فروش';
  $('#viewerShell').hidden=false;$('#authStatus').textContent='';
  studio=new Studio($('#viewport'),()=>{});studio.events?.abort();studio.setPhotoMode(true);
  await refresh();setInterval(()=>void refresh(),3000);
 }
}catch(error){$('#authStatus').textContent='اتصال به پنل عامل فروش انجام نشد. صفحه را دوباره بارگذاری کن.';console.error(error);}
