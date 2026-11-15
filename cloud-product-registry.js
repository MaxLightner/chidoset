// One module identity shared by the versioned Three.js/application modules.
const products=new Map();
const catalogInfo=new Map();
export const getCloudProduct=index=>products.get(index);
export const getCloudProductInfo=index=>catalogInfo.get(index);
export const cloudProductInfoList=()=>[...catalogInfo.values()];
export const cloudProductList=()=>[...products.values()];
const validSize=size=>Array.isArray(size)&&size.length===3&&size.every(n=>Number.isFinite(n)&&n>=.005&&n<=20);
function safeMetadata(value){
 const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const categories=['seating','low-tables','dining','workspace','bedroom','decor','rugs','wall-art'];
 const category=categories.includes(raw.category)?raw.category:'decor';
 const placement=['floor','tabletop','wall','virtual-wall','ceiling','none'].includes(raw.placement)?raw.placement:null;
 const collision=raw.collision&&typeof raw.collision==='object'?{
  ...(typeof raw.collision.floorSolid==='boolean'?{floorSolid:raw.collision.floorSolid}:{})
 }:{};
 const features=raw.features&&typeof raw.features==='object'?{...raw.features}:{};
 const kind=typeof raw.kind==='string'?raw.kind.slice(0,48):typeof raw.role==='string'?raw.role.slice(0,48):null;
 return {...raw,category,...(placement?{placement}:{}),...(Object.keys(collision).length?{collision}:{}),...(kind?{kind}:{}),...(Object.keys(features).length?{features}:{})};
}
export function registerCloudProducts(records=[]){
 for(const p of records){
  const index=p.catalog_index;
  if(!Number.isInteger(index)||index<0||index>99||typeof p.name!=='string')continue;
  const size=validSize(p.size_m)?[...p.size_m]:[1,1,1];
  let thumbnail='';try{const thumb=new URL(p.thumbnail_url);if(thumb.protocol==='https:'&&thumb.hostname==='zeeztpblibcqtxompvxa.supabase.co'&&thumb.pathname.startsWith('/storage/v1/object/sign/chido-assets/images/'))thumbnail=thumb.href;}catch{}
  const metadata=safeMetadata(p.metadata);
  catalogInfo.set(index,{catalog_index:index,name:p.name.slice(0,160),size_m:size,thumbnail_url:thumbnail,metadata});
  if(index<32)continue;
  let url;try{url=new URL(p.asset_url);}catch{continue;}
  if(url.protocol!=='https:'||url.hostname!=='zeeztpblibcqtxompvxa.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/chido-assets/models/'))continue;
  const prior=products.get(index);if(prior&&Number(prior.signed_at)>Number(p.signed_at))continue;
  const signedAt=Number(p.signed_at);
  products.set(index,{catalog_index:index,name:p.name.slice(0,160),size_m:size,asset_url:url.href,asset_path:p.asset_path,thumbnail_url:thumbnail,metadata,signed_at:Number.isFinite(signedAt)&&signedAt<=Date.now()+60000?signedAt:Date.now()});
 }
}
