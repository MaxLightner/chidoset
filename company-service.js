import {supabase,activateCompanyAdmin,requestCompanyAccess} from './chido-cloud.js?v=0.12.0';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './backend-config.js';
import {validateWorkspace} from './workspace-domain.mjs';
export const companyAuth=supabase;
export {activateCompanyAdmin,requestCompanyAccess};
export async function companyRequest(path,body){
 const {data:{session}}=await supabase.auth.getSession();
 const response=await fetch(SUPABASE_URL+'/functions/v1/chido-company'+path,{method:body?'POST':'GET',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(result.error||'ارتباط با فضای مجموعه انجام نشد.');error.status=response.status;throw error;}return result;
}
export const companyWrite=(action,data)=>companyRequest('/write',{action,data:validateWorkspace(action,data)});
export async function uploadCompanyPhotos(files,membership,onProgress=()=>{}){
 if(files.length>8)throw Error('در هر بار حداکثر ۸ عکس انتخاب کن.');
 const result=[];
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>8*1024*1024)throw Error('عکس باید JPEG، PNG یا WebP و حداکثر ۸ مگابایت باشد.');
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  const object_path=membership.company_id+'/'+membership.user_id+'/'+crypto.randomUUID()+'.'+ext;
  const {error}=await supabase.storage.from('company-media').upload(object_path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});if(error)throw Error('بارگذاری عکس انجام نشد. اتصال و دسترسی حساب را بررسی کن.');
  try{const record=await companyWrite('media.register',{object_path,filename:file.name.slice(0,180),mime_type:file.type,bytes:file.size,caption:''});result.push(record.id);onProgress(result.length,files.length);}catch(error){await supabase.storage.from('company-media').remove([object_path]);throw error;}
 }
 return result;
}
