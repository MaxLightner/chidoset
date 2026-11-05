export const CATEGORIES=['seating','low-tables','dining','workspace','bedroom','decor','rugs','wall-art'];
export const builtInCategory=index=>[0,1,3,22,23,24].includes(index)?'seating':[2,12,13,25,26,27].includes(index)?'low-tables':[10,11].includes(index)?'dining':index===9?'workspace':index===8?'bedroom':[7,31].includes(index)?'rugs':index>=16&&index<=21?'wall-art':'decor';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function text(v,min=1,max=160){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw Error('طول یکی از فیلدها معتبر نیست.');return v.trim();}
function choice(v,values){if(!values.includes(v))throw Error('وضعیت انتخاب‌شده معتبر نیست.');return v;}
function id(v,optional=false){if(optional&&!v)return null;if(!uuid(v))throw Error('شناسه معتبر نیست.');return v;}
function integer(v,min,max){v=Number(v);if(!Number.isInteger(v)||v<min||v>max)throw Error('عدد خارج از محدوده مجاز است.');return v;}
function date(v){if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw Error('تاریخ معتبر نیست.');return new Date(v).toISOString();}
function slug(v){v=text(v,2,100);if(!/^[a-z0-9][a-z0-9-]+$/.test(v))throw Error('شناسه انگلیسی فقط شامل حروف کوچک، عدد و خط تیره است.');return v;}
function asset(v,ext){if(!v)return '';v=text(v,1,260);if(!new RegExp('^storage://chido-assets/(models|images)/[a-zA-Z0-9-]+\\.('+ext+')$').test(v)&&!/^assets\/chido\/[a-zA-Z0-9/._-]+$/.test(v))throw Error('مسیر فایل معتبر نیست.');return v;}
export function validateWrite(action,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('اطلاعات فرم معتبر نیست.');
 const out={id:id(input.id,true)};
 switch(action){
 case 'company.save':return {...out,name:text(input.name),slug:slug(input.slug),status:choice(input.status,['pending','active','suspended']),max_layouts_per_set:integer(input.max_layouts_per_set,1,50),max_colorways_per_set:integer(input.max_colorways_per_set,1,50)};
 case 'branch.save':return {...out,company_id:id(input.company_id),name:text(input.name),slug:slug(input.slug),status:choice(input.status,['active','suspended'])};
 case 'code.issue':{const role=choice(input.role,['company_admin','branch']);return {company_id:id(input.company_id),branch_id:role==='branch'?id(input.branch_id):null,role,days:integer(input.days,1,30)};}
 case 'subscription.save':{const starts_at=date(input.starts_at),ends_at=date(input.ends_at);if(ends_at<=starts_at)throw Error('پایان اشتراک باید بعد از شروع آن باشد.');return {...out,company_id:id(input.company_id),plan_code:slug(input.plan_code),status:choice(input.status,['trial','active','past_due','expired','cancelled']),starts_at,ends_at,billing_notes:text(input.billing_notes||'',0,1000)};}
 case 'product.save':{if(!Array.isArray(input.size_m)||input.size_m.length!==3||!input.size_m.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=.005&&n<=20))throw Error('ابعاد محصول باید سه اندازه بین نیم سانتی‌متر و ۲۰ متر باشد.');if(typeof input.active!=='boolean')throw Error('وضعیت محصول معتبر نیست.');return {...out,name:text(input.name),slug:slug(input.slug),size_m:input.size_m,asset_path:asset(input.asset_path,'glb'),thumbnail_path:asset(input.thumbnail_path,'png|jpg|jpeg|webp'),active:input.active,metadata:{category:choice(input.metadata?.category||'decor',CATEGORIES),notes:text(input.metadata?.notes||'',0,1000)}};}
 case 'set.save':{if(!Array.isArray(input.product_ids)||input.product_ids.length>100||new Set(input.product_ids).size!==input.product_ids.length)throw Error('فهرست محصولات معتبر نیست.');return {...out,company_id:id(input.company_id),name:text(input.name),description:text(input.description||'',0,1000),status:choice(input.status,['draft','published','archived']),product_ids:input.product_ids.map(v=>id(v))};}
 case 'member.status':return {id:id(input.id),status:choice(input.status,['active','pending','suspended'])};
 case 'access.status':return {id:id(input.id),status:choice(input.status,['pending','contacted','approved','declined'])};
 case 'layout-request.status':return {id:id(input.id),status:choice(input.status,['pending','approved','declined','completed'])};
 case 'device.revoke':case 'session.revoke':case 'code.revoke':return {id:id(input.id)};
 default:throw Error('عملیات شناخته‌شده نیست.');
 }
}
export function validateGlb(buffer){
 const bytes=buffer instanceof ArrayBuffer?buffer:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
 const view=new DataView(bytes);if(bytes.byteLength<20||bytes.byteLength>33554432||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)throw Error('فایل باید یک GLB نسخه ۲ سالم و حداکثر ۳۲ مگابایتی باشد.');
 const length=view.getUint32(12,true);if(length>bytes.byteLength-20||view.getUint32(16,true)!==0x4e4f534a)throw Error('ساختار GLB معتبر نیست.');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
 if(!json.asset?.version?.startsWith('2')||!Array.isArray(json.scenes)||!json.scenes.length)throw Error('صحنه سه‌بعدی در فایل وجود ندارد.');
 for(const resource of [...(json.buffers||[]),...(json.images||[])])if(resource.uri&&!resource.uri.startsWith('data:'))throw Error('مدل باید مستقل باشد؛ فایل‌های بیرونی را داخل GLB قرار بده.');
 return true;
}
