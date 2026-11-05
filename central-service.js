import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './backend-config.js';
export const centralAuth=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'chido-central-auth-v1'}});
export async function centralRequest(path,body){
 const {data:{session}}=await centralAuth.auth.getSession();
 const response=await fetch(SUPABASE_URL+'/functions/v1/chido-admin'+path,{method:body?'POST':'GET',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.error||'ارتباط با سامانه برقرار نشد.');error.status=response.status;throw error;}
 return data;
}
export const writeCentral=(action,data)=>centralRequest('/write',{action,data});
