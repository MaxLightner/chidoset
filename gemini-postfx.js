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
        uContrast: { value: 1.07 },
        uVibrance: { value: 0.05 },
        uShadowToe: { value: 0.009 }
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

// Real GTAO remains aware of the complete room and nearby furniture, but its
// multiplication is MASKED to the visible architectural wall pixels. The
// wall-depth target is cheaper than a full object-ID render, and importantly
// does not touch the floor or any sofa pixels.
function installWallOnlyGTAO(renderer,scene,camera,gtaoPass,width,height){
 const target=new THREE.WebGLRenderTarget(width,height,{
  minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,
  depthBuffer:true,stencilBuffer:false
 });
 const depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
 const blend=gtaoPass.blendMaterial;
 blend.uniforms.tSceneDepth={value:gtaoPass.depthTexture};
 blend.uniforms.tWallDepth={value:target.texture};
 blend.fragmentShader=`
  #include <packing>
  uniform float intensity;
  uniform sampler2D tDiffuse;
  uniform sampler2D tSceneDepth;
  uniform sampler2D tWallDepth;
  varying vec2 vUv;
  void main(){
   float sceneDepth=texture2D(tSceneDepth,vUv).r;
   float wallDepth=unpackRGBAToDepth(texture2D(tWallDepth,vUv));
   // The wall alone may be occluded by sofa silhouettes. Compare against the
   // full G-buffer depth so only the wall *visible at this pixel* receives AO.
   float visibleWall=(1.0-step(0.00005,abs(sceneDepth-wallDepth)))*
    (1.0-step(0.99995,wallDepth));
   vec3 ao=texture2D(tDiffuse,vUv).rgb;
   gl_FragColor=vec4(mix(vec3(1.0),ao,clamp(intensity*visibleWall,0.0,1.0)),1.0);
  }
 `;
 blend.needsUpdate=true;
 const baseRender=gtaoPass.render.bind(gtaoPass);
 const baseSize=gtaoPass.setSize.bind(gtaoPass);
 gtaoPass.setSize=(w,h)=>{baseSize(w,h);target.setSize(w,h);};
 gtaoPass.render=(render,write,read,dt,maskActive)=>{
  const cameraMask=camera.layers.mask;
  const oldOverride=scene.overrideMaterial,oldBackground=scene.background;
  const oldTarget=render.getRenderTarget(),oldAuto=render.autoClear;
  const oldClear=render.getClearColor(new THREE.Color()),oldAlpha=render.getClearAlpha();
  try{
   camera.layers.set(2);
   scene.overrideMaterial=depthMaterial;
   scene.background=null;
   render.setRenderTarget(target);
   render.autoClear=false;
   render.setClearColor(0xffffff,1);
   render.clear(true,true,true);
   render.render(scene,camera);
  }finally{
   camera.layers.mask=cameraMask;
   scene.overrideMaterial=oldOverride;scene.background=oldBackground;
   render.setRenderTarget(oldTarget);
   render.setClearColor(oldClear,oldAlpha);
   render.autoClear=oldAuto;
  }
  baseRender(render,write,read,dt,maskActive);
 };
 return {dispose(){target.dispose();depthMaterial.dispose();}};
}
export function createGeminiPostFX(renderer,scene,camera,width,height,{scale=1}={}){
 const baseRatio=Math.min(1,renderer.getPixelRatio())*scale;
 const composer=new EffectComposer(renderer);
 composer.setPixelRatio(baseRatio);
 composer.addPass(new RenderPass(scene,camera));
 let gtaoPass=null,wallMask=null;
 try{
  gtaoPass=new GTAOPass(scene,camera,width,height);
  gtaoPass.output=GTAOPass.OUTPUT.Default;
  gtaoPass.normalMaterial.side=THREE.DoubleSide; // room camera sees the interior wall faces
  gtaoPass.blendIntensity=.84;
  // Longer-radius GTAO catches architectural corners and furniture nearing
  // the wall, but never darkens upholstery or produces shadows on the floor.
  gtaoPass.updateGtaoMaterial({radius:1.08,distanceExponent:1.1,thickness:.85,scale:.95,samples:24});
  wallMask=installWallOnlyGTAO(renderer,scene,camera,gtaoPass,width,height);
  composer.addPass(gtaoPass);
 }catch(error){
  console.warn('Selective Gemini wall GTAO unavailable; do not revert to full-scene furniture AO',error);
  wallMask?.dispose();gtaoPass?.dispose();gtaoPass=null;wallMask=null;
 }
 const bloomPass=new UnrealBloomPass(new THREE.Vector2(width,height),.09,.45,1.05);
 composer.addPass(bloomPass);
 const punchPass=new ShaderPass(PunchShader);composer.addPass(punchPass);
 const outputPass=new OutputPass();composer.addPass(outputPass);
 let level=0,aoUserEnabled=true;
 return {
  composer,gtaoPass,bloomPass,punchPass,
  render(){composer.render();},
  setSize(w,h){composer.setSize(w,h);},
  setAmbientOcclusion(value){aoUserEnabled=!!value;if(gtaoPass)gtaoPass.enabled=aoUserEnabled;},
  setBloom(value){bloomPass.enabled=!!value&&level<2;},
  setAdaptiveLevel(next){
   const clamped=Math.max(0,Math.min(3,Math.round(next)));
   if(clamped===level)return;
   level=clamped;
   // Progressive, only expensive effects: sample count -> bloom -> FX resolution.
   if(gtaoPass)gtaoPass.updateGtaoMaterial({radius:1.08,distanceExponent:1.1,thickness:.85,scale:.95,samples:level>=1?12:24});
   bloomPass.enabled=level<2;
   composer.setPixelRatio(baseRatio*(level>=3?.82:1));
   if(gtaoPass)gtaoPass.enabled=aoUserEnabled;
  },
  getQualityLevel(){return level;},
  dispose(){composer.dispose();wallMask?.dispose();gtaoPass?.dispose();bloomPass.dispose();}
 };
}
