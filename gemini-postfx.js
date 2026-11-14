// Shared scene post-effect recipe: no scene darkening, no GTAO and no grade.
import * as THREE from './vendor/three.module.js';
import {EffectComposer} from './vendor/addons/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './vendor/addons/postprocessing/OutputPass.js';

export const CHIDO_BLOOM=Object.freeze({strength:.09,radius:.45,threshold:1.05});
export function createGeminiPostFX(renderer,scene,camera,width,height,{scale=1}={}){
 const baseRatio=Math.min(1,renderer.getPixelRatio())*scale;
 const composer=new EffectComposer(renderer);
 composer.setPixelRatio(baseRatio);
 composer.addPass(new RenderPass(scene,camera));
 const bloomPass=new UnrealBloomPass(new THREE.Vector2(width,height),
  CHIDO_BLOOM.strength,CHIDO_BLOOM.radius,CHIDO_BLOOM.threshold);
 composer.addPass(bloomPass);
 composer.addPass(new OutputPass());
 let level=0,userBloom=true;
 return {
  composer,bloomPass,gtaoPass:null,
  render(){composer.render();},
  setSize(w,h){composer.setSize(w,h);},
  setAmbientOcclusion(){/* GTAO intentionally disabled everywhere */},
  setBloom(enabled){userBloom=!!enabled;bloomPass.enabled=userBloom&&level<2;},
  setAdaptiveLevel(value){
   level=THREE.MathUtils.clamp(Math.round(value)||0,0,3);
   bloomPass.enabled=userBloom&&level<2;
   composer.setPixelRatio(baseRatio*(level>=3?.82:1));
  },
  dispose(){composer.dispose();bloomPass.dispose();}
 };
}
