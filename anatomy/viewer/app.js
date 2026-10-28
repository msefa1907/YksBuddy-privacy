import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ===================== Corpus Atlas — real-anatomy viewer =====================
// Geometry: BodyParts3D 3.0 (DBCLS, CC BY-SA 2.1 JP), decimated and packed by tools/build_pack.py.
const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const DATA = 'data/';
const isMobile = matchMedia('(max-width: 860px)').matches || matchMedia('(pointer: coarse)').matches;

const LAYERS = [
  { key: 'skin', tr: 'Deri', color: '#c99a7c', on: false },
  { key: 'muscle', tr: 'Kaslar', color: '#a3352a', on: true },
  { key: 'skeleton', tr: 'İskelet', color: '#e6dcc3', on: true },
  { key: 'nervous', tr: 'Sinir sistemi', color: '#f0c64a', on: true },
  { key: 'heart', tr: 'Kalp', color: '#8e2b25', on: true },
  { key: 'arteries', tr: 'Atardamarlar', color: '#d6343c', on: true },
  { key: 'veins', tr: 'Toplardamarlar', color: '#3d64c8', on: true },
  { key: 'respiratory', tr: 'Solunum', color: '#e09c9c', on: true },
  { key: 'digestive', tr: 'Sindirim', color: '#d8946f', on: true },
  { key: 'urinary', tr: 'Boşaltım', color: '#b0603f', on: true },
  { key: 'endocrine', tr: 'Endokrin', color: '#d0a43e', on: true },
  { key: 'reproductive', tr: 'Üreme', color: '#c98d76', on: true },
];
const LAYER = Object.fromEntries(LAYERS.map(l => [l.key, l]));
const LOAD_ORDER = ['skeleton', 'heart', 'arteries', 'veins', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive', 'nervous', 'muscle', 'skin'];

// ---------- renderer ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const strongDevice = !isMobile && (navigator.hardwareConcurrency || 4) >= 8;
renderer.shadowMap.enabled = strongDevice;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.localClippingEnabled = true;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.08; controls.maxDistance = 8;
controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.8;
const HOME = [[0, 0.9, 4.0], [0, 0.84, 0]];
camera.position.copy(vec(HOME[0])); controls.target.copy(vec(HOME[1])); controls.update();

{
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
}
// light rig turns with the camera around the vertical axis so every side reads well
const rig = new THREE.Group(); scene.add(rig);
rig.add(new THREE.HemisphereLight(0xe4ecf4, 0x2b2420, 0.35));
const key = new THREE.DirectionalLight(0xfff0e0, 2.8);
key.position.set(1.3, 2.7, 2.3); key.target.position.set(0, 0.85, 0);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -0.95, right: 0.95, top: 1.05, bottom: -1.05, near: 0.5, far: 6 });
key.shadow.bias = -0.0003; key.shadow.normalBias = 0.0015; key.shadow.radius = 3;
rig.add(key, key.target);
const rimL = new THREE.DirectionalLight(0xa8ccff, 1.25); rimL.position.set(-1.8, 1.7, -2.2); rig.add(rimL);
const fill = new THREE.DirectionalLight(0xffdcc8, 0.5); fill.position.set(-2.1, 0.7, 1.6); rig.add(fill);

