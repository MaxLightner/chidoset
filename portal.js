import {supabase,activateCompanyAdmin,signIn,signOut,getMembership,getCompanyDashboard,requestCompanyAccess,logActivity} from './chido-cloud.js?v=0.16.10';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');

async function showDashboard(membership){
  if(!membership||membership.role!=='company_admin')throw new Error('این حساب مدیر شرکت نیست.');
  const data=await getCompanyDashboard(membership);
  $('#companyActivationForm').hidden=true;
  $('#companyLoginForm').hidden=true;
  $('#companyDashboard').hidden=false;
  $('#dashboardCompanyName').textContent=membership.company?.name||'شرکت';
  $('#dashboardCompanyStatus').textContent='حساب مدیر شرکت · وضعیت '+(membership.company?.status==='active'?'فعال':'در انتظار بررسی');
  const layoutCount=data.sets.reduce((sum,set)=>sum+(set.layouts?.length||0),0);
  const colorwayCount=data.sets.reduce((sum,set)=>sum+(set.colorways?.length||0),0);
  $('#dashboardKpis').innerHTML=[
    ['شعبه‌ها',data.branches.length],
    ['ست‌های رسمی',data.sets.length],
    ['چیدمان‌ها',layoutCount],
    ['رنگ‌بندی‌ها',colorwayCount]
  ].map(([label,value])=>'<div class="portal-kpi"><strong>'+fa(value)+'</strong><small>'+label+'</small></div>').join('');
  $('#dashboardBranches').innerHTML=data.branches.map(branch=>'<div class="portal-preview-note" style="margin:7px 0"><strong>'+esc(branch.name)+'</strong><br><small>'+esc(branch.slug)+' · '+esc(branch.status)+'</small></div>').join('')||'<p>هنوز شعبه‌ای ثبت نشده است.</p>';
  $('#dashboardSets').innerHTML=data.sets.map(set=>'<div class="portal-preview-note" style="margin:7px 0"><strong>'+esc(set.name)+'</strong><br><small>'+fa(set.set_products?.length||0)+' محصول · '+fa(set.layouts?.length||0)+' چیدمان · '+fa(set.colorways?.length||0)+' رنگ‌بندی</small></div>').join('')||'<p>هنوز ستی برای شرکت منتشر نشده است.</p>';
  $('#dashboardActivity').innerHTML=data.activity.map(event=>'<div class="portal-preview-note" style="margin:7px 0"><strong>'+esc(event.event_type)+'</strong><br><small>'+new Date(event.created_at).toLocaleString('fa-IR')+'</small></div>').join('')||'<p>هنوز فعالیتی ثبت نشده است.</p>';
}

async function restoreSession(){
  try{
    const membership=await getMembership();
    if(membership?.role==='company_admin')await showDashboard(membership);
  }catch(error){console.warn('Company dashboard restore failed',error);}
}

$('#companyActivationForm').onsubmit=async event=>{
  event.preventDefault();
  const message=$('#activationMessage'),button=event.submitter||$('#companyActivationForm button[type=submit]');
  message.textContent='';button.disabled=true;button.textContent='در حال ساخت حساب…';
  try{
    await activateCompanyAdmin($('#companyInviteCode').value,$('#companyAdminEmail').value,$('#companyAdminPassword').value);
    const membership=await signIn($('#companyAdminEmail').value,$('#companyAdminPassword').value);
    await logActivity(membership,'company_admin_web_login',{source:'invite'});
    await showDashboard(membership);
    message.textContent='حساب مدیر ساخته شد و وارد فضای شرکت شدی.';
    $('#companyActivationForm').hidden=true;
    $('#companyLoginForm').hidden=true;
  }catch(error){message.textContent=error.message||'فعال‌سازی انجام نشد.';}
  finally{button.disabled=false;button.textContent='ساخت حساب مدیر';}
};

$('#companyLoginForm').onsubmit=async event=>{
  event.preventDefault();
  const message=$('#loginMessage'),button=event.submitter||$('#companyLoginForm button[type=submit]');
  message.textContent='';button.disabled=true;
  try{
    const membership=await signIn($('#loginEmail').value,$('#loginPassword').value);
    if(!membership||membership.role!=='company_admin')throw new Error('این حساب، مدیر شرکت نیست.');
    await logActivity(membership,'company_admin_web_login',{source:'login'});
    await showDashboard(membership);
    $('#companyActivationForm').hidden=true;
    $('#companyLoginForm').hidden=true;
  }catch(error){message.textContent=error.message||'ورود انجام نشد.';}
  finally{button.disabled=false;}
};

$('#companySignOut').onclick=async()=>{
  try{await signOut();$('#companyDashboard').hidden=true;$('#companyActivationForm').hidden=false;$('#companyLoginForm').hidden=false;}catch(error){alert(error.message);}
};

$('#accessRequestForm').onsubmit=async event=>{
  event.preventDefault();
  const status=$('#requestStatus'),button=event.submitter||$('#accessRequestForm button[type=submit]');
  status.textContent='';button.disabled=true;
  try{
    await requestCompanyAccess({
      contact_name:$('#requestContact').value,
      company_name:$('#requestCompany').value,
      email:$('#requestEmail').value,
      phone:$('#requestPhone').value,
      message:$('#requestMessage').value
    });
    status.textContent='درخواست ثبت شد. برای هماهنگی با شما تماس گرفته می‌شود.';
    $('#accessRequestForm').reset();
  }catch(error){status.textContent=error.message||'ارسال درخواست انجام نشد.';}
  finally{button.disabled=false;}
};

restoreSession();
