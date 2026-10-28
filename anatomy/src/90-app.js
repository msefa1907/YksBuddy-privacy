// ===================== Scene, registry, UI =====================
function startApp() {
const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(max-width: 860px)').matches || matchMedia('(pointer: coarse)').matches;

const LAYERS = [
  { key: 'skin', tr: 'Deri', color: '#d2a185', on: false },
  { key: 'muscle', tr: 'Kas sistemi', color: '#b5392f', on: false },
  { key: 'skeleton', tr: 'İskelet sistemi', color: '#e6dcc3', on: true },
  { key: 'nervous', tr: 'Sinir sistemi', color: '#f0c64a', on: true },
  { key: 'heart', tr: 'Kalp', color: '#a8322e', on: true },
  { key: 'arteries', tr: 'Atardamarlar', color: '#d6343c', on: true },
  { key: 'veins', tr: 'Toplardamarlar', color: '#3d64c8', on: true },
  { key: 'respiratory', tr: 'Solunum sistemi', color: '#e09c9c', on: true },
  { key: 'digestive', tr: 'Sindirim sistemi', color: '#d8946f', on: true },
  { key: 'urinary', tr: 'Boşaltım sistemi', color: '#b0603f', on: true },
  { key: 'endocrine', tr: 'Endokrin bezler', color: '#d0a43e', on: true },
];
const LAYER = Object.fromEntries(LAYERS.map(l => [l.key, l]));

// ---------- renderer ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = false;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 30);
camera.position.set(0.0, 0.98, 4.1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.88, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.12; controls.maxDistance = 8;
controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.8;
controls.update();

{
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
}
scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x2a2420, 0.55));
const key = new THREE.DirectionalLight(0xfff1e2, 2.3);
key.position.set(1.4, 2.6, 2.2); key.target.position.set(0, 0.9, 0);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1.0, right: 1.0, top: 1.1, bottom: -1.1, near: 0.5, far: 6 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.002; key.shadow.radius = 3;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x9cc8ff, 1.3); rim.position.set(-1.8, 1.6, -2.2); scene.add(rim);
const fill = new THREE.DirectionalLight(0xffd9c4, 0.45); fill.position.set(-2, 0.6, 1.5); scene.add(fill);