const decor = [];
{
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(120,170,200,0.22)'); gr.addColorStop(0.55, 'rgba(70,110,140,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.002;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.605, 128), new THREE.MeshBasicMaterial({ color: 0x6fd0e0, transparent: true, opacity: 0.18, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.001;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.ShadowMaterial({ opacity: 0.32 }));
  sh.rotation.x = -Math.PI / 2; sh.receiveShadow = true;
  scene.add(disc, ring, sh); decor.push(disc, ring, sh);
}

// ---------- surface shading ----------
// Micro detail without textures: band-limited 3D noise in object space drives albedo and a bump on the
// normal (fibre-aligned for muscle). Back faces are drawn as flat "cut surfaces" so clipped parts look solid.
const SURF = { bone: 1, muscle: 2, wet: 3, lung: 4, skin: 5, vessel: 6, eye: 7 };
const GLSL_COMMON = `
varying vec3 vOP;
#if SURF == 2
varying vec4 vFib;
#endif
uniform float uCap;
float hsh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1, 0, 0)), f.x), mix(hsh(i + vec3(0, 1, 0)), hsh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0, 0, 1)), hsh(i + vec3(1, 0, 1)), f.x), mix(hsh(i + vec3(0, 1, 1)), hsh(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
// octaves smaller than about a pixel fade out instead of shimmering
float fbm(vec3 p, int oct) {
  float fw = length(fwidth(p)); float s = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 5; i++) { if (i >= oct) break; s += a * vnoise(p * f) * (1.0 - smoothstep(0.35, 0.8, fw * f)); f *= 2.07; a *= 0.5; }
  return s;
}
vec3 bumpN(vec3 pos, vec3 n, float h, float fd) {
  vec3 sx = dFdx(pos), sy = dFdy(pos); vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * fd; vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - g);
}
`;
const GLSL_SURFACE = `
float hgt = 0.0; float rMul = 1.0;
#if SURF == 1
{ float m = fbm(vOP * 55.0, 3); float pr = fbm(vOP * 650.0, 3);
  diffuseColor.rgb *= 1.0 + 0.10 * m - 0.07 * max(pr, 0.0);
  hgt = 0.00025 * m + 0.00006 * pr; }
#elif SURF == 2
{ vec3 f = normalize(vFib.xyz + vec3(1e-4)); vec3 q = vOP - f * dot(vOP, f) * 0.93; float tn = vFib.w;
  float s = fbm(q * 950.0, 3); float b = fbm(q * 170.0, 2);
  diffuseColor.rgb *= 1.0 + mix(0.22, 0.07, tn) * s + mix(0.12, 0.05, tn) * b;
  hgt = mix(0.00007, 0.00003, tn) * s + 0.00016 * b; rMul = mix(1.0, 0.62, tn); }
#elif SURF == 3
{ float m = fbm(vOP * 34.0, 3); float d = fbm(vOP * 420.0, 3);
  diffuseColor.rgb *= 1.0 + 0.11 * m + 0.05 * d; hgt = 0.0002 * m + 0.00004 * d; }
#elif SURF == 4
{ float m = fbm(vOP * 38.0, 3); float c = fbm(vOP * 300.0, 3); float sp = smoothstep(0.18, 0.42, fbm(vOP * 110.0 + 7.0, 3));
  diffuseColor.rgb *= (1.0 + 0.14 * m + 0.10 * c) * (1.0 - 0.38 * sp); hgt = 0.00012 * c + 0.00022 * m; }
#elif SURF == 5
{ float m = fbm(vOP * 16.0, 3); float pr = fbm(vOP * 1500.0, 2); float w = fbm(vOP * 260.0, 2);
  diffuseColor.rgb *= 1.0 + 0.07 * m; diffuseColor.r *= 1.0 + 0.035 * m; hgt = 0.000025 * pr + 0.00004 * w + 0.0001 * m; }
#elif SURF == 6
{ float m = fbm(vOP * 60.0, 2); float d = fbm(vOP * 500.0, 2);
  diffuseColor.rgb *= 1.0 + 0.07 * m; hgt = 0.00005 * m + 0.00002 * d; }
#elif SURF == 7
{ vec3 c = vec3(sign(vOP.x) * 0.0280, 1.5408, 0.0612); vec3 d = normalize(vOP - c);
  float a = dot(d, normalize(vec3(sign(vOP.x) * 0.06, 0.02, 1.0)));
  float iris = smoothstep(0.855, 0.87, a), pupil = smoothstep(0.978, 0.982, a);
  float ang = atan(d.y, d.x);
  vec3 irisCol = vec3(0.16, 0.085, 0.035) * (0.75 + 0.55 * vnoise(vec3(ang * 14.0, a * 60.0, 3.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 + 0.06 * fbm(vOP * 300.0, 2)), irisCol, iris);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.004), pupil); }
#endif
`;
const GLSL_CAP = `
if (!gl_FrontFacing) {
  vec3 cc = diffuseColor.rgb;
#if SURF == 1
  float sp = smoothstep(-0.05, 0.25, fbm(vOP * 900.0, 2));
  cc = mix(cc * vec3(0.92, 0.62, 0.5), cc, sp);
#elif SURF == 2
  cc *= 0.85 + 0.25 * fbm(vOP * 700.0, 2);
#endif
  outgoingLight = cc * 0.72;
}
`;
// ---------- heart rig: per-vertex displacement fields driven by the cardiac cycle (see cardio.js) ----------
// rigA/rigV: wall displacement at full atrial / ventricular contraction; rigO: valve leaflet motion;
// rigT = (activation time s, arterial arc length m [+10 for the pulmonary tree], valve id, pulse amplitude m).
const RIG_LAYERS = new Set(['heart', 'arteries', 'veins']);
const RIGU = {
  uRigA: { value: 0 }, uRigV: { value: 0 }, uRigOpen: { value: new THREE.Vector4(1, 1, 0, 0) },
  uPulseFront: { value: new THREE.Vector2(-1, -1) }, uPulseAmp: { value: 0 }, uCycleT: { value: -1 }, uGlow: { value: 0 },
};
const GLSL_RIG_VERT = `
#ifdef RIG
{
  float vid = rigT.z;
  float op = vid < 0.5 ? 1.0 : vid < 1.5 ? uRigOpen.x : vid < 2.5 ? uRigOpen.y : vid < 3.5 ? uRigOpen.z : uRigOpen.w;
  float k = vid < 2.5 ? 1.0 - op : op; // AV leaflets are modelled open (rigO closes them), semilunar cusps closed (rigO opens them)
  transformed += uRigA * rigA + uRigV * rigV + k * rigO;
  if (rigT.w > 0.0) {
    bool pul = rigT.y >= 10.0;
    float d = (pul ? rigT.y - 10.0 : rigT.y) - (pul ? uPulseFront.y : uPulseFront.x);
    transformed += objectNormal * rigT.w * uPulseAmp * exp(-d * d / 0.0018);
  }
  vAct = rigT.x;
}
#endif
`;
function patchSurface(mat, kind, rigged = false) {
  const capU = mat.userData.capU || (mat.userData.capU = { value: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCap = capU;
    if (rigged) Object.assign(sh.uniforms, RIGU);
    const rigDecl = rigged ? `#define RIG\nattribute vec3 rigA; attribute vec3 rigV; attribute vec3 rigO; attribute vec4 rigT;\nuniform float uRigA, uRigV, uPulseAmp; uniform vec4 uRigOpen; uniform vec2 uPulseFront;\nvarying float vAct;` : '';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n#define SURF ${kind}\n${rigDecl}\nvarying vec3 vOP;\n#if SURF == 2\nattribute vec4 fiber; varying vec4 vFib;\n#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvOP = transformed;\n#if SURF == 2\nvFib = fiber;\n#endif\n${GLSL_RIG_VERT}`);
    let fs = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n#define SURF ${kind}\n${rigged ? '#define RIG\nvarying float vAct; uniform float uCycleT, uGlow;' : ''}\n${GLSL_COMMON}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef RIG
if (vAct > -0.5 && uGlow > 0.0) { float e = (uCycleT - vAct - 0.018) / 0.02; totalEmissiveRadiance += vec3(1.0, 0.78, 0.3) * uGlow * exp(-e * e); }
#endif`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (!gl_FrontFacing && uCap < 0.5) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${GLSL_SURFACE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * rMul, 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nnormal = bumpN(-vViewPosition, normal, hgt, faceDirection);`);
    const glass = kind === SURF.skin ? `
      if (diffuseColor.a < 0.999) {
        float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
        diffuseColor.a = clamp(diffuseColor.a * 0.45 + fres * 1.1 * diffuseColor.a + fres * 0.16, 0.0, 1.0);
        outgoingLight = mix(outgoingLight * 1.15, vec3(0.80, 0.88, 0.97), fres * 0.7);
      }` : '';
    fs = fs.replace('#include <opaque_fragment>', `${glass}\n${GLSL_CAP}\n#include <opaque_fragment>`);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'surf' + kind + (rigged ? 'r' : '');
  mat.userData.surf = kind; mat.userData.rigged = rigged;
  return mat;
}

// ---------- materials (one per layer × material kind, created on demand) ----------
const WET = { roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.24 };
const MAT_DEFS = {
  bone: [SURF.bone, { roughness: 0.62, clearcoat: 0.05, clearcoatRoughness: 0.6 }],
  tooth: [SURF.bone, { roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.12 }],
  cartilage: [SURF.wet, { roughness: 0.3, clearcoat: 0.65, clearcoatRoughness: 0.22, sheen: 0.3, sheenColor: 0xdfeff0 }],
  disc: [SURF.wet, { roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.3 }],
  ligament: [SURF.wet, { roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.5, sheenColor: 0xffffff }],
  muscle: [SURF.muscle, { roughness: 0.52, clearcoat: 0.3, clearcoatRoughness: 0.3, sheen: 0.15, sheenColor: 0xff8a78, sheenRoughness: 0.5 }],
  tendon: [SURF.muscle, { roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: 0xffffff }],
  brain: [SURF.wet, { ...WET, roughness: 0.5, clearcoat: 0.32 }],
  brainstem: [SURF.wet, { ...WET, roughness: 0.5, clearcoat: 0.32 }],
  deepGray: [SURF.wet, { ...WET, roughness: 0.5, clearcoat: 0.32 }],
  whiteMatter: [SURF.wet, { ...WET, roughness: 0.5, clearcoat: 0.3 }],
  csf: [SURF.wet, { ...WET, roughness: 0.2, clearcoat: 0.9 }],
  eye: [SURF.eye, { roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.03 }],
  nerve: [SURF.vessel, { roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: 0xfff0b0 }],
  heart: [SURF.wet, { ...WET, sheen: 0.3, sheenColor: 0xff8a70 }],
  valve: [SURF.wet, { ...WET, roughness: 0.35 }],
  lung: [SURF.lung, { roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.3 }],
  airway: [SURF.wet, { ...WET, roughness: 0.36 }],
  organ: [SURF.wet, { ...WET }],
  artery: [SURF.vessel, { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: 0xff6a6a }],
  pulmArtery: [SURF.vessel, { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }],
  vein: [SURF.vessel, { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: 0x7aa0ff }],
  pulmVein: [SURF.vessel, { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }],
  coronaryA: [SURF.vessel, { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: 0xff6a6a }],
  coronaryV: [SURF.vessel, { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: 0x7aa0ff }],
  skin: [SURF.skin, { roughness: 0.52, clearcoat: 0.06, clearcoatRoughness: 0.45, sheen: 0.35, sheenColor: 0xffb89c, sheenRoughness: 0.55 }],
};
const MATS = {};
const layerMats = {};
function getMat(layer, mat) {
  const k = layer + ':' + mat;
  if (MATS[k]) return MATS[k];
  const [kind, params] = MAT_DEFS[mat] || MAT_DEFS.organ;
  const m = patchSurface(new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, ...params }), kind, RIG_LAYERS.has(layer));
  m.userData.layer = layer; m.userData.baseOpacity = 1;
  (layerMats[layer] ||= new Set()).add(m);
  if (state.split && (layer === 'muscle' || layer === 'skin')) m.clippingPlanes = [splitPlane];
  return (MATS[k] = m);
}

// ---------- colours ----------
// sRGB tints by structure name; bone and muscle get a small per-part variation.
const TINT = [
  [/^liver/, 0x7b2f25], [/gallbladder/, 0x5f7c3e], [/^stomach/, 0xcf8474], [/esophagus/, 0xc77a6c],
  [/duodenum|jejunum|ileum/, 0xd99a87], [/taenia/, 0xe6cdb2], [/colon|appendix/, 0xcf9b80], [/rectum/, 0xc5836f],
  [/pancreatic duct/, 0xe8d59c], [/pancreas/, 0xe0b27e], [/spleen/, 0x74304a], [/labial part of mouth/, 0xbf6a64], [/gingiva/, 0xd88480],
  [/kidney/, 0x7e3128], [/ureter/, 0xdcb892], [/urinary bladder/, 0xd7a493], [/urethra/, 0xd8a08f],
  [/adrenal/, 0xd49c42], [/thymus/, 0xdcb7a0], [/pineal/, 0xb98b7b], [/pituitary/, 0xcf9a73],
  [/lung/, 0xd99c9b], [/trachea|bronchus/, 0xe2d4c2], [/thyroid cartilage/, 0xdcd6c6], [/diaphragm/, 0x8a2b23],
  [/^wall of heart/, 0x8e2b25], [/valve/, 0xe8d8bc], [/papillary/, 0xa13a30],
  [/coronary sinus|cardiac vein|veins of ventricle/, 0x34509f],
  [/pulmonary artery/, 0x3456b0], [/pulmonary vein/, 0xb52a30], [/artery|aorta|branch/, 0xbe2a2f], [/vein|vena cava/, 0x30509f],
  [/optic|nerve/, 0xf0d58a], [/ventricle|aqueduct|central canal|interventricular foramen/, 0x7fb3d9], [/choroid plexus/, 0xb24f50],
  [/white matter|corpus callosum|capsule|commissure|fornix|stria|septum pellucidum|lamina terminalis|brachium|peduncle/, 0xeee2d2],
  [/thalamus|caudate|putamen|globus pallidus|amygdala|hippocampus|geniculate|colliculus|habenula|mammillary|tuber cinereum|interpeduncular/, 0xbe9084],
  [/pons|medulla|midbrain/, 0xdcc4b4], [/cerebellum/, 0xc89c90], [/gyrus|gyri|lobe|insula|lobule/, 0xd8b2a4],
  [/testis/, 0xd9b8a3], [/epididymis/, 0xca927e], [/deferent/, 0xe1caa2], [/seminal/, 0xd6aa8c], [/prostate/, 0xc98f78], [/glans/, 0xc4736f], [/corpus/, 0xc68c7e],
];
const MAT_TINT = { bone: 0xd9c9a8, tooth: 0xf1ead8, cartilage: 0xd3dcd6, disc: 0xc4d2cd, ligament: 0xdcd4c3, muscle: 0x8a2b23, tendon: 0xe3dbcb, skin: 0xc4937c, eye: 0xf3efe9, nerve: 0xf0d58a };
const TENDON_TINT = new THREE.Color(0xe6dece);
function hash01(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
function tintFor(p) {
  let hex = MAT_TINT[p.mat];
  if (hex === undefined || p.mat === 'muscle') for (const [re, c] of TINT) if (re.test(p.base)) { hex = c; break; }
  if (hex === undefined) hex = 0xcf9a86;
  const c = new THREE.Color(hex);
  const r = hash01(p.id) - 0.5;
  if (p.mat === 'bone') c.multiplyScalar(1 + 0.07 * r).offsetHSL(0.006 * r, 0, 0);
  else if (p.mat === 'muscle') c.multiplyScalar(1 + 0.16 * r).offsetHSL(0.01 * r, 0.04 * r, 0);
  else c.multiplyScalar(1 + 0.05 * r);
  return [c.r, c.g, c.b];
}

// ---------- decoding (runs in workers; plain functions so they can be stringified) ----------
async function gunzipBytes(u) {
  if (u[0] !== 0x1f || u[1] !== 0x8b) return u; // server already removed the gzip layer
  const s = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function decodePart(raw, p, gmin, gsize) {
  const nv = p.nv, n3 = p.nt * 3, base = raw.byteOffset + p.off;
  const head = nv * (p.tw ? 8 : 7); // int16 xyz planes, ao byte plane, optional tendon byte plane
  const dv = new DataView(raw.buffer, base, head + p.ib);
  const pos = new Float32Array(nv * 3);
  for (let a = 0; a < 3; a++) {
    const s = gsize[a] / 65535, m0 = gmin[a], o = a * nv * 2; let q = 0;
    for (let i = 0; i < nv; i++) { q = (q + dv.getInt16(o + 2 * i, true)) & 0xffff; pos[3 * i + a] = m0 + q * s; }
  }
  const idx = nv < 65536 ? new Uint16Array(n3) : new Uint32Array(n3);
  const u8 = new Uint8Array(raw.buffer, base, head + p.ib);
  let o = head, prev = 0;
  for (let k = 0; k < n3; k++) {
    let z = 0, sh = 0, b;
    do { b = u8[o++]; z |= (b & 0x7f) << sh; sh += 7; } while (b & 0x80);
    prev += (z >>> 1) ^ -(z & 1); idx[k] = prev;
  }
  // area-weighted vertex normals
  const nf = new Float32Array(nv * 3);
  for (let k = 0; k < n3; k += 3) {
    const a = 3 * idx[k], b = 3 * idx[k + 1], c = 3 * idx[k + 2];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    nf[a] += nx; nf[a + 1] += ny; nf[a + 2] += nz; nf[b] += nx; nf[b + 1] += ny; nf[b + 2] += nz; nf[c] += nx; nf[c + 1] += ny; nf[c + 2] += nz;
  }
  const nrm = new Int16Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    const x = nf[3 * i], y = nf[3 * i + 1], z = nf[3 * i + 2]; const l = Math.hypot(x, y, z) || 1;
    nrm[3 * i] = Math.round(x / l * 32767); nrm[3 * i + 1] = Math.round(y / l * 32767); nrm[3 * i + 2] = Math.round(z / l * 32767);
  }
  // muscle fibre axis (principal component of the part) and per-vertex tendon weight (baked from local thickness)
  let fib = null, tw = null;
  if (p.fib) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < nv; i++) { cx += pos[3 * i]; cy += pos[3 * i + 1]; cz += pos[3 * i + 2]; }
    cx /= nv; cy /= nv; cz /= nv;
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    for (let i = 0; i < nv; i++) {
      const x = pos[3 * i] - cx, y = pos[3 * i + 1] - cy, z = pos[3 * i + 2] - cz;
      xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z;
    }
    let ax = 0.3, ay = 0.9, az = 0.3;
    for (let it = 0; it < 40; it++) {
      const nx = xx * ax + xy * ay + xz * az, ny = xy * ax + yy * ay + yz * az, nz = xz * ax + yz * ay + zz * az;
      const l = Math.hypot(nx, ny, nz) || 1; ax = nx / l; ay = ny / l; az = nz / l;
    }
    fib = new Int8Array(nv * 4); tw = new Float32Array(nv);
    const fx = Math.round(ax * 127), fy = Math.round(ay * 127), fz = Math.round(az * 127);
    for (let i = 0; i < nv; i++) {
      const w = p.tw ? u8[nv * 7 + i] / 255 : p.tendon ? 1 : 0; tw[i] = w;
      fib[4 * i] = fx; fib[4 * i + 1] = fy; fib[4 * i + 2] = fz; fib[4 * i + 3] = Math.round(w * 127);
    }
  }
  // vertex colour = tint × baked ambient occlusion
  const col = new Uint16Array(nv * 3); const ao0 = nv * 6; const [tr, tg, tb] = p.tint; const tt = p.tendonTint;
  for (let i = 0; i < nv; i++) {
    const ao = u8[ao0 + i] / 255; const s = (p.aoMin + (1 - p.aoMin) * Math.pow(ao, 1.4)) * 65535;
    let r = tr, g = tg, b = tb;
    if (tw && tw[i] > 0) { const w = tw[i]; r += (tt[0] - r) * w; g += (tt[1] - g) * w; b += (tt[2] - b) * w; }
    col[3 * i] = Math.min(65535, r * s); col[3 * i + 1] = Math.min(65535, g * s); col[3 * i + 2] = Math.min(65535, b * s);
  }
  return { j: p.j, pos, nrm, col, idx, fib };
}
async function runJob(job, post) {
  try {
    const res = await fetch(job.url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + job.url);
    const chunks = []; let got = 0;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      for (;;) { const r = await reader.read(); if (r.done) break; chunks.push(r.value); got += r.value.length; post({ type: 'progress', layer: job.layer, bytes: got }); }
    } else { const u = new Uint8Array(await res.arrayBuffer()); chunks.push(u); got = u.length; }
    let buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
    if (job.b64) { // hosts that only serve text get the same pack as base64
      const bin = atob(new TextDecoder().decode(buf).replace(/\s+/g, ''));
      buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    }
    const raw = await gunzipBytes(buf);
    let batch = [], tr = [];
    for (let k = 0; k < job.parts.length; k++) {
      const r = decodePart(raw, job.parts[k], job.gmin, job.gsize);
      batch.push(r); tr.push(r.pos.buffer, r.nrm.buffer, r.col.buffer, r.idx.buffer); if (r.fib) tr.push(r.fib.buffer);
      if (batch.length >= 16 || k === job.parts.length - 1) { post({ type: 'parts', layer: job.layer, recs: batch }, tr); batch = []; tr = []; }
    }
    post({ type: 'done', layer: job.layer });
  } catch (err) { post({ type: 'error', layer: job.layer, msg: String((err && err.message) || err) }); }
}
function workerURL() {
  const src = [gunzipBytes, decodePart, runJob].map(f => f.toString()).join('\n') + '\nself.onmessage = (e) => runJob(e.data, (m, t) => self.postMessage(m, t || []));';
  return URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
}

