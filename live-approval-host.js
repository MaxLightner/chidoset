import {pendingHostViews,changeLiveViewRequest,endHostViews} from './live-approval.js?v=0.16.1';
import {recordRuntime,recordRuntimeError} from './runtime-health.js?v=0.16.1';
import {supabase} from './chido-cloud.js?v=0.16.1';
import {approvedLiveTopic} from './live-broadcast.js?v=0.16.3';
export class LiveApprovalHost{
 constructor({getStudio,publish,onEnd}){
  Object.assign(this,{getStudio,publish,onEnd,clientId:crypto.randomUUID(),allowed:new Set(),broadcasts:new Map(),busy:false,deciding:false,nextPoll:0,current:null,hadSession:false});
  this.card=document.querySelector('#liveApprovalCard');
  this.title=this.card.querySelector('h2');this.message=this.card.querySelector('[role=status]');
  this.accept=this.card.querySelector('[data-approve]');this.reject=this.card.querySelector('[data-reject]');
  this.accept.onclick=()=>void this.decide(true);this.reject.onclick=()=>void this.decide(false);
  setInterval(()=>void this.poll(),1500);
 }
 isAllowed(sessionId){return this.allowed.has(sessionId);}
 packet(state){return {...state,publisherClientId:this.clientId};}
 syncBroadcasts(approved,{preserve=false}={}){
  const expected=new Set([...approved.map(row=>row.id),...(preserve?[...this.broadcasts.keys()]:[])]);
  for(const [id,entry] of this.broadcasts)if(!expected.has(id)){this.broadcasts.delete(id);void supabase.removeChannel(entry.channel);}
  for(const row of approved){
   if(this.broadcasts.has(row.id))continue;
   const topic=approvedLiveTopic(row.id,this.clientId);if(!topic)continue;
   const channel=supabase.channel(topic),entry={channel,connected:false};this.broadcasts.set(row.id,entry);
   channel.subscribe(status=>{entry.connected=status==='SUBSCRIBED';});
  }
 }
 broadcast(event,payload){
  for(const entry of this.broadcasts.values())if(entry.connected){
   void entry.channel.send({type:'broadcast',event,payload}).catch(error=>recordRuntimeError('live-broadcast-'+event,error));
  }
 }
 broadcastPose(state){this.broadcast('pose',state);}
 broadcastTransforms(state){this.broadcast('transforms',state);}
 broadcastScene(state){if(JSON.stringify(state).length<180000)this.broadcast('scene',state);}
 async poll(){
  const studio=this.getStudio();if(!studio?.session){if(this.hadSession)this.end();return;}
  this.hadSession=true;
  if(this.busy||this.deciding||Date.now()<this.nextPoll)return;
  this.nextPoll=Date.now()+1800;this.busy=true;
  try{
   const rows=await pendingHostViews(this.clientId);if(this.getStudio()!==studio||!studio.session)return;
   const recovered=this.failedPolling;this.failedPolling=false;
   const approved=rows.filter(row=>row.status==='approved'&&row.host_client_id===this.clientId);
   this.allowed=new Set(approved.map(row=>row.session_id));this.syncBroadcasts(approved);
   if(this.current&&!rows.some(row=>row.id===this.current.id)){this.current=null;this.card.hidden=true;}
   const request=rows.find(row=>row.status==='requested'||(row.status==='seen'&&row.host_client_id===this.clientId));
   if(!request){if(recovered&&!this.current)this.card.hidden=true;return;}
   if(request.id===this.current?.id&&request.status==='seen'){this.current=request;this.card.hidden=false;if(recovered){this.title.textContent='درخواست نمایش زنده';this.accept.disabled=this.reject.disabled=false;this.message.textContent=request.host_message||'درخواست نمایش دریافت شده است. اجازهٔ نمایش می‌دهی؟';}return;}
   this.current=request;this.card.hidden=false;this.accept.disabled=this.reject.disabled=true;
   this.title.textContent='درخواست نمایش زنده';this.message.textContent='یک بیننده درخواست نمایش این صحنه را دارد. اجازه می‌دهی نمای سه‌بعدی همین AR نمایش داده شود؟';
   recordRuntime('live-approval-prompt',studio.renderer);
   if(request.status==='requested')this.current=await changeLiveViewRequest(request.id,{status:'seen',host_client_id:this.clientId,host_message:''},'requested');
   if(!studio.session||this.getStudio()!==studio){void changeLiveViewRequest(request.id,{status:'ended'}).catch(()=>{});this.current=null;this.card.hidden=true;return;}
   this.accept.disabled=this.reject.disabled=false;
  }catch(error){this.failedPolling=true;recordRuntimeError('live-request-poll-failed',error);this.card.hidden=false;this.title.textContent='ارتباط نمایش برقرار نیست';this.message.textContent='دریافت درخواست نمایش انجام نشد؛ در حال تلاش مجدد هستیم.';this.accept.disabled=this.reject.disabled=true;}
  finally{this.busy=false;}
 }
 async decide(approve){
  if(this.deciding||this.current?.status!=='seen')return;
  const request=this.current,studio=this.getStudio();if(!studio?.session)return;
  this.deciding=true;this.accept.disabled=this.reject.disabled=true;
  try{
   if(!approve){await changeLiveViewRequest(request.id,{status:'rejected'},'seen');this.current=null;this.card.hidden=true;recordRuntime('live-request-rejected',studio.renderer);return;}
   this.message.textContent='در حال ارسال صحنه و زاویهٔ دید…';
   await this.publish(request,this.clientId);
   if(this.getStudio()!==studio||!studio.session)throw Error('نشست AR پایان یافته است.');
   await changeLiveViewRequest(request.id,{status:'approved',host_client_id:this.clientId,host_message:''},'seen');
   this.allowed.add(request.session_id);this.syncBroadcasts([{...request,status:'approved'}],{preserve:true});this.current=null;
   this.title.textContent='نمایش تأیید شد';this.message.textContent='صحنه ارسال شد؛ بیننده در حال بارگذاری مدل‌هاست.';
   recordRuntime('live-request-approved',studio.renderer);
   setTimeout(()=>{if(!this.current)this.card.hidden=true;},4500);
  }catch(error){recordRuntimeError('live-approval-publish-failed',error);this.message.textContent='ارسال نمایش انجام نشد. دوباره «تأیید نمایش» را بزن.';try{await changeLiveViewRequest(request.id,{host_message:'ارسال صحنه از AR انجام نشد؛ روی دستگاه فرستنده دوباره تأیید کن.'},'seen');}catch{}}
  finally{this.deciding=false;this.accept.disabled=this.reject.disabled=false;}
 }
 end(){this.hadSession=false;this.allowed.clear();this.syncBroadcasts([]);this.current=null;this.card.hidden=true;void endHostViews(this.clientId).catch(error=>recordRuntimeError('live-request-end-failed',error));this.onEnd?.();}
}
