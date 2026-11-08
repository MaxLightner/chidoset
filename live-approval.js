import {supabase,withLiveTimeout} from './chido-cloud.js?v=0.16.0';
const fields='id,session_id,requester_id,client_id,status,host_client_id,host_message,created_at';
const checked=async query=>{const {data,error}=await withLiveTimeout(query);if(error)throw error;if(!data)throw Error('درخواست نمایش در دسترس نیست.');return data;};
export const requestLiveView=(sessionId,userId,clientId)=>checked(supabase.from('live_view_requests').insert({session_id:sessionId,requester_id:userId,client_id:clientId}).select(fields).single());
export const readLiveViewRequest=id=>checked(supabase.from('live_view_requests').select(fields).eq('id',id).single());
export const changeLiveViewRequest=(id,values,expected)=>{
 let query=supabase.from('live_view_requests').update(values).eq('id',id);
 if(expected)query=query.eq('status',expected);
 return checked(query.select(fields).maybeSingle());
};
export async function pendingHostViews(clientId){
 const select=fields+',live_sessions!inner(expires_at)';
 const [approved,pending]=await Promise.all([
  checked(supabase.from('live_view_requests').select(select).eq('status','approved').eq('host_client_id',clientId).limit(200)),
  checked(supabase.from('live_view_requests').select(select).in('status',['requested','seen']).or('host_client_id.is.null,host_client_id.eq.'+clientId).order('created_at',{ascending:false}).limit(20))
 ]);return [...approved,...pending];
}
export const liveSession=id=>checked(supabase.from('live_sessions').select('id,expires_at').eq('id',id).single());
export async function endHostViews(clientId){const {error}=await withLiveTimeout(supabase.from('live_view_requests').update({status:'ended'}).eq('host_client_id',clientId).in('status',['seen','approved']));if(error)throw error;}