// ---------- registry ----------
const groups = {};
for (const l of LAYERS) { const g = new THREE.Group(); g.name = l.key; g.visible = l.on; groups[l.key] = g; scene.add(g); }
const PARTS_LIST = [];
const byId = new Map(), byEn = new Map();
let triTotal = 0;
const STATS = {};
function regionOf(c) {
  if (c.y > 1.43) return 'Baş ve boyun';
  if (Math.abs(c.x) > 0.17 && c.y > 0.66) return 'Üst ekstremite';
  if (c.y < 0.8) return 'Alt ekstremite';
  return 'Gövde';
}
function ingest(layer, meta, rec) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(rec.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(rec.nrm, 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(rec.col, 3, true));
  if (rec.fib) geo.setAttribute('fiber', new THREE.BufferAttribute(rec.fib, 4, true));
  geo.setIndex(new THREE.BufferAttribute(rec.idx, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  // coronary vessels get their own material so they can be cut together with the heart wall
  const matKey = /coronary|cardiac vein|veins of ventricle|coronary sinus|interventricular branch|marginal branch|circumflex|posterolateral|septal branches/.test(meta.base) ? (layer === 'arteries' ? 'coronaryA' : 'coronaryV') : meta.mat;
  const mat = getMat(layer, matKey);
  const mesh = new THREE.Mesh(geo, state.isolate && state.selected ? ghostMat : mat);
  const small = geo.boundingSphere.radius < 0.015;
  mesh.castShadow = !small && layer !== 'skin'; mesh.receiveShadow = true;
  const center = geo.boundingSphere.center.clone();
  const d = describe(meta);
  mesh.userData = {
    layer, id: meta.id, en: meta.en, base: meta.base, side: meta.side, mat: matKey, tr: meta.tr,
    la: d.la, desc: d.desc, group: d.group || regionOf(center), center, basePos: new THREE.Vector3(), pickIndex: PARTS_LIST.length + 1,
  };
  mesh.matrixAutoUpdate = true;
  groups[layer].add(mesh);
  PARTS_LIST.push(mesh); byId.set(meta.id, mesh); byEn.set(meta.en, mesh);
  triTotal += rec.idx.length / 3;
}

// ---------- loading ----------
const loadErrors = [];
let layerParts = {};
function setProgress(frac, label) {
  const pct = Math.round(frac * 100) + '%';
  $('bar').firstElementChild.style.width = pct; $('stepPct').textContent = pct; if (label) $('stepName').textContent = label;
  $('buildBar').style.width = pct; $('buildBar').parentElement.hidden = frac >= 1;
  $('stParts').textContent = PARTS_LIST.length.toLocaleString('tr-TR'); $('stTris').textContent = fmtK(Math.round(triTotal));
}
async function loadAll() {
  const t0 = performance.now();
  const res = await fetch(DATA + 'manifest.json');
  if (!res.ok) throw new Error('manifest.json yüklenemedi (HTTP ' + res.status + ')');
  const man = await res.json();
  const order = LOAD_ORDER.filter(k => man.layers[k]);
  const total = order.reduce((a, k) => a + man.layers[k].size, 0);
  const got = {}; const parsed = {}; const seen = new Set(); let decodedParts = 0; const nParts = order.reduce((a, k) => a + man.layers[k].parts.length, 0);
  const report = (label) => {
    const dl = Object.entries(got).reduce((a, [k, v]) => a + Math.min(v, man.layers[k].size), 0) / total;
    setProgress(clamp(0.75 * dl + 0.25 * decodedParts / nParts, 0, 1), label);
  };
  const jobs = order.map((L) => {
    layerParts[L] = man.layers[L].parts;
    return {
      layer: L, url: new URL(DATA + man.layers[L].file, document.baseURI).href, b64: /\.txt$/.test(man.layers[L].file), gmin: man.gmin, gsize: man.gsize,
      parts: man.layers[L].parts.map((p, j) => ({
        j, nv: p.nv, nt: p.nt, off: p.off, ib: p.ib, tw: !!p.tw, tint: tintFor(p), fib: p.mat === 'muscle' || p.mat === 'tendon', tendon: p.mat === 'tendon',
        tendonTint: [TENDON_TINT.r, TENDON_TINT.g, TENDON_TINT.b], aoMin: L === 'skin' ? 0.45 : L === 'muscle' ? 0.22 : 0.3,
      })),
    };
  });
  const onMsg = (m) => {
    if (m.type === 'progress') { got[m.layer] = m.bytes; report(LAYER[m.layer].tr + ' indiriliyor…'); return; }
    if (m.type === 'parts') {
      for (const r of m.recs) { const k = m.layer + ':' + r.j; if (seen.has(k)) continue; seen.add(k); ingest(m.layer, layerParts[m.layer][r.j], r); }
      decodedParts += m.recs.length; parsed[m.layer] = (parsed[m.layer] || 0) + m.recs.length;
      report(LAYER[m.layer].tr + ' hazırlanıyor…');
      if (m.layer === 'skeleton' && parsed.skeleton === layerParts.skeleton.length) revealStage();
      markShadows();
      return;
    }
    if (m.type === 'error') { loadErrors.push(`${LAYER[m.layer].tr}: ${m.msg}`); console.error(m.layer, m.msg); }
  };
  const nW = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 4));
  let workers = [];
  try { const url = workerURL(); for (let k = 0; k < nW; k++) workers.push(new Worker(url)); } catch (e) { console.warn('workers unavailable', e); workers = []; }
  const queue = jobs.slice();
  if (workers.length) {
    await new Promise((resolve) => {
      let finished = 0; let fellBack = false;
      const next = (w) => { const j = queue.shift(); if (j) { w.busy = j; w.postMessage(j); } else w.busy = null; };
      for (const w of workers) {
        w.onmessage = (e) => {
          onMsg(e.data);
          if (e.data.type === 'done' || e.data.type === 'error') { finished++; if (finished === jobs.length) resolve(); else next(w); }
        };
        w.onerror = async (e) => {
          // worker could not start (e.g. blocked by policy): decode its job and the rest of the queue here
          console.warn('worker error', e.message); e.preventDefault();
          if (fellBack) return; fellBack = true;
          for (const w2 of workers) { if (w2.busy) queue.unshift(w2.busy); w2.terminate(); }
          for (const j of queue.splice(0)) await runJob(j, onMsg);
          resolve();
        };
        next(w);
      }
    });
    for (const w of workers) w.terminate();
  } else for (const j of queue) await runJob(j, onMsg);
  STATS.loadMs = performance.now() - t0; STATS.workers = workers.length; STATS.bytes = total;
}