// floor: soft disc + contact shadow
{
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(120,170,200,0.22)'); gr.addColorStop(0.55, 'rgba(70,110,140,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.001; scene.add(disc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.625, 128), new THREE.MeshBasicMaterial({ color: 0x6fd0e0, transparent: true, opacity: 0.18, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.ShadowMaterial({ opacity: 0.32 }));
  sh.rotation.x = -Math.PI / 2; sh.receiveShadow = true; scene.add(sh);
}

// ---------- procedural textures ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// height field -> normal map
function normalFromHeight(hf, w, h, strength) {
  return canvasTex(w, h, (g) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const hL = hf[y * w + ((x - 1 + w) % w)], hR = hf[y * w + ((x + 1) % w)];
      const hD = hf[((y - 1 + h) % h) * w + x], hU = hf[((y + 1) % h) * w + x];
      let nx = (hL - hR) * strength, ny = (hD - hU) * strength, nz = 1; const l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4; img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
}
const TEX = (() => {
  const W = 256, H = 256; const rnd = mulberry32(7);
  // muscle fibres run along v (texture y)
  const col = new Float32Array(W); for (let x = 0; x < W; x++) col[x] = rnd();
  const hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fib = 0.5 + 0.5 * Math.sin((x / W) * TAU * 48 + 2.2 * Math.sin((y / H) * TAU * 2 + x * 0.05));
    const n = noise3(x / W * 16, y / H * 3, 0.5) * 0.5 + noise3(x / W * 64, y / H * 6, 3.1) * 0.25;
    hf[y * W + x] = fib * 0.6 + col[x] * 0.25 + n;
  }
  const muscleMap = canvasTex(W, H, (g) => {
    const img = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { const v = 200 + 55 * clamp(hf[i] * 0.8, 0, 1); img.data[4 * i] = v; img.data[4 * i + 1] = v * 0.97; img.data[4 * i + 2] = v * 0.97; img.data[4 * i + 3] = 255; }
    g.putImageData(img, 0, 0);
  });
  const muscleNormal = normalFromHeight(hf, W, H, 2.2);
  // generic wet organ bump
  const of = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W * TAU, v = y / H * TAU;
    of[y * W + x] = noise3(Math.cos(u) * 2 + 9, Math.sin(u) * 2, Math.cos(v) * 2 + Math.sin(v)) + 0.5 * noise3(Math.cos(u) * 6, Math.sin(u) * 6 + 3, Math.cos(v) * 6 - Math.sin(v) * 2);
  }
  const organNormal = normalFromHeight(of, W, H, 3.0);
  return { muscleMap, muscleNormal, organNormal };
})();

// ---------- materials ----------
const MATS = {};
const layerMats = {};
function defMat(name, layer, params) {
  const m = new THREE.MeshPhysicalMaterial(params);
  m.userData.layer = layer; m.userData.baseOpacity = params.opacity ?? 1; MATS[name] = m;
  (layerMats[layer] ||= new Set()).add(m);
  return m;
}
defMat('bone', 'skeleton', { color: 0xe7dcc4, roughness: 0.6, vertexColors: true, clearcoat: 0.06, clearcoatRoughness: 0.6 });
defMat('cartilage', 'skeleton', { color: 0xb9d3d8, roughness: 0.34, vertexColors: true, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: 0x9fd0e6 });
defMat('disc', 'skeleton', { color: 0xa9c6cc, roughness: 0.4, vertexColors: true, clearcoat: 0.4 });
// skin: fresnel-weighted alpha so the translucent body reads as a glassy silhouette
const skinMat = defMat('skin', 'skin', { color: 0xc99479, roughness: 0.52, vertexColors: true, sheen: 0.5, sheenColor: 0xffc9b0, sheenRoughness: 0.6, clearcoat: 0.06, clearcoatRoughness: 0.5 });
skinMat.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
    float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
    if (diffuseColor.a < 0.999) {
      diffuseColor.a = clamp(diffuseColor.a * 0.45 + fres * 1.1 * diffuseColor.a + fres * 0.16, 0.0, 1.0);
      outgoingLight = mix(outgoingLight * 1.15, vec3(0.80, 0.88, 0.97), fres * 0.7);
    }
    #include <opaque_fragment>`);
};
Object.assign(skinMat, { opacity: 0.32, transparent: true, depthWrite: false });
defMat('tooth', 'skeleton', { color: 0xf4f0e6, roughness: 0.22, vertexColors: true, clearcoat: 0.8, clearcoatRoughness: 0.15 });

// ---------- registry ----------
const groups = {};
for (const l of LAYERS) { const g = new THREE.Group(); g.name = l.key; g.visible = l.on; groups[l.key] = g; scene.add(g); }
const PARTS_LIST = [];
const byId = new Map();
let triTotal = 0;
function ingest(rec) {
  const geo = new THREE.BufferGeometry();
  for (const k in rec.attrs) geo.setAttribute(k, new THREE.BufferAttribute(rec.attrs[k], k === 'uv' ? 2 : 3));
  geo.setIndex(new THREE.BufferAttribute(rec.index, 1));
  if (rec.path) geo.userData.path = rec.path;
  const meta = rec.meta; const mat = MATS[rec.mat];
  if (!mat) { console.warn('material', rec.mat); return; }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = !meta.noShadow; mesh.receiveShadow = true;
  if (meta.pivot) { const p = vec(meta.pivot); geo.translate(-p.x, -p.y, -p.z); mesh.position.copy(p); }
  geo.computeBoundingSphere();
  mesh.userData = { ...meta, mat: rec.mat, basePos: mesh.position.clone() };
  mesh.userData.center = geo.boundingSphere.center.clone().add(mesh.position);
  if (state.selected === null && state.isolate) mesh.material = ghostMat;
  groups[meta.layer].add(mesh);
  PARTS_LIST.push(mesh); byId.set(meta.id, mesh);
  triTotal += rec.index.length / 3;
  if (meta.anim && ANIM[meta.anim]) ANIM[meta.anim].push(mesh);
  if (meta.flow && rec.path) {
    const fp = preparePath(meta.flow.reverse ? rec.path.slice().reverse() : rec.path, meta.flow.kind, meta.flow.speed || 0.12);
    (meta.flow.kind === 'n' ? FLOW.nervePaths : FLOW.paths).push(fp);
  }
}

