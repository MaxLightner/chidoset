import {Studio} from './scene.js?v=0.16.1';
import {supabase,authenticateGuest,guestStatus} from './chido-cloud.js?v=0.16.1';
import {ApprovedLiveWatch} from './live-watch.js?v=0.16.1';
import {watchMarkup,renderWatchState} from './live-watch-ui.js?v=0.16.1';
const $=selector=>document.querySelector(selector),token=new URLSearchParams(location.search).get('token');
let studio=null,watch=null,expiresAt=0,checking=false,ended=false,timer=null,lastCamera=null;
$('#guestMessage').innerHTML='<div>'+watchMarkup+'</div>';
function message(title,text){const root=$('#guestMessage');root.hidden=false;root.dataset.phase='error';root.querySelector('[data-watch-title]').textContent=title;root.querySelector('[data-watch-message]').textContent=text;root.querySelector('ol').hidden=true;root.querySelector('progress').hidden=true;root.querySelector('[data-watch-retry]').hidden=true;}
function connection(label,connected=false){const i=document.createElement('i');$('#guestState').replaceChildren(i,document.createTextNode(' '+label));$('#guestState').classList.toggle('connected',connected);}
function fit(state){const aspect=Number(state?.aspect);if(!Number.isFinite(aspect)||aspect<.4||aspect>3)return;const viewport=$('#viewport'),stage=$('.guest-stage'),width=stage.clientWidth,height=stage.clientHeight;if(width/Math.max(1,height)>aspect){viewport.style.width=height*aspect+'px';viewport.style.height=height+'px';}else{viewport.style.width=width+'px';viewport.style.height=width/aspect+'px';}viewport.style.maxWidth=viewport.style.maxHeight='100%';}
async function finish(){if(ended)return;ended=true;clearInterval(timer);await watch?.destroy();studio?.destroy();studio=null;await supabase.auth.signOut({scope:'local'});message('نمایش به پایان رسید','فروشنده نمایش را پایان داده یا لینک منقضی شده است.');connection('پایان نمایش');}
async function refresh(){if(checking||ended)return;checking=true;try{if(Date.now()>=expiresAt||!await guestStatus(token)){await finish();return;}void watch?.refresh();}catch{connection('در حال تلاش برای اتصال مجدد');}finally{checking=false;}}
async function start(){
 if(!token||token.length<40){message('لینک نمایش معتبر نیست','از فروشنده QR یا لینک تازه بگیر.');connection('لینک نامعتبر');return;}
 try{
  const auth=await authenticateGuest(token);if(!auth.user?.id)throw Error('دسترسی مشاهده آماده نشد.');expiresAt=Date.parse(auth.expiresAt);
  studio=new Studio($('#viewport'),()=>{});studio.events?.abort();
  watch=new ApprovedLiveWatch(studio,{onState:state=>{const root=$('#guestMessage');root.querySelector('ol').hidden=false;renderWatchState(root,state);connection(state.label,['connected','scanning'].includes(state.phase));},onCamera:state=>{lastCamera=state;fit(state);}});
  $('#guestMessage [data-watch-retry]').onclick=()=>void watch.retry();
  await watch.start(auth.sessionId,auth.user.id);timer=setInterval(()=>void refresh(),4000);
 }catch(error){console.error(error);message('اتصال نمایش آماده نشد',error.message||'دسترسی نمایش معتبر نیست.');connection('اتصال ناموفق');}
}
window.addEventListener('online',()=>void refresh());
window.addEventListener('resize',()=>{fit(lastCamera);studio?.resize();});
window.addEventListener('pagehide',event=>{if(event.persisted)return;clearInterval(timer);watch?.destroy();studio?.destroy();});
window.addEventListener('pageshow',event=>{if(event.persisted)void refresh();});
void start();