// ---------- interaction state ----------
const state = { split: true, selected: null, isolate: false, explode: 0, cut: false, cutAxis: 'z', cutPos: 0.52, anim: { heart: true, breath: true }, labels: false, spin: false };
const layerOpacity = Object.fromEntries(LAYERS.map(l => [l.key, l.key === 'skin' ? 0.32 : 1]));
const splitPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

// ---------- GPU picking: render part ids into a 1×1 target under the cursor ----------
const pickRT = new THREE.WebGLRenderTarget(1, 1);
const pickBuf = new Uint8Array(4);
function makePickMat(planes) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uId: { value: new THREE.Vector3() } }, clipping: true, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `#include <common>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n#include <clipping_planes_vertex>\n}`,
    fragmentShader: `uniform vec3 uId;\n#include <clipping_planes_pars_fragment>\nvoid main() {\n#include <clipping_planes_fragment>\ngl_FragColor = vec4(uId, 1.0);\n}`,
  });
  m.clippingPlanes = planes;
  m.onBeforeRender = (r, s, c, g, obj) => {
    const i = obj.userData.pickIndex; m.uniforms.uId.value.set((i & 255) / 255, ((i >> 8) & 255) / 255, ((i >> 16) & 255) / 255); m.uniformsNeedUpdate = true;
  };
  return m;
}
const pickMat = makePickMat(null), pickMatSplit = makePickMat([splitPlane]);
function isPickable(m) {
  const u = m.userData;
  if (!groups[u.layer].visible || !m.visible || u.hidden) return false;
  if (u.layer === 'skin' && layerOpacity.skin < 0.55) return false;
  if (state.isolate && state.selected && m !== state.selected) return false;
  return true;
}
function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  const x = Math.round(clientX - r.left), y = Math.round(clientY - r.top);
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return null;
  const saved = PARTS_LIST.map(m => [m.visible, m.material]);
  for (const m of PARTS_LIST) {
    const ok = isPickable(m); m.visible = ok;
    if (ok) m.material = state.split && (m.userData.layer === 'muscle' || m.userData.layer === 'skin') ? pickMatSplit : pickMat;
  }
  const dv = decor.map(d => d.visible); decor.forEach(d => (d.visible = false));
  const bg = scene.background; scene.background = null;
  const autoSh = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = false;
  const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  camera.setViewOffset(r.width, r.height, x, y, 1, 1);
  renderer.setRenderTarget(pickRT); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, pickBuf);
  renderer.setRenderTarget(null); renderer.setClearColor(cc, ca);
  camera.clearViewOffset();
  scene.background = bg; renderer.shadowMap.needsUpdate = autoSh;
  decor.forEach((d, i) => (d.visible = dv[i]));
  PARTS_LIST.forEach((m, i) => { m.visible = saved[i][0]; m.material = saved[i][1]; });
  const id = pickBuf[0] | (pickBuf[1] << 8) | (pickBuf[2] << 16);
  return id ? PARTS_LIST[id - 1] || null : null;
}

