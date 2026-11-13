import * as THREE from './vendor/three.module.js';
import {copyMaterialStyles,applyRoleMaterial,disposeRoleMaterials} from './material-roles.js?v=0.16.23';
import {getCloudProduct,getCloudProductInfo,registerCloudProducts,cloudProductList} from './cloud-product-registry.js';
import {ArchitectureLayer} from './architecture.js?v=0.18.1';
import {normalizeRoomPlan,roomPlanToArchitecture,constrainFurnitureToRoom} from './room-plan.js?v=0.18.1';
import {updateGeminiTV} from './gemini-room-materials.js?v=0.18.1';
import {createFurniture,furnitureHit} from './furniture.js?v=0.5.4';
import {createDecor} from './decor.js?v=0.5.4';
import {createImportedModel,isImportedModel,isImportedNoShadow,applySofaFabric} from './imported-models.js?v=0.16.23';
import {applyRugStyle} from './rug-textures.js?v=0.5.4';
import {MeasureTool} from './measure-tool.js?v=0.5.4';
import {bindXRExit} from './xr-lifecycle.js?v=0.14.0';
import {endXRSession} from './xr-end.js';
import {requestARSession,xrError} from './xr.js?v=0.5.4';
import {WideViewRenderer,WIDE_VIEW_FOV} from './wide-view.js?v=0.18.1';
import {SpatialState,CATALOG,pairAngle,wrappedAngle} from './spatial.js?v=0.16.16';
import {FloorScanner,floorCandidates} from './surfaces.js?v=0.5.4';
import {recordRuntime,recordRuntimeError} from './runtime-health.js?v=0.15.0';
import {rendererPolicy} from './renderer-policy.js';
import {EnvironmentEffects} from './effects.js?v=0.15.0';
import {AnchorStabilizer,transformPoint} from './anchor-rig.js?v=0.5.4';
import {ARDebugView} from './ar-debug.js?v=0.5.4';
import {buildLayout} from './layout-templates.js?v=0.5.4';
import {captureInternalAR,canCaptureCamera,InternalCaptureUnavailable} from './internal-camera-capture.js?v=0.5.4';
import {assetMetadata,isLamp,isSofa,isTable,isWallArt,SHEEN_CHAIR_SAMPLE} from './asset-metadata.js?v=0.16.16';
import {installSofaCushions} from './sofa-cushions.js?v=0.5.4';
import {isFloorSolid,footprint,footprintsOverlap,moveWithoutOverlap,rotateWithoutOverlap,moveGroupWithoutOverlap,rotateGroupWithoutOverlap,nearestFreeFootprint,settleFootprintsBySize} from './collision.js?v=0.16.16';
export const palette=['#b6bca2','#d5c4ad','#b9c4c6','#ba9380'];
const fa=n=>n.toLocaleString('fa-IR',{maximumFractionDigits:1});
export class Studio{
 constructor(host,changed){
  Object.assign(this,{host,changed,items:[],serial:0,selected:null,session:null,photoMode:false,tracking:true,anchor:null,anchorGeneration:0,anchorPending:false,anchorState:'بدون Anchor',lastStatus:'',lastReport:0,frames:0,fps:0,points:new Map(),gesture:null,needsAnchor:false,wideMode:'ar',wideView:null});
  this.roomPlan=null;this.roomVisible=true;this.roomCalibrationGuides=false;this.roomPendingPlacement=false;this.roomGeometryTimer=null;this.roomGeometryDirty=false;this.model=new SpatialState();this.scanner=new FloorScanner();this.anchorRig=new AnchorStabilizer();this.anchorNodes=[];this.anchorCandidates=[];this.anchorActive=false;this.anchorLastTime=0;this.extraHitSources=[];this.scanHits=0;this.scanDrop=null;this.scanDistance=null;this.revealStart=null;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#eeeee3');this.debugView=new ARDebugView(this.scene);this.debugView.setVisible(false);
  this.camera=new THREE.PerspectiveCamera(48,1,.03,40);this.camera.position.set(5.2,4.4,6);this.camera.lookAt(.6,0,-.5);
  this.renderPolicy=rendererPolicy({coarse:!!globalThis.matchMedia?.('(pointer:coarse)').matches,pixelRatio:globalThis.devicePixelRatio||1});
  this.renderer=new THREE.WebGLRenderer({antialias:this.renderPolicy.antialias,alpha:true,preserveDrawingBuffer:this.renderPolicy.preserveDrawingBuffer});this.renderer.setPixelRatio(this.renderPolicy.pixelRatio);
  // Same Reinhard exposure as the Gemini virtual Wide View; do not substitute
  // ACES, AgX or Neutral when switching to the native scene/AR renderer.
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ReinhardToneMapping;
  this.renderer.toneMappingExposure=1.45;
  this.renderer.xr.enabled=true;this.renderer.xr.setFramebufferScaleFactor(this.renderPolicy.xrScale);this.renderer.xr.setReferenceSpaceType('local');host.prepend(this.renderer.domElement);
  recordRuntime('renderer-created',this.renderer);
  this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.contextLost=true;recordRuntime('context-lost',this.renderer);this.renderer.setAnimationLoop(null);if(this.session)void endXRSession(this.session).catch(()=>{});this.onHint?.('نمای گرافیکی موقتاً قطع شد؛ در حال بازیابی است.');});
  this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.contextLost=false;recordRuntime('context-restored',this.renderer);if(!this.suspended)this.renderer.setAnimationLoop((time,frame)=>this.frame(time,frame));});
  this.effects=new EnvironmentEffects(this.scene,this.renderer);
  this.floorFrame=new THREE.Group();this.scene.add(this.floorFrame);this.root=new THREE.Group();this.floorFrame.add(this.root);
   this.architecture=new ArchitectureLayer(this.root,()=>{if(this.architecture?.data.floor.length&&this.whiteFloor)this.whiteFloor.visible=false;this.changed();});this.architecture.attachRenderer(this.renderer,this.scene);
  this.whiteFloor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));
  // The translucent floor must composite *before* transparent contact shadows.
  this.whiteFloor.rotation.x=-Math.PI/2;this.whiteFloor.position.y=.001;this.whiteFloor.renderOrder=-10;this.whiteFloor.visible=false;this.floorFrame.add(this.whiteFloor);
  this.placementEnabled=false;this.placementPoint=null;this.lastSelectionUI=0;this.moveLayoutMode=false;this.cameraBinding=null;this.pendingPhoto=null;
  this.measureTool=new MeasureTool(this.floorFrame,text=>this.makeLabel(text));this.measureTool.label.userData.updateText=text=>this.setLabel(this.measureTool.label,text);
  // The landing pin is on the already-locked virtual floor; it never changes ARCore tracking.
  this.placementMarker=new THREE.Mesh(new THREE.PlaneGeometry(.66,.66).rotateX(-Math.PI/2),
    new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{phase:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'precision highp float;varying vec2 vUv;uniform float phase;void main(){vec2 p=vUv*2.-1.;float d=length(p);float ring=(1.-smoothstep(.70,.78,d))*smoothstep(.64,.72,d);float xbar=(1.-smoothstep(.075,.11,abs(p.y)))*(1.-step(.42,abs(p.x)));float ybar=(1.-smoothstep(.075,.11,abs(p.x)))*(1.-step(.42,abs(p.y)));float plus=max(xbar,ybar);float a=max(ring*.75,plus*.9)*(1.-smoothstep(.85,1.,d));gl_FragColor=vec4(.96,.79,.37,a*(.85+.15*sin(phase)));}' }));
  this.placementMarker.visible=false;this.placementMarker.position.y=.035;this.placementMarker.renderOrder=9;this.root.add(this.placementMarker);
  // WebGL lineWidth is usually fixed on mobile: a shader gives a visible, soft grid.
   this.floorNet=new THREE.Mesh(
    new THREE.PlaneGeometry(6,6),
    new THREE.ShaderMaterial({
     transparent:true,depthWrite:false,side:THREE.DoubleSide,
     extensions:{derivatives:true},
     uniforms:{opacity:{value:.85},reveal:{value:1},pulse:{value:0}},
     vertexShader:`varying vec2 gridUv;void main(){gridUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
     fragmentShader:`precision highp float;
varying vec2 gridUv;
uniform float opacity;
uniform float reveal;
uniform float pulse;
void main(){
 vec2 cells=gridUv*24.0;
 vec2 dx=max(fwidth(cells),vec2(0.0001));
 vec2 line=abs(fract(cells+0.5)-0.5)/dx;
 float px=min(line.x,line.y);
 float core=1.0-smoothstep(0.7,1.65,px);
 float glow=1.0-smoothstep(1.2,5.2,px);
 float radius=length((gridUv-0.5)*6.0);
 float edge=1.0-smoothstep(reveal-0.06,reveal+0.06,radius);
 float rim=(1.0-smoothstep(0.025,0.11,abs(radius-reveal)))*(1.0-step(2.95,reveal));
 float alpha=clamp((0.72*core+0.32*glow)*opacity*edge+rim*0.65*pulse,0.0,0.95);
 gl_FragColor=vec4(mix(vec3(0.20,0.57,0.52),vec3(0.55,0.97,0.83),max(core,rim)),alpha);
}`
    })
   );
   this.floorNet.rotation.x=-Math.PI/2;
   this.floorNet.position.y=.004;
   this.floorFrame.add(this.floorNet);
   // Crosses represent sampled WebXR hits, NOT ARCore's raw feature point cloud.
   this.scanMarkers=new THREE.Group();this.scene.add(this.scanMarkers);
   const crossGeometry=new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.016,0,-.016),new THREE.Vector3(.016,0,.016),
    new THREE.Vector3(-.016,0,.016),new THREE.Vector3(.016,0,-.016)
   ]);
   this.scanCrosses=Array.from({length:20},()=>{
    const marker=new THREE.LineSegments(crossGeometry,new THREE.LineBasicMaterial({color:0x83ffe3,transparent:true,opacity:.94,depthTest:false}));
    marker.renderOrder=10;marker.visible=false;this.scanMarkers.add(marker);return marker;
   });
  this.ruler=new THREE.Group();this.floorFrame.add(this.ruler);
  this.rulerLine=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,1,10),new THREE.MeshBasicMaterial({color:0xffae52,depthTest:false}));this.rulerLine.renderOrder=5;this.ruler.add(this.rulerLine);
  this.handleA=this.makeHandle('A',0xc47642);this.handleB=this.makeHandle('B',0x5a8a84);this.ruler.add(this.handleA,this.handleB);this.rulerLabel=this.makeLabel('A — B');this.ruler.add(this.rulerLabel);
  this.rulerTicks=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffbc62,depthTest:false}));this.rulerTicks.renderOrder=6;this.ruler.add(this.rulerTicks);
  this.artFloorHandle=new THREE.Group();this.artFloorHandle.visible=false;this.root.add(this.artFloorHandle);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.62,.016,.05),new THREE.MeshBasicMaterial({color:0x55b39c,depthTest:false}));bar.position.y=.035;bar.renderOrder=20;this.artFloorHandle.add(bar);
  const link=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,1,6),new THREE.MeshBasicMaterial({color:0x55b39c,transparent:true,opacity:.7,depthTest:false}));link.name='art-floor-link';link.renderOrder=20;this.artFloorHandle.add(link);
  this.ray=new THREE.Raycaster();this.ray.layers.enable(1);this.pointer=new THREE.Vector2();this.events=new AbortController();const opts={signal:this.events.signal};
  this.attachInput(host,opts);const surface=document.querySelector('#arSurface');if(surface)this.attachInput(surface,opts);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.syncSpatial();this.resize();this.renderer.setAnimationLoop((time,frame)=>this.frame(time,frame));
 }
 setWideView(mode='ar',{natural=true}={}){
  if(mode==='ar'){
   this.wideMode='ar';this.wideView?.disable();this.cancelGesture();
   return {ok:true,mode};
  }
  if(!Object.hasOwn(WIDE_VIEW_FOV,mode))return {ok:false,reason:'میدان دید انتخاب‌شده معتبر نیست.'};
  if(!this.session)return {ok:false,reason:'ابتدا وارد AR شو.'};
  if(!this.model.locked)return {ok:false,reason:'ابتدا کف را تثبیت کن.'};
  if(this.photoMode)return {ok:false,reason:'برای نمای واید ابتدا از حالت عکاسی خارج شو.'};
  if(!this.hasOverlay||this.session.domOverlayState?.type!=='screen')
   return {ok:false,reason:'این مرورگر لایه تمام‌صفحه DOM Overlay را برای Wide View پشتیبانی نمی‌کند.'};
  try{
   if(!this.wideView){
    this.wideView=new WideViewRenderer(this.scene,document.querySelector('#overlay'));
    this.wideView.onFailure=reason=>{this.setWideView('ar');this.onWideViewError?.(reason);};
    this.wideView.onProjectionChange=projection=>this.onWideViewProjection?.(projection);
   }
   this.wideView.setMode(mode,{natural});
   const xrCamera=this.renderer.xr.getCamera();
   const tracked=xrCamera.cameras?.[0]||xrCamera;
   tracked.updateWorldMatrix(true,false);
   tracked.getWorldPosition(this.wideView.camera.position);
   tracked.getWorldQuaternion(this.wideView.camera.quaternion);
   this.wideView.camera.updateMatrixWorld(true);
   this.wideMode=mode;this.cancelGesture();
   return {ok:true,mode,hfov:this.wideView.horizontalFov,
    vfov:this.wideView.verticalFov,requestedHfov:WIDE_VIEW_FOV[mode],limited:this.wideView.limited};
  }catch(error){
   this.wideView?.disable();this.wideMode='ar';
   return {ok:false,reason:'این دستگاه نتوانست نمای واید مستقل را اجرا کند: '+(error?.message||error)};
  }
 }
 setRoomPlan(data){
  const next=normalizeRoomPlan(data);if(!next)return false;
  this.roomPlan=next;
  // Authored rooms do not show the legacy pulsing selection box, emissive rim or edge overlay.
  for(const item of this.items){
   item.userData.edges.visible=false;item.userData.edges.material.opacity=0;
   if(item.userData.selectionHalo)item.userData.selectionHalo.visible=false;
   if(item.material?.emissive&&!isLamp(item.userData.index))item.material.emissiveIntensity=0;
  }
  if(this.session){this.roomPendingPlacement=true;this.root.visible=false;}
  // Keep CAD dragging responsive; build the single shared 3D scene after edits settle.
  this.roomGeometryDirty=true;
  if(this.roomGeometryTimer!==null)clearTimeout(this.roomGeometryTimer);
  this.roomGeometryTimer=setTimeout(()=>{this.roomGeometryTimer=null;this.flushRoomGeometry();},180);
  this.changed();return true;
 }
 flushRoomGeometry(){
  if(this.roomGeometryTimer!==null){clearTimeout(this.roomGeometryTimer);this.roomGeometryTimer=null;}
  if(!this.roomGeometryDirty||!this.roomPlan)return;
  this.roomGeometryDirty=false;
  this.architecture?.restore(roomPlanToArchitecture(this.roomPlan,this.architecture?.data));
  if(this.whiteFloor)this.whiteFloor.visible=false;
  this.changed();
 }
 placeDesignedRoom(){
  if(!this.session||!this.model.locked||!this.roomPlan)return false;
  // Preserve A/B calibration: room architecture and every furniture mesh
  // share this.root, whose uniform scale is the measured correction factor.
  // Never reset calibration or shift the layout when inserting the room.
  this.syncSpatial();
  this.flushRoomGeometry();this.roomVisible=true;if(this.architecture?.group)this.architecture.group.visible=true;this.roomPendingPlacement=false;this.floorNet.visible=false;this.root.visible=true;this.changed();return true;
 }
 setDesignedRoomVisible(visible){
  if(!this.roomPlan||!this.architecture)return false;
  this.roomVisible=!!visible;
  this.architecture.group.visible=this.roomVisible;
  this.changed();return true;
 }
 roomCenterTarget(){
  if(!this.session||!this.model.locked||!this.tracking)return null;
  const camera=this.activeCamera();
  camera.updateWorldMatrix(true,false);
  const eye=camera.getWorldPosition(new THREE.Vector3());
  const direction=camera.getWorldDirection(new THREE.Vector3()).normalize();
  if(direction.y>=-.045)return null; // the reticle must really intersect the floor
  const intersection=new THREE.Ray(eye,direction).intersectPlane(this.model.plane,new THREE.Vector3());
  if(!intersection||!Number.isFinite(intersection.x)||eye.distanceTo(intersection)>12||eye.distanceTo(intersection)<.25)return null;
  return intersection;
 }
 moveRoomCenterToCrosshair(){
  if(!this.roomPlan)return false;
  const target=this.roomCenterTarget();
  if(!target)return false;
  const local=this.floorLocal(target);
  this.model.layoutOffset.set(local.x,0,local.z);
  // Same A/B scale, rotation, floor anchor and furniture-relative positions.
  this.syncSpatial();this.changed();return true;
 }
 moveRoomFurniture(id,x,z){
  if(!this.roomPlan||!Number.isFinite(x)||!Number.isFinite(z))return false;
  const mesh=this.items.find(m=>m.userData.id===id);if(!mesh)return false;
  const safe=this.safeObjectMotion(mesh,{x,z});
  mesh.position.x=safe.x;mesh.position.z=safe.z;
  if([4,14,28].includes(mesh.userData.index))this.snapToSupport(mesh);else this.keepOnFloor(mesh);
  this.refreshAttachments();this.updateArtFloorHandle();this.changed();return true;
 }
  get placed(){return this.model.locked;}
 updateArtFloorHandle(){if(!this.artFloorHandle)return;const mesh=this.selected;if(!mesh||!isWallArt(mesh.userData.index)||this.photoMode){this.artFloorHandle.visible=false;return;}this.artFloorHandle.visible=true;this.artFloorHandle.position.set(mesh.position.x,0,mesh.position.z);this.artFloorHandle.rotation.y=mesh.rotation.y;const link=this.artFloorHandle.getObjectByName('art-floor-link');const h=Math.max(.12,mesh.position.y);link.scale.y=h;link.position.y=h/2;}
 hitArtHandle(e,target){if(!this.artFloorHandle.visible)return false;const rect=target.getBoundingClientRect(),point=this.artFloorHandle.getWorldPosition(new THREE.Vector3()).project(this.activeCamera());if(point.z< -1||point.z>1)return false;return Math.hypot(rect.left+(point.x+1)*rect.width/2-e.clientX,rect.top+(1-point.y)*rect.height/2-e.clientY)<52;}
 rulerScreenPosition(){if(!this.model.locked||!this.tracking)return null;const p=this.rulerLabel.getWorldPosition(new THREE.Vector3()).project(this.activeCamera());if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)return null;const rect=document.querySelector('#arSurface')?.getBoundingClientRect();return rect?{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2}:null;}
 planPosition(mesh){const k=this.model.correction,yaw=this.model.layoutYaw,c=Math.cos(yaw),s=Math.sin(yaw),o=this.model.layoutOffset;return {x:o.x+(mesh.position.x*c+mesh.position.z*s)*k,z:o.z+(-mesh.position.x*s+mesh.position.z*c)*k};}
 moveObjectFromPlan(id,x,z){if(!this.model.locked||!Number.isFinite(x)||!Number.isFinite(z))return false;const mesh=this.items.find(m=>m.userData.id===id);if(!mesh)return false;const k=Math.max(.001,this.model.correction),yaw=this.model.layoutYaw,c=Math.cos(yaw),s=Math.sin(yaw),dx=(x-this.model.layoutOffset.x)/k,dz=(z-this.model.layoutOffset.z)/k;const safe=this.safeObjectMotion(mesh,{x:dx*c-dz*s,z:dx*s+dz*c});mesh.position.x=safe.x;mesh.position.z=safe.z;if([4,14,28].includes(mesh.userData.index))this.snapToSupport(mesh);else this.keepOnFloor(mesh);this.refreshAttachments();this.updateArtFloorHandle();this.changed();return true;}

 setMoveLayoutMode(value){this.moveLayoutMode=!!value;this.cancelGesture();this.onHint?.(this.moveLayoutMode?'برای حرکت کل چیدمان، نقطه‌ای از زمین را لمس کن و بکش.':'حالت جابه‌جایی چیدمان بسته شد.');return this.moveLayoutMode;}
 rotateLayout(degrees=45){this.model.layoutYaw+=degrees*Math.PI/180;this.syncSpatial();this.changed();}

 setPlacementEnabled(value){this.placementEnabled=!!value;this.placementMarker&&(this.placementMarker.visible=this.placementEnabled&&this.model.locked&&!this.photoMode);return this.placementEnabled;}

 setMeasureActive(value){this.measureTool.setActive(value);this.measureTool.group.visible=this.measureTool.active&&!this.photoMode&&this.model.locked;return this.measureTool.active;}
 clearMeasure(){this.measureTool.clear();this.onMeasure?.(null);}
 setMeasureHandler(fn){this.onMeasure=fn;}
 setDebugVisible(value){this.debugView.setVisible(value);}
 debugExport(){return this.debugView.exportLog();}
 resize(){if(this.session||this.suspended||this.exitToHome)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(w<2||h<2)return;this.camera.aspect=w/Math.max(h,1);this.camera.updateProjectionMatrix();if(this.externalCameraState)this.applyExternalCameraState(this.externalCameraState);this.renderer.setSize(w,h);}
 makeLabel(text){const canvas=document.createElement('canvas');let context=canvas.getContext('2d');context.font='42px Tahoma, sans-serif';canvas.width=Math.ceil(Math.max(90,context.measureText(text).width+44));canvas.height=100;context=canvas.getContext('2d');context.fillStyle='#fff9e9ee';context.beginPath();context.roundRect(2,2,canvas.width-4,96,16);context.fill();context.font='42px Tahoma, sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillStyle='#423c31';context.fillText(text,canvas.width/2,50);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(canvas.width/500,.2,1);sprite.renderOrder=8;sprite.userData.text=text;return sprite;}
 setLabel(sprite,text){if(sprite.userData.text===text)return;const previous=sprite.material.map;const replacement=this.makeLabel(text);sprite.material.map=replacement.material.map;sprite.material.needsUpdate=true;sprite.userData.text=text;previous.dispose();replacement.material.dispose();}
 makeHandle(name,color){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.055,20,16),new THREE.MeshBasicMaterial({color,depthTest:false}));mesh.renderOrder=6;mesh.userData.handle=name;const label=this.makeLabel(name);label.scale.set(.27,.085,1);label.position.y=.19;mesh.add(label);return mesh;}
 syncSpatial(){this.model.apply(this.floorFrame,this.root);this.handleA.position.copy(this.model.a);this.handleA.position.y=.04;this.handleB.position.copy(this.model.b);this.handleB.position.y=.04;
  const mid=this.model.a.clone().add(this.model.b).multiplyScalar(.5);this.rulerLine.position.set(mid.x,.036,mid.z);this.rulerLine.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),this.model.b.clone().sub(this.model.a).normalize());this.rulerLine.scale.set(1,this.model.length,1);
  this.rulerLabel.position.copy(this.model.a).lerp(this.model.b,.5);this.rulerLabel.position.y=.15;this.setLabel(this.rulerLabel,`${fa(this.model.length/this.model.correction*100)} cm · A—B`);
   const tickKey=[...this.model.a.toArray(),...this.model.b.toArray(),this.model.correction].map(n=>n.toFixed(4)).join(',');if(tickKey!==this.lastTickKey){this.lastTickKey=tickKey;
   const steps=Math.min(100,Math.floor(this.model.length/(.1*this.model.correction))),direction=this.model.b.clone().sub(this.model.a).normalize(),side=new THREE.Vector3(-direction.z,0,direction.x),pts=[];
   for(let i=0;i<=steps;i++){const center=this.model.a.clone().addScaledVector(direction,i*.1*this.model.correction);center.y=.046;const extent=i%5===0?.065:.028;pts.push(center.clone().addScaledVector(side,-extent),center.clone().addScaledVector(side,extent));}
   this.rulerTicks.geometry.dispose();this.rulerTicks.geometry=new THREE.BufferGeometry().setFromPoints(pts);}
   this.updateArtFloorHandle();this.floorFrame.updateMatrixWorld(true);if(!this.lastLiveMapUpdate||performance.now()-this.lastLiveMapUpdate>65){this.lastLiveMapUpdate=performance.now();this.onLiveChange?.();}
 }
 add(index=this.serial%4,position,options={}){
  const cloud=getCloudProduct(index),sheenChair=index===1000;
  if(index>=32&&!cloud&&!sheenChair&&!isImportedModel(index))throw Error('مدل این محصول در دسترس نیست؛ کتابخانه شرکت را دوباره دریافت کن.');
  if(!cloud&&!sheenChair)index=((index%CATALOG.length)+CATALOG.length)%CATALOG.length;
  const baseProduct=cloud?{name:cloud.name,size:cloud.size_m,price:0}:sheenChair?SHEEN_CHAIR_SAMPLE:{...CATALOG[index],name:getCloudProductInfo(index)?.name||CATALOG[index].name},product=options.size?{...baseProduct,size:options.size}:baseProduct,id=++this.serial,[w,h,d]=product.size;
  const color=palette[index]||'#c6b7a3';const mesh=isImportedModel(index)?createImportedModel(index,product.size,options.fabric||'dark'):index<4?createFurniture(index,product.size,color,options.seats):createDecor(index,product.size,color);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0x9f927f,transparent:true,opacity:.15,depthWrite:false}));mesh.add(edges);
  // Do not build furniture dimension sprites: the 3D and tracked AR rooms remain visually clean.
  const label=null;
  mesh.userData={...mesh.userData,id,index,height:h,price:product.price,product,edges,label,fabric:options.fabric||'dark',materialStyles:copyMaterialStyles(options.materialStyles),
  asset:assetMetadata(index,product.size),seats:options.seats||(index===0?3:1),cushionPreset:'none',
  collisionBox:new THREE.Box3(new THREE.Vector3(-w/2,-h/2,-d/2),new THREE.Vector3(w/2,h/2,d/2))};
  const loadingModel=isImportedModel(index)&&!mesh.userData.modelLoaded;let loadFill=null;
  if(loadingModel){
   loadFill=new THREE.Mesh(new THREE.BoxGeometry(w*.94,h*.94,d*.94),new THREE.MeshBasicMaterial({color:0x58a5cf,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));
   loadFill.name='chido-model-load-fill';loadFill.scale.y=.015;loadFill.position.y=-h/2+(h*.015)/2;loadFill.renderOrder=5;mesh.add(loadFill);
   mesh.userData.loadFill=loadFill;mesh.userData.edges.material.color.set(0x58a5cf);mesh.userData.edges.material.opacity=.62;mesh.material.color.set(0x58a5cf);mesh.material.opacity=.025;
   mesh.userData.onLoadProgress=state=>{
    mesh.userData.loadProgress=state;if(!loadFill?.parent)return;
    if(state?.progress===null||!Number.isFinite(state?.progress)){mesh.userData.loadIndeterminate=true;return;}
    const progress=THREE.MathUtils.clamp(state.progress,0,1);mesh.userData.loadIndeterminate=false;loadFill.scale.y=Math.max(.015,progress);loadFill.position.y=-h/2+(h*loadFill.scale.y)/2;
   };
   if(mesh.userData.loadProgress)mesh.userData.onLoadProgress(mesh.userData.loadProgress);
  }
  const defaults=[[0,h/2,-2.1],[2,h/2,-2.1],[.6,h/2,-.9],[2,h/2,-.6],[.3,h/2,-.75],[.3,h/2,-2.1],[2,h/2,-.65],[.9,h/2,-1.5],[.5,h/2,-1.8],[.5,h/2,-1.8],[.5,h/2,-1.7],[.5,h/2,-1.2]];
  mesh.position.fromArray(defaults[index]||[0,h/2,-1.65]);if(position)mesh.position.copy(position);
  mesh.position.y=isWallArt(index)?(position?.y>1?position.y:1.55):h/2;
  if(isSofa(index))installSofaCushions(mesh,options.cushionPreset||'none');
  this.root.add(mesh);this.items.push(mesh);
  if(!position&&index===4){
   const table=this.items.find(m=>m!==mesh&&isTable(m.userData.index));
   if(table)mesh.userData.attachment={id:table.userData.id,offset:[0,table.userData.height/2+h/2,0]};
  }
  if(!position&&index===5){
   const sofa=this.items.find(m=>m!==mesh&&(m.userData.index===0||m.userData.index===1));
   if(sofa)mesh.userData.attachment={id:sofa.userData.id,offset:[0,.56+h/2-sofa.userData.height/2,.20]};
  }
  this.refreshAttachments();if(isLamp(index)){this.initializeLamp(mesh,options.lampOn===true);if([14,28].includes(index)&&position)this.snapToSupport(mesh);}
  if([14,28].includes(index)&&!position){
   const table=this.items.find(m=>m!==mesh&&m.visible&&isTable(m.userData.index));
   if(table){mesh.position.x=table.position.x;mesh.position.z=table.position.z;}
   this.snapToSupport(mesh);
  }
   if(isImportedModel(index)){
    let readyHandled=false;
    const finishLoading=()=>{
     if(readyHandled)return;readyHandled=true;
     const fill=mesh.getObjectByName('chido-model-load-fill');if(fill){mesh.remove(fill);fill.geometry.dispose();fill.material.dispose();}
     mesh.userData.loadFill=null;mesh.userData.loadIndeterminate=false;mesh.material.opacity=0;
     mesh.userData.edges.material.color.set(mesh===this.selected?'#d3a66e':'#8d7e6d');mesh.userData.edges.material.opacity=mesh===this.selected?.48:.13;
    };
    mesh.userData.onModelReady=()=>{finishLoading();if(mesh.userData.tint)this.tintItem(mesh,mesh.userData.tint);this.enableShadowCasting(mesh);if([22,23,24].includes(index))this.setSofaFabric(mesh.userData.fabric,mesh,{preserveRoles:true});if(isLamp(index))this.initializeLamp(mesh,mesh.userData.lampOn);this.restoreMaterialStyles(mesh);this.changed();};
    mesh.userData.onModelError=error=>{const fill=mesh.getObjectByName('chido-model-load-fill');if(fill){fill.material.color.set('#cf654b');fill.material.opacity=.24;}mesh.material.color.set('#cf654b');mesh.material.opacity=.035;mesh.userData.edges.material.color.set('#cf654b');mesh.userData.edges.material.opacity=.78;this.onHint?.('بارگذاری '+product.name+' ناموفق بود: '+(error?.message||'خطای دریافت فایل'));};
    if(mesh.userData.modelLoaded)mesh.userData.onModelReady();
   }
  if(!options.silentSelect)this.select(mesh);this.setGuides();return mesh;
 }
 enableShadowCasting(mesh){mesh.traverse(node=>{if(node.isMesh&&node.visible&&node.material?.opacity!==0&&node.name!=='chido-contact-shadow'&&node.name!=='contact-shadow-receiver'&&!node.userData.chidoBakedShadow)node.castShadow=true;});}
 refreshAttachments(){for(const item of this.items){const link=item.userData.attachment;if(!link)continue;const base=this.items.find(m=>m.userData.id===link.id);if(!base){item.userData.attachment=null;this.keepOnFloor(item);continue;}const offset=new THREE.Vector3(...link.offset).applyAxisAngle(new THREE.Vector3(0,1,0),base.rotation.y);item.position.copy(base.position).add(offset);}}
 seed(kind='conversation',room='پذیرایی',people=5){
  this.clear();
  const recipe=buildLayout({room,kind,capacity:people});
  if(!recipe.items.length)return;
  const made=[];
  for(const specification of recipe.items){
   const product=CATALOG[specification.index];
   const pos=new THREE.Vector3(specification.x,product.size[1]/2,specification.z);
   const mesh=this.add(specification.index,pos,{...specification.options,silentSelect:true});
   mesh.rotation.y=specification.rotation||0;
   mesh.userData.capacity=specification.options?.capacity||mesh.userData.capacity||null;
   made.push({mesh,specification});
  }
  const dining=made.find(x=>x.mesh.userData.index===10)?.mesh;
  if(dining)for(const {mesh} of made)if(mesh.userData.index===11)mesh.userData.tableId=dining.userData.id;
  for(const {mesh} of made)if(mesh.userData.index===4)this.snapVase(mesh);
  this.select(made.find(x=>[0,1,10,8,9].includes(x.mesh.userData.index))?.mesh||this.items[0]||null);
 }
 select(mesh){if(mesh)this.architecture?.clearSurface();this.selected=mesh;this.updateArtFloorHandle();
  for(const m of this.items){
   const highlighted=m===mesh&&!this.roomPlan;
   m.userData.edges.material.color.set(highlighted?'#d3a66e':'#8d7e6d');
   m.userData.edges.material.opacity=highlighted?.48:0;
   m.userData.edges.visible=highlighted&&!this.photoMode;
   if(m.material?.emissive&&!isLamp(m.userData.index)){
    m.material.emissive.set(highlighted?'#b79363':'#000000');
    m.material.emissiveIntensity=highlighted?.17:0;
   }
   if(m.userData.selectionHalo)m.userData.selectionHalo.visible=highlighted&&!this.photoMode;
  }
  if(mesh&&!this.roomPlan&&!mesh.userData.selectionHalo){
   const [w,h,d]=mesh.userData.product.size;
   const geometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(w+.08,Math.max(.04,h)+.09,d+.08));
   const halo=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
    color:0xffd49b,transparent:true,opacity:.45,depthTest:false,depthWrite:false
   }));
   halo.name='selected-object-halo';halo.renderOrder=17;mesh.add(halo);mesh.userData.selectionHalo=halo;
  }
  this.changed();
 }
 setItemVisible(id,value){
  const mesh=this.items.find(x=>x.userData.id===id);if(!mesh)return false;
  mesh.userData.hidden=!value;mesh.visible=!!value;
  if(!value&&mesh===this.selected)this.select(null);
  this.changed();return true;
 }
 duplicateSelected(){
  if(!this.selected||this.items.length>=24)return null;
  const source=this.selected,p=source.position.clone().add(new THREE.Vector3(Math.max(.43,source.userData.product.size[0]*.28),0,.18));
  if(isFloorSolid(source.userData.index)){
   const spot=nearestFreeFootprint(footprint(source.userData.product.size,p.x,p.z,source.rotation.y),this.collisionObstacles(),2.4);
   if(!spot){this.onHint?.('فضای کافی برای کپی کنار مبلمان نیست.');return null;}
   p.x=spot.x;p.z=spot.z;
  }
  const copy=this.add(source.userData.index,p,{size:[...source.userData.product.size],seats:source.userData.seats,fabric:source.userData.fabric,materialStyles:source.userData.materialStyles});
  copy.rotation.y=source.rotation.y;copy.material.color.copy(source.material.color);if(source.userData.tint)this.tintItem(copy,source.userData.tint);
  if(source.userData.rugStyle)applyRugStyle(copy,source.userData.rugStyle);
  copy.userData.capacity=source.userData.capacity;copy.userData.tableId=source.userData.tableId;
  if(isSofa(source.userData.index))installSofaCushions(copy,source.userData.cushionPreset);
  if(isLamp(source.userData.index))this.initializeLamp(copy,source.userData.lampOn);
  this.select(copy);return copy;
 }

 replaceSelected(index,options={}){
  const old=this.selected;if(!old)return null;
  const p=old.position.clone(),id=old.userData.id,angle=old.rotation.y,color=old.material.color.clone();
  const nextSize=options.size||getCloudProduct(index)?.size_m||(index===1000?SHEEN_CHAIR_SAMPLE.size:CATALOG[index].size);
  if(isFloorSolid(index)){
   const ignored=this.items.filter(m=>old.userData.index===10&&m.userData.tableId===id);
   const blocked=this.collisionObstacles(old,ignored).some(other=>footprintsOverlap(footprint(nextSize,p.x,p.z,angle),other));
   if(blocked){this.onHint?.('برای تغییر ابعاد یا مدل، ابتدا فضای بیشتری باز کن.');return null;}
  }
  const linked=this.items.filter(x=>x.userData.attachment?.id===id).map(x=>({mesh:x,attachment:{...x.userData.attachment}}));
  this.remove();
  const next=this.add(index,p,options);next.userData.id=id;next.rotation.y=angle;next.material.color.copy(color);if(isWallArt(index)&&old.userData.artImage)this.setWallArtImage(old.userData.artImage,next);
  if(isSofa(index)&&isSofa(old.userData.index))installSofaCushions(next,old.userData.cushionPreset);
  if(isLamp(index)&&isLamp(old.userData.index))this.initializeLamp(next,old.userData.lampOn);
  next.userData.seats=options.seats||next.userData.seats;
  this.keepOnFloor(next);
  for(const x of linked)x.mesh.userData.attachment=x.attachment;
  this.refreshAttachments();this.select(next);return next;
 }
 setDiningCapacity(count){
  if(!this.selected||this.selected.userData.index!==10||![2,4,6,8].includes(count))return false;
  const table=this.selected,oldId=table.userData.id;
  const oldChairs=this.items.filter(m=>m.userData.tableId===oldId);
  const center=table.position.clone(),angle=table.rotation.y;
  const width={2:1.05,4:1.35,6:1.85,8:2.35}[count];
  const chairs=[];
  for(let i=0;i<count/2;i++)for(const side of [-1,1]){
   const offset=new THREE.Vector3((i-(count/2-1)/2)*.55,0,side*.78).applyAxisAngle(new THREE.Vector3(0,1,0),angle);
   chairs.push({x:center.x+offset.x,z:center.z+offset.z,angle:angle+(side===1?Math.PI:0)});
  }
  const fixed=this.collisionObstacles(table,oldChairs),tableShape=footprint([width,.75,.86],center.x,center.z,angle);
  const chairShapes=chairs.map(c=>footprint(CATALOG[11].size,c.x,c.z,c.angle));
  if(fixed.some(item=>footprintsOverlap(tableShape,item))||
     chairShapes.some((shape,i)=>fixed.some(item=>footprintsOverlap(shape,item))||
      footprintsOverlap(shape,tableShape)||
      chairShapes.slice(0,i).some(prev=>footprintsOverlap(shape,prev)))){
   this.onHint?.('برای میز و صندلی‌های این ظرفیت فضای کافی نیست.');return false;
  }
  const newer=this.replaceSelected(10,{size:[width,.75,.86]});if(!newer)return false;newer.userData.capacity=count;
  for(const old of oldChairs){this.root.remove(old);this.items=this.items.filter(m=>m!==old);this.disposeObject(old);}
  for(const spot of chairs){
   const chair=this.add(11,new THREE.Vector3(spot.x,.45,spot.z));
   chair.userData.tableId=newer.userData.id;chair.rotation.y=spot.angle;
  }
  this.select(newer);this.changed();return true;
 }
 setSofaSeats(count){
  if(!this.selected||![0,1,3].includes(this.selected.userData.index)||![1,2,3].includes(count))return false;
  const index=count===1?1:0,w={1:.9,2:1.62,3:2.1}[count];
  return !!this.replaceSelected(index,{size:[w,.85,.9],seats:count});
 }
 setRugSize(size){
   if(this.selected?.userData.index!==7||!Array.isArray(size)||size.length!==3)return false;
   const current=this.selected.userData.rugStyle||'laki';
   const next=this.replaceSelected(7,{size});if(!next)return false;
   applyRugStyle(next,current);this.changed();return true;
  }
  snapToSupport(mesh){
   if(!mesh)return null;
   const turn=new THREE.Vector3(0,1,0),[w,,d]=mesh.userData.product.size;
   let nearest=null;
   for(const table of this.items){
    if(table===mesh||!table.visible||!isTable(table.userData.index))continue;
    const surface=table.userData.asset?.supportSurfaces?.find(x=>x.kind==='horizontal');
    if(!surface)continue;
    const point=mesh.position.clone().sub(table.position).applyAxisAngle(turn,-table.rotation.y);
    const reachX=surface.width/2+Math.min(.07,w*.18),reachZ=surface.depth/2+Math.min(.07,d*.18);
    if(Math.abs(point.x)>reachX||Math.abs(point.z)>reachZ)continue;
    const distance=(point.x/reachX)**2+(point.z/reachZ)**2;
    const top=table.position.y-table.userData.height/2+surface.height;
    if(!nearest||distance<nearest.distance||(distance===nearest.distance&&top>nearest.top))nearest={table,surface,point,distance,top};
   }
   if(!nearest){mesh.userData.attachment=null;mesh.position.y=mesh.userData.height/2;return null;}
   const {table,surface,point}=nearest;
   // Keep the lamp/vase footprint entirely on the usable tabletop.
   const offset=new THREE.Vector3(
    THREE.MathUtils.clamp(point.x,-Math.max(0,(surface.width-w)/2),Math.max(0,(surface.width-w)/2)),
    -table.userData.height/2+surface.height+mesh.userData.height/2,
    THREE.MathUtils.clamp(point.z,-Math.max(0,(surface.depth-d)/2),Math.max(0,(surface.depth-d)/2))
   );
   mesh.userData.attachment={id:table.userData.id,offset:offset.toArray()};
   this.refreshAttachments();return table;
  }
 snapVase(mesh){if(mesh?.userData.index!==4)return;this.snapToSupport(mesh);}
 initializeLamp(mesh,on){
  mesh.userData.lampOn=!!on;
  mesh.traverse(o=>{
   if(o.isPointLight){o.visible=!!on;o.intensity=on?2.2:0;o.distance=3.8;}
   if(o.name==='lamp-visible-glow'&&o.material)o.material.opacity=on?.46:0;
   if(isImportedModel(mesh.userData.index)&&o.isMesh&&o!==mesh){
    for(const material of Array.isArray(o.material)?o.material:[o.material]){
     if(!material?.emissive)continue;
     if(material.userData.nativeEmissive)material.emissive.copy(material.userData.nativeEmissive);
     material.emissiveIntensity=on?(material.userData.nativeEmissiveIntensity||0):0;
    }
   }
  });
  if(mesh.material?.emissive)mesh.material.emissiveIntensity=on?2.3:.04;
 }
 setSofaCushions(preset){
  const mesh=this.selected;
  if(!mesh||!isSofa(mesh.userData.index))return false;
  const ok=installSofaCushions(mesh,preset);
  if(ok)this.changed();return ok;
 }
 setWallArtImage(dataUrl,mesh=this.selected){if(!mesh||!isWallArt(mesh.userData.index)||typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/')||dataUrl.length>650000)return false;const image=mesh.getObjectByName('wall-art-image');if(!image)return false;mesh.userData.artImage=dataUrl;const texture=new THREE.TextureLoader().load(dataUrl,()=>this.changed());texture.colorSpace=THREE.SRGBColorSpace;const old=image.material.map;image.material.map=texture;image.material.needsUpdate=true;old?.dispose();this.changed();return true;}
 setRugStyle(id){if(!this.selected||this.selected.userData.index!==7)return false;applyRugStyle(this.selected,id);this.changed();return true;}
 setLampOn(value){
  if(!this.selected||!isLamp(this.selected.userData.index))return false;
  this.initializeLamp(this.selected,value);this.changed();return true;
 }
 addAtMarker(index){
  const h=(getCloudProduct(index)?.size_m||(index===1000?SHEEN_CHAIR_SAMPLE.size:CATALOG[index].size))[1];
  const p=this.placementPoint?new THREE.Vector3(this.placementPoint.x,h/2,this.placementPoint.z):undefined;
  const previous=this.selected,item=this.add(index,p);
  if(!this.tryPlaceNew(item,previous,2.3))return null;
  if(index===10){item.userData.capacity=4;if(!this.setDiningCapacity(4)){
   this.select(item);this.remove();this.select(previous&&this.items.includes(previous)?previous:(this.items[0]||null));
   return null;
  }}
  if(index===4)this.snapVase(item);
  if([14,28].includes(index))this.snapToSupport(item);
  return this.selected||item;
 }
 updatePlacementMarker(time){
  if(!this.placementMarker)return;
  if(!this.placementEnabled||!this.model.locked||!this.session||!this.tracking||this.photoMode){this.placementMarker.visible=false;return;}
  const camera=this.activeCamera(),eye=camera.getWorldPosition(new THREE.Vector3());
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const ray=new THREE.Ray(eye,dir),world=ray.intersectPlane(this.model.plane,new THREE.Vector3());
  if(!world||eye.distanceTo(world)>5||eye.distanceTo(world)<.25){
   world=eye.clone().addScaledVector(new THREE.Vector3(dir.x,0,dir.z).normalize(),1.65);world.y=this.model.height;
  }
  const local=this.rootLocal(world);
  this.placementPoint=local.clone();this.placementPoint.y=0;
  this.placementMarker.position.set(local.x,.042,local.z);
  this.placementMarker.material.uniforms.phase.value=time*.005;
  this.placementMarker.visible=true;
 }
 selectionScreenPosition(){
  if(!this.selected||!this.selected.visible||!this.session||!this.model.locked||!this.tracking)return null;
  const camera=this.activeCamera();
  const point=this.selected.getWorldPosition(new THREE.Vector3());point.y+=this.selected.userData.height*.25;
  const ndc=point.project(camera);if(ndc.z< -1||ndc.z>1||Math.abs(ndc.x)>1.12||Math.abs(ndc.y)>1.12)return null;
  const target=document.querySelector('#arSurface');if(!target)return null;
  const rect=target.getBoundingClientRect();
  return {x:rect.left+(ndc.x+1)*rect.width/2,y:rect.top+(1-ndc.y)*rect.height/2};
 }

 remove(){const m=this.selected;if(!m)return;this.items=this.items.filter(x=>x!==m);for(const child of this.items)if(child.userData.attachment?.id===m.userData.id){child.userData.attachment=null;this.keepOnFloor(child);}this.root.remove(m);this.disposeObject(m);this.select(this.items[0]||null);}
 clear(){if(this.roomGeometryTimer!==null)clearTimeout(this.roomGeometryTimer);this.roomGeometryTimer=null;this.roomGeometryDirty=false;this.roomPendingPlacement=false;this.roomPlan=null;for(const m of this.items){this.root.remove(m);this.disposeObject(m);}this.items=[];this.selected=null;this.serial=0;this.architecture?.restore({floor:[],walls:[],windows:[]});this.changed();}
 disposeObject(object){disposeRoleMaterials(object.getObjectByName('imported-visual'));const imported=!!object.userData.imported;object.userData.disposed=true;object.traverse(o=>{o.geometry?.dispose();if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){if(!imported)material.map?.dispose();material.dispose();}}});}
 rotate(degrees){if(!this.selected)return;const mesh=this.selected;const desired=degrees===undefined?mesh.rotation.y+Math.PI/4:degrees*Math.PI/180;
  mesh.rotation.y=this.safeObjectRotation(mesh,desired);
  this.keepOnFloor(mesh);this.refreshAttachments();this.changed();}
 tintItem(mesh,color){if(!mesh)return;mesh.userData.tint=color;mesh.traverse(node=>{if(!node.isMesh)return;for(const material of Array.isArray(node.material)?node.material:[node.material])if(material?.color)material.color.set(color);});}
 color(color){if(this.selected){this.tintItem(this.selected,color);this.changed();}}
 async setMaterialStyle(role,style,mesh=this.selected){
  if(!mesh||!this.items.includes(mesh)||mesh.userData.disposed)return false;
  const visual=mesh.getObjectByName('imported-visual');if(!visual)return false;
  const clean=style?copyMaterialStyles({[role]:style})[role]:null;if(style&&!clean)return false;
  const applied=await applyRoleMaterial(visual,role,clean);
  if(!applied||mesh.userData.disposed)return false;
  mesh.userData.materialStyles??={};if(clean)mesh.userData.materialStyles[role]=clean;else delete mesh.userData.materialStyles[role];
  if(role==='fabric'&&!clean&&[22,23,24].includes(mesh.userData.index))this.setSofaFabric(mesh.userData.fabric,mesh,{preserveRoles:true});
  this.changed();return true;
 }
 restoreMaterialStyles(mesh){for(const [role,style] of Object.entries(copyMaterialStyles(mesh.userData.materialStyles)))void this.setMaterialStyle(role,style,mesh).catch(error=>this.onHint?.(error.message||'تکسچر بارگذاری نشد.'));}
 setSofaFabric(id,mesh=this.selected,{preserveRoles=false}={}){
  if(![22,23,24].includes(mesh?.userData.index))return false;
  mesh.userData.fabric=id;
  if(!preserveRoles){if(mesh.userData.materialStyles)delete mesh.userData.materialStyles.fabric;const visual=mesh.getObjectByName('imported-visual');if(visual?.userData.roleMaterialOverrides)delete visual.userData.roleMaterialOverrides.fabric;}
  const visual=mesh.getObjectByName('imported-visual');if(visual)void applySofaFabric(visual,id,mesh.userData.index).then(applied=>{if(applied&&!mesh.userData.disposed){if(mesh.userData.tint)this.tintItem(mesh,mesh.userData.tint);this.changed();}}).catch(error=>console.warn('Fabric apply failed',error));
  this.changed();return true;
 }
 setWhiteFloor(visible){this.whiteFloor.visible=!!visible;this.changed();return this.whiteFloor.visible;}
 calibrate(cm){this.model.calibrate(Number(cm)/100);this.measureTool.setCorrection(this.model.correction);this.syncSpatial();this.changed();return this.measurement();}
 resetCalibration(){this.model.resetCalibration();this.measureTool.setCorrection(this.model.correction);this.syncSpatial();this.changed();}
 setHeight(){throw Error('ارتفاع کف فقط از شناسایی واقعی تعیین می‌شود.');}
 measurement(){return {measuredCm:this.model.length*100,correctedCm:this.model.length/this.model.correction*100,scale:this.model.correction,actualCm:this.model.actualLength===null?null:this.model.actualLength*100,heightCm:this.model.heightOffset*100};}
 exportState(){return {roomPlan:this.roomPlan?structuredClone(this.roomPlan):null,cloudProducts:cloudProductList().filter(p=>this.items.some(m=>m.userData.index===p.catalog_index)),spatial:this.model.snapshot(),whiteFloor:!!this.whiteFloor?.visible,architecture:this.architecture?.snapshot()||{floor:[],walls:[],windows:[]},items:this.items.map(m=>({index:m.userData.index,id:m.userData.id,
 position:m.position.toArray(),rotation:m.rotation.y,color:'#'+m.material.color.getHexString(),tint:m.userData.tint||null,
 attachment:m.userData.attachment||null,size:[...m.userData.product.size],capacity:m.userData.capacity||null,
 seats:m.userData.seats||null,tableId:m.userData.tableId||null,hidden:!!m.userData.hidden,
 rugStyle:m.userData.rugStyle||null,artImage:m.userData.artImage||null,lampOn:!!m.userData.lampOn,
 cushionPreset:m.userData.cushionPreset||'none',fabric:m.userData.fabric||null,materialStyles:copyMaterialStyles(m.userData.materialStyles)}))};}
 restoreState(state){registerCloudProducts(state.cloudProducts);this.model.restore(state.spatial);this.roomPlan=normalizeRoomPlan(state.roomPlan)||null;this.roomPendingPlacement=!!this.roomPlan;this.architecture?.restore(state.architecture||{floor:[],walls:[],windows:[]});if(this.whiteFloor)this.whiteFloor.visible=!!state.whiteFloor&&!this.architecture?.data.floor.length;for(const x of state.items){const mesh=this.add(x.index,x.position?new THREE.Vector3(...x.position):undefined,{size:[22,23,24].includes(x.index)?undefined:x.size,seats:x.seats,silentSelect:true,cushionPreset:x.cushionPreset,lampOn:x.lampOn,fabric:x.fabric,materialStyles:x.materialStyles});mesh.userData.id=x.id;mesh.position.fromArray(x.position);if([22,23,24].includes(x.index))mesh.position.y=CATALOG[x.index].size[1]/2;mesh.rotation.y=x.rotation;mesh.material.color.set(x.color);if(x.tint)this.tintItem(mesh,x.tint);mesh.userData.attachment=x.attachment||null;mesh.userData.capacity=x.capacity||null;mesh.userData.seats=x.seats||mesh.userData.seats;mesh.userData.tableId=x.tableId||null;mesh.userData.hidden=!!x.hidden;mesh.visible=!x.hidden;if(x.rugStyle)applyRugStyle(mesh,x.rugStyle);if(x.artImage)this.setWallArtImage(x.artImage,mesh);if(isLamp(mesh.userData.index))this.initializeLamp(mesh,x.lampOn===true);}this.serial=Math.max(0,...state.items.map(x=>x.id));this.measureTool.setCorrection(this.model.correction);this.refreshAttachments();this.syncSpatial();this.select(this.items[0]||null);}
 attachInput(target,opts){target.addEventListener('pointerdown',e=>this.down(e,target),opts);target.addEventListener('pointermove',e=>this.drag(e,target),opts);target.addEventListener('pointerup',e=>this.up(e,target),opts);target.addEventListener('pointercancel',()=>this.cancelGesture(),opts);target.addEventListener('lostpointercapture',e=>{if(this.points.has(e.pointerId))this.up(e,target);},opts);}

 exportLiveState(){
  this.floorFrame.updateMatrixWorld(true);
  return {...this.exportState(),floorPose:this.floorFrame.matrixWorld.toArray()};
 }
 restoreLiveState(state){
  this.restoreState(state);
  if(Array.isArray(state.floorPose)&&state.floorPose.length===16&&state.floorPose.every(Number.isFinite)){
   new THREE.Matrix4().fromArray(state.floorPose).decompose(this.floorFrame.position,this.floorFrame.quaternion,this.floorFrame.scale);
   this.floorFrame.updateMatrixWorld(true);
  }
 }
 // A read-only monitor keeps existing GLB meshes, GPU textures and animations
 // while the sending tablet changes the layout. Rebuilding the whole Studio
 // on each position/material update would flash models and redownload assets.
 syncLiveState(state){
  if(!state||!Array.isArray(state.items))return false;
  registerCloudProducts(state.cloudProducts||[]);
  const current=new Map(this.items.map(mesh=>[mesh.userData.id,mesh]));
  for(const mesh of [...this.items]){
   const incoming=state.items.find(item=>item.id===mesh.userData.id);
   if(incoming&&!mesh.userData.loadError&&incoming.index===mesh.userData.index&&JSON.stringify(incoming.size)===JSON.stringify(mesh.userData.product.size))continue;
   this.root.remove(mesh);this.disposeObject(mesh);this.items.splice(this.items.indexOf(mesh),1);
   current.delete(mesh.userData.id);
  }
  for(const item of state.items){
   if(!Number.isInteger(item.id)||!Number.isInteger(item.index)||!Array.isArray(item.position)||item.position.length!==3||!item.position.every(Number.isFinite))continue;
   let mesh=current.get(item.id);
   if(!mesh){
    try{
     mesh=this.add(item.index,new THREE.Vector3(...item.position),{size:[22,23,24].includes(item.index)?undefined:item.size,seats:item.seats,silentSelect:true,cushionPreset:item.cushionPreset,lampOn:item.lampOn,fabric:item.fabric,materialStyles:item.materialStyles});
    }catch(error){this.onHint?.(error.message||'مدل جدید در دسترس نیست.');continue;}
    mesh.userData.id=item.id;
    current.set(item.id,mesh);
   }else{
    const oldStyles=copyMaterialStyles(mesh.userData.materialStyles),nextStyles=copyMaterialStyles(item.materialStyles);
    const oldFabric=mesh.userData.fabric;
    // An in-flight model load reads the latest styles from userData when ready.
    if(!mesh.userData.modelLoaded&&mesh.userData.imported)mesh.userData.materialStyles=nextStyles;
    else for(const role of new Set([...Object.keys(oldStyles),...Object.keys(nextStyles)])){
     if(oldStyles[role]?.source===nextStyles[role]?.source)continue;
     void this.setMaterialStyle(role,nextStyles[role]||null,mesh).catch(error=>this.onHint?.(error.message||'تکسچر دریافت نشد.'));
    }
    if(item.fabric&&oldFabric!==item.fabric)this.setSofaFabric(item.fabric,mesh,{preserveRoles:!!nextStyles.fabric});
   }
   mesh.position.fromArray(item.position);
   if(Number.isFinite(item.rotation))mesh.rotation.y=item.rotation;
   if(typeof item.color==='string')mesh.material.color.set(item.color);
   if(item.tint&&item.tint!==mesh.userData.tint)this.tintItem(mesh,item.tint);
   mesh.userData.tint=item.tint||null;
   mesh.userData.attachment=item.attachment||null;
   mesh.userData.capacity=item.capacity||null;
   mesh.userData.seats=item.seats||mesh.userData.seats;
   mesh.userData.tableId=item.tableId||null;
   mesh.userData.hidden=!!item.hidden;mesh.visible=!item.hidden;
   if(item.rugStyle&&item.rugStyle!==mesh.userData.rugStyle)applyRugStyle(mesh,item.rugStyle);
   if(item.artImage&&item.artImage!==mesh.userData.artImage)this.setWallArtImage(item.artImage,mesh);
   if(isLamp(mesh.userData.index)&&!!item.lampOn!==!!mesh.userData.lampOn)this.initializeLamp(mesh,!!item.lampOn);
  }
  this.items.sort((a,b)=>state.items.findIndex(item=>item.id===a.userData.id)-state.items.findIndex(item=>item.id===b.userData.id));
  this.serial=Math.max(0,...this.items.map(mesh=>mesh.userData.id));
  const architectureKey=JSON.stringify(state.architecture||{});
  if(this.lastLiveArchitecture!==architectureKey){this.architecture?.restore(state.architecture||{floor:[],walls:[],windows:[]});this.lastLiveArchitecture=architectureKey;}
  this.model.restore(state.spatial);
  this.measureTool.setCorrection(this.model.correction);
  this.syncSpatial();
  if(this.whiteFloor)this.whiteFloor.visible=!!state.whiteFloor&&!this.architecture?.data.floor.length;
  if(Array.isArray(state.floorPose)&&state.floorPose.length===16&&state.floorPose.every(Number.isFinite)){
   new THREE.Matrix4().fromArray(state.floorPose).decompose(this.floorFrame.position,this.floorFrame.quaternion,this.floorFrame.scale);
   this.floorFrame.updateMatrixWorld(true);
  }
  this.root.visible=true; // The monitor has no real-world depth/visibility mask.
  this.select(null);this.setGuides();
  return true;
 }
 cameraSnapshot(){
  this.floorFrame.updateMatrixWorld(true);const camera=this.activeCamera();camera.updateMatrixWorld(true);
  const position=camera.getWorldPosition(new THREE.Vector3());
  const quaternion=camera.getWorldQuaternion(new THREE.Quaternion());
  const rect=this.host.getBoundingClientRect();
  const projectionMatrix=camera.projectionMatrix.toArray();
  // XR cameras may keep the default fov/aspect properties. Their matrix is authoritative.
  const aspect=Math.abs(projectionMatrix[5]/projectionMatrix[0]);
  return {position:position.toArray(),quaternion:quaternion.toArray(),projectionMatrix,fov:camera.fov||48,zoom:camera.zoom||1,near:camera.near||.03,far:camera.far||40,aspect:Number.isFinite(aspect)?aspect:(rect.width/Math.max(1,rect.height)),wideMode:this.wideMode||'ar',timestamp:Date.now(),arActive:!!this.session,placed:this.placed,tracking:this.tracking,sceneVisible:this.root.visible,floorPose:this.floorFrame.matrixWorld.toArray()};
 }
 applyExternalCameraState(state){
  if(!state||!Array.isArray(state.position)||state.position.length!==3||!state.position.every(Number.isFinite)||!Array.isArray(state.quaternion)||state.quaternion.length!==4||!state.quaternion.every(Number.isFinite))return false;
  if(Array.isArray(state.floorPose)&&state.floorPose.length===16&&state.floorPose.every(Number.isFinite)){new THREE.Matrix4().fromArray(state.floorPose).decompose(this.floorFrame.position,this.floorFrame.quaternion,this.floorFrame.scale);this.floorFrame.updateMatrixWorld(true);}
  if(typeof state.sceneVisible==='boolean')this.root.visible=state.sceneVisible;
  this.externalCameraState=state;
  this.camera.position.fromArray(state.position);this.camera.quaternion.fromArray(state.quaternion);
  this.camera.fov=Number(state.fov)||48;this.camera.zoom=Number(state.zoom)||1;
  this.camera.near=Number(state.near)||.03;this.camera.far=Number(state.far)||40;
  const aspect=Number(state.aspect);if(Number.isFinite(aspect)&&aspect>.1&&aspect<10)this.camera.aspect=aspect;
  this.camera.updateProjectionMatrix();
  if(Array.isArray(state.projectionMatrix)&&state.projectionMatrix.length===16&&state.projectionMatrix.every(Number.isFinite)){
   this.camera.projectionMatrix.fromArray(state.projectionMatrix);
   this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }
  this.camera.updateMatrixWorld(true);return true;
 }
 // Unlike an AR capture, the laptop renders its own complete virtual scene.
 // Only tracked position and rotation are shared; no XR projection, depth mask,
 // hidden-scene bit, or tablet aspect ratio is copied to the browser.
 applyViewerCameraState(state){
  if(!state||!Array.isArray(state.position)||state.position.length!==3||!state.position.every(Number.isFinite)||!Array.isArray(state.quaternion)||state.quaternion.length!==4||!state.quaternion.every(Number.isFinite))return false;
  this.externalCameraState=null;
  if(Array.isArray(state.floorPose)&&state.floorPose.length===16&&state.floorPose.every(Number.isFinite)){
   new THREE.Matrix4().fromArray(state.floorPose).decompose(this.floorFrame.position,this.floorFrame.quaternion,this.floorFrame.scale);
   this.floorFrame.updateMatrixWorld(true);
  }
  this.camera.position.fromArray(state.position);
  this.camera.quaternion.fromArray(state.quaternion);
  this.camera.fov=72;this.camera.zoom=1;this.camera.near=.02;this.camera.far=100;
  this.camera.aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
  this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
  this.root.visible=true;
  return true;
 }

 activeCamera(){if(this.wideView?.active)return this.wideView.camera;if(this.session)return this.renderer.xr.getCamera().cameras[0]||this.renderer.xr.getCamera();return this.camera;}
 setRay(e,target){const r=target.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.floorFrame.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer,this.activeCamera());}
 pointOnFloor(e,target){this.setRay(e,target);return this.ray.ray.intersectPlane(this.model.plane,new THREE.Vector3());}
 floorLocal(point){return this.floorFrame.worldToLocal(point.clone());}
 rootLocal(point){return this.root.worldToLocal(point.clone());}
 keepOnFloor(mesh){if(mesh&&!mesh.userData.attachment&&!isWallArt(mesh.userData.index))mesh.position.y=mesh.userData.height/2;}
  collisionShape(mesh,x=mesh.position.x,z=mesh.position.z,angle=mesh.rotation.y,size=mesh.userData.product.size){
   return footprint(mesh.userData.authoredCollisionSize||size,x,z,angle);
  }
  collisionObstacles(excluded=null,ignored=[]){
   return this.items.filter(m=>m!==excluded&&!ignored.includes(m)&&m.visible&&isFloorSolid(m.userData.index))
    .map(m=>this.collisionShape(m));
  }
  linkedChairs(mesh){
    return mesh.userData.index===10?this.items.filter(item=>item.userData.tableId===mesh.userData.id&&item!==mesh):[];
   }
   
   // Skip visual AO/contact shadows only while an object is being dragged.
   setDragOcclusion(disabled){
    this.originalAo??=new WeakMap();
    for(const item of this.items)item.traverse(obj=>{
     if(obj.name==='chido-contact-shadow'){this.dragShadowMemory??=new WeakMap();if(disabled){if(!this.dragShadowMemory.has(obj))this.dragShadowMemory.set(obj,obj.visible);obj.visible=false;}else if(this.dragShadowMemory.has(obj)){obj.visible=this.dragShadowMemory.get(obj);this.dragShadowMemory.delete(obj);}return;}
     if(!obj.isMesh||item.userData.index!==22)return;
     for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
      if(!mat?.aoMap)continue;
      if(disabled){if(!this.originalAo.has(mat))this.originalAo.set(mat,mat.aoMapIntensity);mat.aoMapIntensity=0;}
      else if(this.originalAo.has(mat)){mat.aoMapIntensity=this.originalAo.get(mat);this.originalAo.delete(mat);}
     }
    });
   }
   settleObjectsAfterDrag(){
    const solids=this.items.filter(item=>item.visible&&isFloorSolid(item.userData.index));
    if(solids.length<2)return;
    const ids=new Set(solids.map(item=>item.userData.id));
    const positions=settleFootprintsBySize(solids.map(item=>({...this.collisionShape(item),id:item.userData.id,groupId:ids.has(item.userData.tableId)?item.userData.tableId:item.userData.id})));
    const byId=new Map(positions.map(item=>[item.id,item]));
    for(const item of solids){const p=byId.get(item.userData.id);if(p){item.position.x=p.x;item.position.z=p.z;}}
    this.refreshAttachments();
   }
safeObjectMotion(mesh,desired){
    if(!isFloorSolid(mesh.userData.index))return desired;
    const linked=this.linkedChairs(mesh),parts=[this.collisionShape(mesh),...linked.map(m=>this.collisionShape(m))];
    const fixed=this.collisionObstacles(mesh,linked);
    const inside=this.roomPlan?constrainFurnitureToRoom(this.roomPlan,parts,desired):desired;
    if(!inside)return {x:mesh.position.x,z:mesh.position.z};
    const solved=linked.length?moveGroupWithoutOverlap(parts,inside,fixed):moveWithoutOverlap(parts[0],inside,fixed);
    const safe=this.roomPlan?constrainFurnitureToRoom(this.roomPlan,parts,solved):solved;
    if(!safe)return {x:mesh.position.x,z:mesh.position.z};
    const dx=safe.x-mesh.position.x,dz=safe.z-mesh.position.z;
    for(const chair of linked){chair.position.x+=dx;chair.position.z+=dz;}
    return safe;
   }
   safeObjectRotation(mesh,desired){
    if(!isFloorSolid(mesh.userData.index))return desired;
    const linked=this.linkedChairs(mesh),fixed=this.collisionObstacles(mesh,linked);
    const safe=linked.length?
     rotateGroupWithoutOverlap([this.collisionShape(mesh),...linked.map(m=>this.collisionShape(m))],desired,fixed):
     rotateWithoutOverlap(this.collisionShape(mesh),desired,fixed);
    if(this.roomPlan){
     const diffPreview=safe-mesh.rotation.y,cp=Math.cos(diffPreview),sp=Math.sin(diffPreview);
     const future=[this.collisionShape(mesh,mesh.position.x,mesh.position.z,safe),
      ...linked.map(chair=>{
       const dx=chair.position.x-mesh.position.x,dz=chair.position.z-mesh.position.z;
       return this.collisionShape(chair,mesh.position.x+dx*cp+dz*sp,mesh.position.z-dx*sp+dz*cp,chair.rotation.y+diffPreview);
      })];
     const checked=constrainFurnitureToRoom(this.roomPlan,future,{x:mesh.position.x,z:mesh.position.z});
     if(!checked||Math.hypot(checked.x-mesh.position.x,checked.z-mesh.position.z)>.001)return mesh.rotation.y;
    }
    const diff=safe-mesh.rotation.y,c=Math.cos(diff),s=Math.sin(diff);
    for(const chair of linked){
     const dx=chair.position.x-mesh.position.x,dz=chair.position.z-mesh.position.z;
     chair.position.x=mesh.position.x+dx*c+dz*s;
     chair.position.z=mesh.position.z-dx*s+dz*c;
     chair.rotation.y+=diff;
    }
    return safe;
   }
   tryPlaceNew(mesh,previous=null,maxRadius=2.3){
   if(!mesh||!isFloorSolid(mesh.userData.index))return !!mesh;
   let found=null;
   if(this.roomPlan){
    const moving=this.collisionShape(mesh),blockers=this.collisionObstacles(mesh);
    const candidates=[{x:moving.x,z:moving.z}];
    const {w,d}=this.roomPlan;
    for(let x=-w/2+.2;x<=w/2-.2;x+=.42)for(let z=-d/2+.2;z<=d/2-.2;z+=.42)candidates.push({x,z});
    candidates.sort((a,b)=>Math.hypot(a.x-moving.x,a.z-moving.z)-Math.hypot(b.x-moving.x,b.z-moving.z));
    for(const goal of candidates){
     const bounded=constrainFurnitureToRoom(this.roomPlan,[moving],goal);
     if(!bounded||Math.hypot(bounded.x-goal.x,bounded.z-goal.z)>.002)continue;
     if(blockers.some(obstacle=>footprintsOverlap(this.collisionShape(mesh,bounded.x,bounded.z),obstacle)))continue;
     found=bounded;break;
    }
   }else found=nearestFreeFootprint(this.collisionShape(mesh),this.collisionObstacles(mesh),maxRadius);
   if(!found){
    this.items=this.items.filter(m=>m!==mesh);this.root.remove(mesh);this.disposeObject(mesh);
    this.select(previous&&this.items.includes(previous)?previous:(this.items[0]||null));
    this.onHint?.('اینجا فضای خالی کافی برای این مدل وجود ندارد.');
    return false;
   }
   mesh.position.x=found.x;mesh.position.z=found.z;this.refreshAttachments();return true;
  }
 hitHandle(e,target){const bounds=target.getBoundingClientRect();let best=null,distance=36;for(const h of [this.handleA,this.handleB]){const p=h.getWorldPosition(new THREE.Vector3()).project(this.activeCamera());if(p.z>1||p.z< -1)continue;const d=Math.hypot((p.x+1)*bounds.width/2+bounds.left-e.clientX,(1-p.y)*bounds.height/2+bounds.top-e.clientY);if(d<distance){distance=d;best=h.userData.handle;}}return best;}
 down(e,target){if(this.photoMode){this.onPhotoTap?.();return;}
   if(this.architecture?.mode&&this.model.locked){
    e.preventDefault();const p=this.pointOnFloor(e,target);
    if(p){
     const mode=this.architecture.mode,success=this.architecture.tap(this.rootLocal(p));
     this.onHint?.(success?(mode==='wall'?'پیش‌نمایش دیوار آماده است؛ نقطه دوم را بزن و تأیید کن.':'نقطه ثبت شد.'):'نقطه معتبر نیست یا باید به دیوار نزدیک‌تر شوی.');
    }
    return;
   }
   const archHandle=this.architecture?.pickHandle(e,target,this.activeCamera());
   if(archHandle&&this.model.locked){e.preventDefault();target.setPointerCapture(e.pointerId);this.points.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});this.gesture={kind:'arch-window',handle:archHandle};return;}
  if(this.measureTool.active&&this.model.locked&&(!this.session||this.tracking)){
   e.preventDefault();const p=this.pointOnFloor(e,target);
   if(p){const meters=this.measureTool.setPoint(this.floorLocal(p));this.onMeasure?.(meters,!!this.measureTool.a&&!this.measureTool.b);}
   return;
  }
  if(!this.model.locked||(this.session&&!this.tracking)||this.points.size>=2||(this.points.size===1&&['A','B'].includes(this.gesture?.kind)))return;e.preventDefault();target.setPointerCapture(e.pointerId);this.points.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
  if(this.points.size===1){const p=this.pointOnFloor(e,target);if(!p){this.cancelGesture();return;}
   if(this.moveLayoutMode){this.gesture={kind:'layout',offset:this.model.layoutOffset.clone().sub(this.floorLocal(p))};return;}
   if(this.selected&&isWallArt(this.selected.userData.index)&&this.hitArtHandle(e,target)){this.gesture={kind:'art-handle',offset:this.selected.position.clone().sub(this.rootLocal(p))};return;}
   const handle=this.hitHandle(e,target);if(handle){this.gesture={kind:handle,offset:this.model[handle.toLowerCase()].clone().sub(this.floorLocal(p))};return;}
   this.setRay(e,target);if(this.architecture?.pickWindow(this.ray)){this.select(null);this.gesture=null;return;}const hit=furnitureHit(this.ray,this.items.filter(x=>x.visible));if(!hit){const picked=this.architecture?.pickSurface(this.ray);this.select(null);this.gesture=null;return;}
   this.select(hit.object);
   if(isWallArt(hit.object.userData.index)){this.gesture=null;this.onHint?.('تابلو را از دستگیره سبز روی کف جابه‌جا کن.');return;}
   // Only *standing* lamps require grabbing the base; tabletop lamps move
   // like vases and can be dragged from any visible part.
   if(isLamp(hit.object.userData.index)&&![14,28].includes(hit.object.userData.index)){
    const localHit=hit.object.worldToLocal(hit.point.clone());
    if(localHit.y> -hit.object.userData.height/2+(hit.object.userData.index===29?.25:.34)){this.gesture=null;this.onHint?.('آباژور را از پایه بگیر و جابه‌جا کن.');return;}
   }
   this.gesture={kind:'object',offset:hit.object.position.clone().sub(this.rootLocal(p))};this.setDragOcclusion(true);
  }else if(this.points.size===2&&this.selected&&this.gesture?.kind==='object'){this.startTwist(target);}
 }
 twistAngle(target){const [a,b]=[...this.points.values()];if(!a||!b)return null;const dx=b.clientX-a.clientX,dy=b.clientY-a.clientY;if(Math.hypot(dx,dy)<.5)return null;return Math.atan2(-dy,dx);}
 startTwist(target){const angle=this.twistAngle(target);if(angle!==null)this.gesture={kind:'twist',start:angle,rotation:this.selected.rotation.y};}
 drag(e,target){
  if(this.architecture?.mode&&this.model.locked&&!this.photoMode){const p=this.pointOnFloor(e,target);if(p)this.architecture.hover(this.rootLocal(p));}
  if(!this.points.has(e.pointerId)||this.photoMode||(this.session&&!this.tracking))return;e.preventDefault();this.points.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});const g=this.gesture;if(!g)return;
  if(this.points.size===2&&this.selected){if(g.kind!=='twist'){this.startTwist(target);return;}const angle=this.twistAngle(target);if(angle!==null){const desired=g.rotation+wrappedAngle(angle-g.start);const delta=desired-this.selected.rotation.y,c=Math.cos(delta),ss=Math.sin(delta);for(const chair of this.linkedChairs(this.selected)){const dx=chair.position.x-this.selected.position.x,dz=chair.position.z-this.selected.position.z;chair.position.x=this.selected.position.x+dx*c+dz*ss;chair.position.z=this.selected.position.z-dx*ss+dz*c;chair.rotation.y+=delta;}this.selected.rotation.y=desired;}this.keepOnFloor(this.selected);this.refreshAttachments();return;}
  if(this.points.size!==1||g.kind==='twist')return;
   if(g.kind==='arch-window'){this.setRay(e,target);this.architecture?.dragHandle(g.handle,this.ray.ray);return;}
   const p=this.pointOnFloor(e,target);if(!p)return;
  if(g.kind==='layout'){
   this.model.layoutOffset.copy(this.floorLocal(p).add(g.offset));this.syncSpatial();return;
  }
  if((g.kind==='object'||g.kind==='art-handle')&&this.selected){const mesh=this.selected,local=this.rootLocal(p).add(g.offset);
    // Limit a single tracking update to prevent teleporting after XR tracking glitches.
    const dx=local.x-mesh.position.x,dz=local.z-mesh.position.z,dist=Math.hypot(dx,dz);
    if(!Number.isFinite(dist)||dist<.004)return;
    const step=this.session ? .28 : .65,factor=dist>step?step/dist:1;
    const desired={x:mesh.position.x+dx*factor,z:mesh.position.z+dz*factor};
    const dxMove=desired.x-mesh.position.x,dzMove=desired.z-mesh.position.z;for(const chair of this.linkedChairs(mesh)){chair.position.x+=dxMove;chair.position.z+=dzMove;}
    mesh.position.x=desired.x;mesh.position.z=desired.z;
    if([4,14,28].includes(this.selected.userData.index)){this.snapToSupport(this.selected);}else{this.keepOnFloor(this.selected);if(this.selected.userData.attachment){const link=this.selected.userData.attachment,base=this.items.find(m=>m.userData.id===link.id);if(base){const offset=this.selected.position.clone().sub(base.position).applyAxisAngle(new THREE.Vector3(0,1,0),-base.rotation.y);link.offset[0]=offset.x;link.offset[2]=offset.z;}}this.refreshAttachments();}}
  else if(g.kind==='A'){this.model.moveA(this.floorLocal(p).add(g.offset));this.syncSpatial();}
  else if(g.kind==='B'){this.model.moveB(this.floorLocal(p).add(g.offset));this.syncSpatial();}
  this.updateArtFloorHandle();this.onLiveChange?.('drag');
 }
 up(e,target){const wasMoving=['object','twist'].includes(this.gesture?.kind);this.points.delete(e.pointerId);if(this.points.size===1&&this.selected&&!this.moveLayoutMode){const remaining=[...this.points.values()][0],p=this.pointOnFloor(remaining,target);this.gesture=p&&!isWallArt(this.selected.userData.index)?{kind:'object',offset:this.selected.position.clone().sub(this.rootLocal(p))}:null;}else if(!this.points.size){if(wasMoving)this.settleObjectsAfterDrag();this.setDragOcclusion(false);this.gesture=null;this.changed();}}
 cancelGesture(){const wasMoving=['object','twist'].includes(this.gesture?.kind);this.points.clear();if(wasMoving)this.settleObjectsAfterDrag();this.setDragOcclusion(false);this.gesture=null;}
 setRoomCalibrationGuides(enabled){this.roomCalibrationGuides=!!enabled;this.setGuides();}
 setGuides(){const show=!this.photoMode;if(this.placementMarker)this.placementMarker.visible=show&&this.model.locked&&this.placementEnabled;if(this.measureTool)this.measureTool.group.visible=show&&this.model.locked&&this.measureTool.active;this.updateArtFloorHandle();this.floorNet.visible=show&&(this.model.locked||this.scanner.ready)&&!(this.roomPlan&&this.model.locked);this.ruler.visible=show&&this.model.locked&&(!this.roomPlan||this.roomCalibrationGuides);for(const m of this.items){m.userData.edges.visible=show&&!this.roomPlan&&m===this.selected;if(m.userData.label)m.userData.label.visible=false;if(m.userData.selectionHalo)m.userData.selectionHalo.visible=show&&!this.roomPlan&&m===this.selected;}}
 setPhotoMode(enabled){if(enabled&&this.wideMode!=='ar'){this.setWideView('ar');this.onWideViewReset?.();}this.cancelGesture();this.photoMode=enabled;this.setGuides();this.changed();}
 status(message){if(this.lastStatus!==message){this.lastStatus=message;this.onStatus?.(message);}}
 dropAnchor({release=true}={}){this.anchorGeneration++;if(release)for(const item of this.anchorNodes)try{item.anchor.delete();}catch{}this.anchorNodes=[];this.anchorCandidates=[];this.anchorActive=false;this.anchorRig=new AnchorStabilizer();this.needsAnchor=false;this.anchorPending=false;this.anchorState='مختصات ثابت';}
 capturePhoto(ratio='4:3'){
  if(!this.session||!this.model.locked) return Promise.reject(new InternalCaptureUnavailable('برای کپچر داخلی، ابتدا کف AR را تثبیت کن.'));
  if(!canCaptureCamera(this.session,this.cameraBinding))return Promise.reject(new InternalCaptureUnavailable('دوربین این دستگاه اجازه کپچر مستقیم داخل WebXR را نمی‌دهد. عکس خام بدون مدل ذخیره نخواهد شد.'));
  if(this.pendingPhoto)return Promise.reject(new InternalCaptureUnavailable('ثبت عکس قبلی هنوز تمام نشده است.'));
  return new Promise((resolve,reject)=>{
   const pending={resolve,reject,ratio};
   pending.timeout=setTimeout(()=>{if(this.pendingPhoto===pending){this.pendingPhoto=null;reject(new InternalCaptureUnavailable('فریم دوربین دریافت نشد؛ دوباره امتحان کن.'));}},3500);
   this.pendingPhoto=pending;
  });
 }
 async startAR(status,report,basic=false,options={},incomingSession=null){
  const session=incomingSession?await incomingSession:await requestARSession(navigator.xr,document.querySelector('#overlay'),basic,options);this.session=session;this.architecture?.setReflectionAllowed(false);this.roomPendingPlacement=!!this.roomPlan;this.onStatus=status;this.onReport=report;this.tracking=false;this.frames=0;this.fps=0;this.lastReport=performance.now();this.lastReportState='';this.lastStatus='';this.debugView.start();this.model.locked=false;this.model.heightOffset=0; // Restore saved project calibration; a new empty scene defaults to 1:1.this.anchorRig=new AnchorStabilizer();this.scanMarkers.visible=true;this.scanHits=0;this.scanDrop=null;this.scanDistance=null;this.floorNet.material.uniforms.opacity.value=.85;this.syncSpatial();this.scanner.reset();this.debugView.note('scan started');this.root.visible=false;this.floorNet.visible=false;this.ruler.visible=false;this.scene.background=null;this.status('کف را اسکن کن؛ دوربین را آرام رو به پایین حرکت بده.');
  const finish=()=>{if(this.session===session)this.endSession();};this.xrExitBinding?.dispose();this.xrExitBinding=bindXRExit(session,this.renderer.xr,finish,stage=>recordRuntime(stage,this.renderer));let stage='renderer';
  try{await this.renderer.xr.setSession(session);recordRuntime('xr-started',this.renderer);if(this.session!==session)return {hasOverlay:false,ended:true};this.cameraBinding=null;
    if(session.enabledFeatures?.includes('camera-access')&&globalThis.XRWebGLBinding){try{this.cameraBinding=new XRWebGLBinding(session,this.renderer.getContext());}catch(error){console.warn('Camera binding unavailable',error?.name||error);}}
    stage='hit-test';await this.beginScan();if(this.session!==session)return {hasOverlay:false,ended:true};this.hasOverlay=!!session.domOverlayState;this.effects.start(session,options);session.addEventListener('select',e=>{if(this.hasOverlay||!this.tracking||this.photoMode)return;if(!this.placed&&this.scanner.ready)this.confirmFloor();else this.selectAR(e);});return {hasOverlay:this.hasOverlay};}
  catch(error){try{await endXRSession(session);}catch{}throw xrError(error,stage);}
 }
 async beginScan(){const session=this.session;if(!session)return;this.roomPendingPlacement=!!this.roomPlan;if(this.wideMode!=='ar'){this.setWideView('ar');this.onWideViewReset?.();}this.whiteFloor.visible=false;this.dropAnchor();const generation=this.anchorGeneration;this.hitSource?.cancel();this.hitSource=null;for(const s of this.extraHitSources)try{s.cancel();}catch{}this.extraHitSources=[];this.revealStart=null;this.scanMarkers.visible=true;this.floorNet.material.uniforms.reveal.value=.65;this.floorNet.material.uniforms.pulse.value=1;this.scanCrosses.forEach(m=>m.visible=false);this.model.locked=false;if(this.measureTool)this.measureTool.group.visible=false;this.scanner.reset();this.root.visible=false;this.ruler.visible=false;this.floorNet.visible=false;this.floorNet.material.uniforms.opacity.value=.85;this.cancelGesture();this.status('کف را پیدا کن؛ سطح پایین‌تر معمولاً کف است. سپس «تثبیت کف» را بزن.');const viewer=await session.requestReferenceSpace('viewer');const source=await session.requestHitTestSource({space:viewer,entityTypes:['plane']});if(this.session!==session||this.anchorGeneration!==generation){if(this.session===session)source.cancel();return;}this.hitSource=source;
  // Request auxiliary directions around the center; unsupported devices retain the central reticle.
  if(globalThis.XRRigidTransform){
   const offsets=[[-.24,0],[.24,0],[0,-.24],[0,.24],[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]];
   for(const [x,y] of offsets){
    try{
     const direction=new THREE.Vector3(x,y,-1).normalize();
     const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);
     const transformed=await session.requestReferenceSpace('viewer');
     const raySpace=transformed.getOffsetReferenceSpace(new XRRigidTransform({}, {x:rotation.x,y:rotation.y,z:rotation.z,w:rotation.w}));
     const hit=await session.requestHitTestSource({space:raySpace,entityTypes:['plane']});
     if(this.session!==session||this.anchorGeneration!==generation){if(this.session===session)hit.cancel();break;}
     this.extraHitSources.push(hit);
    }catch(error){console.debug('Auxiliary WebXR hit test unavailable',error?.name||error);break;}
   }
  }}
 confirmFloor(){if(this.model.locked||!this.scanner.ready||!this.scanner.point)return false;this.model.lock(this.scanner.point);if(this.measureTool)this.measureTool.group.visible=this.measureTool.active;this.debugView.note('floor confirmed',{origin:this.model.origin.toArray()});this.model.heightOffset=0;this.syncSpatial();this.root.visible=false;this.revealStart=performance.now();this.scanMarkers.visible=false;this.setGuides();this.needsAnchor=true;this.initialFloorOrigin=this.model.origin.toArray();this.anchorCandidates=[...this.scanner.observations];this.anchorCandidates.unshift(this.scanner.point.clone());this.status(this.roomPendingPlacement?'کف ثابت شد؛ برای نمایش اتاق «قرار دادن اتاق» را بزن.':'کف ثابت شد. A و B را روی مرجع معلوم بگذار؛ سپس طول واقعی را وارد کن.');this.changed();return true;}
 updateAnchor(frame,space,time){
  if(this.needsAnchor){
   this.needsAnchor=false;
   if(frame.createAnchor&&globalThis.XRRigidTransform)this.anchorActive=true;
   else{this.anchorState='مختصات ثابت (بدون Anchors API)';this.hitSource?.cancel();this.hitSource=null;}
  }
  if(this.anchorActive&&this.hitSource&&this.anchorNodes.length+Number(this.anchorPending)<5){
   const results=frame.getHitTestResults(this.hitSource);
   const viewerPose=frame.getViewerPose(space);
   const viewer=viewerPose?.transform.position;
   const candidates=floorCandidates(results,space,viewer?new THREE.Vector3(viewer.x,viewer.y,viewer.z):null);
   for(const c of candidates){
    if(Math.abs(c.point.y-this.initialFloorOrigin[1])>.055)continue;
    if(this.anchorCandidates.every(p=>p.distanceTo(c.point)>.42))this.anchorCandidates.push(c.point.clone());
   }
  }
  if(this.anchorActive&&!this.anchorPending&&this.anchorNodes.length<5){
   const next=this.anchorCandidates.find(p=>this.anchorNodes.every(item=>item.requested.distanceTo(p)>.42));
   if(next){
    const generation=this.anchorGeneration,session=this.session;
    this.anchorPending=true;
    try{
     Promise.resolve(frame.createAnchor(new XRRigidTransform({x:next.x,y:next.y,z:next.z}),space)).then(anchor=>{
      if(this.anchorGeneration!==generation||this.session!==session){if(this.session===session)anchor.delete();return;}
      this.anchorNodes.push({anchor,requested:next.clone(),reference:null,id:this.anchorNodes.length+1});
      this.anchorPending=false;
     },()=>{if(this.anchorGeneration===generation){this.anchorPending=false;this.anchorCandidates=this.anchorCandidates.filter(p=>p!==next);}});
    }catch{this.anchorPending=false;this.anchorCandidates=this.anchorCandidates.filter(p=>p!==next);}
   }
  }
  const samples=[];
  for(const item of this.anchorNodes){
   let pose;try{pose=frame.getPose(item.anchor.anchorSpace,space);}catch{}
   if(!pose)continue;
   const pos=pose.transform.position,point=[pos.x,pos.y,pos.z];
   if(!item.reference)item.reference=[...point];
   samples.push({id:item.id,reference:item.reference,observed:point});
  }
  if(samples.length>=3){
   const elapsed=this.anchorLastTime?Math.max(.001,(time-this.anchorLastTime)/1000):.016;
   this.anchorLastTime=time;
   const state=this.anchorRig.update(samples,elapsed);
   if(state.status!=='insufficient'){
    const point=transformPoint(this.initialFloorOrigin,state.pose);
    this.model.setAnchorTranslation(new THREE.Vector3(...point),state.pose.yaw);
    this.syncSpatial();
   }
   this.anchorState=`${state.inliers.length}/${this.anchorNodes.length} نقاط · ${state.status}`;
  }else this.anchorState=`${this.anchorNodes.length}/۵ نقطه · آماده‌سازی`;
  if(this.anchorNodes.length>=5){this.hitSource?.cancel();this.hitSource=null;}
 }
 selectAR(event){if(!this.model.locked)return;const pose=event.frame.getPose(event.inputSource.targetRaySpace,this.renderer.xr.getReferenceSpace());if(!pose)return;const matrix=new THREE.Matrix4().fromArray(pose.transform.matrix);this.ray.ray.origin.setFromMatrixPosition(matrix);this.ray.ray.direction.set(0,0,-1).transformDirection(matrix);this.floorFrame.updateMatrixWorld(true);const hit=furnitureHit(this.ray,this.items);if(hit)this.select(hit.object);}
 endSession(){
  // Both the device event and the menu fallback arrive here. Never resize or
  // detach the canvas from inside Three's native sessionend event dispatch.
  if(!this.session||this.renderer.xr.isPresenting||this.sessionEndTimer!=null)return;
  recordRuntime('cleanup-queued',this.renderer);
  const session=this.session;
  this.sessionEndTimer=setTimeout(()=>{
   this.sessionEndTimer=null;
   if(this.session!==session||this.renderer.xr.isPresenting)return;
   this.finishSessionEnd();
  },0);
 }
 finishSessionEnd(){if(!this.session)return;
  recordRuntime('xr-ended',this.renderer);this.session=null;
  const clean=(label,fn)=>{try{fn();}catch(error){recordRuntimeError('cleanup-error:'+label,error);console.warn('XR cleanup: '+label,error);}};
  recordRuntime('cleanup-binding-start',this.renderer);clean('binding',()=>this.xrExitBinding?.dispose());this.xrExitBinding=null;recordRuntime('cleanup-binding-done',this.renderer);
  recordRuntime('cleanup-photo-start',this.renderer);
  clean('photo',()=>{if(this.pendingPhoto){clearTimeout(this.pendingPhoto.timeout);this.pendingPhoto.reject(new InternalCaptureUnavailable('جلسه AR بسته شد.'));this.pendingPhoto=null;}});
  recordRuntime('cleanup-photo-done',this.renderer);recordRuntime('cleanup-wide-start',this.renderer);
  this.cameraBinding=null;clean('wide view',()=>this.wideView?.disable());this.wideMode='ar';
  recordRuntime('cleanup-wide-done',this.renderer);
  // The native session is already over. Forget its handles; do not call back
  // into expired hit-test / anchor services during browser teardown.
  this.extraHitSources=[];this.hitSource=null;
  recordRuntime('cleanup-handles-forgotten',this.renderer);
  clean('anchors',()=>this.dropAnchor({release:false}));this.needsAnchor=false;this.moveLayoutMode=false;recordRuntime('cleanup-inputs-done',this.renderer);
  clean('measure',()=>this.measureTool?.setActive(false));this.setPlacementEnabled(false);
  this.model.origin.set(0,0,0);this.model.anchorYaw=0;this.model.heightOffset=0;this.model.locked=true;this.tracking=true;this.root.visible=true;this.photoMode=false;this.scanMarkers.visible=false;
  clean('spatial',()=>this.syncSpatial());clean('guides',()=>this.setGuides());clean('effects',()=>this.effects.reset());
  this.architecture?.setReflectionAllowed(true);this.floorNet.visible=false;
  this.scene.background=new THREE.Color('#eeeee3');this.camera.position.set(5.2,4.4,6);this.camera.lookAt(.6,0,-.5);
  clean('gesture',()=>this.cancelGesture());if(!this.exitToHome&&!this.renderer.xr.isPresenting)clean('resize',()=>this.resize());
  const overlay=document.querySelector('#overlay');if(overlay)overlay.hidden=true;
  recordRuntime('cleanup-scene-done',this.renderer);
  clean('end UI',()=>this.onEnd?.());clean('changed',()=>this.changed());recordRuntime('cleanup-complete',this.renderer);
 }
 frame(time,frame){
  if(this.suspended||this.exitToHome)return;
  if(this.root?.visible&&this.roomPlan?.elements.some(el=>el.type==='tv'))updateGeminiTV(time);
  for(const item of (this.items||[]))if(item.userData.loadIndeterminate&&item.userData.loadFill?.parent){
   const fill=item.userData.loadFill,h=item.userData.height,band=.16,phase=(time%1150)/1150;
   fill.scale.y=band;fill.position.y=-h/2+((phase*(1-band)+band/2)*h);fill.material.opacity=.10+.10*(.5+.5*Math.sin(time*.008));
  }
  if(!this.session&&this.host.classList.contains('ar-launch-stage')&&!this.host.classList.contains('show-preview'))return;
  if(frame&&this.session){const space=this.renderer.xr.getReferenceSpace(),pose=frame.getViewerPose(space);if(this.wideView?.active)this.wideView.updatePose(pose);this.tracking=!!pose;
   if(!pose){this.cancelGesture();this.status('ردیابی قطع شد؛ چیدمان جابجا نمی‌شود. دوربین را آرام به محیط برگردان.');}
   else if(!this.model.locked&&this.hitSource){const viewer=new THREE.Vector3(pose.transform.position.x,pose.transform.position.y,pose.transform.position.z);const centralResults=frame.getHitTestResults(this.hitSource);
     const additional=[];
     for(const source of this.extraHitSources){try{additional.push(...frame.getHitTestResults(source));}catch{}}
     const forward=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(pose.transform.orientation.x,pose.transform.orientation.y,pose.transform.orientation.z,pose.transform.orientation.w));
     const point=this.scanner.update(centralResults,additional,space,viewer,time,forward);
     this.scanHits=this.scanner.rawHits;
     this.scanCrosses.forEach((marker,i)=>{
      const c=this.scanner.currentHits[i];marker.visible=!!c;
      if(c){marker.position.copy(c.point);marker.position.y+=.009;marker.rotation.y=i*1.4;marker.material.color.setHex(c.accepted?0x83ffe3:0xff6b61);}
     });
     if(point){
      this.scanDrop=viewer.y-point.y;this.scanDistance=viewer.distanceTo(point);
      this.floorFrame.position.copy(point);this.floorFrame.rotation.set(0,0,0);
      const dist=viewer.distanceTo(point);
      const camera=this.activeCamera();const fov=camera.isPerspectiveCamera?camera.fov:48;
      const radius=THREE.MathUtils.clamp(dist*Math.tan(THREE.MathUtils.degToRad(fov/2))/3,.28,.95);
      this.floorNet.material.uniforms.reveal.value=radius;
      this.floorNet.material.uniforms.pulse.value=1;
      this.root.visible=false;this.floorNet.visible=!this.photoMode;this.ruler.visible=false;
      this.status('دایره را روی کف قرار بده و «تثبیت این کف» را بزن.');
      if(!this.hasOverlay)this.confirmFloor();
     }else{
      this.scanDrop=null;this.scanDistance=null;this.root.visible=false;this.floorNet.visible=false;
      this.status('سطحی در مرکز دید پیدا نشد؛ گوشی را آرام حرکت بده.');
     }}
   else if(this.model.locked){
     if(this.revealStart!==null){
      const t=Math.min(1,(performance.now()-this.revealStart)/750);
      const eased=1-Math.pow(1-t,3);
      this.floorNet.material.uniforms.reveal.value=.65+3.6*eased;
      this.floorNet.material.uniforms.pulse.value=1-eased;
      this.floorNet.material.uniforms.opacity.value=.85-.46*eased;
      this.root.visible=t>.68&&!this.roomPendingPlacement;
      if(t>=1){this.revealStart=null;this.floorNet.visible=false;}
     }
     this.updateAnchor(frame,space,time);if(!this.photoMode)this.status('A: جابه‌جایی مرجع و چیدمان · B: تنظیم راستا · اندازه واقعی از پنل A/B');}
   this.debugView.tick(frame,space,this,time);this.effects.update(frame,time,this.fps);this.effects.updateShadowAnchor?.(this.floorFrame.position);this.frames++;if(time-this.lastReport>=750){this.fps=Math.round(this.frames*1000/(time-this.lastReport));this.frames=0;this.lastReport=time;}
   const report={fps:this.fps,objects:this.items.length,visible:this.root.visible&&pose?this.items.length:0,placed:this.model.locked,hit:this.scanner.ready,scanHits:this.scanHits,validHits:this.scanner.validHits,inlierHits:this.scanner.inlierHits,scanDrop:this.scanDrop,scanDistance:this.scanDistance,tracking:!!pose,anchor:this.anchorState,light:this.effects.lightState,depth:this.effects.depthState,photo:this.photoMode,...this.measurement()};const state=JSON.stringify(report);if(state!==this.lastReportState){this.onReport?.(report);this.lastReportState=state;}
  }
  if(this.session&&this.model.locked){
   this.updatePlacementMarker(time);
   if(!this.roomPlan&&this.selected?.userData.edges){
    this.selected.userData.edges.material.opacity=.38+.10*Math.sin(time*.0035);
    if(this.selected.userData.selectionHalo)this.selected.userData.selectionHalo.material.opacity=.36+.14*Math.sin(time*.0028);
    if(this.selected.material?.emissive&&!isLamp(this.selected.userData.index))this.selected.material.emissiveIntensity=.13+.07*Math.sin(time*.0026);
   }
   if(time-this.lastSelectionUI>65){this.onSelectionScreen?.(this.selectionScreenPosition());this.onABPosition?.(this.rulerScreenPosition());this.lastSelectionUI=time;}
  }
  this.effects.setRealShadows?.(!!this.architecture?.data.floor.length);this.scaleLabels();this.effects.updateCameraLight?.(this.renderer.xr.isPresenting?this.renderer.xr.getCamera():this.camera,this.items.find(m=>[22,23,24,1000].includes(m.userData.index))||this.root);this.renderer.render(this.scene,this.camera);
  try{this.onFrame?.(time,frame);}catch(error){console.warn('Chido live frame callback failed',error);}
  if(this.wideView?.active&&this.tracking){
   try{this.wideView.draw();}catch(error){
    this.setWideView('ar');this.onWideViewError?.('رندر Wide View روی این مرورگر ممکن نشد: '+(error?.message||error));
   }
  }
  if(frame&&this.session&&this.pendingPhoto){
   const task=this.pendingPhoto;this.pendingPhoto=null;clearTimeout(task.timeout);
   try{Promise.resolve(captureInternalAR({session:this.session,binding:this.cameraBinding,frame,referenceSpace:this.renderer.xr.getReferenceSpace(),renderer:this.renderer,scene:this.scene,ratio:task.ratio})).then(task.resolve,task.reject);}catch(error){task.reject(error);}
  }
 }
 scaleLabels(){if(this.photoMode)return;const camera=this.activeCamera(),eye=camera.getWorldPosition(new THREE.Vector3()),height=this.session?document.querySelector('#arSurface').clientHeight:this.host.clientHeight;
  const labels=[this.rulerLabel,this.handleA.children[0],this.handleB.children[0]];
  for(const label of labels){if(!label.visible||!label.material.map)continue;const distance=eye.distanceTo(label.getWorldPosition(new THREE.Vector3())),pixels=label===this.selected?.userData.label?34:label===this.rulerLabel?32:label.parent===this.handleA||label.parent===this.handleB?34:24;
   const parentScale=label.parent.getWorldScale(new THREE.Vector3()),worldHeight=2*distance*pixels/(Math.max(height,1)*camera.projectionMatrix.elements[5]);const image=label.material.map.image;label.scale.set(worldHeight*(image.width/image.height)/parentScale.x,worldHeight/parentScale.y,1);
  }
 }
 async snapshot(){if(this.session)throw Error('در AR از اسکرین‌شات گوشی استفاده کن.');const before=this.photoMode;this.setPhotoMode(true);this.effects.updateCameraLight?.(this.renderer.xr.isPresenting?this.renderer.xr.getCamera():this.camera,this.items.find(m=>[22,23,24,1000].includes(m.userData.index))||this.root);this.renderer.render(this.scene,this.camera);try{return await new Promise((resolve,reject)=>this.renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(Error('ثبت نشد')),'image/webp',.82));}finally{this.setPhotoMode(before);}}
 suspend(){recordRuntime('renderer-suspended',this.renderer);this.suspended=true;this.renderer.setAnimationLoop(null);this.resizeObserver.disconnect();this.events.abort();this.renderer.domElement.remove();}
 resume(host){this.exitToHome=false;this.host=host;host.prepend(this.renderer.domElement);this.events=new AbortController();const opts={signal:this.events.signal};this.attachInput(host,opts);const surface=document.querySelector('#arSurface');if(surface)this.attachInput(surface,opts);this.resizeObserver.observe(host);this.suspended=false;this.resize();recordRuntime('renderer-resumed',this.renderer);if(!this.contextLost)this.renderer.setAnimationLoop((time,frame)=>this.frame(time,frame));}
 pause(){clearTimeout(this.sessionEndTimer);this.sessionEndTimer=null;this.suspended=true;this.renderer.setAnimationLoop(null);this.resizeObserver.disconnect();this.events.abort();this.xrExitBinding?.dispose();for(const item of this.items)item.traverse(node=>node.userData.disposed=true);this.renderer.domElement.remove();}
 destroy(){if(this.roomGeometryTimer!==null)clearTimeout(this.roomGeometryTimer);this.roomGeometryTimer=null;this.pause();this.effects?.dispose();this.architecture?.dispose();this.wideView?.dispose();this.wideView=null;this.resizeObserver.disconnect();this.events.abort();this.renderer.setAnimationLoop(null);this.dropAnchor();this.clear();this.disposeObject(this.ruler);this.disposeObject(this.artFloorHandle);this.scanCrosses[0]?.geometry.dispose();for(const m of this.scanCrosses)m.material.dispose();this.debugView.dispose();this.measureTool?.dispose();this.placementMarker.geometry.dispose();this.placementMarker.material.dispose();this.floorNet.geometry.dispose();this.floorNet.material.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}


