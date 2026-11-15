import {CATALOG} from './catalog-data.js?v=0.19.0';
import {getCloudProduct,cloudProductList} from './cloud-product-registry.js';
export const SHEEN_CHAIR_SAMPLE=Object.freeze({name:'صندلی شین (SheenChair)',size:Object.freeze([.85,.9,.85]),price:0});
const categoryByIndex=index=>[0,1,3,22,23,24,32,1000].includes(index)?'seating':[2,12,13,25,26,27].includes(index)?'low-tables':[10,11].includes(index)?'dining':index===9?'workspace':index===8?'bedroom':[7,31].includes(index)?'rugs':index>=16&&index<=21?'wall-art':'decor';
export const RUG_SIZE_PRESETS=Object.freeze([
 {id:'170x240',label:'۱.۷ × ۲.۴ متر',size:[2.4,.015,1.7]},
 {id:'150x200',label:'۱.۵ × ۲ متر',size:[2,.015,1.5]},
 {id:'200x300',label:'۲ × ۳ متر',size:[3,.015,2]},
 {id:'250x350',label:'۲.۵ × ۳.۵ متر',size:[3.5,.015,2.5]},
 {id:'300x400',label:'۳ × ۴ متر',size:[4,.015,3]}
]);
export const ASSET_CATEGORIES=Object.freeze([
 {id:'seating',label:'مبل و نشیمن',indexes:[1,0,3,24,23,22,32,1000]},
 {id:'low-tables',label:'میز جلو مبلی و عسلی',indexes:[2,12,13,25,26,27]},
 {id:'dining',label:'میز ناهارخوری و صندلی',indexes:[10,11]},
 {id:'workspace',label:'میز کار و مطالعه',indexes:[9]},
 {id:'bedroom',label:'تخت خواب',indexes:[8]},
 {id:'decor',label:'آباژور و دکور',indexes:[4,6,14,15,28,29,30,5]},
 {id:'rugs',label:'فرش',indexes:[7,31]},
 {id:'wall-art',label:'تابلو و دیوارکوب',indexes:[16,17,18,19,20,21]}
]);
const tableIndexes=[2,9,10,12,13,25,26,27],sofaIndexes=[0,1,3];
export function assetMetadata(index,size=getCloudProduct(index)?.size_m||(index===1000?SHEEN_CHAIR_SAMPLE.size:CATALOG[index]?.size),sourceMetadata=getCloudProduct(index)?.metadata,collisionBounds=null){
 if(!Array.isArray(size)||size.length!==3||!size.every(n=>Number.isFinite(n)&&n>0))throw RangeError('Unknown asset');
 const product=getCloudProduct(index),dynamic=!!product,meta=sourceMetadata&&typeof sourceMetadata==='object'?sourceMetadata:{};
 const category=meta.category||categoryByIndex(index);
 const explicitFloor=typeof meta.collision?.floorSolid==='boolean'?meta.collision.floorSolid:null;
 const placementOverride=meta.placement;
 let inferredFloor;
 if(dynamic){
  if(explicitFloor!==null)inferredFloor=explicitFloor;
  else if(['tabletop','wall','virtual-wall','ceiling','none'].includes(placementOverride))inferredFloor=false;
  else if(placementOverride==='floor')inferredFloor=true;
  else if(['seating','low-tables','dining','workspace','bedroom'].includes(category))inferredFloor=true;
  else if(category==='rugs'||category==='wall-art')inferredFloor=false;
  else inferredFloor=size[1]>=.8;
 }
 const placement=placementOverride||(dynamic?(inferredFloor?'floor':'tabletop'):
  index>=16&&index<=21?'virtual-wall':index===5?'sofa':'floor');
 const surfaces=tableIndexes.includes(index)?[{name:'tabletop',kind:'horizontal',height:size[1],width:size[0]*.84,depth:size[2]*.84}]:
  sofaIndexes.includes(index)?[{name:'sofa-seat',kind:'seat',height:.48,width:size[0]-.2,depth:.37,backAngle:80}]:[];
 const collisionSize=collisionBounds?.size||size,collisionCenter=collisionBounds?.center||[0,0,0];
 const kind=meta.kind||meta.role||null;
 return {
  index,dynamic,category,kind,
  variantGroup:kind|| (sofaIndexes.includes(index)?'sofa':tableIndexes.includes(index)?'table':
   [6,14,15,28,29].includes(index)?'lamp':index>=16&&index<=21?'art':index===31?'rug':category),
  collision:{kind:collisionBounds?'authored-box':'bounds',size:[...collisionSize],center:[...collisionCenter],
   ...(inferredFloor!==undefined?{floorSolid:inferredFloor}:{})},
  footprint2D:{shape:category==='rugs'?'rug':category==='wall-art'?'wall-rect':'rect',width:size[0],depth:size[2]},
  placement,supportSurfaces:surfaces,
  features:{seats:sofaIndexes.includes(index),cushions:sofaIndexes.includes(index),
   capacity:index===10,power:[6,14,15,28,29].includes(index)||meta.features?.power===true,
   material:true,variants:category==='seating'||tableIndexes.includes(index)||[6,14,15,28,29].includes(index)||category==='rugs'||category==='wall-art',
   ...(meta.features||{})}
 };
}
export const isLamp=(index,asset=null)=>[6,14,15,28,29].includes(index)||asset?.kind==='lamp'||asset?.features?.power===true;
export const isRug=(index,asset=null)=>index===7||index===31||asset?.category==='rugs';
export const isSofa=(index,asset=null)=>[0,1,3].includes(index)||asset?.kind==='sofa';
export const isTable=(index,asset=null)=>tableIndexes.includes(index)||asset?.kind==='table'||['low-tables','dining','workspace'].includes(asset?.category);
export const isWallArt=(index,asset=null)=>index>=16&&index<=21||asset?.category==='wall-art';
export function categoryForIndex(index){return getCloudProduct(index)?.metadata.category||ASSET_CATEGORIES.find(c=>c.indexes.includes(index))?.id||'decor';}
export function variantsFor(index){const category=categoryForIndex(index);if(getCloudProduct(index))return cloudProductList().filter(p=>p.metadata.category===category).map(p=>p.catalog_index);if(category==='seating')return [1,0,3,24,23,22,32,1000];if(category==='low-tables')return [2,12,13,25,26,27];if(category==='dining')return index===10?[10]:[10,11];if(isLamp(index))return [6,14,15,28,29];if(isRug(index))return [7,31];if(isWallArt(index))return [16,17,18,19,20,21];return [index];}
