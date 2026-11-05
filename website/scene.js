import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const neutral = 0xf8f6f1;
const tone = (color, roughness = 0.86) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.8 });
const wood = tone(0x594032, 0.43);
const steel = new THREE.MeshStandardMaterial({ color: 0x9c9288, metalness: 0.65, roughness: 0.35 });

function box(group, x, y, z, w, h, d, radius, material, rotationY = 0) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, radius), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function leg(group, x, z, length = 0.26) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, length, 10), wood);
  mesh.position.set(x, -0.78, z);
  mesh.castShadow = true;
  group.add(mesh);
}

function pillow(group, x, y, z, size, material, angle = 0) {
  const pillowMesh = box(group, x, y, z, size, size * 0.82, 0.18, 0.11, material);
  pillowMesh.rotation.z = angle;
  pillowMesh.rotation.x = -0.13;
  return pillowMesh;
}

function addLegs(group, left = -1.62, right = 1.62) {
  for (const x of [left, right]) for (const z of [-0.52, 0.53]) leg(group, x, z);
}

function makeAria(color) {
  const group = new THREE.Group();
  const fabric = tone(color);
  const fabricShade = tone(new THREE.Color(color).multiplyScalar(0.89), 0.9);
  const detail = tone(0xbba28b);
  box(group, 0, -0.48, 0, 3.74, 0.38, 1.53, 0.15, fabricShade);
  box(group, 0, 0.08, -0.65, 3.64, 1.12, 0.32, 0.17, fabricShade);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.16;
    box(group, x, -0.17, 0.15, 1.13, 0.25, 1.24, 0.12, fabric);
    const back = box(group, x, 0.32, -0.48, 1.09, 0.81, 0.22, 0.13, fabric);
    back.rotation.x = 0.11;
  }
  box(group, -1.72, -0.12, 0.02, 0.32, 0.84, 1.56, 0.16, fabricShade);
  box(group, 1.72, -0.12, 0.02, 0.32, 0.84, 1.56, 0.16, fabricShade);
  pillow(group, -1.20, 0.11, 0.41, 0.48, detail, -0.20);
  pillow(group, 1.19, 0.14, 0.42, 0.45, detail, 0.16);
  addLegs(group);
  return { group, fabricMaterials: [fabric, fabricShade], defaultColor: color };
}

function makeNava(color) {
  const group = new THREE.Group();
  const fabric = tone(color, 0.78);
  const shade = tone(new THREE.Color(color).multiplyScalar(0.79), 0.82);
  const accent = tone(0xd8c8b1, 0.9);
  box(group, 0, -0.52, 0, 3.83, 0.34, 1.54, 0.16, shade);
  box(group, -1.19, -0.53, 0.53, 1.38, 0.32, 2.36, 0.15, shade);
  box(group, 0, 0.07, -0.64, 3.83, 0.97, 0.31, 0.18, shade);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.23;
    box(group, x, -0.19, 0.14, 1.18, 0.29, 1.23, 0.12, fabric);
    const back = box(group, x, 0.27, -0.49, 1.14, 0.74, 0.24, 0.13, fabric);
    back.rotation.x = 0.07;
  }
  box(group, -1.2, -0.21, 0.85, 1.19, 0.3, 1.39, 0.11, fabric);
  box(group, 1.77, -0.18, 0.08, 0.25, 0.64, 1.52, 0.12, shade);
  box(group, -1.76, -0.18, 0.15, 0.25, 0.63, 1.42, 0.12, shade);
  pillow(group, 1.20, 0.16, -0.29, 0.47, accent, 0.16);
  addLegs(group);
  leg(group, -1.59, 1.45, 0.23);
  leg(group, -0.67, 1.45, 0.23);
  return { group, fabricMaterials: [fabric, shade], defaultColor: color };
}

function makeRoza(color) {
  const group = new THREE.Group();
  const fabric = tone(color, 0.9);
  const shade = tone(new THREE.Color(color).multiplyScalar(0.91), 0.92);
  const accent = tone(0xe5d7bd);
  box(group, 0, -0.55, 0, 3.72, 0.4, 1.60, 0.19, shade);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.22;
    box(group, x, -0.19, 0.12, 1.16, 0.38, 1.32, 0.19, fabric);
    box(group, x, 0.36, -0.57, 1.18, 0.96, 0.35, 0.2, fabric);
  }
  box(group, -1.72, -0.17, 0.05, 0.31, 0.72, 1.55, 0.15, fabric);
  box(group, 1.72, -0.17, 0.05, 0.31, 0.72, 1.55, 0.15, fabric);
  pillow(group, -1.11, 0.1, 0.48, 0.53, accent, -0.2);
  pillow(group, 1.13, 0.1, 0.48, 0.42, accent, 0.17);
  for (const x of [-1.63, 1.63]) for (const z of [-0.52, 0.53]) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), steel);
    mesh.position.set(x, -0.81, z);
    group.add(mesh);
  }
  return { group, fabricMaterials: [fabric, shade], defaultColor: color };
}

