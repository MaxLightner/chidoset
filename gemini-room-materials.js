// Architectural PBR surfaces and moving TV screen lifted from the original
// Gemini room-planner experiment, using Chido's ONE local THREE runtime.
// Keeping the texture algorithms intact preserves the reference look.
import * as THREE from './vendor/three.module.js';

function generateNormalFromHeight(heightCanvas, strength = 2.2) {
    const w = heightCanvas.width;
    const h = heightCanvas.height;
    const ctx = heightCanvas.getContext('2d');
    const src = ctx.getImageData(0, 0, w, h).data;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    const dst = outCtx.createImageData(w, h);

    const sample = (x, y) => {
        const wx = (x + w) % w;
        const wy = (y + h) % h;
        return src[(wy * w + wx) * 4] / 255.0;
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const tl = sample(x - 1, y - 1);
            const t  = sample(x,     y - 1);
            const tr = sample(x + 1, y - 1);
            const l  = sample(x - 1, y);
            const r  = sample(x + 1, y);
            const bl = sample(x - 1, y + 1);
            const b  = sample(x,     y + 1);
            const br = sample(x + 1, y + 1);

            const dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
            const dY = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);

            let nx = -dX * strength;
            let ny = -dY * strength;
            let nz = 1.0;
            const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx *= invLen; ny *= invLen; nz *= invLen;

            const idx = (y * w + x) * 4;
            dst.data[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
            dst.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
            dst.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
            dst.data[idx + 3] = 255;
        }
    }
    outCtx.putImageData(dst, 0, 0);
    const tex = new THREE.CanvasTexture(outCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}\n
