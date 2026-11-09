// Chido native still-photo composition from WebXR Raw Camera Access.
// No screen sharing or OS screenshot. Access is available only with "camera-access".
import * as THREE from './vendor/three.module.js';
import {cropRect,CAMERA_RATIOS} from './camera-capture.js';

export class InternalCaptureUnavailable extends Error {
 constructor(message){super(message);this.name='InternalCaptureUnavailable';}
}
export function canCaptureCamera(session,binding){
 return !!session?.enabledFeatures?.includes('camera-access')&&typeof binding?.getCameraImage==='function';
}
export function rowsTopDown(bottomUp,width,height){
 const result=new Uint8ClampedArray(bottomUp.length),stride=width*4;
 for(let y=0;y<height;y++)result.set(bottomUp.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
 return result;
}
function pixelsToCanvas(pixels,width,height){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:true});
 if(!ctx)throw new InternalCaptureUnavailable('مرورگر قابلیت ترکیب تصویر را ندارد.');
 ctx.putImageData(new ImageData(rowsTopDown(pixels,width,height),width,height),0,0);
 return canvas;
}
export function readCameraPixels(renderer,binding,view){
 const gl=renderer.getContext(),camera=view?.camera;
 if(!camera?.width||!camera?.height)throw new InternalCaptureUnavailable('دادهٔ تصویر واقعی دوربین در این فریم موجود نیست.');
 const texture=binding.getCameraImage(camera);
 if(!texture)throw new InternalCaptureUnavailable('فریم دوربین در اختیار برنامه قرار نگرفت.');
 const width=camera.width,height=camera.height;
 if(width>4096||height>4096||width<16||height<16)throw new InternalCaptureUnavailable('ابعاد تصویر دوربین نامعتبر است.');
 const framebuffer=gl.createFramebuffer(),previous=gl.getParameter(gl.FRAMEBUFFER_BINDING);
 if(!framebuffer)throw new InternalCaptureUnavailable('حافظهٔ گرافیکی برای تصویر کافی نیست.');
 try{
  gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
   throw new InternalCaptureUnavailable('دسترسی مستقیم به پیکسل‌های دوربین در این دستگاه محدود شده است.');
  const pixels=new Uint8Array(width*height*4);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  if(gl.getError()!==gl.NO_ERROR)throw new InternalCaptureUnavailable('خواندن تصویر دوربین توسط درایور دستگاه رد شد.');
  // Some drivers return an all-black placeholder before the first authorised camera frame.
  let valid=false;
  for(let i=0;i<pixels.length;i+=Math.max(4,Math.floor(pixels.length/2048/4)*4)){
   if(pixels[i]+pixels[i+1]+pixels[i+2]>8){valid=true;break;}
  }
  if(!valid)throw new InternalCaptureUnavailable('دوربین فریم تصویری معتبر نداد؛ چند لحظه بعد دوباره امتحان کن.');
  return {width,height,pixels};
 }finally{
  gl.bindFramebuffer(gl.FRAMEBUFFER,previous);
  gl.deleteFramebuffer(framebuffer);
  renderer.resetState();
 }
}
export function renderObjectPixels(renderer,scene,view,width,height){
 const target=new THREE.WebGLRenderTarget(width,height,{
  format:THREE.RGBAFormat,type:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false
 });
 const camera=new THREE.PerspectiveCamera();
 camera.matrixAutoUpdate=false;
 camera.matrix.fromArray(view.transform.matrix);
 camera.matrixWorld.copy(camera.matrix);
 camera.matrixWorldInverse.copy(camera.matrix).invert();
 camera.projectionMatrix.fromArray(view.projectionMatrix);
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 const savedTarget=renderer.getRenderTarget();
 const oldXR=renderer.xr.enabled,oldBackground=scene.background;
 const oldColor=renderer.getClearColor(new THREE.Color()).clone(),oldAlpha=renderer.getClearAlpha();
 const pixels=new Uint8Array(width*height*4);
 try{
  renderer.xr.enabled=false;scene.background=null;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000,0);
  renderer.clear(true,true,true);
  renderer.render(scene,camera);
  renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  return pixels;
 }finally{
  renderer.setRenderTarget(savedTarget);
  renderer.setClearColor(oldColor,oldAlpha);
  scene.background=oldBackground;
  renderer.xr.enabled=oldXR;
  target.dispose();
 }
}
function toJpegBlob(canvas){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new InternalCaptureUnavailable('رمزگذاری عکس انجام نشد.')),'image/jpeg',.9));
}
// Must be invoked synchronously inside the active XR animation frame.
// Only JPEG encoding may continue asynchronously after the frame.
export function captureInternalAR({session,binding,frame,referenceSpace,renderer,scene,ratio='4:3'}){
 if(!CAMERA_RATIOS[ratio])throw new InternalCaptureUnavailable('نسبت تصویر نامعتبر است.');
 if(!canCaptureCamera(session,binding))throw new InternalCaptureUnavailable('کپچر داخلی دوربین در این مرورگر فعال نیست. از Chrome سازگار با WebXR Raw Camera Access استفاده کن.');
 const pose=frame.getViewerPose(referenceSpace);
 const view=pose?.views?.find(v=>v.camera);
 if(!view)throw new InternalCaptureUnavailable('دوربین واقعی برای این فریم AR در دسترس نیست.');
 const {width,height,pixels}=readCameraPixels(renderer,binding,view);
 const maxWidth=1440,renderScale=Math.min(1,maxWidth/width);
 const rw=Math.max(1,Math.round(width*renderScale)),rh=Math.max(1,Math.round(height*renderScale));
 const overlay=renderObjectPixels(renderer,scene,view,rw,rh);
 const backgroundCanvas=pixelsToCanvas(pixels,width,height);
 const overlayCanvas=pixelsToCanvas(overlay,rw,rh);
 const region=cropRect(width,height,CAMERA_RATIOS[ratio]);
 const outputWidth=Math.min(1440,Math.max(1,Math.round(region.sw)));
 const outputHeight=Math.max(1,Math.round(outputWidth/CAMERA_RATIOS[ratio]));
 const output=document.createElement('canvas');output.width=outputWidth;output.height=outputHeight;
 const ctx=output.getContext('2d',{alpha:false});
 if(!ctx)throw new InternalCaptureUnavailable('ساخت عکس در مرورگر ممکن نشد.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,outputWidth,outputHeight);
 ctx.drawImage(backgroundCanvas,region.sx,region.sy,region.sw,region.sh,0,0,outputWidth,outputHeight);
 ctx.drawImage(overlayCanvas,region.sx*renderScale,region.sy*renderScale,region.sw*renderScale,region.sh*renderScale,0,0,outputWidth,outputHeight);
 return toJpegBlob(output);
}