// ---------- selection ----------
const hlCache = new Map();
function highlightMat(m) {
  if (!hlCache.has(m)) {
    const h = m.clone(); h.userData = { ...m.userData, hl: true }; patchSurface(h, m.userData.surf, m.userData.rigged);
    h.emissive = new THREE.Color(0x1f9fbf); h.emissiveIntensity = 0.28;
    hlCache.set(m, h);
  }
  return hlCache.get(m);
}
const ghostMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c2, transparent: true, opacity: 0.06, depthWrite: false, roughness: 1 });
function refreshMaterials() {
  for (const m of PARTS_LIST) {
    const base = getMat(m.userData.layer, m.userData.mat);
    if (state.isolate && state.selected && m !== state.selected) m.material = ghostMat;
    else m.material = m === state.selected ? highlightMat(base) : base;
  }
  for (const [b, h] of hlCache) { h.opacity = b.opacity; h.transparent = b.transparent; h.depthWrite = b.depthWrite; h.clippingPlanes = b.clippingPlanes; }
  markShadows();
}
function select(mesh, focus = false) {
  state.selected = mesh || null;
  if (!mesh) state.isolate = false;
  refreshMaterials();
  renderInfo();
  if (mesh && focus) focusOn(mesh);
  if (mesh && isMobile) document.body.classList.add('show-info');
}

