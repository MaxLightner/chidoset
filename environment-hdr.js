// Radiance RGBE HDR loader for the vendored Three.js module.
// Keeps IBL independent from addon/CDN versions and never changes the camera background.
import * as THREE from './vendor/three.module.js';
const SOURCES=['./assets/lighting/1.hdr','https://showroom.silktouchjoinery.com.au/models/1.hdr'];
let bytesPromise;
function readHDR(buffer){
 const bytes=new Uint8Array(buffer);let offset=0;
 const line=()=>{let end=offset;while(end<bytes.length&&bytes[end]!==10)end++;
  const out=new TextDecoder().decode(bytes.subarray(offset,end)).trim();offset=end+1;return out;};
 if(!line().startsWith('#?'))throw Error('Invalid Radiance HDR signature');
 let header='';while(offset<bytes.length){const s=line();if(!s)break;header+=s+'\n';}
 if(!/FORMAT=32-bit_rle_rgbe/.test(header))throw Error('Unsupported HDR encoding');
 const dimensions=line().match(/^-Y\s+(\d+)\s+\+X\s+(\d+)$/);
 if(!dimensions)throw Error('Unsupported HDR orientation');
 const height=+dimensions[1],width=+dimensions[2];
 if(width<8||width>32767||height<1||width*height>8000000)throw Error('Unsupported HDR dimensions');
 const data=new Float32Array(width*height*4);
 for(let y=0;y<height;y++){
  if(offset+4>bytes.length||bytes[offset++]!==2||bytes[offset++]!==2)throw Error('Invalid HDR scanline');
  const size=(bytes[offset++]<<8)|bytes[offset++];
  if(size!==width)throw Error('Mismatched HDR scanline');
  const scan=new Uint8Array(width*4);
  for(let c=0;c<4;c++){let x=0;while(x<width){
   if(offset>=bytes.length)throw Error('Truncated HDR file');
   const token=bytes[offset++];
   if(token>128){const run=token-128;if(!run||offset>=bytes.length||x+run>width)throw Error('Invalid HDR RLE');
    const v=bytes[offset++];scan.fill(v,c*width+x,c*width+x+run);x+=run;
   }else{if(!token||offset+token>bytes.length||x+token>width)throw Error('Invalid HDR literal');
    scan.set(bytes.subarray(offset,offset+token),c*width+x);offset+=token;x+=token;}
  }}
  for(let x=0;x<width;x++){
   const e=scan[3*width+x],i=(y*width+x)*4;
   const f=e?Math.pow(2,e-136):0;
   data[i]=scan[x]*f;data[i+1]=scan[width+x]*f;data[i+2]=scan[2*width+x]*f;data[i+3]=1;
  }
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
 texture.mapping=THREE.EquirectangularReflectionMapping;
 texture.colorSpace=THREE.LinearSRGBColorSpace;
 texture.flipY=true;
 texture.generateMipmaps=false;
 texture.needsUpdate=true;
 texture.userData.chidoHDR=true;
 return texture;
}
async function readBytes(){
 let lastError;
 for(const url of SOURCES){
  try{
   const response=await fetch(url,{mode:'cors',cache:'force-cache'});
   if(!response.ok)throw Error('HTTP '+response.status+' '+url);
   return await response.arrayBuffer();
  }catch(error){lastError=error;}
 }
 throw lastError||Error('HDR unavailable');
}
export async function loadEnvironmentHDR(){
 bytesPromise||=readBytes().catch(error=>{bytesPromise=null;throw error;});
 return readHDR(await bytesPromise);
}
export const ENVIRONMENT_HDR_PATH=SOURCES[0];