function createWoodTextures(baseHex, grainHex, roughMin, roughMax, repeatX = 4, repeatY = 4) {
    const size = 512;
    const diffCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');
    diffCanvas.width = roughCanvas.width = size;
    diffCanvas.height = roughCanvas.height = size;

    const dCtx = diffCanvas.getContext('2d');
    const rCtx = roughCanvas.getContext('2d');

    const planks = 6;
    const plankH = size / planks;

    for (let p = 0; p < planks; p++) {
        const y0 = p * plankH;
        dCtx.fillStyle = baseHex;
        dCtx.fillRect(0, y0, size, plankH);

        const plankRough = roughMin + ((p * 37) % 10) * 0.015;
        const rVal = Math.round(Math.min(255, Math.max(0, plankRough * 255)));
        rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
        rCtx.fillRect(0, y0, size, plankH);

        dCtx.strokeStyle = grainHex;
        dCtx.globalAlpha = 0.22;
        for (let g = 0; g < 26; g++) {
            const gy = y0 + (g / 26) * plankH;
            dCtx.lineWidth = 0.8 + (g % 3) * 0.5;
            dCtx.beginPath();
            dCtx.moveTo(0, gy);
            dCtx.bezierCurveTo(size * 0.33, gy + Math.sin(p + g) * 2.2, size * 0.66, gy - Math.cos(p + g) * 2.2, size, gy);
            dCtx.stroke();
        }
        dCtx.globalAlpha = 1.0;

        // Plank seam
        dCtx.fillStyle = 'rgba(20, 14, 10, 0.45)';
        dCtx.fillRect(0, y0, size, 2);
        const jointX = ((p * 173 + 90) % size);
        dCtx.fillRect(jointX, y0, 2, plankH);

        const seamRough = Math.round(roughMax * 255);
        rCtx.fillStyle = `rgb(${seamRough},${seamRough},${seamRough})`;
        rCtx.fillRect(0, y0, size, 2);
        rCtx.fillRect(jointX, y0, 2, plankH);
    }

    const map = new THREE.CanvasTexture(diffCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(repeatX, repeatY);

    const normalMap = generateNormalFromHeight(roughCanvas, 1.5);
    normalMap.repeat.set(repeatX, repeatY);

    return { map, roughnessMap, normalMap };
}\n
function createStoneTextures(baseHex, veinHex, repeat = 3) {
    const size = 512;
    const diffCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');
    diffCanvas.width = roughCanvas.width = size;
    diffCanvas.height = roughCanvas.height = size;

    const dCtx = diffCanvas.getContext('2d');
    const rCtx = roughCanvas.getContext('2d');

    dCtx.fillStyle = baseHex;
    dCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = 'rgb(72, 72, 72)';
    rCtx.fillRect(0, 0, size, size);

    dCtx.strokeStyle = veinHex;
    for (let v = 0; v < 18; v++) {
        dCtx.globalAlpha = 0.08 + (v % 4) * 0.04;
        dCtx.lineWidth = 0.8 + (v % 3) * 0.9;
        dCtx.beginPath();
        let x = (v * 79) % size;
        let y = 0;
        dCtx.moveTo(x, y);
        while (y < size) {
            y += 32;
            x += Math.sin(y * 0.02 + v) * 24;
            dCtx.lineTo(x, y);
        }
        dCtx.stroke();
    }
    dCtx.globalAlpha = 1.0;

    const map = new THREE.CanvasTexture(diffCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(repeat, repeat);

    const normalMap = generateNormalFromHeight(roughCanvas, 1.1);
    normalMap.repeat.set(repeat, repeat);

    return { map, roughnessMap, normalMap };
}\n
function createPlasterTextures() {
    const size = 512;
    const diffCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');
    diffCanvas.width = roughCanvas.width = size;
    diffCanvas.height = roughCanvas.height = size;

    const dCtx = diffCanvas.getContext('2d');
    const rCtx = roughCanvas.getContext('2d');

    dCtx.fillStyle = '#ffffff';
    dCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = 'rgb(205, 205, 205)';
    rCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 650; i++) {
        const x = (i * 97) % size;
        const y = (i * 53 + Math.floor(i / 11) * 19) % size;
        const rad = 10 + (i % 24);
        const tone = 246 + (i % 10);
        dCtx.fillStyle = `rgba(${tone},${tone},${tone},0.16)`;
        dCtx.beginPath();
        dCtx.arc(x, y, rad, 0, Math.PI * 2);
        dCtx.fill();

        const rTone = 185 + (i % 45);
        rCtx.fillStyle = `rgba(${rTone},${rTone},${rTone},0.18)`;
        rCtx.beginPath();
        rCtx.arc(x, y, rad, 0, Math.PI * 2);
        rCtx.fill();
    }

    const map = new THREE.CanvasTexture(diffCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 2);

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(3, 2);

    const normalMap = generateNormalFromHeight(roughCanvas, 0.9);
    normalMap.repeat.set(3, 2);

    return { map, roughnessMap, normalMap };
}\n

const colorHexes=Object.freeze(['#f4efe6','#e8decb','#d8dadf','#d5cfc2','#cfd8cf']);
export const GEMINI_WALL_COLORS=colorHexes;
export const GEMINI_FLOOR_KEYS=Object.freeze(['oak','walnut','marble','concrete']);
const surfaces=new Map();
let plasterMaps=null;
function defaultMaps(key){
 if(surfaces.has(key))return surfaces.get(key);
 const generated=key==='oak'?createWoodTextures('#c9a276','#8d643b',.26,.55,4,4):
  key==='walnut'?createWoodTextures('#6d4730','#3a2214',.24,.52,4,4):
  key==='marble'?createStoneTextures('#eceae4','#a8a29e',3):
  createStoneTextures('#9ca3af','#6b7280',3);
 for(const tex of Object.values(generated))tex.anisotropy=4;
 surfaces.set(key,generated);return generated;
}
export function geminiFloorMaterial(key){
 const maps=defaultMaps(GEMINI_FLOOR_KEYS.includes(key)?key:'oak');
 const roughness={oak:.44,walnut:.42,marble:.22,concrete:.55}[key]??.44;
 return new THREE.MeshStandardMaterial({...maps,
  normalScale:new THREE.Vector2(key==='marble'?.3:key==='concrete'?.45:.5,key==='marble'?.3:key==='concrete'?.45:.5),
  roughness,metalness:key==='marble'?.04:key==='concrete'?.03:.02,side:THREE.DoubleSide
 });
}
export function geminiPlasterMaterial(color='#f4efe6'){
 if(!plasterMaps){
  plasterMaps=createPlasterTextures();
  for(const tex of Object.values(plasterMaps))tex.anisotropy=4;
 }
 return new THREE.MeshStandardMaterial({
  color:new THREE.Color(color),...plasterMaps,normalScale:new THREE.Vector2(.35,.35),
  roughness:.86,metalness:0,side:THREE.DoubleSide
 });
}
let tvScreenCanvas=null,tvScreenCtx=null,tvScreenTexture=null,isTVOn=true;
function drawTVFrame(channel, time) {
    if (!tvScreenCtx || !tvScreenCanvas) return;
    const w = tvScreenCanvas.width;
    const h = tvScreenCanvas.height;
    const ctx = tvScreenCtx;

    if (!isTVOn) {
        ctx.fillStyle = '#06080c';
        ctx.fillRect(0, 0, w, h);
        if (tvScreenTexture) tvScreenTexture.needsUpdate = true;
        return;
    }

    if (channel === 'nature') {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0f2942');
        g.addColorStop(0.52, '#2d6a8e');
        g.addColorStop(0.53, '#183a4a');
        g.addColorStop(1, '#091922');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Sun glow
        const sunX = w * 0.68 + Math.sin(time * 0.25) * 14;
        const sunY = h * 0.34;
        const rg = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 150);
        rg.addColorStop(0, 'rgba(255, 244, 210, 0.95)');
        rg.addColorStop(0.35, 'rgba(251, 191, 36, 0.45)');
        rg.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);

        // Mountain ridge
        ctx.fillStyle = '#0c1f2e';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.53);
        ctx.lineTo(w * 0.22, h * 0.36);
        ctx.lineTo(w * 0.45, h * 0.48);
        ctx.lineTo(w * 0.72, h * 0.32);
        ctx.lineTo(w, h * 0.49);
        ctx.lineTo(w, h * 0.53);
        ctx.closePath();
        ctx.fill();

        // Lake water shimmer
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.38)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
            const wy = h * 0.56 + i * 13;
            const wave = Math.sin(time * 2.2 + i) * 18;
            ctx.beginPath();
            ctx.moveTo(sunX - 55 + wave, wy);
            ctx.lineTo(sunX + 55 - wave, wy);
            ctx.stroke();
        }
    } else if (channel === 'fireplace') {
        ctx.fillStyle = '#0c0807';
        ctx.fillRect(0, 0, w, h);

        const glow = ctx.createRadialGradient(w * 0.5, h * 0.72, 20, w * 0.5, h * 0.65, 280);
        glow.addColorStop(0, 'rgba(255, 140, 30, 0.75)');
        glow.addColorStop(0.55, 'rgba(190, 45, 10, 0.35)');
        glow.addColorStop(1, 'rgba(12, 8, 7, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        for (let f = 0; f < 14; f++) {
            const fx = w * 0.25 + f * (w * 0.5 / 13);
            const flicker = Math.sin(time * 7.5 + f * 1.7) * 26;
            const fh = 120 + (f % 4) * 25 + flicker;
            const fg = ctx.createLinearGradient(fx, h * 0.85, fx, h * 0.85 - fh);
            fg.addColorStop(0, '#fff7ed');                    fg.addColorStop(0.35, '#f59e0b');
            fg.addColorStop(0.8, '#dc2626');
            fg.addColorStop(1, 'rgba(220, 38, 38, 0)');
            ctx.fillStyle = fg;
            ctx.beginPath();
            ctx.ellipse(fx, h * 0.85 - fh * 0.45, 22, fh * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        const ag = ctx.createLinearGradient(0, 0, w, h);
        ag.addColorStop(0, '#1e1b4b');
        ag.addColorStop(0.5, '#312e81');
        ag.addColorStop(1, '#78350f');
        ctx.fillStyle = ag;
        ctx.fillRect(0, 0, w, h);

        for (let c = 0; c < 5; c++) {
            const cx = w * (0.2 + c * 0.15) + Math.sin(time * 0.8 + c) * 25;
            const cy = h * 0.5 + Math.cos(time * 0.6 + c) * 35;
            ctx.strokeStyle = c % 2 === 0 ? 'rgba(251, 191, 36, 0.7)' : 'rgba(56, 189, 248, 0.65)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(cx, cy, 65 + c * 18, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    if (tvScreenTexture) tvScreenTexture.needsUpdate = true;
}\n
export const GEMINI_TV_CHANNELS=Object.freeze(['nature','fireplace','abstract']);
let currentChannel='nature',lastTVTime=-Infinity;
export function setGeminiTVChannel(channel){if(!GEMINI_TV_CHANNELS.includes(channel))return;currentChannel=channel;lastTVTime=-Infinity;}
export function getGeminiTVChannel(){return currentChannel;}
export function setGeminiTVOn(on){isTVOn=!!on;lastTVTime=-Infinity;}
export function makeGeminiTVScreenMaterial(){
 if(!tvScreenCanvas){
  tvScreenCanvas=document.createElement('canvas');
  tvScreenCanvas.width=1024;tvScreenCanvas.height=576;
  tvScreenCtx=tvScreenCanvas.getContext('2d');
  tvScreenTexture=new THREE.CanvasTexture(tvScreenCanvas);
  tvScreenTexture.colorSpace=THREE.SRGBColorSpace;
  drawTVFrame(currentChannel,0);
 }
 return new THREE.MeshStandardMaterial({
  map:tvScreenTexture,emissiveMap:tvScreenTexture,emissive:0xffffff,
  emissiveIntensity:isTVOn?1.15:0,roughness:.14,metalness:.08
 });
}
export function updateGeminiTV(timeMs){
 if(!tvScreenTexture||!isTVOn)return;
 if(timeMs-lastTVTime<250)return;
 lastTVTime=timeMs;
 drawTVFrame(currentChannel,timeMs*.001);
}
const consoleMaterialCache=new Map();
export function geminiConsoleMaterial(key='walnut'){
 const cached=consoleMaterialCache.get(key);
 if(cached)return cached.clone();
 let material;
 if(key==='nero'){
  const maps=createStoneTextures('#1f2124','#d4af37',2);
  material=new THREE.MeshPhysicalMaterial({...maps,roughness:.18,metalness:.05,clearcoat:.75,clearcoatRoughness:.12,envMapIntensity:.5});
 }else if(key==='lacquer')material=new THREE.MeshPhysicalMaterial({color:0x3b3734,roughness:.24,metalness:.04,clearcoat:.65,clearcoatRoughness:.15});
 else{
  const maps=createWoodTextures('#573724','#2e1b10',.16,.32,2,1);
  material=new THREE.MeshPhysicalMaterial({...maps,roughness:.28,metalness:.02,clearcoat:.55,clearcoatRoughness:.18,envMapIntensity:.45});
 }
 consoleMaterialCache.set(key,material);return material.clone();
}