// ---------- camera ----------
let camAnim = null;
function flyTo(pos, target, dur = 0.9) {
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.isVector3 ? pos.clone() : vec(pos), t1: target.isVector3 ? target.clone() : vec(target), s: performance.now(), d: dur * 1000 };
}
function focusOn(mesh) {
  const bs = mesh.geometry.boundingSphere; const c = bs.center.clone().applyMatrix4(mesh.matrixWorld);
  const r = Math.max(bs.radius, 0.025); const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = r / Math.sin((camera.fov * Math.PI / 180) / 2) * 1.3;
  flyTo(c.clone().add(dir.multiplyScalar(dist)), c);
}
const VIEWS = [
  ['Ön', HOME[0], HOME[1]], ['Arka', [0, 0.9, -4.0], HOME[1]], ['Sol', [4.0, 0.9, 0], HOME[1]], ['Sağ', [-4.0, 0.9, 0], HOME[1]],
  ['Baş', [0.26, 1.6, 0.62], [0, 1.53, 0.0]], ['Göğüs', [0.3, 1.32, 1.25], [0.0, 1.22, 0.0]], ['Karın', [0.25, 1.08, 1.15], [0, 1.0, 0.0]],
  ['El', [0.66, 0.84, 0.46], [0.28, 0.76, 0.02]], ['Ayak', [0.52, 0.3, 0.6], [0.08, 0.05, 0.02]],
];

// ---------- cut plane ----------
function applyCut() {
  const t = state.cutPos;
  if (state.cutAxis === 'z') { cutPlane.normal.set(0, 0, -1); cutPlane.constant = lerp(-0.15, 0.15, t); }
  if (state.cutAxis === 'x') { cutPlane.normal.set(-1, 0, 0); cutPlane.constant = lerp(-0.34, 0.34, t); }
  if (state.cutAxis === 'y') { cutPlane.normal.set(0, -1, 0); cutPlane.constant = lerp(0, 1.67, t); }
  renderer.clippingPlanes = state.cut ? [cutPlane] : [];
  markShadows();
}

// ---------- split (sagittal half) view for skin & muscles ----------
function setSplit(on) {
  state.split = on;
  for (const key of ['muscle', 'skin']) for (const m of layerMats[key] || []) { m.clippingPlanes = on ? [splitPlane] : null; m.clipShadows = true; m.needsUpdate = true; }
  for (const [b, h] of hlCache) { h.clippingPlanes = b.clippingPlanes; h.needsUpdate = true; }
  const btn = $('tSplit'); if (btn) btn.classList.toggle('on', on);
  markShadows();
}

// ---------- explode ----------
function applyExplode() {
  const a = state.explode;
  for (const m of PARTS_LIST) {
    const c = m.userData.center; const lay = m.userData.layer;
    const k = lay === 'skin' ? 0.0 : lay === 'muscle' ? 0.55 : lay === 'skeleton' ? 0.25 : 1.0;
    const off = new THREE.Vector3(c.x * 1.6, (c.y - 1.0) * 0.35, (c.z + 0.01) * 2.4 + (lay === 'muscle' ? 0.05 : 0)).multiplyScalar(a * k);
    m.position.copy(m.userData.basePos).add(off);
  }
  markShadows();
}

// ---------- shadows are re-rendered only when something changed ----------
let shadowDirty = 2;
function markShadows() { shadowDirty = 2; }

