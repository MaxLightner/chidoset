import {runtimeHealth} from './runtime-health.js?v=0.16.1';
const report=runtimeHealth(),text=JSON.stringify(report,null,2);
const field=document.querySelector('#reportText'),status=document.querySelector('#reportStatus');
field.value=text;
status.textContent=report.runs.length?'گزارش آماده است. آن را کپی کن و در همین چت بفرست.':'هنوز گزارشی ثبت نشده؛ نسخهٔ جدید اپ را در همین مرورگر باز کن و مشکل را تکرار کن.';
document.querySelector('#copyReport').onclick=async()=>{try{await navigator.clipboard.writeText(text);status.textContent='گزارش کپی شد.';}catch{field.focus();field.select();status.textContent='کپی خودکار ممکن نشد؛ متن را انتخاب و کپی کن، یا گزارش را دانلود کن.';}};
document.querySelector('#downloadReport').onclick=()=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='chido-exit-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
