import {supabase,getMembership} from './chido-cloud.js?v=0.12.2';
const $=selector=>document.querySelector(selector);
let stream=null,scanning=false,detector=null;
const status=message=>{$('#scanStatus').textContent=message;};

function parseGuestLink(value){
 const input=String(value||'').trim();
 const url=new URL(input,location.origin+'/');
 if(url.origin!==location.origin||!url.pathname.endsWith('/guest.html'))throw Error('لینک باید مربوط به نمایش مهمان چیدو باشد.');
 const token=url.searchParams.get('token');
 if(!token||token.length<40||token.length>512)throw Error('کد نمایش معتبر نیست.');
 return new URL('guest.html?token='+encodeURIComponent(token),location.href).href;
}
function setTab(mode){
 const watch=mode==='watch';
 $('#scanPanel').hidden=watch;$('#watchPanel').hidden=!watch;
 $('#scanTab').setAttribute('aria-selected',String(!watch));
 $('#watchTab').setAttribute('aria-selected',String(watch));
 if(watch)stopCamera();
}
function openGuest(value){
 try{
  const url=parseGuestLink(value);
  $('#guestFrame').src=url;$('#guestFrame').hidden=false;$('#emptyWatch').hidden=true;
  $('#watchStatus').textContent='در حال اتصال به نمایش فروشنده…';
  setTab('watch');
 }catch(error){status(error.message);}
}
function stopCamera(){
 scanning=false;
 if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
 $('#scanVideo').srcObject=null;$('#scanVideo').classList.remove('active');
 $('#cameraHint').hidden=false;$('#stopScan').hidden=true;$('#startScan').hidden=false;
}
async function startCamera(){
 if(!('BarcodeDetector' in window)){status('اسکن زنده در این مرورگر پشتیبانی نمی‌شود؛ لینک QR را در کادر وارد کن.');return;}
 try{
  const formats=await BarcodeDetector.getSupportedFormats();
  if(!formats.includes('qr_code'))throw Error('تشخیص QR در این مرورگر پشتیبانی نمی‌شود.');
  detector=new BarcodeDetector({formats:['qr_code']});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
  const video=$('#scanVideo');video.srcObject=stream;await video.play();video.classList.add('active');
  $('#cameraHint').hidden=true;$('#stopScan').hidden=false;$('#startScan').hidden=true;
  status('دوربین روشن است؛ QR نمایش را روبه‌روی دوربین نگه دار.');
  scanning=true;
  while(scanning){
   try{
    const codes=await detector.detect(video);
    for(const code of codes){
     try{parseGuestLink(code.rawValue);openGuest(code.rawValue);return;}catch{/* Ignore unrelated QR codes. */}
    }
   }catch{/* Camera frame may not be ready yet. */}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
 }catch(error){stopCamera();status(error.message||'امکان استفاده از دوربین وجود ندارد. لینک نمایش را وارد کن.');}
}
$('#scanTab').onclick=()=>setTab('scan');
$('#watchTab').onclick=()=>setTab('watch');
$('#startScan').onclick=startCamera;
$('#stopScan').onclick=()=>{stopCamera();status('اسکن متوقف شد.');};
$('#scanAgain').onclick=()=>setTab('scan');
$('#closeWatch').onclick=()=>{const frame=$('#guestFrame');frame.src='about:blank';frame.hidden=true;$('#emptyWatch').hidden=false;$('#watchStatus').textContent='نمایش بسته شد';};
$('#guestFrame').onload=()=>{$('#watchStatus').textContent='صفحه نمایش مهمان بارگذاری شد';};
$('#linkForm').onsubmit=event=>{event.preventDefault();openGuest($('#guestLink').value);};
$('#signOut').onclick=async()=>{stopCamera();await supabase.auth.signOut();localStorage.removeItem('chido-site-role');sessionStorage.removeItem('chido-site-role');location.replace('login.html?retry=1');};
window.addEventListener('pagehide',stopCamera);

try{
 const member=await getMembership();
 if(member?.role!=='branch')location.replace('login.html?retry=1');
 else{$('#operatorName').textContent=member.display_name||'عامل فروش';$('#viewerShell').hidden=false;$('#authStatus').textContent='';}
}catch(error){$('#authStatus').textContent='تأیید دسترسی انجام نشد. صفحه را دوباره بارگذاری کن.';console.error(error);}
