import {supabase,withLiveTimeout} from './chido-cloud.js?v=0.16.1';
import {requestLiveView,readLiveViewRequest,changeLiveViewRequest} from './live-approval.js?v=0.16.1';
import {recordRuntime,recordRuntimeError} from './runtime-health.js?v=0.16.1';
import * as THREE from './vendor/three.module.js';
import {LiveViewCamera} from './live-view-camera.js?v=0.16.3';
import {approvedLiveTopic} from './live-broadcast.js?v=0.16.3';
export class ApprovedLiveWatch{
 constructor(studio,{onState=()=>{},onCamera=()=>{}}={}){
  Object.assign(this,{studio,onState,onCamera,clientId:crypto.randomUUID(),sessionId:null,userId:null,request:null,channel:null,fastChannel:null,fastTopic:null,busy:false,starting:false,epoch:0,lastKey:null,camera:null,wanted:false});
  studio.scene.background?.set('#ffffff');studio.renderer.setClearColor('#ffffff',1);studio.setPhotoMode(true);
  this.viewerCamera=new LiveViewCamera(studio);
  this.grid=new THREE.GridHelper(10,20,0xdce4df,0xeaf0ec);studio.scene.add(this.grid);
  this.timer=setInterval(()=>void this.refresh(),2200);
  this.emit('idle','محیط سه‌بعدی آماده است','برای ارسال درخواست، «نمایش همین‌جا» را بزن.');
 }
 emit(phase,label,message='',extra={}){const state={phase,label,message,requested:!!this.request,received:['seen','approved','rejected'].includes(this.request?.status),approved:this.request?.status==='approved',...extra},key=JSON.stringify(state);if(key!==this.lastState){if(this.lastPhase!==phase)recordRuntime('viewer-'+phase,null,'received='+state.received+' approved='+state.approved);this.lastPhase=phase;this.lastState=key;if(this.grid)this.grid.visible=!this.camera;this.onState(state);}}
 standby(){this.studio.externalCameraState=null;this.viewerCamera.pose=null;this.viewerCamera.marker.visible=false;this.viewerCamera.setMode(this.viewerCamera.mode);this.studio.resize();}
 setViewMode(mode){this.viewerCamera.setMode(mode);this.studio.resize();}
 connectFastChannel(request){
  const topic=approvedLiveTopic(request.id,request.host_client_id);
  if(!topic||this.fastTopic===topic)return;
  if(this.fastChannel)void supabase.removeChannel(this.fastChannel);
  this.fastTopic=topic;
  this.fastChannel=supabase.channel(topic)
   .on('broadcast',{event:'pose'},message=>this.applyCamera(message.payload))
   .on('broadcast',{event:'transforms'},message=>this.applyTransforms(message.payload))
   .on('broadcast',{event:'scene'},message=>this.applyScene(message.payload))
   .subscribe();
 }
 async start(sessionId,userId){
  this.wanted=true;if(this.starting)return;
  if(this.sessionId===sessionId&&this.request&&!['ended','rejected'].includes(this.request.status)){void this.refresh();return;}
  const old=this.request;if(old)void changeLiveViewRequest(old.id,{status:'ended'}).catch(()=>{});
  this.starting=true;const epoch=++this.epoch;this.sessionId=sessionId;this.userId=userId;this.request=null;this.lastKey=null;this.camera=null;this.lastSceneTimestamp=0;this.lastTransformTimestamp=0;this.sceneRevision=(this.sceneRevision||0)+1;this.studio.clear();this.standby();
  if(this.channel){void supabase.removeChannel(this.channel);this.channel=null;}
  if(this.fastChannel){void supabase.removeChannel(this.fastChannel);this.fastChannel=null;this.fastTopic=null;}
  this.emit('requesting','در حال ثبت درخواست نمایش','محیط سفید آماده است؛ در حال ارتباط با سامانه…');
  try{
   const request=await requestLiveView(sessionId,userId,this.clientId);
   if(epoch!==this.epoch){void changeLiveViewRequest(request.id,{status:'ended'}).catch(()=>{});return;}
   this.request=request;this.emit('requested','درخواست نمایش ثبت شد','منتظر دریافت درخواست در محیط AR هستیم.');
   this.channel=supabase.channel('chido-approved-watch-'+request.id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_view_requests',filter:'id=eq.'+request.id},()=>void this.refresh())
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_session_cameras',filter:'session_id=eq.'+sessionId},payload=>{if(this.request?.status==='approved')this.applyCamera(payload.new?.camera_state);})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_session_scenes',filter:'session_id=eq.'+sessionId},payload=>{if(this.request?.status==='approved')this.applyScene(payload.new?.scene_state);})
    .subscribe();
   void this.refresh();
  }catch(error){recordRuntimeError('watch-request-failed',error);this.emit('error','ثبت درخواست انجام نشد','ارتباط با سامانه ناموفق بود. دوباره تلاش کن.');}
  finally{this.starting=false;}
 }
 async refresh(){
  if(!this.wanted||!this.request||this.busy)return;this.busy=true;const epoch=this.epoch;
  try{
   const request=await readLiveViewRequest(this.request.id);if(epoch!==this.epoch)return;this.request=request;
   if(request.status==='requested'){this.emit('requested','درخواست نمایش ثبت شد','هنوز دریافت درخواست در AR ثبت نشده است.');return;}
   if(request.status==='seen'){this.emit(request.host_message?'error':'seen',request.host_message?'ارسال از AR کامل نشد':'اعلان در AR دریافت شد',request.host_message||'روی دستگاه فرستنده، «تأیید نمایش» را بزن.');return;}
   if(request.status==='rejected'){this.studio.clear();this.emit('rejected','درخواست نمایش رد شد','برای درخواست دوباره، دکمهٔ تلاش دوباره را بزن.');return;}
   if(request.status==='ended'){this.studio.clear();this.emit('ended','نمایش پایان یافت','می‌توانی درخواست تازه‌ای بفرستی.');return;}
   this.connectFastChannel(request);
   if(!this.camera||!this.lastKey)this.emit('loading','نمایش در AR تأیید شد','در حال دریافت صحنه و مدل‌ها…');
   if(this.camera&&this.lastKey&&Date.now()-(this.lastServerSync||0)<10000)return;
   const [scene,camera]=await Promise.all([
    withLiveTimeout(supabase.from('live_session_scenes').select('scene_state').eq('session_id',this.sessionId).single()),
    withLiveTimeout(supabase.from('live_session_cameras').select('camera_state').eq('session_id',this.sessionId).single())
   ]);
   if(epoch!==this.epoch)return;if(scene.error)throw scene.error;if(camera.error)throw camera.error;
   this.lastServerSync=Date.now();this.applyScene(scene.data.scene_state);this.applyCamera(camera.data.camera_state);
  }catch(error){recordRuntimeError('watch-read-failed',error);this.emit('error','دریافت اطلاعات نمایش انجام نشد','ارتباط با سامانه را بررسی کن یا دوباره تلاش کن.');}
  finally{this.busy=false;}
 }
 applyScene(state){
  if(!state||this.request?.status!=='approved'||state.publisherClientId!==this.request.host_client_id)return;
  if(Number(state.timestamp||0)<this.lastSceneTimestamp)return;
  // Floor tracking can move continuously; it must not destroy/reload the same models.
  const key=JSON.stringify({items:state.items,cloudProducts:state.cloudProducts,architecture:state.architecture,whiteFloor:state.whiteFloor});
  if(key===this.lastKey){
   this.lastSceneTimestamp=Math.max(this.lastSceneTimestamp||0,Number(state.timestamp||0));
   if(state.spatial){this.studio.model.restore(state.spatial);this.studio.syncSpatial();}
   if(Array.isArray(state.floorPose)&&state.floorPose.length===16&&state.floorPose.every(Number.isFinite)){const frame=this.studio.floorFrame;frame.matrix.fromArray(state.floorPose).decompose(frame.position,frame.quaternion,frame.scale);frame.updateMatrixWorld(true);}
   this.studio.root.visible=true;
   return;
  }
  this.lastSceneTimestamp=Number(state.timestamp||0);this.lastKey=key;const revision=(this.sceneRevision||0)+1;this.sceneRevision=revision;
  this.studio.syncLiveState(state);this.studio.setPhotoMode(true);this.studio.scene.background?.set('#ffffff');this.loadStarted=Date.now();
  if(this.lastTransforms&&Number(this.lastTransforms.timestamp)>=Number(state.timestamp||0))this.applyTransforms(this.lastTransforms,true);
  this.viewerCamera.fitOverview();
  void Promise.allSettled(this.studio.items.map(item=>item.userData.loadPromise).filter(Boolean)).then(()=>{if(this.sceneRevision===revision&&this.wanted)this.progress();});
  this.progress();
 }
 applyCamera(state){
  if(this.request?.status!=='approved'||!state||state.publisherClientId!==this.request.host_client_id)return;
  if(this.camera&&Number(state.timestamp)<Number(this.camera.timestamp))return;
  if(!this.viewerCamera.setPose(state))return;
  this.camera=state;this.onCamera(state);this.progress();
 }
 applyTransforms(state,replay=false){
  if(this.request?.status!=='approved'||!state||state.publisherClientId!==this.request.host_client_id||!Array.isArray(state.items))return;
  if(!replay&&Number(state.timestamp||0)<(this.lastSceneTimestamp||0))return;
  if(!replay&&Number(state.timestamp||0)<this.lastTransformTimestamp)return;
  if(!replay){this.lastTransformTimestamp=Number(state.timestamp||0);this.lastTransforms=state;}
  const byId=new Map(this.studio.items.map(item=>[item.userData.id,item]));
  for(const item of state.items){
   const mesh=byId.get(item.id);
   if(!mesh||mesh.userData.index!==item.index||!Array.isArray(item.position)||item.position.length!==3||!item.position.every(Number.isFinite))continue;
   mesh.position.fromArray(item.position);
   if(Number.isFinite(item.rotation))mesh.rotation.y=item.rotation;
   if(typeof item.hidden==='boolean'){mesh.userData.hidden=item.hidden;mesh.visible=!item.hidden;}
  }
  if(this.viewerCamera.mode==='overview'&&Date.now()-(this.lastOverviewFit||0)>450){this.lastOverviewFit=Date.now();this.viewerCamera.fitOverview();}
 }
 progress(){
  if(this.request?.status!=='approved')return;
  const items=this.studio.items.filter(item=>item.userData.imported),failed=items.filter(item=>item.userData.loadError),loaded=items.filter(item=>item.userData.modelLoaded).length,total=items.length;
  if(failed.length){this.emit('model-error','بعضی مدل‌ها بارگذاری نشدند','با «تلاش دوباره» دریافت مدل‌ها را تکرار کن.',{loaded,total});return;}
  if(loaded<total){this.emit('loading','در حال بارگذاری مدل‌ها',loaded+' از '+total+' مدل آماده است.',{loaded,total});return;}
  if(!this.camera||Date.now()-Number(this.camera.timestamp)>12000){this.emit('camera','تأیید دریافت شد؛ منتظر نمای تازهٔ AR هستیم','هنوز زاویهٔ دید تازه‌ای از فرستنده دریافت نشده است.',{loaded,total});return;}
  if(this.camera.tracking===false||this.camera.placed===false){this.emit('scanning','اتصال برقرار است؛ مدل‌ها آماده‌اند','فرستنده در حال اسکن یا بازیابی ردیابی محیط است.',{loaded,total});return;}
  this.emit('connected','نمایش زنده برقرار است',total?'همهٔ مدل‌ها بارگذاری شدند.':'اتصال برقرار است؛ صحنهٔ فرستنده خالی است.',{loaded,total});
 }
 async retry(){
  if(this.request?.status==='approved'&&this.camera&&Date.now()-Number(this.camera.timestamp)<12000){this.lastKey=null;void this.refresh();return;}
  const {sessionId,userId}=this;this.request&&await changeLiveViewRequest(this.request.id,{status:'ended'}).catch(()=>{});this.request=null;await this.start(sessionId,userId);
 }
 stop(){this.wanted=false;++this.epoch;this.sceneRevision=(this.sceneRevision||0)+1;const row=this.request;this.request=null;this.sessionId=null;this.lastKey=null;this.camera=null;this.lastTransforms=null;this.studio.clear();this.standby();const closing=row?changeLiveViewRequest(row.id,{status:'ended'}).catch(()=>{}):Promise.resolve();if(this.channel)void supabase.removeChannel(this.channel);this.channel=null;if(this.fastChannel)void supabase.removeChannel(this.fastChannel);this.fastChannel=null;this.fastTopic=null;this.emit('idle','محیط سه‌بعدی آماده است','برای نمایش، یک درخواست تازه بفرست.');return closing;}
 destroy(){const closing=this.stop();clearInterval(this.timer);this.viewerCamera.dispose();this.grid.removeFromParent();this.grid.geometry.dispose();this.grid.material.dispose();return closing;}
}
