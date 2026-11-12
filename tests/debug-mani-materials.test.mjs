import test from 'node:test';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
function decodePng(buf){
 const chunks=[];let off=8,width=0,height=0,depth=0,type=0;
 while(off<buf.length){const len=buf.readUInt32BE(off),name=buf.toString('ascii',off+4,off+8),data=buf.subarray(off+8,off+8+len);if(name==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];}if(name==='IDAT')chunks.push(data);off+=12+len;if(name==='IEND')break;}
 const channels=type===6?4:type===2?3:type===0?1:type===4?2:0;if(!channels||depth!==8)return {width,height,depth,type,channels,unsupported:true};
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,out=Buffer.alloc(height*stride);let p=0;
 const paeth=(a,b,c)=>{const q=a+b-c,aa=Math.abs(q-a),ab=Math.abs(q-b),ac=Math.abs(q-c);return aa<=ab&&aa<=ac?a:ab<=ac?b:c;};
 for(let y=0;y<height;y++){const filter=raw[p++],row=y*stride,prev=row-stride;for(let x=0;x<stride;x++){const a=x>=channels?out[row+x-channels]:0,b=y?out[prev+x]:0,c=y&&x>=channels?out[prev+x-channels]:0,v=raw[p++];out[row+x]=(v+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}}
 const stats=Array.from({length:channels},(_,ch)=>{let min=255,max=0,sum=0;for(let i=ch;i<out.length;i+=channels){const v=out[i];min=Math.min(min,v);max=Math.max(max,v);sum+=v;}return {min,max,mean:+(sum/(width*height)).toFixed(2)};});
 return {width,height,depth,type,channels,stats};
}
test('inspect Mani GLB material channels for migration',()=>{
 const b=readFileSync(new URL('../assets/chido/mani--maniset--tak--e3585876.glb',import.meta.url));
 const jl=b.readUInt32LE(12),d=JSON.parse(b.toString('utf8',20,20+jl)),binStart=20+jl+8;
 console.log('MANI_MATERIALS '+JSON.stringify(d.materials.map(m=>({name:m.name,pbr:m.pbrMetallicRoughness,normal:m.normalTexture,occlusion:m.occlusionTexture,alphaMode:m.alphaMode,extensions:m.extensions,extras:m.extras}))));
 console.log('MANI_IMAGES '+JSON.stringify(d.images.map(i=>({name:i.name,mimeType:i.mimeType,bufferView:i.bufferView,stats:i.bufferView!==undefined?decodePng(b.subarray(binStart+d.bufferViews[i.bufferView].byteOffset,binStart+d.bufferViews[i.bufferView].byteOffset+d.bufferViews[i.bufferView].byteLength)):null}))));
 console.log('MANI_NODES '+JSON.stringify(d.nodes.filter(n=>/SHADOW/i.test(n.name||'')||n.extras?.tripo_prep_shadow_baked||n.extras?.chido_color_uv_v1).map(n=>({name:n.name,mesh:n.mesh,extras:n.extras}))));
 console.log('MANI_EXTENSIONS '+JSON.stringify({used:d.extensionsUsed,required:d.extensionsRequired}));
});
