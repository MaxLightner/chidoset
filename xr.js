export function xrError(error,stage){
 const failure=new Error(error?.message||String(error),{cause:error});
 failure.name=error?.name||'Error';failure.xrStage=stage;return failure;
}
export async function requestARSession(xr,root,basic=false,effects={}){
 if(!xr)throw xrError(new Error('navigator.xr is unavailable'),'availability');
 try{return await xr.requestSession('immersive-ar',{
  requiredFeatures:['hit-test','dom-overlay'],
  optionalFeatures:['anchors','plane-detection','camera-access',...(effects.light?['light-estimation']:[]),...(effects.depth?['depth-sensing']:[])],
  ...(effects.depth?{depthSensing:{usagePreference:['gpu-optimized'],dataFormatPreference:['float32','luminance-alpha']}}:{}),domOverlay:{root}
 });}catch(error){throw xrError(error,'request-session');}
}
export function explainXR(error){
 const stage=error?.xrStage||'unknown';
 let message='راه‌اندازی AR کامل نشد. جزئیات زیر علت گزارش‌شدهٔ مرورگر را نشان می‌دهد.';
 if(stage==='availability')message='این مرورگر API واقعیت افزوده را در اختیار صفحه نمی‌گذارد.';
 else if(error.name==='NotAllowedError'||error.name==='SecurityError')message='مرورگر اجازهٔ شروع AR را نداد؛ مجوز دوربین، دسترسی حرکت و بازشدن صفحه در تب اصلی Chrome را بررسی کن.';
 else if(error.name==='NotSupportedError'&&stage==='request-session')message='این دستگاه قابلیت WebXR، شناسایی کف و نمایش کنترل‌ها روی تصویر AR (DOM Overlay) را هم‌زمان پشتیبانی نکرد؛ Chrome و ARCore را بررسی کن.';
 else if(stage==='overlay')message='نشست AR ایجاد شد اما پنل کنترل دوربین قابل نمایش نیست؛ به همین دلیل نشست متوقف شد.';
 else if(stage==='renderer')message='جلسهٔ AR ایجاد شد، اما اتصال گرافیک سه‌بعدی به آن شکست خورد.';
 else if(stage==='hit-test')message='جلسهٔ AR ایجاد شد، اما تشخیص سطح راه‌اندازی نشد.';
 else if(error.name==='InvalidStateError')message='مرورگر وضعیت فعلی صفحه یا یک جلسهٔ باز دیگر را مانع شروع AR دانست. جلسهٔ قبلی را ببند و دوباره امتحان کن.';
 return {stage,message,name:error?.name||'Error',detail:error?.message||String(error)};
}
