import * as THREE from './vendor/three.module.js';
export const CATALOG=Object.freeze([
 Object.freeze({name:'کاناپه',size:Object.freeze([2.1,.85,.9]),price:4200000}),
 Object.freeze({name:'تک‌نفره',size:Object.freeze([.9,.85,.9]),price:2800000}),
 Object.freeze({name:'میز',size:Object.freeze([1.1,.4,.6]),price:1900000}),
 Object.freeze({name:'تک‌نفره دوم',size:Object.freeze([.9,.85,.9]),price:2800000}),
 Object.freeze({name:'گلدان سرامیکی',size:Object.freeze([.25,.4,.25]),price:0}),
 Object.freeze({name:'کوسن دکوراتیو',size:Object.freeze([.46,.18,.4]),price:0}),
 Object.freeze({name:'آباژور ایستاده',size:Object.freeze([.45,1.55,.45]),price:0}),
 Object.freeze({name:'فرش مینیمال',size:Object.freeze([2.4,.015,1.7]),price:0}),
 Object.freeze({name:'تخت دو نفره',size:Object.freeze([1.65,.95,2.08]),price:0}),
 Object.freeze({name:'میز کار',size:Object.freeze([1.4,.74,.67]),price:0}),
 Object.freeze({name:'میز ناهارخوری',size:Object.freeze([1.7,.75,.86]),price:0}),
 Object.freeze({name:'صندلی ناهارخوری',size:Object.freeze([.48,.90,.47]),price:0}),
 Object.freeze({name:'میز عسلی مربعی',size:Object.freeze([.48,.48,.48]),price:0}),
 Object.freeze({name:'میز جلو مبلی مربعی',size:Object.freeze([1.15,.42,1.15]),price:0}),
 Object.freeze({name:'آباژور رومیزی',size:Object.freeze([.35,.55,.35]),price:0}),
 Object.freeze({name:'آباژور سه‌پایه',size:Object.freeze([.55,1.6,.55]),price:0}),
 Object.freeze({name:'تابلو عمودی کوچک',size:Object.freeze([.45,.68,.045]),price:0}),
 Object.freeze({name:'تابلو افقی کوچک',size:Object.freeze([.70,.44,.045]),price:0}),
 Object.freeze({name:'تابلو مربعی متوسط',size:Object.freeze([.65,.65,.045]),price:0}),
 Object.freeze({name:'تابلو افقی بزرگ',size:Object.freeze([1.20,.68,.045]),price:0}),
 Object.freeze({name:'تابلو عمودی بزرگ',size:Object.freeze([.78,1.15,.045]),price:0}),
 Object.freeze({name:'تابلو سه‌تکه',size:Object.freeze([1.25,.75,.045]),price:0}),
 Object.freeze({name:'مبل سه‌نفره پارچه‌ای تیره',size:Object.freeze([1.8934,.7744,.8930]),price:0}),
 Object.freeze({name:'مبل دونفره پارچه‌ای تیره',size:Object.freeze([1.6778,.7700,.9029]),price:0}),
 Object.freeze({name:'مبل تک‌نفره پارچه‌ای تیره',size:Object.freeze([1.1458,.7781,.9081]),price:0}),
 Object.freeze({name:'میز جلو مبلی چوب و فلز',size:Object.freeze([1.19,.353,.6]),price:0}),
 Object.freeze({name:'میز عسلی چوب و فلز',size:Object.freeze([.49,.351,.489]),price:0}),
 Object.freeze({name:'میز دکوری شیشه‌ای',size:Object.freeze([.571,.731,.535]),price:0}),
 Object.freeze({name:'آباژور رومیزی کریستالی',size:Object.freeze([.391,.4,.393]),price:0}),
 Object.freeze({name:'چراغ ایستاده فلزی',size:Object.freeze([.338,1.7,.33]),price:0}),
 Object.freeze({name:'شمعدان دکوری',size:Object.freeze([.428,.54,.19]),price:0}),
 Object.freeze({name:'فرش پتینه طوسی',size:Object.freeze([3,.01,2]),price:0})
]);
export const wrappedAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function pairAngle(a,b){return Math.atan2(-(b.z-a.z),b.x-a.x);}
export class SpatialState{
 constructor(){this.origin=new THREE.Vector3();this.anchorYaw=0;this.heightOffset=0;this.locked=true;this.a=new THREE.Vector3(0,0,.7);this.b=new THREE.Vector3(4,0,.7);this.correction=1;this.actualLength=null;this.layoutOffset=new THREE.Vector3();this.layoutYaw=0;}
 get length(){return this.a.distanceTo(this.b);}
 get yaw(){return pairAngle(this.a,this.b);}
 get height(){return this.origin.y+this.heightOffset;}
 get plane(){return new THREE.Plane(new THREE.Vector3(0,1,0),-this.height);}
 lock(point){this.origin.copy(point);this.anchorYaw=0;this.locked=true;}
 setAnchorTranslation(point,yaw=this.anchorYaw){if(this.locked){this.origin.copy(point);if(Number.isFinite(yaw))this.anchorYaw=yaw;}}
 setHeight(meters){if(!Number.isFinite(meters)||Math.abs(meters)>2)throw Error('اصلاح ارتفاع باید بین ۲۰۰− و ۲۰۰ سانتی‌متر باشد.');this.heightOffset=meters;}
 moveA(point){const delta=point.clone().sub(this.a);delta.y=0;this.a.add(delta);this.b.add(delta);}
 moveB(point){const next=point.clone();next.y=0;if(next.distanceTo(this.a)<1||next.distanceTo(this.a)>10)return false;this.b.copy(next);return true;}
 calibrate(actualMeters){if(!Number.isFinite(actualMeters)||actualMeters<1||actualMeters>10)throw Error('طول واقعی را بین ۱۰۰ و ۱۰۰۰ سانتی‌متر وارد کن.');
  // If XR reports m units for a real r-meter span, a nominal P-meter product needs P*m/r XR units.
  const scale=this.length/actualMeters;if(!Number.isFinite(scale)||scale<=0)throw Error('ضریب اندازه معتبر نیست.');this.correction=scale;this.actualLength=actualMeters;return scale;
 }
 resetCalibration(){this.correction=1;this.actualLength=null;}
 apply(floorFrame,layout){floorFrame.position.copy(this.origin);floorFrame.position.y+=this.heightOffset;floorFrame.rotation.set(0,this.anchorYaw,0);layout.position.copy(this.layoutOffset);layout.rotation.set(0,this.layoutYaw,0);layout.scale.setScalar(this.correction);floorFrame.updateMatrixWorld(true);}
 snapshot(){return {a:this.a.toArray(),b:this.b.toArray(),correction:this.correction,actualLength:this.actualLength,heightOffset:this.heightOffset,layoutOffset:this.layoutOffset.toArray(),layoutYaw:this.layoutYaw};}
 restore(state){if(!state)return;this.a.fromArray(state.a);this.b.fromArray(state.b);this.correction=state.correction;this.actualLength=state.actualLength;this.heightOffset=state.heightOffset;this.layoutOffset.fromArray(state.layoutOffset||state.a||[0,0,0]);this.layoutYaw=state.layoutYaw??this.yaw;}
}