// ---------- build pipeline (workers with inline fallback) ----------
const buildErrors = [];
function workerURL() {
  const el = document.getElementById('app');
  let threeURL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
  try { threeURL = import.meta.resolve('three'); } catch (e) { /* older browsers: keep the pinned CDN URL */ }
  let src = el.textContent.replace(/^import \* as THREE from 'three';$/m, `import * as THREE from '${threeURL}';`);
  src = src.replace(/^import \{[^}]*\} from 'three\/addons\/[^']*';$/mg, '');
  src = 'const OrbitControls = null, RoomEnvironment = null;\n' + src;
  return URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
}
function setProgress(frac, label) {
  const pct = Math.round(frac * 100) + '%';
  $('bar').firstElementChild.style.width = pct; $('stepPct').textContent = pct; if (label) $('stepName').textContent = label;
  $('buildBar').style.width = pct; $('buildBar').parentElement.hidden = frac >= 1;
  $('stParts').textContent = PARTS_LIST.length.toLocaleString('tr-TR'); $('stTris').textContent = fmtK(Math.round(triTotal));
}
async function buildAll() {
  const t0 = performance.now();
  const tasks = planTasks(); const n = tasks.length;
  const order = tasks.map((t, i) => i).sort((a, b) => (tasks[b].provides ? 1 : 0) - (tasks[a].provides ? 1 : 0));
  const finished = new Set(); const available = new Set();
  const onDone = (i, recs, err) => {
    if (err) { console.error(tasks[i].label, err); buildErrors.push(`${tasks[i].label}: ${String(err).split('\n')[0]}`); }
    for (const r of recs) ingest(r);
    finished.add(i); setProgress(finished.size / n, tasks[i].label);
    if (finished.size > 6) revealStage();
  };
  const runInline = async () => {
    for (const i of order) {
      if (finished.has(i)) continue;
      let recs = [], err = null;
      try { recs = runTask(tasks[i]); } catch (e) { err = e.stack || e; }
      if (tasks[i].provides) available.add(tasks[i].provides);
      onDone(i, recs, err);
      await new Promise(r => setTimeout(r, 0));
    }
  };
  const nW = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 8));
  let workers = [];
  try { const url = workerURL(); for (let k = 0; k < nW; k++) workers.push(new Worker(url, { type: 'module' })); } catch (e) { console.warn('workers unavailable', e); workers = []; }
  if (workers.length) {
    const ok = await new Promise((resolve) => {
      const pending = order.slice(); const idle = []; let readyCount = 0; let failed = false;
      const timer = setTimeout(() => { if (!readyCount) { failed = true; resolve(false); } }, 12000);
      const dispatch = () => {
        while (idle.length) {
          const k = pending.findIndex(i => tasks[i].needs.every(x => available.has(x)));
          if (k < 0) break;
          const i = pending.splice(k, 1)[0]; const w = idle.pop(); w.postMessage({ type: 'run', index: i });
        }
      };
      for (const w of workers) {
        w.onerror = (e) => { console.warn('worker error', e.message); if (!readyCount && !failed) { failed = true; clearTimeout(timer); resolve(false); } };
        w.onmessage = (e) => {
          const m = e.data; if (failed) return;
          if (m.type === 'ready') { readyCount++; idle.push(w); dispatch(); return; }
          if (m.type !== 'done') return;
          if (m.shared) { available.add(m.shared.key); SHARED[m.shared.key] = m.shared.data; for (const w2 of workers) w2.postMessage({ type: 'shared', key: m.shared.key, data: m.shared.data }); }
          onDone(m.index, m.recs, m.err);
          idle.push(w);
          if (finished.size === n) { clearTimeout(timer); resolve(true); } else dispatch();
        };
      }
    });
    for (const w of workers) w.terminate();
    if (!ok) await runInline();
  } else await runInline();
  STATS.buildMs = performance.now() - t0;
  STATS.workers = workers.length;
}

