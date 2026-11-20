// Unified legacy + v3 product and material registry. Product identity is database catalog_index/product_code.
import { ASSET_BASE_URL } from './backend-config.js';

const products = new Map();
const productsByCode = new Map();
const catalogInfo = new Map();
const materialFamilies = new Map();
const materialSwatches = new Map();
const syncManifest = new Map();
let unifiedCatalogLoaded = false;
const categories = ['seating','low-tables','dining','workspace','bedroom','decor','rugs','wall-art'];
export const getCloudProduct = key => products.get(key) || productsByCode.get(key);
export const getCloudProductByCode = code => productsByCode.get(code);
export const getCloudProductInfo = index => catalogInfo.get(index);
export const cloudProductInfoList = () => [...catalogInfo.values()];
export const cloudProductList = () => [...products.values()];
export const cloudProductsByCodeList = () => [...productsByCode.values()];
export const getCloudMaterialFamily = code => materialFamilies.get(code);
export const getCloudMaterialSwatch = code => materialSwatches.get(code);
export const listCloudMaterialFamilies = kind => [...materialFamilies.values()].filter(f=>!kind||f.kind===kind);
export const getAssetSyncHash = storagePath => syncManifest.get(storagePath)?.file_hash || '';
export const isUnifiedCatalogLoaded = () => unifiedCatalogLoaded;
export const isLegacyCatalogLive = index => !unifiedCatalogLoaded || (catalogInfo.get(index)?.status === 'live');

export function resolveStorageUrl(pathOrUrl, hash='') {
  if(typeof pathOrUrl !== 'string' || !pathOrUrl) return '';
  let url = pathOrUrl.trim();
  if (!/^https:\/\//i.test(url)) {
    if (url.startsWith('assets/chido/')) url = new URL(url, location.href).href;
    else if (ASSET_BASE_URL && !url.includes('..')) url=ASSET_BASE_URL+'/'+url.replace(/^\/+/, '');
    else return ''; // The private bucket requires a signed URL.
  }
  if (!hash) return url;
  const u=new URL(url);u.searchParams.set('v',hash);return u.href;
}

export function registerSyncManifest(rows=[]) {
  syncManifest.clear();
  for(const row of rows) if(row?.storage_path&&row?.file_hash) syncManifest.set(row.storage_path,row);
}
export function registerCloudMaterials(families=[]) {
  materialFamilies.clear();materialSwatches.clear();
  for(const fam of families) {
    if(!fam?.code)continue;
    const swatches=(fam.material_swatches||[]).filter(s=>s.active!==false).map(sw=>{
      const sHash=getAssetSyncHash(sw.albedo_path)||sw.file_hash||'';
      const item={code:sw.code,familyCode:fam.code,kind:fam.kind,name:sw.name,
        hexColor:sw.hex_color||'#D6CFC7',albedoPath:sw.albedo_path||'',
        albedoUrl:resolveStorageUrl(sw.albedo_url||sw.albedo_path,sHash),
        thumbUrl:resolveStorageUrl(sw.thumb_url||sw.albedo_url||sw.thumb_path||sw.albedo_path,sHash),
        fileHash:sHash};
      materialSwatches.set(sw.code,item);return item;
    });
    materialFamilies.set(fam.code,{code:fam.code,name:fam.name,kind:fam.kind,
      scope:fam.scope||'shared',tileCm:Number(fam.tile_cm)||35,
      roughnessFactor:Number(fam.roughness_factor)||.85,normalScale:Number(fam.normal_scale)||.65,
      normalUrl:resolveStorageUrl(fam.normal_url||fam.normal_path,getAssetSyncHash(fam.normal_path)||fam.content_hash),
      roughnessUrl:resolveStorageUrl(fam.roughness_url||fam.roughness_path,getAssetSyncHash(fam.roughness_path)||fam.content_hash),
      swatches});
  }
}

export function registerCloudProducts(records=[],{unified=false}={}) {
  if (unified) unifiedCatalogLoaded=true;
  for(const p of records) {
    const index=Number(p.catalog_index);
    if(!Number.isInteger(index)||index<0||typeof p.name!=='string')continue;
    const category=categories.includes(p.category)?p.category:categories.includes(p.metadata?.category)?p.metadata.category:'decor';
    const thumbPath=p.live_thumb_path||p.thumbnail_path||'';
    const thumbnail=resolveStorageUrl(p.thumbnail_url||thumbPath,getAssetSyncHash(thumbPath));
    const status=p.status||(p.active===false?'archived':'live');
    catalogInfo.set(index,{catalog_index:index,product_code:p.product_code||null,
      name:p.name.slice(0,160),thumbnail_url:thumbnail,metadata:{category},status});
    // Legacy bundled GLBs are still loaded by imported-models.js.
    if(p.status==='archived'||p.active===false){products.delete(index);if(p.product_code)productsByCode.delete(p.product_code);continue;}
    const raw=p.asset_url||'';
    const assetUrl=resolveStorageUrl(raw,p.glb_hash||getAssetSyncHash(p.live_glb_path||p.asset_path)||'');
    if(!assetUrl)continue;
    const size=Array.isArray(p.size_m)&&p.size_m.length===3&&p.size_m.every(n=>Number.isFinite(Number(n))&&Number(n)>.004&&Number(n)<=20)?p.size_m.map(Number):[2,.85,.9];
    const entry={catalog_index:index,product_code:p.product_code||null,name:p.name.slice(0,160),size_m:size,
      asset_url:assetUrl,asset_path:p.live_glb_path||p.asset_path||'',glb_hash:p.glb_hash||'',
      thumbnail_url:thumbnail,metadata:{category},signed_at:Date.now()};
    products.set(index,entry);if(p.product_code)productsByCode.set(p.product_code,entry);
  }
}
