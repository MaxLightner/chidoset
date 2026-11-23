import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {measureModelBounds} from './model-bounds.js';

const cm=value=>(Math.round(value*10000)/100).toLocaleString('fa-IR',{maximumFractionDigits:2});

export async function previewModel(host,file){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 const width=host.clientWidth||600,height=220;
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(width,height);
 host.replaceChildren(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eee5');
 const camera=new THREE.PerspectiveCamera(38,width/height,.01,1000);
 scene.add(new THREE.HemisphereLight(0xffffff,0x607367,2.5));
 const light=new THREE.DirectionalLight(0xfff6e6,3);light.position.set(4,6,3);scene.add(light);
 try{
  const {scene:model}=await new GLTFLoader().parseAsync(await file.arrayBuffer(),'');
  const bounds=measureModelBounds(model);
  const box=new THREE.Box3(new THREE.Vector3(...bounds.min_m),new THREE.Vector3(...bounds.max_m));
  const center=box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.updateMatrixWorld(true);
  scene.add(model);
  const outline=new THREE.Box3Helper(box.translate(center.clone().negate()),0x327f70);
  scene.add(outline);
  const size=new THREE.Vector3(...bounds.size_m),radius=Math.max(.1,size.length());
  camera.position.set(radius,.65*radius,radius);camera.lookAt(0,0,0);
  renderer.render(scene,camera);
  const summary=document.createElement('div');
  summary.className='model-bbox-summary';
  summary.textContent='Bounding Box هندسه GLB — عرض: '+cm(bounds.size_m[0])+' · ارتفاع: '+cm(bounds.size_m[1])+' · عمق: '+cm(bounds.size_m[2])+' سانتی‌متر | '+bounds.mesh_count+' مش؛ '+bounds.excluded_helpers+' آبجکت کمکی حذف شده از اندازه‌گیری';
  host.append(summary);
  const dispose=()=>{
   model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});
   outline.geometry.dispose();outline.material.dispose();renderer.dispose();host.replaceChildren();
  };
  dispose.bounds=bounds;
  return dispose;
 }catch(error){renderer.dispose();host.replaceChildren();throw Error(error.message||'نمایش مدل ممکن نشد. فایل GLB را بررسی کن.');}
}
