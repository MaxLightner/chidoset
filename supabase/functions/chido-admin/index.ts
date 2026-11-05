import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {validateWrite,validateGlb} from './central-domain.mjs';
import {validateWorkspace} from './workspace-domain.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const checked=(result:any)=>{if(result.error)throw result.error;return result.data;};
async function owner(req:Request){
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
 if(!token)throw {status:401,message:'ابتدا وارد حساب مدیر مرکزی شو.'};
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)throw {status:401,message:'نشست ورود معتبر نیست. دوباره وارد شو.'};
 const role=checked(await admin.from('platform_roles').select('user_id').eq('user_id',data.user.id).eq('role','platform_admin').maybeSingle());
 if(!role)throw {status:403,message:'این حساب دسترسی مدیریت مرکزی چیدو ندارد.'};
 return data.user;
}
async function bootstrap(req:Request){
 const input=await req.json();
 if(typeof input.code!=='string'||input.code.length<32||input.code.length>100||typeof input.email!=='string'||!/^\S+@\S+\.\S+$/.test(input.email)||typeof input.password!=='string'||input.password.length<12||input.password.length>128)return respond({error:'کد دعوت، ایمیل معتبر و رمز حداقل ۱۲ کاراکتری لازم است.'},400);
 const invite=checked(await admin.from('platform_admin_invites').select('id,redeemed_at,expires_at').eq('code_hash',await hash(input.code.trim().toUpperCase())).maybeSingle());
 if(!invite||invite.redeemed_at||Date.parse(invite.expires_at)<=Date.now())return respond({error:'کد دعوت نامعتبر، استفاده‌شده یا منقضی است.'},400);
 const created=await admin.auth.admin.createUser({email:input.email.trim().toLowerCase(),password:input.password,email_confirm:true});
 if(created.error||!created.data.user)return respond({error:'ساخت حساب انجام نشد. ایمیل یا شرایط رمز را بررسی کن.'},400);
 const user=created.data.user;
 try{
  const claimed=checked(await admin.from('platform_admin_invites').update({redeemed_at:new Date().toISOString()}).eq('id',invite.id).is('redeemed_at',null).gt('expires_at',new Date().toISOString()).select('id').maybeSingle());
  if(!claimed)throw Error('کد دعوت هم‌زمان مصرف شده است.');
  checked(await admin.from('platform_roles').insert({user_id:user.id,role:'platform_admin'}));
  checked(await admin.from('platform_audit_events').insert({actor_id:user.id,action:'platform.activate',entity_id:user.id,details:{}}));
  return respond({ok:true});
 }catch(error){await admin.auth.admin.deleteUser(user.id);throw error;}
}
async function snapshot(){
 const names=['companies','branches','company_memberships','branch_devices','activation_codes','products','sets','set_products','layouts','colorways','subscriptions','company_access_requests','layout_requests','live_sessions','activity_events','platform_audit_events','company_requests','support_tickets','company_messages','company_media'];
 const columns:Record<string,string>={activation_codes:'id,company_id,branch_id,role,expires_at,redeemed_at,revoked_at,created_at',live_sessions:'id,company_id,branch_id,host_user_id,expires_at,revoked_at,created_at',layouts:'id,set_id,name,room,capacity,status,updated_at',colorways:'id,set_id,name,status,updated_at'};
 const result:Record<string,unknown>={};
 await Promise.all(names.map(async name=>{let query=admin.from(name).select(columns[name]||'*');if(name==='activity_events'||name==='platform_audit_events')query=query.order('created_at',{ascending:false}).limit(150);else query=query.limit(1000);result[name]=checked(await query);}));
 // Resolve private preview files without exposing bucket listing permissions.
 const products=result.products as any[];const paths=products.map(p=>p.thumbnail_path).filter(p=>p?.startsWith('storage://chido-assets/')).map(p=>p.slice('storage://chido-assets/'.length));
 if(paths.length){const signed=checked(await admin.storage.from('chido-assets').createSignedUrls(paths,3600));for(const p of products){const item=signed.find((s:any)=>'storage://chido-assets/'+s.path===p.thumbnail_path);if(item)p.preview_url=item.signedUrl;}}
 const media=result.company_media as any[];
 if(media.length){const signed=checked(await admin.storage.from('company-media').createSignedUrls(media.map(p=>p.object_path),900));for(const p of media)p.url=signed.find((s:any)=>s.path===p.object_path)?.signedUrl||'';}
 return result;
}
async function workspace(req:Request,user:any){
 const body=await req.json();if(!['request.status','ticket.status','message.send'].includes(body.action))return respond({error:'این عملیات پشتیبانی مجاز نیست.'},400);
 let input:any;try{input=validateWorkspace(body.action,body.data);}catch(e){return respond({error:e.message},400);}
 const kind=body.action==='message.send'?input.parent_kind:body.action==='request.status'?'request':'ticket';const id=body.action==='message.send'?input.parent_id:input.id;
 const record=checked(await admin.from(kind==='request'?'company_requests':'support_tickets').select('company_id').eq('id',id).maybeSingle());
 if(!record)return respond({error:'درخواست یا تیکت پیدا نشد.'},404);
 const result=await admin.rpc('chido_company_write',{p_actor:user.id,p_company:record.company_id,p_action:body.action,p_data:input,p_central:true});
 if(result.error)return respond({error:'ثبت پاسخ یا وضعیت انجام نشد. دوباره تلاش کن.'},400);
 return respond(result.data);
}
async function write(req:Request,user:any){
 const body=await req.json();let data;try{data=validateWrite(body.action,body.data);}catch(error){return respond({error:error.message},400);}
 let rawCode:string|null=null;
 if(body.action==='code.issue'){
  rawCode='CHIDO-'+(data.role==='branch'?'BRANCH-':'ADMIN-')+crypto.randomUUID().replaceAll('-','').toUpperCase();
  data={...data,code_hash:await hash(rawCode),expires_at:new Date(Date.now()+data.days*86400000).toISOString()};delete data.days;
 }
 if(body.action==='product.save'&&data.asset_path?.startsWith('storage://')){
  const path=data.asset_path.slice('storage://chido-assets/'.length);
  const blob=checked(await admin.storage.from('chido-assets').download(path));
  try{validateGlb(await blob.arrayBuffer());}catch(error){return respond({error:error.message},400);}
 }
 if(body.action==='product.save'){
  const existing=data.id?checked(await admin.from('products').select('catalog_index').eq('id',data.id).maybeSingle()):null;
  if((!data.id||existing?.catalog_index>=32)&&!data.asset_path?.startsWith('storage://chido-assets/models/'))return respond({error:'برای محصول جدید یک فایل GLB بارگذاری کن.'},400);
 }
 const result=await admin.rpc('chido_admin_write',{p_actor:user.id,p_action:body.action,p_data:data});
 if(result.error){console.error('admin write rejected',body.action,result.error.code);const message=result.error.code==='23505'?'این شناسه قبلاً ثبت شده است.':result.error.code==='42501'?'اجازه این عملیات را نداری.':'ذخیره انجام نشد؛ وضعیت رکورد و فیلدها را بررسی کن.';return respond({error:message},400);}
 return respond({...result.data,...(rawCode?{code:rawCode,expires_at:data.expires_at}:{})});
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const path=new URL(req.url).pathname.replace(/\/+$/,'');
 try{
  if(req.method==='POST'&&path.endsWith('/bootstrap'))return await bootstrap(req);
  const user=await owner(req);
  if(req.method==='GET'&&path.endsWith('/snapshot'))return respond({user:{id:user.id,email:user.email},data:await snapshot(),server_time:new Date().toISOString()});
  if(req.method==='POST'&&path.endsWith('/write'))return await write(req,user);
  if(req.method==='POST'&&path.endsWith('/workspace'))return await workspace(req,user);
  return respond({error:'مسیر درخواست معتبر نیست.'},404);
 }catch(error){console.error('chido-admin',error.code||error.status||'error');return respond({error:error.status?error.message:'سرویس موقتاً در دسترس نیست. دوباره تلاش کن.'},error.status||500);}
});