// ---------- interaction state ----------
const state = { selected: null, isolate: false, explode: 0, cut: false, cutAxis: 'z', cutPos: 0.52, anim: { heart: true, breath: true, flow: false, nerve: false }, labels: false, spin: false };
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pickables() {
  const out = [];
  for (const l of LAYERS) {
    const g = groups[l.key]; if (!g.visible) continue;
    if (l.key === 'skin' && layerOpacity.skin < 0.55) continue;
    for (const m of g.children) if (m.visible && m.isMesh && !m.userData.noPick) out.push(m);
  }
  return out;
}
const layerOpacity = Object.fromEntries(LAYERS.map(l => [l.key, l.key === 'skin' ? 0.32 : 1]));
function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const objs = pickables();
  // lazy BVH-free raycast: test bounding spheres first (three does), keep nearest
  const hits = raycaster.intersectObjects(objs, false);
  for (const h of hits) {
    if (state.cut && cutPlane.distanceToPoint(h.point) < 0) continue;
    if (state.isolate && h.object !== state.selected) continue;
    return h;
  }
  return null;
}

// selection highlight
const hlCache = new Map();
function highlightMat(m) {
  if (!hlCache.has(m)) {
    const h = m.clone(); h.emissive = new THREE.Color(0x3fb6cc); h.emissiveIntensity = 0.55; h.userData = { ...m.userData, hl: true };
    hlCache.set(m, h);
  }
  return hlCache.get(m);
}
const ghostMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c2, transparent: true, opacity: 0.07, depthWrite: false, roughness: 1 });
function refreshMaterials() {
  for (const m of PARTS_LIST) {
    const base = MATS[m.userData.mat];
    if (state.isolate && state.selected && m !== state.selected) m.material = ghostMat;
    else m.material = m === state.selected ? highlightMat(base) : base;
  }
  for (const [b, h] of hlCache) { h.opacity = b.opacity; h.transparent = b.transparent; h.depthWrite = b.depthWrite; }
}
function select(mesh, focus = false) {
  state.selected = mesh || null;
  if (!mesh) state.isolate = false;
  refreshMaterials();
  renderInfo();
  if (mesh && focus) focusOn(mesh);
  if (mesh && isMobile) document.body.classList.add('show-info');
}

// ---------- camera animation ----------
let camAnim = null;
function flyTo(pos, target, dur = 0.9) {
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: vec(pos), t1: vec(target), s: performance.now(), d: dur * 1000 };
}
function focusOn(mesh) {
  const bs = mesh.geometry.boundingSphere; const c = bs.center.clone().add(mesh.position);
  const r = Math.max(bs.radius, 0.03); const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = r / Math.sin((camera.fov * Math.PI / 180) / 2) * 1.25;
  flyTo(c.clone().add(dir.multiplyScalar(dist)), c);
}
const VIEWS = [
  ['Ön', [0, 0.98, 4.1], [0, 0.88, 0]], ['Arka', [0, 0.98, -4.1], [0, 0.88, 0]], ['Sol', [4.1, 0.98, 0], [0, 0.88, 0]], ['Sağ', [-4.1, 0.98, 0], [0, 0.88, 0]],
  ['Baş', [0.32, 1.7, 0.7], [0, 1.62, 0]], ['Göğüs', [0.3, 1.38, 1.3], [0, 1.26, 0.0]], ['Karın', [0.25, 1.1, 1.15], [0, 1.02, 0.0]],
  ['El', [0.62, 0.86, 0.42], [0.3, 0.78, 0.0]], ['Ayak', [0.55, 0.32, 0.62], [0.09, 0.05, 0.05]],
];

// ---------- cut plane ----------
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
function applyCut() {
  const t = state.cutPos;
  if (state.cutAxis === 'z') { cutPlane.normal.set(0, 0, -1); cutPlane.constant = lerp(-0.18, 0.2, t); }
  if (state.cutAxis === 'x') { cutPlane.normal.set(-1, 0, 0); cutPlane.constant = lerp(-0.4, 0.4, t); }
  if (state.cutAxis === 'y') { cutPlane.normal.set(0, -1, 0); cutPlane.constant = lerp(0, 1.8, t); }
  renderer.clippingPlanes = state.cut ? [cutPlane] : [];
}

// ---------- explode ----------
function applyExplode() {
  const a = state.explode;
  for (const m of PARTS_LIST) {
    const c = m.userData.center; if (!c) continue;
    const lay = m.userData.layer;
    const k = lay === 'skin' ? 0.0 : lay === 'muscle' ? 0.55 : lay === 'skeleton' ? 0.25 : 1.0;
    const off = new THREE.Vector3(c.x * 1.6, (c.y - 1.05) * 0.35, (c.z + 0.02) * 2.4 + (lay === 'muscle' ? 0.05 : 0)).multiplyScalar(a * k);
    m.position.copy(m.userData.basePos).add(off);
  }
}

