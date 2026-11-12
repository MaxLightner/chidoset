// This small, local entry remains visible if the application module cannot load.
const host=document.querySelector('#app');
let loadingTimer;
function loadApplication(){
 host.innerHTML='<section class="page" data-app-loading role="status"><h1>چیدو</h1><p>در حال بازکردن اپلیکیشن…</p></section>';
 loadingTimer=setTimeout(()=>{
  const message=host.querySelector('[data-app-loading] p');
  if(message)message.textContent='بارگذاری طول کشیده؛ اتصال اینترنت را بررسی کن. هنوز در حال تلاش هستیم…';
 },10000);
 import('./app.js?v=0.16.17').catch(()=>{
  host.innerHTML='<section class="page" role="alert"><h1>چیدو باز نشد</h1><p>دریافت فایل‌های اپلیکیشن کامل نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.</p><button type="button" class="primary" data-retry-app>تلاش دوباره</button> <a href="website/">بازگشت به سایت</a></section>';
  host.querySelector('[data-retry-app]').onclick=()=>location.reload();
 }).finally(()=>clearTimeout(loadingTimer));
}
loadApplication();
