import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {validateWorkspace,WEB_ROLES} from './workspace-domain.mjs';
const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
const sandboxBase='https://sandbox.zarinpal.com';
// Sandbox permits an arbitrary UUID merchant id. No production merchant credentials are used.
const sandboxMerchant=Deno.env.get('CHIDO_SANDBOX_MERCHANT_ID')||'cb3b20d2-1cec-4008-87c8-f90d4d087f68';
const sandboxPlans:Record<string,number>={quarter:50_000_000,half:100_000_000,annual:200_000_000,lifetime:500_000_000};
async function sandboxRequest(endpoint:string,body:any){
 const result=await fetch(sandboxBase+endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!result.ok)throw Error('sandbox HTTP '+result.status);
 return await result.json();
}
async function sandboxStart(req:Request,m:any){
 const input=await req.json();const plan=String(input?.plan||'');
 if(!Object.hasOwn(sandboxPlans,plan))return response({error:'پلن تستی معتبر نیست.'},400);
 const amount=sandboxPlans[plan],id=crypto.randomUUID();
 checked(await admin.from('chido_sandbox_payment_attempts').insert({id,company_id:m.company_id,user_id:m.user_id,plan_code:plan,amount_rials:amount}));
 try{
  const result=await sandboxRequest('/pg/v4/payment/request.json',{merchant_id:sandboxMerchant,amount,currency:'IRR',description:'CHIDO sandbox '+plan,callback_url:'https://chidoset.ir/company.html?payment_attempt='+id,metadata:{order_id:id}});
  const authority=String(result?.data?.authority||'');
  if(Number(result?.data?.code)!==100||!/^S[A-Za-z0-9_-]{10,90}$/.test(authority))throw Error('invalid sandbox authority');
  checked(await admin.from('chido_sandbox_payment_attempts').update({authority,status:'redirected'}).eq('id',id));
  return response({sandbox:true,attempt_id:id,redirect_url:sandboxBase+'/pg/StartPay/'+encodeURIComponent(authority)});
 }catch(e){await admin.from('chido_sandbox_payment_attempts').update({status:'failed'}).eq('id',id);console.error('chido-sandbox-start',String(e).slice(0,120));return response({error:'سرویس آزمایشی زرین‌پال پاسخ نداد. کمی بعد دوباره امتحان کن.'},503);}
}
async function sandboxVerify(req:Request,m:any){
 const input=await req.json(),attemptId=String(input?.attempt_id||''),authority=String(input?.authority||''),status=String(input?.status||'');
 if(!/^[0-9a-f-]{36}$/i.test(attemptId)||!/^S[A-Za-z0-9_-]{10,90}$/.test(authority)||!['OK','NOK'].includes(status))return response({error:'اطلاعات بازگشت پرداخت معتبر نیست.'},400);
 const attempt=checked(await admin.from('chido_sandbox_payment_attempts').select('*').eq('id',attemptId).eq('company_id',m.company_id).eq('user_id',m.user_id).maybeSingle());
 if(!attempt||attempt.authority!==authority)return response({error:'تراکنش آزمایشی به این حساب تعلق ندارد.'},403);
 if(attempt.status==='verified')return response({sandbox:true,verified:true,ref_id:attempt.ref_id,plan:attempt.plan_code});
 if(attempt.status!=='redirected')return response({error:'این تراکنش آزمایشی قابل بررسی نیست.'},409);
 if(status==='NOK'){checked(await admin.from('chido_sandbox_payment_attempts').update({status:'cancelled',verified_at:new Date().toISOString()}).eq('id',attemptId));return response({sandbox:true,verified:false,cancelled:true});}
 try{
  const result=await sandboxRequest('/pg/v4/payment/verify.json',{merchant_id:sandboxMerchant,amount:attempt.amount_rials,authority});
  const verified=[100,101].includes(Number(result?.data?.code)),ref=verified?String(result.data.ref_id||''):null;
  checked(await admin.from('chido_sandbox_payment_attempts').update({status:verified?'verified':'failed',ref_id:ref,verified_at:new Date().toISOString()}).eq('id',attemptId));
  return response({sandbox:true,verified,ref_id:ref,plan:attempt.plan_code});
 }catch(e){console.error('chido-sandbox-verify',String(e).slice(0,120));return response({error:'استعلام از سرویس آزمایشی زرین‌پال انجام نشد. دوباره امتحان کن.'},503);}
}
async function capacity(companyId:string){
 const subscriptions=checked(await admin.from('subscriptions').select('plan_code,status,starts_at,ends_at').eq('company_id',companyId).order('starts_at',{ascending:false}).limit(20));
 const current=subscriptions.find((s:any)=>['trial','active'].includes(s.status)&&Date.parse(s.ends_at)>Date.now());
 const code=String(current?.plan_code||'trial').toLowerCase();
 const agents=/annual|year|yearly|lifetime|10year|12m|1y/.test(code)?20:/half|6month|6month|6m|semi/.test(code)?10:3;
 return {max_agents:agents,max_branches:agents===3?5:agents};
}
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
async function member(req:Request){
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
 if(!token)throw {status:401,message:'ابتدا وارد حساب مجموعه شو.'};
 const {data,error}=await admin.auth.getUser(token);if(error||!data.user)throw {status:401,message:'نشست ورود معتبر نیست. دوباره وارد شو.'};
 const m=checked(await admin.from('company_memberships').select('*').eq('user_id',data.user.id).eq('status','active').in('role',WEB_ROLES).maybeSingle());
 if(!m)throw {status:403,message:'این حساب به فضای وب مجموعه دسترسی ندارد. از حساب مدیر مجموعه استفاده کن.'};
 return {...m,user:data.user};
}
async function snapshot(m:any){
 const company=checked(await admin.from('companies').select('*').eq('id',m.company_id).single());
 const result:any={company,membership:{id:m.id,company_id:m.company_id,user_id:m.user_id,role:m.role,display_name:m.display_name,email:m.user.email},enabled:checked(await admin.rpc('chido_activation_company_enabled',{p_company_id:m.company_id})),limits:await capacity(m.company_id)};
 const tables=['branches','branch_devices','company_memberships','activation_codes','subscriptions','sets','company_media','company_requests','support_tickets','company_messages','showroom_accounts','company_notifications','activity_events'];
 const fields:any={activation_codes:'id,company_id,branch_id,role,expires_at,redeemed_at,revoked_at,created_at'};
 await Promise.all(tables.map(async table=>{
  if((table==='company_memberships'||table==='activation_codes'||table==='branch_devices')&&m.role!=='company_admin'){result[table]=[];return;}
  let query:any=admin.from(table).select(table==='sets'?'id,company_id,name,description,status,set_products(product_id,sort_order,products(id,catalog_index,name,thumbnail_path,active)),layouts(id,name,room,status,updated_at),colorways(id,name,status,updated_at)':fields[table]||'*');
  if(table==='branch_devices'){const branches=checked(await admin.from('branches').select('id').eq('company_id',m.company_id));query=query.in('branch_id',branches.map((b:any)=>b.id));}
  else query=query.eq('company_id',m.company_id);
  if(table==='activity_events')query=query.order('created_at',{ascending:false}).limit(60);else query=query.limit(1000);
  result[table]=checked(await query);
 }));
 const media=result.company_media||[];if(media.length){const signed=checked(await admin.storage.from('company-media').createSignedUrls(media.map((p:any)=>p.object_path),900));for(const p of media)p.url=signed.find((s:any)=>s.path===p.object_path)?.signedUrl||'';}
 const notifications=result.company_notifications||[];result.notification_reads=notifications.length?checked(await admin.from('company_notification_reads').select('notification_id').eq('user_id',m.user_id).in('notification_id',notifications.map((n:any)=>n.id))):[];
 return result;
}
async function showroomLogin(req:Request){
 const b=await req.json();const name=typeof b.username==='string'?b.username.trim().toLowerCase():'';
 if(!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(name)||typeof b.password!=='string'||b.password.length>128)return response({error:'نام کاربری یا رمز درست نیست.'},401);
 const account=checked(await admin.from('showroom_accounts').select('*').eq('login_name',name).maybeSingle());
 if(!account)return response({error:'نام کاربری یا رمز درست نیست.'},401);
 const limit=checked(await admin.from('showroom_login_limits').select('*').eq('login_name',name).maybeSingle());
 if(limit&&limit.failures>=8&&Date.parse(limit.window_started_at)>Date.now()-900000)return response({error:'تلاش‌های ناموفق زیاد بوده است. ۱۵ دقیقه بعد دوباره تلاش کن.'},429);
 const auth=await admin.auth.admin.getUserById(account.user_id);const email=auth.data.user?.email;
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=email?await client.auth.signInWithPassword({email,password:b.password}):null;
 if(!signed?.data.session){await admin.rpc('chido_showroom_login_failed',{p_name:name});return response({error:'نام کاربری یا رمز درست نیست.'},401);}
 const member=checked(await admin.from('company_memberships').select('status,branch_id').eq('user_id',account.user_id).eq('company_id',account.company_id).maybeSingle());
 const branch=checked(await admin.from('branches').select('status').eq('id',account.branch_id).eq('company_id',account.company_id).maybeSingle());
 const device=checked(await admin.from('branch_devices').select('revoked_at').eq('user_id',account.user_id).maybeSingle());
 const enabled=checked(await admin.rpc('chido_activation_company_enabled',{p_company_id:account.company_id}));
 if(account.status!=='active'||member?.status!=='active'||member.branch_id!==account.branch_id||branch?.status!=='active'||!device||device.revoked_at||!enabled){await client.auth.signOut();return response({error:'دسترسی این کاربر، نمایشگاه یا اشتراک فعال نیست. با مدیر مجموعه هماهنگ کن.'},403);}
 await admin.from('showroom_login_limits').delete().eq('login_name',name);
 await admin.from('showroom_accounts').update({last_login_at:new Date().toISOString()}).eq('id',account.id);
 await admin.from('branch_devices').update({last_seen_at:new Date().toISOString()}).eq('user_id',account.user_id);
 await admin.from('activity_events').insert({company_id:account.company_id,branch_id:account.branch_id,user_id:account.user_id,event_type:'showroom_login',payload:{}});
 return response({session:{access_token:signed.data.session.access_token,refresh_token:signed.data.session.refresh_token}});
}
async function write(req:Request,m:any){
 const body=await req.json();let data:any;try{data=validateWorkspace(body.action,body.data);}catch(e){return response({error:e.message},400);}
 if(body.action==='request.review'){
  const request=checked(await admin.from('company_requests').select('id,kind,status,set_id').eq('id',data.id).eq('company_id',m.company_id).maybeSingle());
  if(!request||request.kind!=='model'||request.status!=='completed')return response({error:'مدل هنوز برای بررسی آماده نیست.'},409);
  if(data.decision==='approve'){
   const set=request.set_id?checked(await admin.from('sets').select('id,status,set_products(product_id)').eq('id',request.set_id).eq('company_id',m.company_id).maybeSingle()):null;
   if(!set||set.status!=='published'||!set.set_products?.length)return response({error:'مدل تأییدشدنی هنوز در کتابخانه منتشر نشده است.'},409);
  }
  const next=data.decision==='approve'?'approved':'needs_info';
  const rows=checked(await admin.from('company_requests').update({status:next,updated_at:new Date().toISOString()}).eq('id',data.id).eq('company_id',m.company_id).eq('status','completed').select('id'));
  if(!rows.length)return response({error:'وضعیت درخواست تغییر کرده است؛ صفحه را تازه‌سازی کن.'},409);
  const note=data.decision==='approve'?'مدل سه‌بعدی توسط مدیر مجموعه تأیید شد.':data.body;
  await admin.from('company_messages').insert({company_id:m.company_id,request_id:data.id,author_id:m.user_id,sender:'company',body:note,media_ids:[]});
  await admin.from('activity_events').insert({company_id:m.company_id,user_id:m.user_id,event_type:'workspace.request.review',payload:{id:data.id,decision:data.decision}});
  return response({id:data.id,status:next});
 }
 if(body.action==='branch.save'&&!data.id){
  const limits=await capacity(m.company_id);
  // For head requests, count is separate from the data payload.
  const r=await admin.from('branches').select('id',{count:'exact',head:true}).eq('company_id',m.company_id);
  if(r.error)throw r.error;if((r.count||0)>=limits.max_branches)return response({error:'سقف شعبه‌های اشتراک تکمیل شده است.'},409);
 }
 if(body.action==='showroom.create'){
  const limits=await capacity(m.company_id);const r=await admin.from('showroom_accounts').select('id',{count:'exact',head:true}).eq('company_id',m.company_id);
  if(r.error)throw r.error;if((r.count||0)>=limits.max_agents)return response({error:'سقف عاملان فروش اشتراک تکمیل شده است.'},409);
 }
 if(body.action==='showroom.create'||body.action==='showroom.update'){
  const branch=checked(await admin.from('branches').select('id').eq('id',data.branch_id).eq('company_id',m.company_id).maybeSingle());
  if(!branch)return response({error:'این نمایشگاه متعلق به مجموعه نیست.'},403);
  const existing=data.id?checked(await admin.from('showroom_accounts').select('id,user_id').eq('id',data.id).eq('company_id',m.company_id).maybeSingle()):null;
  if(body.action==='showroom.update'&&!existing)return response({error:'کاربر پیدا نشد.'},404);
  const password=data.password;delete data.password;let userId=existing?.user_id;let created=false;
  if(body.action==='showroom.create'){
   const result=await admin.auth.admin.createUser({email:'showroom-'+crypto.randomUUID()+'@device.chido.invalid',password,email_confirm:true,app_metadata:{role:'branch',company_id:m.company_id,branch_id:data.branch_id}});
   if(result.error||!result.data.user)return response({error:'ساخت کاربر انجام نشد. شرایط رمز را بررسی کن.'},400);userId=result.data.user.id;created=true;
  }
  const result=await admin.rpc('chido_company_write',{p_actor:m.user_id,p_company:m.company_id,p_action:created?'showroom.register':'showroom.update',p_data:{...data,user_id:userId},p_central:false});
  if(result.error){if(created)await admin.auth.admin.deleteUser(userId);return response({error:result.error.code==='23505'?'این نام کاربری قبلاً انتخاب شده است. نام دیگری وارد کن.':'ذخیره کاربر انجام نشد. وضعیت نمایشگاه و اشتراک را بررسی کن.'},400);}
  if(!created&&password){const changed=await admin.auth.admin.updateUserById(userId,{password});if(changed.error)return response({error:'اطلاعات کاربر ذخیره شد، اما تغییر رمز انجام نشد. دوباره رمز را ثبت کن.'},400);}
  return response(result.data);
 }
 let code:string|null=null;
 if(body.action==='code.issue'){
  code='CHIDO-BRANCH-'+crypto.randomUUID().replaceAll('-','').toUpperCase();data.code_hash=await hash(code);data.expires_at=new Date(Date.now()+data.days*86400000).toISOString();delete data.days;
 }
 if(body.action==='media.register'){
  if(!data.object_path.startsWith(m.company_id+'/'+m.user_id+'/'))return response({error:'فایل متعلق به این حساب نیست.'},403);
  const existing=checked(await admin.from('company_media').select('id').eq('object_path',data.object_path).eq('company_id',m.company_id).maybeSingle());if(existing)return response(existing);
  const split=data.object_path.lastIndexOf('/');const files=checked(await admin.storage.from('company-media').list(data.object_path.slice(0,split),{search:data.object_path.slice(split+1)}));const file=files.find((f:any)=>f.name===data.object_path.slice(split+1));
  if(!file||Number(file.metadata?.size)!==data.bytes||file.metadata?.mimetype!==data.mime_type)return response({error:'فایل بارگذاری‌شده با مشخصات عکس مطابقت ندارد.'},400);
 }
 const result=await admin.rpc('chido_company_write',{p_actor:m.user_id,p_company:m.company_id,p_action:body.action,p_data:data,p_central:false});
 if(result.error){const message=result.error.code==='42501'?'اجازه انجام این کار یا دسترسی به این فایل را نداری.':result.error.message?.includes('own access')?'نقش یا دسترسی حساب خودت را نمی‌توانی تغییر دهی.':result.error.message?.includes('Last manager')?'آخرین مدیر فعال مجموعه باید حفظ شود.':result.error.message?.includes('already a member')?'این ایمیل قبلاً عضو مجموعه است.':result.error.message?.includes('Subscription inactive')?'برای این عملیات، مجموعه و اشتراک باید فعال باشند.':result.error.code==='23505'?'این شناسه قبلاً ثبت شده است.':'ثبت تغییرات انجام نشد. وضعیت و اطلاعات فرم را بررسی کن.';return response({error:message},result.error.code==='42501'?403:400);}
 return response({...result.data,...(code?{code,expires_at:data.expires_at}:{})});
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});const path=new URL(req.url).pathname.replace(/\/+$/,'');
 try{
  if(req.method==='POST'&&path.endsWith('/showroom/login'))return await showroomLogin(req);
  const m=await member(req);
  if(req.method==='GET'&&path.endsWith('/snapshot'))return response({data:await snapshot(m),server_time:new Date().toISOString()});
  if(req.method==='POST'&&path.endsWith('/sandbox-payment/start'))return await sandboxStart(req,m);
  if(req.method==='POST'&&path.endsWith('/sandbox-payment/verify'))return await sandboxVerify(req,m);
  if(req.method==='POST'&&path.endsWith('/write'))return await write(req,m);
  return response({error:'مسیر درخواست معتبر نیست.'},404);
 }catch(e){console.error('chido-company',e.code||e.status||'error');return response({error:e.status?e.message:'ارتباط با فضای مجموعه انجام نشد. دوباره تلاش کن.'},e.status||500);}
});

