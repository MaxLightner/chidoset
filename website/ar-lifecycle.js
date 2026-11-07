// Browser-driven and button-driven exits must release the same UI and renderer.
export function createARLifecycle(release){
 let session=null,ended=false;
 function finish(){if(ended)return;ended=true;session?.removeEventListener('end',finish);release();}
 return {
  get ended(){return ended;},
  attach(value){session=value;session.addEventListener('end',finish,{once:true});},
  async stop(){try{if(session&&!ended)await session.end();}catch{}finally{finish();}},
  finish
 };
}
