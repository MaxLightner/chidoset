import {accountLogin} from './account-login.js';
import {rememberAccount,accountName} from './auth-storage.js';
import {supabase,getMembership} from './chido-cloud.js?v=0.12.2';
import {centralAuth} from './central-service.js?v=0.12.2';
let submitting=false;
const $=s=>document.querySelector(s),form=$('#siteLoginForm');
$('#siteUsername').value=accountName('chido-site')||accountName('chido-auth-v1')||accountName('chido-central-auth-v1');
$('#siteRemember').checked=localStorage.getItem('chido-site-remember')!=='no';
form.onsubmit=async event=>{
 event.preventDefault();submitting=true;const button=event.submitter,message=$('#siteLoginMessage');button.disabled=true;message.textContent='در حال ورود…';
 try{
  const username=$('#siteUsername').value,result=await accountLogin(username,$('#sitePassword').value);
  if(!['central','company_admin','branch'].includes(result.role))throw Error('این حساب مجوز ورود به سایت را ندارد.');
  const remember=$('#siteRemember').checked,namespace=result.role==='central'?'chido-central-auth-v1':'chido-auth-v1';
  rememberAccount(namespace,remember,username);rememberAccount('chido-site',remember,username);
  const client=result.role==='central'?centralAuth:supabase;
  const {error}=await client.auth.setSession(result.session);if(error)throw error;
  localStorage.removeItem('chido-site-role');sessionStorage.removeItem('chido-site-role');
  (remember?localStorage:sessionStorage).setItem('chido-site-role',result.role);
  location.replace(result.role==='central'?'central.html':result.role==='branch'?'live-viewer.html':'company.html');
 }catch(error){message.textContent=error.message||'ورود انجام نشد.';}finally{button.disabled=false;submitting=false;}
};

async function resume(){
 if(new URLSearchParams(location.search).has('retry'))return;
 const role=sessionStorage.getItem('chido-site-role')||localStorage.getItem('chido-site-role');
 if(role==='central'){
  const {data:{session}}=await centralAuth.auth.getSession();
  if(session&&!submitting)location.replace('central.html');
 }else{
  const member=await getMembership();
  if(member&&!submitting){
   if(member.role==='company_admin')location.replace('company.html');
   if(member.role==='branch')location.replace('live-viewer.html');
  }
 }
}
void resume().catch(()=>{});
