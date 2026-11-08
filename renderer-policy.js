export function rendererPolicy({coarse=false,pixelRatio=1}={}){
 return {antialias:!coarse,preserveDrawingBuffer:false,pixelRatio:Math.min(pixelRatio,coarse?1:1.5),xrScale:coarse?.75:1};
}
