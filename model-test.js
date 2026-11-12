import * as THREE from './vendor/three.module.js';
import {createImportedModel} from './imported-models.js?v=0.16.16';
import {applyRoleMaterial,materialPresets,roleMaterials} from './material-roles.js?v=0.16.16';
import {footprint,moveWithoutOverlap,footprintsOverlap} from './collision.js?v=0.16.16';
const host=document.querySelector('#view'),status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#ede9e2');
const camera=new THREE.PerspectiveCamera(38,1,.01,100);let yaw=.55,pitch=.28;
function orbit(){camera.position.set(Math.sin(yaw)*3.5,1+pitch*2,Math.cos(yaw)*3.5);camera.lookAt(.45,.4,0);}orbit();
scene.add(new THREE.HemisphereLight(0xffffff,0xb4ac99,2));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:0xddd7cd}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);
let drag;host.onpointerdown=e=>{drag=[e.clientX,e.clientY];host.setPointerCapture(e.pointerId);};host.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.008;pitch=Math.max(0,Math.min(1,pitch+(e.clientY-drag[1])*.003));drag=[e.clientX,e.clientY];orbit();};host.onpointerup=()=>drag=null;
const a=createImportedModel(32,[.887268,.942722,.885356]),b=createImportedModel(32,[.887268,.942722,.885356]);
a.position.y=b.position.y=.942722/2;b.position.x=1.8;scene.add(a,b);
new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}).observe(host);
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
try{
 await Promise.all([a.userData.loadPromise,b.userData.loadPromise]);if(a.userData.loadError)throw Error(a.userData.loadError);
 const visual=a.getObjectByName('imported-visual'),roles=roleMaterials(visual).map(e=>e.role);let shadow,collider;
 visual.traverse(n=>{if(n.userData.chidoBakedShadow)shadow=n;if(n.userData.chidoCollider)collider=n;});
 if(!shadow||!collider||!roles.includes('fabric')||!roles.includes('wood'))throw Error('سایه، کالیژن یا بخش‌های متریال کامل نیستند.');
 const helper=new THREE.BoxHelper(collider,0x318b72);scene.add(helper);helper.visible=false;
 document.querySelector('#collider').onchange=e=>{helper.visible=e.target.checked;helper.update();};
 const change=async(role,style)=>{try{await applyRoleMaterial(visual,role,style);status.textContent='فقط '+(role==='wood'?'چوب':'پارچه')+' تغییر کرد؛ نور بیک‌شده حفظ شد.';}catch(e){status.textContent=e.message;}};
 for(const role of ['wood','fabric'])for(const preset of materialPresets(role)){const button=document.createElement('button');button.textContent=preset.label;button.onclick=()=>change(role,{source:preset.source});document.querySelector('#'+role).append(button);}
 document.querySelector('#reset').onclick=async()=>{await change('wood',null);await change('fabric',null);};
 const size=a.userData.authoredCollisionSize;document.querySelector('#move').oninput=e=>{const moving=footprint(size,b.position.x,0),fixed=footprint(size,0,0),goal={x:Number(e.target.value)/100,z:0},position=moveWithoutOverlap(moving,goal,[fixed]);b.position.x=position.x;document.querySelector('#collisionStatus').textContent=Math.abs(position.x-goal.x)>.01?'کالیژن جلوی عبور مبل دوم را گرفت.':'حرکت آزاد؛ برخوردی نیست.';};
 status.textContent='مدل آماده است؛ سایه، کالیژن و دو بخش چوب و پارچه شناسایی شدند.';
 window.modelTest={a,b,visual,shadow,collider,roles,renderer,scene,change,footprintsOverlap,footprint};
}catch(e){status.textContent='خطا: '+e.message;console.error(e);}
