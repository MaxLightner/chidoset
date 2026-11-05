// One module identity shared by the versioned Three.js/application modules.
const products=new Map();
const catalogInfo=new Map();
export const getCloudProduct=index=>products.get(index);
export const getCloudProductInfo=index=>catalogInfo.get(index);
export const cloudProductInfoList=()=>[...catalogInfo.values()];
export const cloudProductList=()=>[...products.values()];
export function registerCloudProducts(records=[]){
 for(const p of records){
  const index=p.catalog_index;
  if(!Number.isInteger(index)||index<0||index>99)continue;
  if(typeof p.name!=='string'||!Array.isArray(p.size_m)||p.size_m.length!==3||!p.size_m.every(n=>Number.isFinite(n)&&n>=.005&&n<=20))continue;
  let thumbnail='';try{const thumb=new URL(p.thumbnail_url);if(thumb.protocol==='https:'&&thumb.hostname==='zeeztpblibcqtxompvxa.supabase.co'&&thumb.pathname.startsWith('/storage/v1/object/sign/chido-assets/images/'))thumbnail=thumb.href;}catch{}
  const category=['seating','low-tables','dining','workspace','bedroom','decor','rugs','wall-art'].includes(p.metadata?.category)?p.metadata.category:null;
  catalogInfo.set(index,{catalog_index:index,name:p.name.slice(0,160),thumbnail_url:thumbnail,metadata:{category}});
  if(index<32)continue;
  let url;try{url=new URL(p.asset_url);}catch{continue;}
  if(url.protocol!=='https:'||url.hostname!=='zeeztpblibcqtxompvxa.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/chido-assets/models/'))continue;
  const prior=products.get(index);if(prior&&Number(prior.signed_at)>Number(p.signed_at))continue;
  const signedAt=Number(p.signed_at);
  products.set(index,{catalog_index:index,name:p.name.slice(0,160),size_m:[...p.size_m],asset_url:url.href,asset_path:p.asset_path,thumbnail_url:thumbnail,metadata:{category:category||'decor'},signed_at:Number.isFinite(signedAt)&&signedAt<=Date.now()+60000?signedAt:Date.now()});
 }
}
