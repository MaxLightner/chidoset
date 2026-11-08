// A single suspended renderer survives ordinary app navigation. No delayed GPU deletion.
export class StudioCache{
 park(studio,owner){
  if(this.entry&&this.entry.studio!==studio)throw Error('Only one parked renderer is allowed');
  if(studio.session||studio.renderer.xr.isPresenting)throw Error('Cannot park an active XR renderer');
  studio.suspend();this.entry={studio,owner};
 }
 take(owner){
  if(!this.entry)return null;
  if(this.entry.owner!==owner){this.drop();return null;}
  const studio=this.entry.studio;this.entry=null;return studio;
 }
 drop(){const entry=this.entry;this.entry=null;if(entry)entry.studio.destroy();}
}
export const sceneStateKey=state=>JSON.stringify({items:state?.items||[],spatial:state?.spatial,architecture:state?.architecture,whiteFloor:!!state?.whiteFloor});