// ---------- UI: layers ----------
function buildLayerUI() {
  const list = $('layerList'); list.innerHTML = '';
  for (const l of LAYERS) {
    const count = groups[l.key].children.length;
    if (!count) continue;
    const row = document.createElement('div'); row.className = 'layer' + (l.on ? ' on' : '');
    row.innerHTML = `<span class="dot" style="background:${l.color}"></span><label for="ly_${l.key}">${l.tr}<span class="count">${count}</span></label>
      <span class="switch"><input type="checkbox" id="ly_${l.key}" ${l.on ? 'checked' : ''}><i></i></span>
      <div class="op"><span>opaklık</span><input type="range" id="op_${l.key}" min="5" max="100" value="${Math.round(layerOpacity[l.key] * 100)}" aria-label="${l.tr} opaklığı"></div>`;
    list.appendChild(row);
    row.querySelector('input[type=checkbox]').addEventListener('change', (e) => { setLayer(l.key, e.target.checked); row.classList.toggle('on', e.target.checked); });
    row.querySelector('input[type=range]').addEventListener('input', (e) => setOpacity(l.key, e.target.value / 100));
  }
}
function setLayer(key, on) {
  LAYER[key].on = on; groups[key].visible = on;
  const cb = $('ly_' + key); if (cb) { cb.checked = on; cb.closest('.layer').classList.toggle('on', on); }
  if (!on && state.selected && state.selected.userData.layer === key) select(null);
  updateLabels(true);
}
function setOpacity(key, v) {
  layerOpacity[key] = v;
  for (const m of layerMats[key] || []) {
    const o = m.userData.baseOpacity * v; m.opacity = o; m.transparent = o < 0.999; m.depthWrite = o > 0.6;
    m.needsUpdate = true;
  }
  for (const mesh of groups[key].children) mesh.castShadow = v > 0.6 && !mesh.userData.noShadow;
  refreshMaterials();
}
$('allOn').addEventListener('click', () => { for (const l of LAYERS) if (groups[l.key].children.length && l.key !== 'skin') setLayer(l.key, true); });

// ---------- UI: info ----------
function triCount(m) { const g = m.geometry; return Math.round((g.index ? g.index.count : g.attributes.position.count) / 3); }
function renderInfo() {
  const box = $('info'); const m = state.selected;
  $('hint').hidden = !!m;
  if (!m) { box.hidden = true; return; }
  const u = m.userData; const l = LAYER[u.layer];
  box.hidden = false;
  box.innerHTML = `<button class="close" type="button" aria-label="Kapat">×</button>
    <div class="eyebrow"><span class="chip"><i style="background:${l.color}"></i>${l.tr}</span>${u.group ? `<span>${u.group}</span>` : ''}</div>
    <h2>${u.tr}</h2><div class="latin">${u.la || ''}</div>
    ${u.desc ? `<p>${u.desc}</p>` : ''}
    <div class="meta"><span>${triCount(m).toLocaleString('tr-TR')} üçgen</span>${u.side ? `<span>taraf: ${u.side}</span>` : ''}<span>id: ${u.id}</span></div>
    <div class="actions">
      <button class="btn" data-a="focus" type="button">Odakla</button>
      <button class="btn ${state.isolate ? 'on' : ''}" data-a="iso" type="button">Yalnız göster</button>
      <button class="btn" data-a="hide" type="button">Gizle</button>
      <button class="btn" data-a="unhide" type="button">Gizlenenleri göster</button>
    </div>`;
  box.querySelector('.close').onclick = () => { select(null); document.body.classList.remove('show-info'); };
  box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'focus') focusOn(m);
    if (a === 'iso') { state.isolate = !state.isolate; refreshMaterials(); renderInfo(); if (state.isolate) focusOn(m); }
    if (a === 'hide') { m.visible = false; m.userData.hidden = true; select(null); }
    if (a === 'unhide') { for (const p of PARTS_LIST) { p.visible = true; p.userData.hidden = false; } }
  });
}