const factories = [makeAria, makeNava, makeRoza];
const defaults = ['#d7c6ad', '#345f69', '#bb7960'];
const fallbackAssets = ['./sofa-aria.webp', './sofa-nava.webp', './sofa-roza.webp'];
export function createSofa(variant = 0, color) {
  return factories[variant % 3](color || defaults[variant % 3]);
}

export function tintSofa(model, hex) {
  const base = new THREE.Color(hex);
  model.fabricMaterials[0].color.copy(base);
  model.fabricMaterials[1].color.copy(base).multiplyScalar(0.86);
}

function baseScene(background = null) {
  const scene = new THREE.Scene();
  if (background != null) scene.background = new THREE.Color(background);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc1b8a7, 2.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff7e9, 3.9);
  key.position.set(-4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0005;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe1ecff, 1.2);
  fill.position.set(4, 4, -4);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.15, color: 0x524338 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.92;
  ground.receiveShadow = true;
  scene.add(ground);
  return scene;
}

function rendererFor(canvas, alpha = true, preserveDrawingBuffer = false) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.38;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function cameraFor(aspect = 1.6) {
  const camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 50);
  camera.position.set(5.7, 2.15, 8.4);
  camera.lookAt(0, -0.08, 0);
  return camera;
}

// Each product is presented from the front. During a chapter change it turns
// only as far as its side, swaps at the narrow edge, and the next product
// turns from the opposite side to face the visitor. No 180° back views.
const sofaTurnDegrees = 84;
const sofaTurnLead = 0.105;
const sofaTurnTail = 0.065;
const smoothstep = value => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function heroSofaPose(progress) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  for (let chapter = 0; chapter < 2; chapter++) {
    const boundary = (chapter + 1) / 3;
    const start = boundary - sofaTurnLead;
    const halfway = boundary - 0.015;
    const end = boundary + sofaTurnTail;
    if (p < start) return { index: chapter, angle: 0 };
    if (p < halfway) {
      return { index: chapter, angle: sofaTurnDegrees * smoothstep((p - start) / (halfway - start)) };
    }
    if (p < end) {
      return { index: chapter + 1, angle: -sofaTurnDegrees * (1 - smoothstep((p - halfway) / (end - halfway))) };
    }
  }
  return { index: 2, angle: 0 };
}

export function mountHero(canvas, progressGetter) {
  if (!canvas) return () => {};
  const stage = canvas.closest('.hero-scene-wrap');
  const fallback = stage?.querySelector('.hero-fallback');
  const fallbackItems = [...(fallback?.querySelectorAll('img') || [])];
  let fallbackAlive = true;
  let previousIndex = -1;
  let visualProgress = 0;
  let previousFrameTime = 0;
  const nextPose = now => {
    const deltaSeconds = previousFrameTime ? Math.min((now - previousFrameTime) / 1000, 0.07) : 1 / 60;
    previousFrameTime = now;
    // A fast wheel gesture must still play every intermediate turn, rather
    // than jumping straight to the final sofa and skipping the animation.
    const maxStep = Math.max(0.0005, deltaSeconds * 0.36);
    const target = THREE.MathUtils.clamp(progressGetter(), 0, 1);
    visualProgress += THREE.MathUtils.clamp(target - visualProgress, -maxStep, maxStep);
    return heroSofaPose(visualProgress);
  };
  const animateFallback = now => {
    if (!fallbackAlive) return;
    const { index, angle } = nextPose(now);
    if (index !== previousIndex) {
      fallbackItems.forEach((item, i) => item.classList.toggle('is-current', i === index));
      previousIndex = index;
    }
    if (fallback) {
      fallback.style.setProperty('--sofa-shift', `${(visualProgress - 0.5) * 70}px`);
      fallback.style.setProperty('--sofa-rotation', `${angle.toFixed(2)}deg`);
    }
    requestAnimationFrame(animateFallback);
  };
  let renderer;
  try { renderer = rendererFor(canvas); } catch {
    canvas.style.display = 'none';
    requestAnimationFrame(animateFallback);
    return () => { fallbackAlive = false; };
  }
  stage?.classList.add('has-webgl');
  const scene = baseScene();
  const camera = cameraFor();
  const pivot = new THREE.Group();
  scene.add(pivot);
  const models = [0, 1, 2].map(i => createSofa(i));
  models.forEach(({ group }, i) => { group.visible = i === 0; pivot.add(group); });
  let alive = true;
  let lastW = 0, lastH = 0;
  const animate = now => {
    if (!alive) return;
    const width = canvas.clientWidth || 900, height = canvas.clientHeight || 600;
    if (width !== lastW || height !== lastH) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(width < 700 ? 6.8 : 5.7, width < 700 ? 2.85 : 2.15, width < 700 ? 10.7 : 8.4);
      camera.updateProjectionMatrix();
      camera.lookAt(0, -0.08, 0);
      lastW = width; lastH = height;
    }
    const { index, angle } = nextPose(now);
    models.forEach((m, i) => { m.group.visible = i === index; });
    const cameraFacingAngle = Math.atan2(camera.position.x, camera.position.z);
    pivot.rotation.y = cameraFacingAngle + THREE.MathUtils.degToRad(angle);
    pivot.rotation.z = 0;
    pivot.position.x = THREE.MathUtils.lerp(-0.16, 0.16, visualProgress);
    pivot.position.y = 0.04;
    pivot.scale.setScalar(lastW < 700 ? 0.88 : 1.02);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  return () => { alive = false; fallbackAlive = false; renderer.dispose(); };
}

