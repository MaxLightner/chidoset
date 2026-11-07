// Recovery is separate from saving an official layout. Sellers keep it in this tab only.
const key=member=>member?.company_id&&member?.user?.id?`chido:recovery:v2:${member.company_id}:${member.user.id}`:null;
const storage=member=>member.role==='branch'?globalThis.sessionStorage:globalThis.localStorage;
export function readRecovery(member){try{const k=key(member),value=k&&JSON.parse(storage(member).getItem(k)||'null');return value?.scene?.spatial&&Array.isArray(value.scene.items)&&value.scene.items.length<=64?value:null;}catch{return null;}}
export function saveRecovery(member,record){const k=key(member);if(k&&record?.scene)storage(member).setItem(k,JSON.stringify({...record,updatedAt:Date.now()}));}
export function clearRecovery(member){const k=key(member);if(k)storage(member).removeItem(k);}
export function filterPublishedScene(scene,allowed){
 if(!scene?.spatial||!Array.isArray(scene.items))return null;
 return {...scene,items:scene.items.filter(item=>item&&allowed.has(item.index)&&item.index>=22&&Array.isArray(item.position)&&item.position.length===3&&item.position.every(Number.isFinite)&&Number.isFinite(item.rotation)),cloudProducts:[]};
}