// ---------- UI: search ----------
const trLower = (s) => s.toLocaleLowerCase('tr-TR');
const fold = (s) => trLower(s).replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a');
let searchHits = [], searchIdx = -1;
function runSearch(q) {
  const res = $('results'); res.innerHTML = ''; searchHits = []; searchIdx = -1;
  q = fold(q.trim()); if (q.length < 2) return;
  for (const m of PARTS_LIST) {
    const u = m.userData; const hay = fold(`${u.tr} ${u.la || ''} ${u.group || ''}`);
    if (hay.includes(q)) searchHits.push(m);
    if (searchHits.length >= 40) break;
  }
  for (const m of searchHits) {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="dot" style="background:${LAYER[m.userData.layer].color}"></span><span>${m.userData.tr}<small>${m.userData.la || ''}</small></span>`;
    b.onclick = () => chooseHit(m);
    res.appendChild(b);
  }
}
function chooseHit(m) {
  if (!LAYER[m.userData.layer].on) setLayer(m.userData.layer, true);
  m.visible = true; m.userData.hidden = false;
  select(m, true); $('results').innerHTML = ''; $('search').value = '';
}
$('search').addEventListener('input', (e) => runSearch(e.target.value));
$('search').addEventListener('keydown', (e) => {
  const btns = [...$('results').children];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!btns.length) return;
    searchIdx = (searchIdx + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
    btns.forEach((b, i) => b.classList.toggle('act', i === searchIdx)); btns[searchIdx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && searchHits.length) chooseHit(searchHits[Math.max(searchIdx, 0)]);
  else if (e.key === 'Escape') { $('results').innerHTML = ''; e.target.blur(); }
});

// ---------- UI: toolbar ----------
for (const [nm, p, t] of VIEWS) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = nm;
  b.onclick = () => flyTo(p, t); $('views').appendChild(b);
}
const toggleBtn = (id, fn) => { const b = $(id); b.addEventListener('click', () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); fn(on); }); };
toggleBtn('tCut', (on) => { state.cut = on; $('cutAxis').hidden = !on; $('cutWrap').hidden = !on; applyCut(); });
$('cutAxis').addEventListener('change', (e) => { state.cutAxis = e.target.value; applyCut(); });
$('cutPos').addEventListener('input', (e) => { state.cutPos = e.target.value / 1000; applyCut(); });
$('explode').addEventListener('input', (e) => { state.explode = e.target.value / 100; applyExplode(); updateLabels(true); });
toggleBtn('aHeart', (on) => state.anim.heart = on);
toggleBtn('aBreath', (on) => state.anim.breath = on);
toggleBtn('aFlow', (on) => { state.anim.flow = on; if (FLOW.points) FLOW.points.visible = on; });
toggleBtn('aNerve', (on) => { state.anim.nerve = on; if (FLOW.nervePts) FLOW.nervePts.visible = on; });
toggleBtn('tLabels', (on) => { state.labels = on; updateLabels(true); });
toggleBtn('tSpin', (on) => { state.spin = on; controls.autoRotate = on; controls.autoRotateSpeed = 1.2; });
if (isMobile) $('tShadow').classList.remove('on');
toggleBtn('tShadow', (on) => { renderer.shadowMap.enabled = on; for (const m of Object.values(MATS)) m.needsUpdate = true; });
$('mLayers').onclick = () => { document.body.classList.toggle('show-layers'); document.body.classList.remove('show-info'); };
$('mInfo').onclick = () => { document.body.classList.toggle('show-info'); document.body.classList.remove('show-layers'); };

// ---------- pointer events ----------
let downAt = null, hoverPending = null, lastHover = 0;
const tip = $('tip');
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  if (moved < 5 && e.button === 0) { const h = pick(e.clientX, e.clientY); select(h ? h.object : null); }
  downAt = null;
});
renderer.domElement.addEventListener('dblclick', (e) => { const h = pick(e.clientX, e.clientY); if (h) { select(h.object); focusOn(h.object); } });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || downAt) { tip.hidden = true; return; }
  hoverPending = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; hoverPending = null; });
function doHover() {
  if (!hoverPending || performance.now() - lastHover < 70) return;
  const [x, y] = hoverPending; hoverPending = null; lastHover = performance.now();
  const h = pick(x, y);
  if (!h) { tip.hidden = true; renderer.domElement.style.cursor = ''; return; }
  tip.hidden = false; tip.style.left = x + 'px'; tip.style.top = y + 'px';
  tip.innerHTML = `${h.object.userData.tr}<small>${h.object.userData.la || ''}</small>`;
  renderer.domElement.style.cursor = 'pointer';
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') select(null);
  if (e.key === '/' ) { e.preventDefault(); $('search').focus(); }
});

// ---------- labels ----------
const LABEL_IDS = ['skull', 'mandible', 'clavicle_L', 'sternum', 'humerus_R', 'radius_L', 'hipbone_R', 'femur_L', 'tibia_R', 'scapula_L',
  'heart_v', 'lung_L', 'lung_R', 'liver', 'stomach', 'colon_t', 'smallInt', 'kidney_L', 'brain_L', 'aorta', 'ivc', 'spinalCord', 'sciatic_R', 'bladder',
  'pectoralis_L', 'deltoid_R', 'rectusAbd_L', 'quadriceps_R', 'gastrocnemius_L', 'biceps_L', 'sartorius_R', 'trapezius_L', 'thyroid', 'diaphragm', 'pancreas', 'spleen'];
const labelEls = new Map(); let labelDirty = true;
function updateLabels(force) { if (force) labelDirty = true; }
function drawLabels() {
  const host = $('labels'); const svg = host.querySelector('svg');
  if (!state.labels) { if (labelEls.size) { labelEls.forEach(el => el.remove()); labelEls.clear(); svg.innerHTML = ''; } return; }
  let lines = '';
  const w = innerWidth, h = innerHeight; const v = new THREE.Vector3();
  for (const id of LABEL_IDS) {
    const m = byId.get(id); let el = labelEls.get(id);
    const vis = m && m.visible && groups[m.userData.layer].visible;
    if (!vis) { if (el) el.style.display = 'none'; continue; }
    if (!el) { el = document.createElement('div'); el.className = 'lb'; el.textContent = m.userData.tr.replace(/ \((sol|sağ)\)/, ''); host.appendChild(el); labelEls.set(id, el); }
    v.copy(m.geometry.boundingSphere.center).add(m.position).project(camera);
    if (v.z > 1) { el.style.display = 'none'; continue; }
    const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    const side = x > w / 2 ? 1 : -1; const lx = x + side * 46, ly = y - 26;
    el.style.display = ''; el.style.left = lx + 'px'; el.style.top = ly + 'px';
    lines += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${(ly).toFixed(1)}" stroke="rgba(228,233,236,0.55)" stroke-width="1"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#6fd0e0"/>`;
  }
  svg.innerHTML = lines;
}

