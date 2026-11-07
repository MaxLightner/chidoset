export async function endXRSession(session,timeoutMs=1800){
 let timer;
 try{return await Promise.race([Promise.resolve().then(()=>session.end()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('مرورگر هنوز خروج از AR را تأیید نکرده است. دوباره خروج را بزن.')),timeoutMs);})]);}
 finally{clearTimeout(timer);}
}
