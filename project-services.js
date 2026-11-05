// Storage adapter boundary for free/local and future authenticated/cloud plans.
import {saveCustomLayout,listCustomLayouts,removeCustomLayout} from './layout-storage.js';
export const PRODUCT_EDITION='free';
export const FEATURES=Object.freeze({
 free:{localProjects:true,photoGallery:true,templates:true,customCatalog:false,branding:false,cloudSave:false},
 business:{localProjects:true,photoGallery:true,templates:true,customCatalog:true,branding:true,cloudSave:true}
});
export const BRAND=Object.freeze({name:'TOLICA',logo:null,theme:null});
export const localProjectService=Object.freeze({
 list:()=>listCustomLayouts(),
 save:data=>saveCustomLayout(data),
 remove:id=>removeCustomLayout(id),
 get:id=>listCustomLayouts().find(x=>x.id===id)||null
});
export function packProject(record){
 if(!record?.scene||!Array.isArray(record.scene.items)||!record.scene.spatial)throw Error('چیدمان قابل ذخیره نیست.');
 return JSON.stringify({format:'tolica-layout',version:1,exportedAt:new Date().toISOString(),project:{name:record.name||'چیدمان من',scene:record.scene,room:record.room,layout:record.layout,capacity:record.capacity,style:record.style,theme:record.theme}},null,2);
}
export function unpackProject(json){
 if(typeof json!=='string'||json.length>1200000)throw Error('فایل چیدمان بیش از حد بزرگ است.');
 let data;try{data=JSON.parse(json);}catch{throw Error('فایل JSON معتبر نیست.');}
 if(data?.format!=='tolica-layout'||data.version!==1)throw Error('این فایل مربوط به چیدمان تولیکا نیست.');
 const x=data.project;
 if(!x||typeof x!=='object'||!Array.isArray(x.scene?.items)||x.scene.items.length>64||!x.scene.spatial||typeof x.scene.spatial!=='object')throw Error('اطلاعات چیدمان ناقص است.');
 for(const item of x.scene.items){
  if(!Number.isInteger(item.index)||item.index<0||item.index>99||!Array.isArray(item.position)||item.position.length!==3||!item.position.every(Number.isFinite))throw Error('موقعیت یک آبجکت نامعتبر است.');
  if(!Number.isFinite(item.rotation))throw Error('چرخش یک آبجکت نامعتبر است.');
 }
 return {name:String(x.name||'چیدمان واردشده').slice(0,70),scene:x.scene,room:x.room||'پذیرایی',layout:x.layout||'conversation',capacity:x.capacity||5,style:x.style||'مینیمال',theme:Number.isInteger(x.theme)?x.theme:0};
}
