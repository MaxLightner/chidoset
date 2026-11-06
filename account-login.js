import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './backend-config.js';
export async function accountLogin(username,password){
 const response=await fetch(SUPABASE_URL+'/functions/v1/chido-login',{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({username,password})});
 const result=await response.json().catch(()=>({}));if(!response.ok||!result.session)throw Error(result.error||'ورود انجام نشد.');return result;
}
