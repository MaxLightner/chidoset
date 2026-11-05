import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply(405,{});
 try{if(Number(req.headers.get('content-length')||0)>4096)return reply(413,{});const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply(401,{});const {data,error}=await admin.auth.getUser(token);if(error||!data.user)return reply(401,{});const user=data.user;
 const member=await admin.from('company_memberships').select('company_id,role,status').eq('user_id',user.id).eq('status','active').maybeSingle();let companyId=member.data?.company_id,role=member.data?.role;
 if(!role){const central=await admin.from('platform_roles').select('user_id').eq('user_id',user.id).maybeSingle();if(central.data)role='central';else{const guest=await admin.from('live_session_guests').select('live_sessions!inner(company_id,expires_at,revoked_at)').eq('user_id',user.id).maybeSingle();const s:any=guest.data?.live_sessions;if(s&&!s.revoked_at&&Date.parse(s.expires_at)>Date.now()){companyId=s.company_id;role='guest';}}}
 if(!role)return reply(403,{});const input=await req.json();if(!/^[0-9a-f-]{36}$/.test(input.id)||!['app','company','studio','guest','central'].includes(input.client))return reply(400,{});
 const row:any={id:input.id,company_id:companyId||null,user_id:user.id,role,client:input.client};const max:any={http_sent:268435456,http_received:536870912,ws_sent:268435456,ws_received:536870912,requests:10000,errors:10000,model_loads:1000,active_seconds:300};for(const [key,limit]of Object.entries(max)){const n=input[key];if(!Number.isSafeInteger(n)||n<0||n>Number(limit))return reply(400,{});row[key]=n;}
 const recent=await admin.from('chido_usage_batches').select('id',{count:'exact',head:true}).eq('user_id',user.id).gt('created_at',new Date(Date.now()-60000).toISOString());if((recent.count||0)>=12)return reply(429,{});
 const saved=await admin.from('chido_usage_batches').upsert(row,{onConflict:'id',ignoreDuplicates:true});if(saved.error)return reply(400,{});return reply(200,{ok:true});
 }catch{return reply(400,{});}
});