export function createProductImages() {
  const images = [...document.querySelectorAll('img[data-sofa-image]')];
  if (!images.length) return;
  images.forEach(img => { img.src = fallbackAssets[Number(img.dataset.sofaImage || 0) % 3]; });
}

let viewerDispose = null;
export function mountViewer(container, variant = 0, color) {
  if (viewerDispose) viewerDispose();
  const canvas = document.createElement('canvas');
  canvas.className = 'product-viewer-canvas';
  container.replaceChildren(canvas);
  let renderer;
  try { renderer = rendererFor(canvas); } catch {
    container.innerHTML = `<div class="viewer-static"><img src="${fallbackAssets[variant % 3]}" alt="تصویر نمونه محصول"/><p>مرورگر فعلی از WebGL پشتیبانی نمی‌کند. نمایش چرخش سه‌بعدی روی دستگاه سازگار فعال می‌شود.</p></div>`;
    return { setColor() {}, dispose() { container.replaceChildren(); } };
  }
  const scene = baseScene();
  const camera = cameraFor();
  camera.position.set(4.8, 2.3, 7.7);
  camera.lookAt(0, -0.1, 0);
  const model = createSofa(variant, color);
  scene.add(model.group);
  let angle = 0, dragging = false, px = 0, alive = true;
  const onDown = e => { dragging = true; px = e.clientX; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = e => { if (!dragging) return; angle += (e.clientX - px) * 0.008; px = e.clientX; };
  const onUp = () => { dragging = false; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  const loop = () => {
    if (!alive) return;
    const w = container.clientWidth || 600, h = container.clientHeight || 440;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!dragging) angle += 0.002;
    model.group.rotation.y = angle;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
  viewerDispose = () => { alive = false; renderer.dispose(); canvas.remove(); };
  return { setColor: hex => tintSofa(model, hex), dispose: viewerDispose };
}

export async function startAR(container, variant, color, onStatus) {
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-ar'))) {
    onStatus('واقعیت افزوده در این مرورگر یا دستگاه پشتیبانی نمی‌شود؛ نمای سه‌بعدی همچنان در دسترس است.');
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'ar-canvas';
  container.prepend(canvas);
  const renderer = rendererFor(canvas, true);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  const scene = new THREE.Scene();
  const light = new THREE.HemisphereLight(0xffffff, 0xbab3a8, 2.6);
  scene.add(light);
  const model = createSofa(variant, color);
  model.group.scale.setScalar(0.53);
  model.group.visible = false;
  scene.add(model.group);
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.15, 44).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x21bca8, side: THREE.DoubleSide }));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  const camera = new THREE.PerspectiveCamera();
  let session, hitTestSource, referenceSpace;
  try {
    session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: container } });
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    referenceSpace = await session.requestReferenceSpace('local');
    onStatus('دوربین را به سمت کف بگیرید؛ برای قرار دادن مبل روی تصویر لمس کنید.');
    session.addEventListener('select', () => {
      if (!reticle.visible) return;
      model.group.position.setFromMatrixPosition(reticle.matrix);
      model.group.visible = true;
      onStatus('مبل قرار گرفت؛ برای تغییر رنگ از دکمه‌های پایین استفاده کنید.');
    });
    renderer.setAnimationLoop((_, frame) => {
      if (frame && hitTestSource && referenceSpace) {
        const results = frame.getHitTestResults(hitTestSource);
        reticle.visible = results.length > 0;
        if (results.length) {
          const pose = results[0].getPose(referenceSpace);
          if (pose) reticle.matrix.fromArray(pose.transform.matrix);
        }
      }
      renderer.render(scene, camera);
    });
    return {
      setColor: hex => tintSofa(model, hex),
      rotate: radians => { model.group.rotation.y += radians; },
      move: (x, z) => { model.group.position.x += x; model.group.position.z += z; },
      reset: () => { model.group.visible = false; },
      stop: async () => { renderer.setAnimationLoop(null); hitTestSource?.cancel(); if (session && session.visibilityState !== 'hidden') await session.end().catch(() => {}); renderer.dispose(); canvas.remove(); },
    };
  } catch (error) {
    onStatus('اجازه دوربین یا اسکن کف صادر نشد: ' + (error?.message || 'خطای ناشناخته'));
    renderer.dispose(); canvas.remove();
    return null;
  }
}
