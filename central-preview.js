import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export async function previewModel(host,file){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(host.clientWidth||600,220);host.replaceChildren(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eee5');const camera=new THREE.PerspectiveCamera(38,(host.clientWidth||600)/220,.01,1000);
 scene.add(new THREE.HemisphereLight(0xffffff,0x607367,2.5));const light=new THREE.DirectionalLight(0xfff6e6,3);light.position.set(4,6,3);scene.add(light);
 try{const {scene:model}=await new GLTFLoader().parseAsync(await file.arrayBuffer(),'');const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());model.position.sub(center);scene.add(model);const radius=Math.max(.1,size.length());camera.position.set(radius,.65*radius,radius);camera.lookAt(0,0,0);renderer.render(scene,camera);
 return ()=>{model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});renderer.dispose();host.replaceChildren();};
 }catch(error){renderer.dispose();throw Error('نمایش مدل ممکن نشد. فایل GLB را بررسی کن.');}
}
