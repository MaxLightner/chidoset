import {CATALOG} from './spatial.js?v=0.6.0';
const categoryByIndex=index=>[0,1,3,22,23,24].includes(index)?'seating':[2,12,13,25,26,27].includes(index)?'low-tables':[10,11].includes(index)?'dining':index===9?'workspace':index===8?'bedroom':[7,31].includes(index)?'rugs':index>=16&&index<=21?'wall-art':'decor';
export const RUG_SIZE_PRESETS=Object.freeze([
 {id:'170x240',label:'۱.۷ × ۲.۴ متر',size:[2.4,.015,1.7]},
 {id:'150x200',label:'۱.۵ × ۲ متر',size:[2,.015,1.5]},
 {id:'200x300',label:'۲ × ۳ متر',size:[3,.015,2]},
 {id:'250x350',label:'۲.۵ × ۳.۵ متر',size:[3.5,.015,2.5]},
 {id:'300x400',label:'۳ × ۴ متر',size:[4,.015,3]}
]);
export const ASSET_CATEGORIES=Object.freeze([
 {id:'seating',label:'مبل و نشیمن',indexes:[1,0,3,24,23,22]},
 {id:'low-tables',label:'میز جلو مبلی و عسلی',indexes:[2,12,13,25,26,27]},
 {id:'dining',label:'میز ناهارخوری و صندلی',indexes:[10,11]},
 {id:'workspace',label:'میز کار و مطالعه',indexes:[9]},
 {id:'bedroom',label:'تخت خواب',indexes:[8]},
 {id:'decor',label:'آباژور و دکور',indexes:[4,6,14,15,28,29,30,5]},
 {id:'rugs',label:'فرش',indexes:[7,31]},
 {id:'wall-art',label:'تابلو و دیوارکوب',indexes:[16,17,18,19,20,21]}
]);
export function assetMetadata(index,size=CATALOG[index]?.size){
 if(!size)throw RangeError('Unknown asset');
 const category=categoryByIndex(index);
 const tables=[2,9,10,12,13,25,26,27],sofas=[0,1,3];
 const surfaces=tables.includes(index)?[{name:'tabletop',kind:'horizontal',height:size[1],width:size[0]*.84,depth:size[2]*.84}]:
 sofas.includes(index)?[{name:'sofa-seat',kind:'seat',height:.48,width:size[0]-.2,depth:.37,backAngle:80}]:[];
 return {
  index,category,variantGroup:sofas.includes(index)?'sofa':tables.includes(index)?'table':
   [6,14,15,28,29].includes(index)?'lamp':index>=16&&index<=21?'art':index===31?'rug':'decor',
  collision:{kind:'box',size:[...size]},
  footprint2D:{shape:[7,31].includes(index)?'rug':index>=16&&index<=21?'wall-rect':'rect',width:size[0],depth:size[2]},
  placement:index>=16&&index<=21?'virtual-wall':index===5?'sofa':'floor',
  supportSurfaces:surfaces,
  features:{seats:sofas.includes(index),cushions:sofas.includes(index),
   capacity:index===10,power:[6,14,15,28,29].includes(index),material:true,
   variants:category==='seating'||tables.includes(index)||[6,14,15,28,29].includes(index)||category==='rugs'||(index>=16&&index<=21)}
 };
}
export const isLamp=index=>[6,14,15,28,29].includes(index);
export const isRug=index=>index===7||index===31;
export const isSofa=index=>[0,1,3].includes(index);
export const isTable=index=>[2,9,10,12,13,25,26,27].includes(index);
export const isWallArt=index=>index>=16&&index<=21;
export function categoryForIndex(index){return ASSET_CATEGORIES.find(c=>c.indexes.includes(index))?.id||'decor';}
export function variantsFor(index){const category=categoryForIndex(index);if(category==='seating')return [1,0,3,24,23,22];if(category==='low-tables')return [2,12,13,25,26,27];if(category==='dining')return index===10?[10]:[10,11];if(isLamp(index))return [6,14,15,28,29];if(isRug(index))return [7,31];if(isWallArt(index))return [16,17,18,19,20,21];return [index];}
