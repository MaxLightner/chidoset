// Remember sessions, never passwords. Both app and company dashboard share this store.
export function authStorage(namespace){
 const preference=namespace+'-remember';
 return {
  getItem:key=>sessionStorage.getItem(key)??localStorage.getItem(key),
  setItem(key,value){const persistent=localStorage.getItem(preference)!=='no';(persistent?sessionStorage:localStorage).removeItem(key);(persistent?localStorage:sessionStorage).setItem(key,value);},
  removeItem(key){localStorage.removeItem(key);sessionStorage.removeItem(key);}
 };
}
export function rememberAccount(namespace,remember,username){
 localStorage.setItem(namespace+'-remember',remember?'yes':'no');
 localStorage.removeItem(namespace+'-username');sessionStorage.removeItem(namespace+'-username');
 (remember?localStorage:sessionStorage).setItem(namespace+'-username',username.trim());
}
export const accountName=namespace=>sessionStorage.getItem(namespace+'-username')||localStorage.getItem(namespace+'-username')||'';
