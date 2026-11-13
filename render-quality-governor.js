// Lightweight hysteresis controller for expensive passes only.
// Geometry, textures, tone mapping, wall material and calibrated AR scale NEVER
// change in response to FPS. Only GTAO samples, subtle bloom, and postFX
// resolution are adapted one step at a time.
export class RenderQualityGovernor{
 constructor({threshold=20,recovery=29,slowMs=2600,fastMs=6500,cooldownMs=3800}={}){
  this.threshold=threshold;this.recovery=recovery;this.slowMs=slowMs;this.fastMs=fastMs;this.cooldownMs=cooldownMs;
  this.enabled=true;this.level=0;this.fps=0;this.lastTime=null;this.slowStart=null;this.fastStart=null;this.adjustedAt=-Infinity;
 }
 setEnabled(enabled){
  this.enabled=!!enabled;this.slowStart=null;this.fastStart=null;
  const changed=!this.enabled&&this.level!==0; if(changed)this.level=0;
  return changed;
 }
 update(timeMs){
  if(!Number.isFinite(timeMs))return false;
  const previous=this.lastTime;this.lastTime=timeMs;
  if(previous===null)return false;
  const dt=timeMs-previous;if(dt<=0||dt>1000){this.slowStart=null;this.fastStart=null;return false;}
  const current=Math.min(150,1000/Math.max(1,dt));
  this.fps=this.fps?this.fps*.90+current*.10:current;
  if(!this.enabled)return false;
  if(timeMs-this.adjustedAt<this.cooldownMs){this.slowStart=null;this.fastStart=null;return false;}
  if(this.fps<this.threshold){
   this.fastStart=null;this.slowStart??=timeMs;
   if(timeMs-this.slowStart>=this.slowMs&&this.level<3){
    this.level++;this.adjustedAt=timeMs;this.slowStart=null;return true;
   }
  }else if(this.fps>this.recovery){
   this.slowStart=null;this.fastStart??=timeMs;
   if(timeMs-this.fastStart>=this.fastMs&&this.level>0){
    this.level--;this.adjustedAt=timeMs;this.fastStart=null;return true;
   }
  }else{this.slowStart=null;this.fastStart=null;}
  return false;
 }
}
