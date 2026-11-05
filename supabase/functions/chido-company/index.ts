import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {validateWorkspace,WEB_ROLES} from './workspace-domain.mjs';
const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
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
 const result:any={company,membership:{id:m.id,company_id:m.company_id,user_id:m.user_id,role:m.role,display_name:m.display_name,email:m.user.email},enabled:checked(await admin.rpc('chido_activation_company_enabled',{p_company_id:m.company_id}))};
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
  if(req.method==='POST'&&path.endsWith('/write'))return await write(req,m);
  return response({error:'مسیر درخواست معتبر نیست.'},404);
 }catch(e){console.error('chido-company',e.code||e.status||'error');return response({error:e.status?e.message:'ارتباط با فضای مجموعه انجام نشد. دوباره تلاش کن.'},e.status||500);}
});
