export const WEB_ROLES=['company_admin'];
export const REQUEST_STATES=['submitted','reviewing','in_progress','needs_info','completed','cancelled'];
export const TICKET_STATES=['open','in_progress','waiting_customer','resolved','closed'];
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function id(v,optional=false){if(optional&&!v)return null;if(!uuid(v))throw Error('شناسه معتبر نیست.');return v;}
function str(v,min=1,max=160){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw Error('طول یکی از فیلدها معتبر نیست.');return v.trim();}
function pick(v,list){if(!list.includes(v))throw Error('گزینه انتخاب‌شده معتبر نیست.');return v;}
function integer(v,min,max){v=Number(v);if(!Number.isInteger(v)||v<min||v>max)throw Error('عدد خارج از محدوده است.');return v;}
function media(v=[]){if(!Array.isArray(v)||v.length>8||new Set(v).size!==v.length)throw Error('حداکثر ۸ عکس متفاوت انتخاب کن.');return v.map(x=>id(x));}
export function validateWorkspace(action,input){
 if(['invite.issue','invite.revoke','member.update'].includes(action))throw Error('کاربران نمایشگاه را با نام کاربری و رمز تعریف کن.');
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('اطلاعات فرم معتبر نیست.');
 const base={id:id(input.id,true)};
 switch(action){
 case 'media.register':{const object_path=str(input.object_path,1,260);if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(object_path))throw Error('مسیر عکس معتبر نیست.');return {object_path,filename:str(input.filename,1,180),mime_type:pick(input.mime_type,['image/jpeg','image/png','image/webp']),bytes:integer(input.bytes,1,999999),caption:str(input.caption||'',0,400)};}
 case 'media.archive':case 'code.revoke':case 'device.revoke':case 'notification.read':case 'layout.archive':case 'colorway.archive':return {id:id(input.id)};
 case 'request.create':{let dimensions_cm=null;if(input.dimensions_cm){if(!Array.isArray(input.dimensions_cm)||input.dimensions_cm.length!==3||!input.dimensions_cm.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=.5&&n<=2000))throw Error('عرض، ارتفاع و عمق را بین نیم تا ۲۰۰۰ سانتی‌متر وارد کن.');dimensions_cm=input.dimensions_cm;}return {kind:pick(input.kind,['model','layout','colorway','general']),title:str(input.title,3,160),description:str(input.description,5,6000),product_name:str(input.product_name||'',0,160),dimensions_cm,media_ids:media(input.media_ids),set_id:id(input.set_id,true),priority:pick(input.priority||'normal',['normal','high'])};}
 case 'ticket.create':return {title:str(input.title,3,160),category:pick(input.category,['technical','account','billing','models','other']),priority:pick(input.priority||'normal',['normal','high']),body:str(input.body,5,6000),media_ids:media(input.media_ids)};
 case 'message.send':return {parent_id:id(input.parent_id),parent_kind:pick(input.parent_kind,['request','ticket']),body:str(input.body,1,6000),media_ids:media(input.media_ids)};
 case 'request.status':return {id:id(input.id),status:pick(input.status,REQUEST_STATES)};
 case 'request.link_set':return {id:id(input.id),set_id:id(input.set_id)};
 case 'request.review':return {id:id(input.id),decision:pick(input.decision,['approve','revision']),body:str(input.body||'',input.decision==='revision'?5:0,6000)};
 case 'ticket.status':return {id:id(input.id),status:pick(input.status,TICKET_STATES)};
 case 'branch.save':{const slug=str(input.slug,2,100);if(!/^[a-z0-9][a-z0-9-]+$/.test(slug))throw Error('شناسه انگلیسی فقط شامل حروف کوچک، عدد و خط تیره است.');return {...base,name:str(input.name),slug,status:pick(input.status,['active','suspended'])};}
 case 'showroom.create':case 'showroom.update':{const login_name=str(input.login_name,3,50).toLowerCase();if(!/^[a-z0-9][a-z0-9._-]+$/.test(login_name))throw Error('نام کاربری باید انگلیسی و شامل حروف، عدد، نقطه یا خط تیره باشد.');const password=typeof input.password==='string'?input.password:'';if((action==='showroom.create'||password)&& (password.length<10||password.length>128||!/^[\x20-\x7e]+$/.test(password)))throw Error('رمز باید حداقل ۱۰ نویسه انگلیسی، عدد یا علامت داشته باشد.');return {...base,branch_id:id(input.branch_id),display_name:str(input.display_name,2,120),login_name,password,status:pick(input.status||'active',['active','suspended'])};}
 case 'code.issue':return {branch_id:id(input.branch_id),days:integer(input.days,1,30)};
 case 'profile.save':return {name:str(input.name),profile:{phone:str(input.profile?.phone||'',0,30),address:str(input.profile?.address||'',0,500),contact_name:str(input.profile?.contact_name||'',0,120)}};
 default:throw Error('عملیات شناخته‌شده نیست.');
 }
}