// ---------- animation systems (filled by organ/vessel modules) ----------
const ANIM = { heartV: [], heartA: [], lungs: [], diaphragm: [] };
const FLOW = { points: null, nervePts: null, paths: [], nervePaths: [] };
function buildFlowParticles() {
  const sprite = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const mk = (paths, perLen, colorFn, size) => {
    const items = [];
    for (const p of paths) {
      const L = p.cum[p.cum.length - 1]; const n = Math.max(1, Math.round(L * perLen));
      for (let i = 0; i < n; i++) items.push({ p, s: (i / n) * L + Math.random() * 0.01, v: p.speed * (0.85 + Math.random() * 0.3) });
    }
    const pos = new Float32Array(items.length * 3), col = new Float32Array(items.length * 3);
    items.forEach((it, i) => { const c = colorFn(it.p); col.set(c, i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    pts.frustumCulled = false; pts.userData.items = items; pts.visible = false; scene.add(pts);
    return pts;
  };
  if (FLOW.paths.length) FLOW.points = mk(FLOW.paths, 60, (p) => p.kind === 'a' ? [1.0, 0.25, 0.22] : [0.35, 0.55, 1.0], 0.012);
  if (FLOW.nervePaths.length) FLOW.nervePts = mk(FLOW.nervePaths, 9, () => [1.0, 0.92, 0.55], 0.016);
  if (FLOW.points) FLOW.points.visible = state.anim.flow;
  if (FLOW.nervePts) FLOW.nervePts.visible = state.anim.nerve;
}
function preparePath(pts, kind, speed) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len3(sub3(pts[i], pts[i - 1])));
  return { pts, cum, kind, speed };
}
function pathAt(p, s, out) {
  const c = p.cum; const L = c[c.length - 1]; s = ((s % L) + L) % L;
  let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const t = (s - c[lo]) / Math.max(c[hi] - c[lo], 1e-9); const a = p.pts[lo], b = p.pts[hi];
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
}
function stepFlow(pts, dt, layerKeys) {
  if (!pts || !pts.visible) return;
  const vis = layerKeys.some(k => groups[k].visible);
  pts.material.opacity = vis ? 1 : 0;
  const items = pts.userData.items; const pos = pts.geometry.attributes.position.array; const o = [0, 0, 0];
  for (let i = 0; i < items.length; i++) { const it = items[i]; it.s += it.v * dt; pathAt(it.p, it.s, o); pos[3 * i] = o[0]; pos[3 * i + 1] = o[1]; pos[3 * i + 2] = o[2]; }
  pts.geometry.attributes.position.needsUpdate = true;
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let fpsEma = 60, fpsT = 0;
function heartCurve(t) {
  // one cardiac cycle t in [0,1): atrial kick then ventricular systole
  const a = Math.exp(-(((t - 0.08) / 0.05) ** 2));
  const v = Math.exp(-(((t - 0.32) / 0.09) ** 2));
  return { a, v };
}
function animate() {
  if (state.paused) { requestAnimationFrame(animate); return; }
  const dt = Math.min(clock.getDelta(), 0.05); const t = clock.elapsedTime;
  if (camAnim) {
    const k = clamp((performance.now() - camAnim.s) / camAnim.d, 0, 1); const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    if (k >= 1) camAnim = null;
  }
  controls.update();
  if (state.anim.heart) {
    const hc = heartCurve((t * 1.2) % 1);
    for (const m of ANIM.heartV) m.scale.setScalar(1 - 0.07 * hc.v);
    for (const m of ANIM.heartA) m.scale.setScalar(1 - 0.09 * hc.a + 0.03 * hc.v);
  }
  if (state.anim.breath) {
    const b = 0.5 - 0.5 * Math.cos(t * TAU / 4.2);
    for (const m of ANIM.lungs) m.scale.set(1 + 0.035 * b, 1 + 0.05 * b, 1 + 0.045 * b);
    for (const m of ANIM.diaphragm) m.position.y = m.userData.basePos.y - 0.012 * b;
  }
  stepFlow(FLOW.points, dt, ['arteries', 'veins']);
  stepFlow(FLOW.nervePts, dt, ['nervous']);
  doHover();
  renderer.render(scene, camera);
  if (state.labels) drawLabels(); else if (labelEls.size) drawLabels();
  fpsEma = fpsEma * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  if (t - fpsT > 0.5) { fpsT = t; $('stFps').textContent = Math.round(fpsEma); }
  requestAnimationFrame(animate);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const fmtK = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n);
window.__anatomy = {
  ready: false, THREE, scene, camera, controls, state, byId, PARTS_LIST,
  setView: (i) => { const v = VIEWS[i]; camera.position.copy(vec(v[1])); controls.target.copy(vec(v[2])); controls.update(); },
  look: (p, t) => { camera.position.copy(vec(p)); controls.target.copy(vec(t)); controls.update(); },
  setLayer, setOpacity, select: (id) => select(byId.get(id) || null),
  stats: () => ({ parts: PARTS_LIST.length, tris: Math.round(triTotal), buildMs: Math.round(STATS.buildMs), workers: STATS.workers, errors: buildErrors }),
  render: () => { controls.update(); renderer.render(scene, camera); if (state.labels) drawLabels(); },
  pause: (p = true) => { state.paused = p; },
};

let revealed = false;
function revealStage() { if (revealed) return; revealed = true; $('loader').classList.add('done'); }
(async () => {
  try {
    animate();
    await buildAll();
    buildFlowParticles();
    buildLayerUI();
    for (const l of LAYERS) if (layerOpacity[l.key] !== 1) setOpacity(l.key, layerOpacity[l.key]);
    setProgress(1, `${(STATS.buildMs / 1000).toFixed(1)} sn'de hazır`);
    $('buildInfo').textContent = `${(STATS.buildMs / 1000).toFixed(1)} sn · ${STATS.workers || 1} iş parçacığı`;
    if (buildErrors.length) { $('err').textContent = buildErrors.join('\n'); console.warn(buildErrors); }
    revealStage();
    window.__anatomy.ready = true;
  } catch (e) {
    console.error(e); $('err').textContent = String((e && e.stack) || e);
  }
})();
}
if (!IS_WORKER) startApp();