// ---------- UI: layers ----------
function buildLayerUI() {
  const list = $('layerList'); list.innerHTML = '';
  for (const l of LAYERS) {
    const count = groups[l.key].children.length;
    if (!count) continue;
    const row = document.createElement('div'); row.className = 'layer' + (l.on ? ' on' : '');
    row.innerHTML = `<span class="dot" style="background:${l.color}"></span><label for="ly_${l.key}">${l.tr}<span class="count">${count}</span></label>
      <input type="range" id="op_${l.key}" min="5" max="100" value="${Math.round(layerOpacity[l.key] * 100)}" aria-label="${l.tr} opaklığı" title="Opaklık">
      <span class="switch"><input type="checkbox" id="ly_${l.key}" ${l.on ? 'checked' : ''}><i></i></span>`;
    list.appendChild(row);
    row.querySelector('input[type=checkbox]').addEventListener('change', (e) => { setLayer(l.key, e.target.checked); clearPreset(); });
    row.querySelector('input[type=range]').addEventListener('input', (e) => { setOpacity(l.key, e.target.value / 100); clearPreset(); });
  }
}
function buildPresetUI() {
  const pr = $('presets'); pr.innerHTML = '';
  for (const [name] of PRESETS) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.dataset.p = name;
    b.onclick = () => applyPreset(name); pr.appendChild(b);
  }
  markPreset(currentPreset);
}
// layer presets: [name, {layer: opacity|0}, split]
const ORG = ['heart', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'];
const PRESETS = [
  ['Tümü', { muscle: 1, skeleton: 1, nervous: 1, arteries: 1, veins: 1, ...Object.fromEntries(ORG.map(k => [k, 1])) }, true],
  ['Kaslar', { muscle: 1, skeleton: 1 }, false],
  ['İskelet', { skeleton: 1 }, false],
  ['Organlar', { skeleton: 0.22, nervous: 1, arteries: 1, veins: 1, ...Object.fromEntries(ORG.map(k => [k, 1])) }, false],
  ['Dolaşım', { skeleton: 0.22, heart: 1, arteries: 1, veins: 1 }, false],
  ['Beyin', { skeleton: 0.16, nervous: 1 }, false],
  ['Röntgen', { skin: 0.3, skeleton: 1, heart: 1, respiratory: 1, digestive: 1, urinary: 1, nervous: 1 }, false],
  ['Deri', { skin: 1 }, false],
];
let currentPreset = 'Tümü';
function markPreset(name) { currentPreset = name; document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', b.dataset.p === name)); }
function clearPreset() { markPreset(null); }
function applyPreset(name) {
  const p = PRESETS.find(x => x[0] === name); if (!p) return;
  for (const l of LAYERS) {
    const v = p[1][l.key] || 0;
    setLayer(l.key, v > 0);
    if (v > 0) { setOpacity(l.key, v); const sl = $('op_' + l.key); if (sl) sl.value = Math.round(v * 100); }
  }
  setSplit(p[2]);
  markPreset(name);
}
function setLayer(key, on) {
  LAYER[key].on = on; groups[key].visible = on;
  const cb = $('ly_' + key); if (cb) { cb.checked = on; cb.closest('.layer').classList.toggle('on', on); }
  if (!on && state.selected && state.selected.userData.layer === key) select(null);
  markShadows();
}
function setOpacity(key, v) {
  layerOpacity[key] = v;
  for (const m of layerMats[key] || []) {
    const o = m.userData.baseOpacity * v; m.opacity = o; m.transparent = o < 0.999; m.depthWrite = o > 0.6;
    m.userData.capU.value = o < 0.999 ? 0 : 1;
    m.needsUpdate = true;
  }
  for (const mesh of groups[key].children) mesh.castShadow = v > 0.6 && key !== 'skin' && mesh.geometry.boundingSphere.radius >= 0.015;
  refreshMaterials();
}
$('allOn').addEventListener('click', () => applyPreset('Tümü'));

// ---------- UI: info ----------
const SIDE_TR = { left: 'sol', right: 'sağ' };
function renderInfo() {
  const box = $('info'); const m = state.selected;
  $('hint').hidden = !!m;
  if (!m) { box.hidden = true; return; }
  const u = m.userData; const l = LAYER[u.layer];
  box.hidden = false;
  const tris = Math.round(m.geometry.index.count / 3);
  box.innerHTML = `<button class="close" type="button" aria-label="Kapat">×</button>
    <div class="eyebrow"><span class="chip"><i style="background:${l.color}"></i>${l.tr}</span>${u.group ? `<span>${u.group}</span>` : ''}</div>
    <h2>${u.tr}</h2><div class="latin">${u.la || u.en}</div>
    ${u.desc ? `<p>${u.desc}</p>` : ''}
    <div class="meta"><span>${tris.toLocaleString('tr-TR')} üçgen</span>${u.side ? `<span>taraf: ${SIDE_TR[u.side] || u.side}</span>` : ''}<span title="${u.en}">${u.id}</span></div>
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
    if (a === 'hide') { m.visible = false; m.userData.hidden = true; select(null); markShadows(); }
    if (a === 'unhide') { for (const p of PARTS_LIST) { p.visible = true; p.userData.hidden = false; } markShadows(); }
  });
}

// ---------- UI: search ----------
const trLower = (s) => s.toLocaleLowerCase('tr-TR');
const fold = (s) => trLower(s).replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a');
let searchHits = [], searchIdx = -1;
function runSearch(q) {
  const res = $('results'); res.innerHTML = ''; searchHits = []; searchIdx = -1;
  q = fold(q.trim()); if (q.length < 2) return;
  const scored = [];
  for (const m of PARTS_LIST) {
    const u = m.userData; const tr = fold(u.tr);
    const hay = `${tr} ${fold(u.la || '')} ${u.en.toLowerCase()} ${fold(u.group || '')}`;
    const at = hay.indexOf(q); if (at < 0) continue;
    scored.push([tr.startsWith(q) ? 0 : at < tr.length ? 1 : 2, tr.length, m]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  searchHits = scored.slice(0, 40).map(s => s[2]);
  for (const m of searchHits) {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="dot" style="background:${LAYER[m.userData.layer].color}"></span><span>${m.userData.tr}<small>${m.userData.la || m.userData.en}</small></span>`;
    b.onclick = () => chooseHit(m);
    res.appendChild(b);
  }
}
function chooseHit(m) {
  if (!LAYER[m.userData.layer].on) setLayer(m.userData.layer, true);
  if (layerOpacity[m.userData.layer] < 0.3) { setOpacity(m.userData.layer, 1); const sl = $('op_' + m.userData.layer); if (sl) sl.value = 100; }
  m.visible = true; m.userData.hidden = false;
  if (state.split && (m.userData.layer === 'muscle' || m.userData.layer === 'skin') && m.userData.center.x < 0) setSplit(false);
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
$('explode').addEventListener('input', (e) => { state.explode = e.target.value / 100; applyExplode(); });
toggleBtn('aHeart', (on) => { state.anim.heart = on; });
toggleBtn('aBreath', (on) => { state.anim.breath = on; });
toggleBtn('tLabels', (on) => { state.labels = on; });
$('tSplit').addEventListener('click', () => { setSplit(!state.split); clearPreset(); });
toggleBtn('tSpin', (on) => { state.spin = on; controls.autoRotate = on; controls.autoRotateSpeed = 1.2; });
if (!strongDevice) $('tShadow').classList.remove('on');
toggleBtn('tShadow', (on) => { renderer.shadowMap.enabled = on; for (const m of Object.values(MATS)) m.needsUpdate = true; for (const h of hlCache.values()) h.needsUpdate = true; markShadows(); });
$('mLayers').onclick = () => { document.body.classList.toggle('show-layers'); document.body.classList.remove('show-info'); };
$('mInfo').onclick = () => { document.body.classList.toggle('show-info'); document.body.classList.remove('show-layers'); };

// ---------- pointer events ----------
let downAt = null, hoverPending = null, lastHover = 0;
const tip = $('tip');
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; tip.hidden = true; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  if (moved < 5 && e.button === 0) select(pick(e.clientX, e.clientY));
  downAt = null;
});
renderer.domElement.addEventListener('dblclick', (e) => { const m = pick(e.clientX, e.clientY); if (m) { select(m); focusOn(m); } });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || downAt) { tip.hidden = true; return; }
  hoverPending = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; hoverPending = null; });
function doHover() {
  if (!hoverPending || performance.now() - lastHover < 80 || camAnim) return;
  const [x, y] = hoverPending; hoverPending = null; lastHover = performance.now();
  const m = pick(x, y);
  if (!m) { tip.hidden = true; renderer.domElement.style.cursor = ''; return; }
  tip.hidden = false; tip.style.left = x + 'px'; tip.style.top = y + 'px';
  tip.innerHTML = `${m.userData.tr}<small>${m.userData.la || m.userData.en}</small>`;
  renderer.domElement.style.cursor = 'pointer';
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') select(null);
  if (e.key === '/') { e.preventDefault(); $('search').focus(); }
});

// ---------- labels ----------
const LABEL_EN = ['frontal bone', 'mandible', 'left clavicle', 'body of sternum', 'right humerus', 'left radius', 'right hip bone', 'left femur', 'right tibia', 'sacrum',
  'wall of heart', 'upper lobe of left lung', 'upper lobe of right lung', 'liver', 'stomach', 'colon, nsn', 'jejunum', 'left kidney', 'urinary bladder', 'arch of aorta',
  'inferior vena cava', 'trachea', 'diaphragm', 'spleen', 'cerebellum', 'eyeball', 'corpus callosum',
  'sternocostal part of left pectoralis major', 'acromial part of left deltoid', 'left rectus abdominis', 'left rectus femoris', 'medial head of left gastrocnemius',
  'long head of left biceps brachii', 'left sartorius', 'descending part of left trapezius', 'left sternocleidomastoid', 'left tibialis anterior', 'left external oblique', 'left temporalis'];
