// Camera aspect-ratio and gallery metadata shared by native WebXR capture.
// This file intentionally contains no screen-share or screenshot functionality.
export function cropRect(width,height,ratio){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isFinite(ratio)||ratio<=0)throw RangeError('invalid camera dimensions');
 const sourceRatio=width/height;
 if(sourceRatio>ratio){const w=height*ratio;return {sx:(width-w)/2,sy:0,sw:w,sh:height};}
 const h=width/ratio;return {sx:0,sy:(height-h)/2,sw:width,sh:h};
}
export const CAMERA_PHOTO_KIND='chido-camera';
export const isCameraPhoto=photo=>photo?.kind===CAMERA_PHOTO_KIND;
export const CAMERA_RATIOS=Object.freeze({'9:16':9/16,'3:4':3/4,'1:1':1,'4:3':4/3,'16:9':16/9});

/** Match a selected photo ratio to the physical orientation of the viewport.
 * A portrait tablet gets 9:16 from the 16:9 option and 3:4 from 4:3.
 * The image is still center-cropped at the chosen output ratio.
 */
export function effectiveCameraRatio(choice,width,height){
 const allowed=Object.hasOwn(CAMERA_RATIOS,choice)?choice:'4:3';
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return allowed;
 if(width===height)return allowed;
 const [w,h]=allowed.split(':').map(Number);
 if((width<height&&w>h)||(width>height&&w<h))return h+':'+w;
 return allowed;
}
