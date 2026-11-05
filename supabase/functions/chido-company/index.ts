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
 if(!m)throw {status:403,message:'این حساب به فضای وب مجموعه دسترسی ندارد. از حساب مدیر یا کارشناس مجموعه استفاده کن.'};
 return {...m,user:data.user};
}
async function snapshot(m:any){
 const company=checked(await admin.from('companies').select('*').eq('id',m.company_id).single());
 const result:any={company,membership:{id:m.id,company_id:m.company_id,user_id:m.user_id,role:m.role,display_name:m.display_name,email:m.user.email},enabled:checked(await admin.rpc('chido_activation_company_enabled',{p_company_id:m.company_id}))};
 const tables=['branches','branch_devices','company_memberships','activation_codes','subscriptions','sets','company_media','company_requests','support_tickets','company_messages','company_user_invites','company_notifications','activity_events'];
 const fields:any={activation_codes:'id,company_id,branch_id,role,expires_at,redeemed_at,revoked_at,created_at',company_user_invites:'id,display_name,email,role,expires_at,redeemed_at,revoked_at,created_at'};
 await Promise.all(tables.map(async table=>{
  if((table==='company_memberships'||table==='company_user_invites'||table==='activation_codes'||table==='branch_devices')&&m.role!=='company_admin'){result[table]=[];return;}
  let query:any=admin.from(table).select(table==='sets'?'id,company_id,name,description,status,set_products(product_id,sort_order,products(id,catalog_index,name,thumbnail_path,active)),layouts(id,name,room,status,updated_at),colorways(id,name,status,updated_at)':fields[table]||'*');
  if(table==='branch_devices'){const branches=checked(await admin.from('branches').select('id').eq('company_id',m.company_id));query=query.in('branch_id',branches.map((b:any)=>b.id));}
  else query=query.eq('company_id',m.company_id);
  if(table==='activity_events')query=query.order('created_at',{ascending:false}).limit(60);else query=query.limit(1000);
  result[table]=checked(await query);
 }));
 for(const item of result.company_memberships){const auth=await admin.auth.admin.getUserById(item.user_id);item.email=auth.data.user?.email||'';}
 const media=result.company_media||[];if(media.length){const signed=checked(await admin.storage.from('company-media').createSignedUrls(media.map((p:any)=>p.object_path),900));for(const p of media)p.url=signed.find((s:any)=>s.path===p.object_path)?.signedUrl||'';}
 const notifications=result.company_notifications||[];result.notification_reads=notifications.length?checked(await admin.from('company_notification_reads').select('notification_id').eq('user_id',m.user_id).in('notification_id',notifications.map((n:any)=>n.id))):[];
 return result;
}
async function acceptInvite(req:Request){
 const body=await req.json();const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';const code=typeof body.code==='string'?body.code.trim().toUpperCase():'';
 if(code.length<30||code.length>100||!/^\S+@\S+\.\S+$/.test(email)||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return response({error:'کد دعوت، ایمیل و رمز حداقل ۱۲ کاراکتری را بررسی کن.'},400);
 const digest=await hash(code);const invitation=checked(await admin.from('company_user_invites').select('id,role,expires_at,redeemed_at,revoked_at').eq('code_hash',digest).eq('email',email).maybeSingle());
 if(!invitation||invitation.redeemed_at||invitation.revoked_at||Date.parse(invitation.expires_at)<=Date.now())return response({error:'ایمیل با دعوت مطابقت ندارد یا دعوت معتبر نیست.'},400);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password:body.password});let user=login.data.user;let created=false;
 if(!user){const result=await admin.auth.admin.createUser({email,password:body.password,email_confirm:true});if(result.error||!result.data.user)return response({error:'اگر این ایمیل حساب دارد، رمز همان حساب را وارد کن؛ در غیر این صورت شرایط رمز را بررسی کن.'},400);user=result.data.user;created=true;}
 const result=await admin.rpc('chido_accept_company_invite',{p_hash:digest,p_user:user.id,p_email:user.email});
 if(result.error){if(created)await admin.auth.admin.deleteUser(user.id);return response({error:'پذیرش دعوت انجام نشد. اعتبار دعوت و عضویت قبلی این ایمیل را بررسی کن.'},400);}
 return response({ok:true,role:invitation.role});
}
async function write(req:Request,m:any){
 const body=await req.json();let data:any;try{data=validateWorkspace(body.action,body.data);}catch(e){return response({error:e.message},400);}
 let code:string|null=null;
 if(body.action==='code.issue'||body.action==='invite.issue'){
  code=(body.action==='code.issue'?'CHIDO-BRANCH-':'CHIDO-USER-')+crypto.randomUUID().replaceAll('-','').toUpperCase();data.code_hash=await hash(code);data.expires_at=new Date(Date.now()+data.days*86400000).toISOString();delete data.days;
 }
 if(body.action==='media.register'){
  if(m.role==='company_viewer')return response({error:'این حساب فقط اجازه مشاهده دارد.'},403);
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
  if(req.method==='POST'&&path.endsWith('/accept-invite'))return await acceptInvite(req);
  const m=await member(req);
  if(req.method==='GET'&&path.endsWith('/snapshot'))return response({data:await snapshot(m),server_time:new Date().toISOString()});
  if(req.method==='POST'&&path.endsWith('/write'))return await write(req,m);
  return response({error:'مسیر درخواست معتبر نیست.'},404);
 }catch(e){console.error('chido-company',e.code||e.status||'error');return response({error:e.status?e.message:'ارتباط با فضای مجموعه انجام نشد. دوباره تلاش کن.'},e.status||500);}
});