const labelEls = new Map();
const _lv = new THREE.Vector3();
// visible label anchors projected to a w×h viewport: [{ key, text, x, y }]
function labelItems(w, h) {
  const out = []; const anchors = scenarioLabels(); // scenario steps bring their own labels anchored to points
  const push = (key, text, p) => {
    _lv.copy(p).project(camera);
    const x = (_lv.x * 0.5 + 0.5) * w, y = (-_lv.y * 0.5 + 0.5) * h;
    if (_lv.z <= 1 && x >= 0 && x <= w && y >= 0 && y <= h) out.push({ key, text, x, y });
  };
  if (anchors) { for (const a of anchors) push(a.key, a.text, a.pos); return out; }
  if (!state.labels) return out;
  for (const en of LABEL_EN) {
    const m = byEn.get(en);
    let vis = m && m.visible && !m.userData.hidden && groups[m.userData.layer].visible && layerOpacity[m.userData.layer] >= 0.3;
    if (vis && state.split && (m.userData.layer === 'muscle' || m.userData.layer === 'skin') && m.userData.center.x < 0) vis = false;
    if (vis && state.cut && cutPlane.distanceToPoint(m.userData.center) < 0) vis = false;
    if (vis && state.isolate && state.selected !== m) vis = false;
    if (vis) push(en, m.userData.tr.replace(/ \((sol|sağ)\)$/, ''), _lv.copy(m.geometry.boundingSphere.center).applyMatrix4(m.matrixWorld).clone());
  }
  return out;
}
// two columns of labels left and right of the subject; sets lx (column x), ly, side and ex (leader end)
function layoutLabels(items, w, h, rowH = 21, margin = 120) {
  if (!items.length) return items;
  const cx = items.reduce((a, it) => a + it.x, 0) / items.length;
  const spread = Math.max(...items.map(it => Math.abs(it.x - cx)));
  const off = Math.min(Math.max(margin * 1.25, spread + margin * 0.6), w * 0.42);
  for (const side of [-1, 1]) {
    const col = items.filter(it => (it.x < cx) === (side < 0)).sort((a, b) => a.y - b.y);
    const colX = clamp(cx + side * off, margin, w - margin);
    let last = -Infinity;
    for (const it of col) { it.ly = Math.max(it.y, last + rowH); last = it.ly; }
    const over = last - (h - rowH * 4.3); if (over > 0) for (const it of col) it.ly -= over;
    for (const it of col) { it.side = side; it.lx = colX; it.ex = colX - side * rowH * 0.3; }
  }
  return items;
}
function drawLabels() {
  const host = $('labels'); const svg = host.querySelector('svg');
  const w = innerWidth, h = innerHeight; const items = labelItems(w, h);
  const keys = new Set(items.map(it => it.key));
  for (const [k, el] of labelEls) if (!keys.has(k)) { el.remove(); labelEls.delete(k); }
  if (!items.length) { svg.innerHTML = ''; return; }
  layoutLabels(items, w, h);
  let lines = '';
  for (const it of items) {
    let el = labelEls.get(it.key);
    if (!el) { el = document.createElement('div'); el.className = 'lb'; el.textContent = it.text; host.appendChild(el); labelEls.set(it.key, el); }
    el.style.left = it.lx + 'px'; el.style.top = it.ly + 'px';
    el.style.transform = it.side < 0 ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
    lines += `<polyline points="${it.x.toFixed(1)},${it.y.toFixed(1)} ${(it.ex - it.side * 18).toFixed(1)},${it.ly.toFixed(1)} ${it.ex.toFixed(1)},${it.ly.toFixed(1)}" fill="none" stroke="rgba(228,233,236,0.45)" stroke-width="1"/><circle cx="${it.x.toFixed(1)}" cy="${it.y.toFixed(1)}" r="2.4" fill="#6fd0e0"/>`;
  }
  svg.innerHTML = lines;
}

// ---------- heartbeat & breathing ----------
const ANIM = { lungs: [], diaphragm: [] };
function setPivot(mesh, p) {
  // move the mesh origin to p without changing where it renders
  mesh.geometry.translate(-p.x, -p.y, -p.z); mesh.userData.basePos.copy(p); mesh.position.copy(p);
  mesh.geometry.computeBoundingSphere();
}
function setupAnimation() {
  // the heart itself is animated by the rig in cardio.js
  for (const side of ['left', 'right']) {
    const lobes = PARTS_LIST.filter(m => /lobe of lung/.test(m.userData.base) && (m.userData.side === side || (!m.userData.side && side === 'right')));
    if (!lobes.length) continue;
    const box = new THREE.Box3(); for (const m of lobes) box.union(m.geometry.boundingBox);
    const p = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2); // apex: lungs grow downward
    for (const m of lobes) { setPivot(m, p); m.castShadow = false; ANIM.lungs.push(m); }
  }
  const dia = byEn.get('diaphragm'); if (dia) { dia.castShadow = false; ANIM.diaphragm.push(dia); }
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let fpsEma = 60, fpsT = 0; let rigAz = 0;
function updateRig() {
  const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  if (Math.abs(az - rigAz) > 0.035) { rigAz = az; rig.rotation.y = az; markShadows(); }
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
  updateRig();
  cardioTick(dt);
  if (state.anim.breath) {
    const b = 0.5 - 0.5 * Math.cos(t * TAU / 4.4);
    for (const m of ANIM.lungs) m.scale.set(1 + 0.022 * b, 1 + 0.06 * b, 1 + 0.035 * b);
    for (const m of ANIM.diaphragm) m.position.y = m.userData.basePos.y - 0.011 * b;
  }
  doHover();
  if (shadowDirty > 0) { renderer.shadowMap.needsUpdate = true; shadowDirty--; }
  renderer.render(scene, camera);
  if (state.labels || labelEls.size || SCN.active) drawLabels();
  fpsEma = fpsEma * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  if (t - fpsT > 0.5) { fpsT = t; $('stFps').textContent = Math.round(fpsEma); }
  requestAnimationFrame(animate);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const fmtK = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n);
window.__anatomy = {
  ready: false, THREE, scene, camera, controls, renderer, state, byId, byEn, PARTS_LIST, MATS, get CARDIO() { return CARDIO; }, get SCN() { return SCN; },
  setView: (i) => { const v = VIEWS[i]; camera.position.copy(vec(v[1])); controls.target.copy(vec(v[2])); controls.update(); },
  look: (p, t) => { camera.position.copy(vec(p)); controls.target.copy(vec(t)); controls.update(); },
  setLayer, setOpacity, setSplit, applyPreset, select: (en) => select(byEn.get(en) || byId.get(en) || null), pick,
  setCut: (on, axis = 'z', pos = 0.52) => { state.cut = on; state.cutAxis = axis; state.cutPos = pos; applyCut(); },
  stats: () => ({ parts: PARTS_LIST.length, tris: Math.round(triTotal), loadMs: Math.round(STATS.loadMs), workers: STATS.workers, errors: loadErrors }),
  render: () => { controls.update(); updateRig(); renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera); drawLabels(); },
  pause: (p = true) => { state.paused = p; },
  shadows: (on) => { renderer.shadowMap.enabled = on; for (const m of Object.values(MATS)) m.needsUpdate = true; markShadows(); },
};

