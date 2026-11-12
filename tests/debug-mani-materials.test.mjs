import test from 'node:test';
import {readFileSync} from 'node:fs';
test('inspect Mani GLB material channels for migration',()=>{
 const b=readFileSync(new URL('../assets/chido/mani--maniset--tak--e3585876.glb',import.meta.url));
 const d=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 console.log('MANI_MATERIALS '+JSON.stringify(d.materials.map(m=>({name:m.name,pbr:m.pbrMetallicRoughness,extensions:m.extensions,extras:m.extras}))))
 console.log('MANI_IMAGES '+JSON.stringify(d.images.map(i=>({name:i.name,mimeType:i.mimeType,bufferView:i.bufferView}))))
 console.log('MANI_TEXTURES '+JSON.stringify(d.textures.map(t=>({source:t.source,sampler:t.sampler,extensions:t.extensions}))))
 console.log('MANI_TEXCOORDS '+JSON.stringify(d.meshes.map(m=>m.primitives.map(p=>({material:p.material,attributes:p.attributes})))));
});
