// Local Gemini-inspired renderer. Uses unmodified Three.js r180 GTAO, bloom
// and output passes vendored under vendor/addons (Three.js MIT license).
import * as THREE from './vendor/three.module.js';
import {EffectComposer} from './vendor/addons/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/addons/postprocessing/RenderPass.js';
import {GTAOPass} from './vendor/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from './vendor/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './vendor/addons/postprocessing/OutputPass.js';
import {ShaderPass} from './vendor/addons/postprocessing/ShaderPass.js';

const PunchShader = {
    uniforms: {
        tDiffuse: { value: null },
        uContrast: { value: 1.12 },
        uVibrance: { value: 0.16 },
        uShadowToe: { value: 0.015 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uContrast;
        uniform float uVibrance;
        uniform float uShadowToe;
        varying vec2 vUv;

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 col = max(vec3(0.0), texel.rgb - vec3(uShadowToe));
            col = (col - 0.5) * uContrast + 0.5;
            float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
            float maxC = max(col.r, max(col.g, col.b));
            float minC = min(col.r, min(col.g, col.b));
            float sat = maxC - minC;
            float vibFactor = uVibrance * (1.0 - sat);
            col = mix(vec3(luma), col, 1.0 + vibFactor);
            gl_FragColor = vec4(clamp(col, 0.0, 1.0), texel.a);
        }
    `
};

export function createGeminiPostFX(renderer,scene,camera,width,height,{scale=1}={}){
 const composer=new EffectComposer(renderer);
 composer.setPixelRatio(Math.min(1,renderer.getPixelRatio())*scale);
 const renderPass=new RenderPass(scene,camera);
 composer.addPass(renderPass);
 let gtaoPass=null;
 try{
  gtaoPass=new GTAOPass(scene,camera,width,height);
  gtaoPass.output=GTAOPass.OUTPUT.Default;
  gtaoPass.blendIntensity=.95;
  gtaoPass.updateGtaoMaterial({radius:.36,distanceExponent:1.2,thickness:.8,scale:.9,samples:24});
  composer.addPass(gtaoPass);
 }catch(error){console.warn('Gemini GTAO unavailable',error);gtaoPass?.dispose();gtaoPass=null;}
 const bloomPass=new UnrealBloomPass(new THREE.Vector2(width,height),.15,.45,1.05);
 composer.addPass(bloomPass);
 const punchPass=new ShaderPass(PunchShader);
 composer.addPass(punchPass);
 const outputPass=new OutputPass();
 composer.addPass(outputPass);
 return {
  composer,gtaoPass,bloomPass,punchPass,
  render(){composer.render();},
  setSize(w,h){composer.setSize(w,h);},
  setAmbientOcclusion(value){if(gtaoPass)gtaoPass.enabled=!!value;},
  setBloom(value){bloomPass.enabled=!!value;},
  dispose(){composer.dispose();gtaoPass?.dispose();bloomPass.dispose();}
 };
}
