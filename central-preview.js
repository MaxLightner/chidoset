import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {extractModelHelpers} from './model-contract.js?v=0.19.0';

export async function previewModel(host,file){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(host.clientWidth||600,220);
 host.replaceChildren(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eee5');
 const camera=new THREE.PerspectiveCamera(38,(host.clientWidth||600)/220,.01,1000);
 scene.add(new THREE.HemisphereLight(0xffffff,0x607367,2.5));
 const light=new THREE.DirectionalLight(0xfff6e6,3);light.position.set(4,6,3);scene.add(light);
 try{
  const {scene:model}=await new GLTFLoader().parseAsync(await file.arrayBuffer(),'');
  const helpers=extractModelHelpers(model),box=helpers.bounds;
  if(box.isEmpty())throw Error('مدل هندسه قابل نمایش ندارد.');
  const size=box.getSize(new THREE.Vector3());
  if(!size.toArray().every(n=>Number.isFinite(n)&&n>=.005&&n<=20))
   throw Error('ابعاد مدل باید بین نیم سانتی‌متر و ۲۰ متر باشد.');
  const center=box.getCenter(new THREE.Vector3());
  helpers.restore();
  for(const {node} of helpers.collisionNodes)node.visible=false;
  model.position.sub(center);scene.add(model);
  const radius=Math.max(.1,size.length());
  camera.position.set(radius,.65*radius,radius);camera.lookAt(0,0,0);renderer.render(scene,camera);
  const cleanup=()=>{
   model.traverse(object=>{
    if(!object.isMesh)return;
    object.geometry.dispose();
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
     for(const value of Object.values(material||{}))if(value?.isTexture)value.dispose();
     material?.dispose();
    }
   });
   renderer.dispose();host.replaceChildren();
  };
  cleanup.size_m=size.toArray();
  return cleanup;
 }catch(error){
  renderer.dispose();host.replaceChildren();
  throw Error(error?.message||'نمایش مدل ممکن نشد. فایل GLB را بررسی کن.');
 }
}
