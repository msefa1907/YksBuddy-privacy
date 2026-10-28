// ===================== Cardiac cycle: heart rig, conduction system, blood flow =====================
// Landmarks and vessel centrelines come from data/heart_rig.json (tools/heart_rig.py). Every vertex of the
// heart, arteries and veins gets displacement fields for atrial and ventricular contraction, valve motion,
// an activation time for the conduction glow and an arc length for the arterial pulse wave.
const CYC = 0.8; // template cycle length (s); all phase times below are on this scale
const CARDIO = { ready: false, rig: null, tc: 0, bpm: 72, speed: 1, playing: true, hold: null, fx: null, flows: {} };
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

// ---------- the cardiac cycle (one beat of 0.8 s, scaled to the heart rate) ----------
const PHASES = [
  { from: 0.0, to: 0.16, key: 'atrial', tr: 'Kulakçık sistolü', sub: 'Kulakçıklar kasılır; kan açık AV kapaklardan karıncıklara dolar.' },
  { from: 0.16, to: 0.24, key: 'vsys1', tr: 'Karıncık sistolü', sub: 'Karıncıklar kasılmaya başlar; AV kapaklar kapanır (1. kalp sesi).' },
  { from: 0.24, to: 0.45, key: 'vsys2', tr: 'Karıncık sistolü', sub: 'Yarım ay kapaklar açılır; kan aort ve akciğer atardamarına pompalanır.' },
  { from: 0.45, to: 0.53, key: 'dia1', tr: 'Diyastol', sub: 'Karıncıklar gevşer; yarım ay kapaklar kapanır (2. kalp sesi).' },
  { from: 0.53, to: 0.8, key: 'dia2', tr: 'Diyastol', sub: 'AV kapaklar açılır; toplardamarlardan gelen kan kulakçıklardan karıncıklara akar.' },
];
function cycleState(tc) {
  const uA = bump(tc, 0.11, 0.045);
  const uV = sstep(0.17, 0.3, tc) * (1 - sstep(0.4, 0.53, tc));
  const av = tc < 0.3 ? 1 - sstep(0.175, 0.205, tc) : sstep(0.49, 0.53, tc);
  const sl = sstep(0.225, 0.25, tc) * (1 - sstep(0.435, 0.46, tc));
  const phase = PHASES.find(p => tc >= p.from && tc < p.to) || PHASES[PHASES.length - 1];
  return { uA, uV, av, sl, phase };
}
// schematic ECG (P, QRS, T) on the same time base
function ecgAt(tc) {
  return 0.13 * bump(tc, 0.05, 0.022) - 0.08 * bump(tc, 0.172, 0.006) + 1.0 * bump(tc, 0.19, 0.008) - 0.22 * bump(tc, 0.207, 0.007) + 0.28 * bump(tc, 0.44, 0.035);
}
const SOUNDS = [{ t: 0.19, tr: '1. ses (lub)' }, { t: 0.45, tr: '2. ses (dub)' }];

// ---------- spatial hash for nearest-point queries ----------
function pointHash(cell) {
  const map = new Map(); const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  return {
    add(x, y, z, v) { const k = key(x, y, z); let b = map.get(k); if (!b) map.set(k, (b = [])); b.push(x, y, z, v); },
    nearest(x, y, z, maxR) { // returns [dist, value] within maxR (searches the cells around)
      const n = Math.ceil(maxR / cell); const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let best = maxR * maxR, val = null;
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
        const b = map.get(`${cx + i},${cy + j},${cz + k}`); if (!b) continue;
        for (let q = 0; q < b.length; q += 4) { const dx = b[q] - x, dy = b[q + 1] - y, dz = b[q + 2] - z; const d = dx * dx + dy * dy + dz * dz; if (d < best) { best = d; val = b[q + 3]; } }
      }
      return [Math.sqrt(best), val];
    },
  };
}

// ---------- rig fields ----------
function rigFrame(rig) {
  const B = V3(rig.base), A = V3(rig.apex), nav = V3(rig.avNormal).normalize();
  const ax = A.clone().sub(B); const L = ax.length(); ax.normalize();
  const ch = Object.fromEntries(Object.entries(rig.chambers).map(([k, v]) => [k, { c: V3(v.c), r: v.r }]));
  const val = Object.fromEntries(Object.entries(rig.valves).map(([k, v]) => [k, { c: V3(v.c), u: V3(v.axis).normalize(), r: v.r || 0.012 }]));
  const sepN = V3(rig.septum.n).normalize(), sepC = V3(rig.septum.c);
  const center = new THREE.Vector3(); for (const k in ch) center.add(ch[k].c); center.multiplyScalar(0.25);
  // four-chamber plane through both AV valves and the apex, normal facing the viewer (anterior)
  const T = val.tricuspid.c, M = val.mitral.c;
  const n4 = new THREE.Vector3().subVectors(M, T).cross(new THREE.Vector3().subVectors(A, T)).normalize();
  if (n4.z < 0) n4.negate();
  return { B, A, nav, ax, L, ch, val, sepN, sepC, center, n4, sa: V3(rig.nodes.sa), av: V3(rig.nodes.av) };
}
const _q = new THREE.Vector3(), _r = new THREE.Vector3(), _t = new THREE.Vector3();
// displacement of point p (normal n) at full atrial (outA) and ventricular (outV) contraction; g = attachment to the heart
function heartFields(F, p, n, g, outA, outV) {
  outA.set(0, 0, 0); outV.set(0, 0, 0); if (g <= 0) return;
  const d = _q.copy(p).sub(F.B).dot(F.nav);
  const wv = sstep(-0.004, 0.008, d), wa = 1 - sstep(-0.008, 0.004, d);
  const a = _q.copy(p).sub(F.B).dot(F.ax); const f = clamp(a / F.L, 0, 1);
  const rp = _r.copy(p).sub(F.B).addScaledVector(F.ax, -a); const rl = rp.length() || 1;
  // ventricles: walls move toward the long axis (inner surface more, so the wall thickens) and the AV plane descends
  const inner = n ? -n.dot(rp) / rl > 0.25 : false;
  const kr = (inner ? 0.17 : 0.07) * (0.5 + 0.5 * sstep(0, 0.3, f));
  outV.copy(rp).multiplyScalar(-kr).addScaledVector(F.ax, 0.008 * (1 - f)).multiplyScalar(wv);
  outV.addScaledVector(F.ax, 0.008 * wa * Math.exp(-Math.max(0, -d) / 0.015)); // atria are stretched as the AV plane moves
  // atria: walls move toward the centre of their own atrium; ventricles fill a little
  const ra = F.ch.RA.c, la = F.ch.LA.c; const w1 = 1 / Math.max(p.distanceToSquared(ra), 1e-6), w2 = 1 / Math.max(p.distanceToSquared(la), 1e-6);
  _t.copy(ra).multiplyScalar(w1).addScaledVector(la, w2).multiplyScalar(1 / (w1 + w2));
  outA.copy(_t).sub(p).multiplyScalar(0.13 * wa).addScaledVector(rp, 0.025 * wv);
  // keep the arterial roots steady
  const keep = sstep(0.011, 0.02, p.distanceTo(F.val.aortic.c)) * sstep(0.009, 0.017, p.distanceTo(F.val.pulmonary.c));
  outA.multiplyScalar(g * keep); outV.multiplyScalar(g * (0.4 + 0.6 * keep));
}
// activation time (s) of a myocardial point: atria from the SA node, ventricles after the AV delay from apex to base
function activationTime(F, p) {
  const d = _q.copy(p).sub(F.B).dot(F.nav);
  if (d < 0) return p.distanceTo(F.sa) / 0.75;
  const f = clamp(_q.copy(p).sub(F.B).dot(F.ax) / F.L, 0, 1);
  const sep = Math.abs(_r.copy(p).sub(F.sepC).dot(F.sepN));
  return 0.172 + 0.05 * (1 - f) + 0.25 * Math.min(sep, 0.03);
}

const VALVE_ID = { 'tricuspid valve': 1, 'mitral valve': 2, 'pulmonary valve': 3, 'aortic valve': 4 };
const CORONARY_RE = /coronary|cardiac vein|veins of ventricle|coronary sinus|interventricular branch|marginal branch|circumflex|posterolateral|septal branches/;

function buildTreeSamples(rig) {
  // arc length from the root for every centreline sample of the arterial trees (pulse wave)
  const h = pointHash(0.008); const trees = [['aorta', 0], ['pa', 10]];
  for (const [k, off] of trees) for (const q of rig.trees[k] || []) {
    let s = 0;
    for (let i = 0; i < q.p.length; i++) {
      if (i) s += Math.hypot(q.p[i][0] - q.p[i - 1][0], q.p[i][1] - q.p[i - 1][1], q.p[i][2] - q.p[i - 1][2]);
      h.add(q.p[i][0], q.p[i][1], q.p[i][2], [off + s, q.r[i]]);
    }
  }
  return h;
}

function applyRig(F, rig) {
  const wallMesh = byEn.get('wall of heart'); if (!wallMesh) return;
  const wallHash = pointHash(0.006); const wp = wallMesh.geometry.attributes.position.array;
  for (let i = 0; i < wp.length; i += 9) wallHash.add(wp[i], wp[i + 1], wp[i + 2], 1);
  const treeHash = buildTreeSamples(rig);
  const box = new THREE.Box3().setFromBufferAttribute(wallMesh.geometry.attributes.position).expandByScalar(0.03);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), dA = new THREE.Vector3(), dV = new THREE.Vector3();
  for (const m of PARTS_LIST) {
    const L = m.userData.layer; if (!RIG_LAYERS.has(L)) continue;
    const geo = m.geometry; const P = geo.attributes.position.array, N = geo.attributes.normal; const nv = P.length / 3;
    const A = new Float32Array(nv * 3), Vv = new Float32Array(nv * 3), O = new Float32Array(nv * 3), T = new Float32Array(nv * 4);
    const en = m.userData.base; const vid = VALVE_ID[en] || 0; const heartPart = L === 'heart';
    const myo = heartPart && !vid; const isArt = L === 'arteries' && !CORONARY_RE.test(en);
    const valve = vid ? F.val[{ 1: 'tricuspid', 2: 'mitral', 3: 'pulmonary', 4: 'aortic' }[vid]] : null;
    for (let i = 0; i < nv; i++) {
      p.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]); n.fromBufferAttribute(N, i).normalize();
      let g = 0;
      if (heartPart) g = 1;
      else if (box.containsPoint(p)) g = 1 - sstep(0.003, 0.025, wallHash.nearest(p.x, p.y, p.z, 0.03)[0]);
      heartFields(F, p, n, g, dA, dV);
      A[3 * i] = dA.x; A[3 * i + 1] = dA.y; A[3 * i + 2] = dA.z; Vv[3 * i] = dV.x; Vv[3 * i + 1] = dV.y; Vv[3 * i + 2] = dV.z;
      T[4 * i] = myo ? activationTime(F, p) : -1; T[4 * i + 2] = vid;
      if (valve) {
        const h = _q.copy(p).sub(valve.c).dot(valve.u); const r = _r.copy(p).sub(valve.c).addScaledVector(valve.u, -h); const rl = r.length();
        if (vid <= 2) { // AV leaflets: free edges come together and billow back toward the atrium
          const wl = sstep(-0.003, 0.004, h) * (1 - sstep(0.016, 0.026, h));
          O[3 * i] = (-r.x * 0.7 * sstep(0, 0.012, h) - valve.u.x * h * 0.45) * wl;
          O[3 * i + 1] = (-r.y * 0.7 * sstep(0, 0.012, h) - valve.u.y * h * 0.45) * wl;
          O[3 * i + 2] = (-r.z * 0.7 * sstep(0, 0.012, h) - valve.u.z * h * 0.45) * wl;
        } else if (vid === 3) { // pulmonary cusps are pressed against the wall when open
          const k = Math.max(0, valve.r * 0.95 - rl) * sstep(-0.003, 0.005, h) / Math.max(rl, 1e-4);
          O[3 * i] = r.x * k; O[3 * i + 1] = r.y * k; O[3 * i + 2] = r.z * k;
        }
      }
      if (isArt) {
        const [dist, val] = treeHash.nearest(p.x, p.y, p.z, 0.03);
        if (val && dist < val[1] * 1.6 + 0.004) { T[4 * i + 1] = val[0]; T[4 * i + 3] = Math.min(val[1], 0.014); }
      }
    }
    if (vid === 4 && m.userData.openPos) { const op = m.userData.openPos; for (let i = 0; i < nv * 3; i++) O[i] = op[i] - P[i]; }
    geo.setAttribute('rigA', new THREE.BufferAttribute(A, 3)); geo.setAttribute('rigV', new THREE.BufferAttribute(Vv, 3));
    geo.setAttribute('rigO', new THREE.BufferAttribute(O, 3)); geo.setAttribute('rigT', new THREE.BufferAttribute(T, 4));
    if (L !== 'heart' && !CORONARY_RE.test(en)) continue;
    m.castShadow = false;
  }
  bakeHeartColours(F, wallMesh);
}

// epicardial fat along the coronary grooves and a paler endocardium, baked into the wall's vertex colours
function bakeHeartColours(F, wall) {
  const cor = pointHash(0.006);
  for (const m of PARTS_LIST) if (CORONARY_RE.test(m.userData.base)) { const a = m.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 6) cor.add(a[i], a[i + 1], a[i + 2], 1); }
  const geo = wall.geometry; const P = geo.attributes.position.array, N = geo.attributes.normal, C = geo.attributes.color;
  const base = tintFor({ id: wall.userData.id, base: 'wall of heart', mat: 'heart' });
  const fat = new THREE.Color(0xd8bd84), endo = new THREE.Color(0xa84a43);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.length / 3; i++) {
    p.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]); n.fromBufferAttribute(N, i).normalize();
    const ao = clamp(C.getX(i) / Math.max(base[0], 1e-4), 0, 1.2);
    let best = null, bd = 1e9; for (const k in F.ch) { const d = p.distanceTo(F.ch[k].c); if (d < bd) { bd = d; best = F.ch[k]; } }
    const toC = _q.copy(best.c).sub(p).normalize();
    const innerW = sstep(0.15, 0.5, n.dot(toC)) * (1 - sstep(best.r * 1.6, best.r * 2.4, bd));
    const outerW = sstep(0.0, 0.3, n.dot(_r.copy(p).sub(F.center).normalize()));
    const fw = sstep(0.0052, 0.0018, cor.nearest(p.x, p.y, p.z, 0.008)[0]) * outerW * 0.55;
    let r = base[0], g = base[1], b = base[2];
    r += (endo.r - r) * innerW * 0.6; g += (endo.g - g) * innerW * 0.6; b += (endo.b - b) * innerW * 0.6;
    r += (fat.r - r) * fw; g += (fat.g - g) * fw; b += (fat.b - b) * fw;
    C.setXYZ(i, r * ao, g * ao, b * ao);
  }
  C.needsUpdate = true;
}

// ---------- aortic valve (missing from the data set): three semilunar cusps, modelled closed with an open pose ----------
function buildAorticValve(F) {
  const v = F.val.aortic; const u = v.u; const R = v.r * 0.98;
  const ex = new THREE.Vector3().crossVectors(u, Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const ey = new THREE.Vector3().crossVectors(u, ex);
  const nT = 18, nS = 7; const closed = [], open = [], idx = [];
  const dir = (th) => ex.clone().multiplyScalar(Math.cos(th)).addScaledVector(ey, Math.sin(th));
  const centre = v.c.clone().addScaledVector(u, 0.0015);
  for (let k = 0; k < 3; k++) {
    const th0 = k * TAU / 3 + 0.3; const base = closed.length / 3;
    const c0 = v.c.clone().addScaledVector(dir(th0), R), c1 = v.c.clone().addScaledVector(dir(th0 + TAU / 3), R);
    for (let i = 0; i <= nT; i++) {
      const t = i / nT, th = th0 + t * TAU / 3, d = dir(th);
      const W = v.c.clone().addScaledVector(d, R).addScaledVector(u, -0.007 * Math.sin(Math.PI * t));
      const Ec = t < 0.5 ? c0.clone().lerp(centre, t * 2) : centre.clone().lerp(c1, (t - 0.5) * 2);
      const Eo = v.c.clone().addScaledVector(d, R * 0.84).addScaledVector(u, 0.005);
      for (let j = 0; j <= nS; j++) {
        const s = j / nS; const sag = 0.0028 * Math.sin(Math.PI * s) * Math.sin(Math.PI * t);
        const pc = W.clone().lerp(Ec, s).addScaledVector(u, -sag); const po = W.clone().lerp(Eo, s).addScaledVector(d, -0.0006 * Math.sin(Math.PI * s));
        closed.push(pc.x, pc.y, pc.z); open.push(po.x, po.y, po.z);
      }
    }
    for (let i = 0; i < nT; i++) for (let j = 0; j < nS; j++) {
      const a = base + i * (nS + 1) + j, b = a + nS + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(closed), 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const tint = tintFor({ id: 'aortic valve', base: 'valve', mat: 'valve' }); const nv = closed.length / 3; const col = new Uint16Array(nv * 3);
  for (let i = 0; i < nv; i++) { col[3 * i] = tint[0] * 0.9 * 65535; col[3 * i + 1] = tint[1] * 0.9 * 65535; col[3 * i + 2] = tint[2] * 0.9 * 65535; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new THREE.Mesh(geo, getMat('heart', 'valve'));
  const meta = { id: 'SYN-aortic-valve', en: 'aortic valve', base: 'aortic valve', side: null, mat: 'valve', tr: 'Aort kapağı (şematik)' };
  const d = describe(meta);
  mesh.userData = { layer: 'heart', ...meta, la: d.la, desc: d.desc, group: d.group, center: geo.boundingSphere.center.clone(), basePos: new THREE.Vector3(), pickIndex: PARTS_LIST.length + 1, openPos: new Float32Array(open), synthetic: true };
  mesh.castShadow = false; mesh.receiveShadow = true;
  groups.heart.add(mesh); PARTS_LIST.push(mesh); byId.set(meta.id, mesh); byEn.set(meta.en, mesh); triTotal += idx.length / 3;
}

// ---------- conduction system (SA node → AV node → His bundle → bundle branches → Purkinje fibres) ----------
function buildConduction(F) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const segs = [];
  const mk = (pts, r, t0, t1, name) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(q => q.clone()));
    const geo = new THREE.TubeGeometry(curve, Math.max(8, pts.length * 10), r, 8, false);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2a08, emissive: 0xffc640, emissiveIntensity: 0.6, roughness: 0.4 });
    const ghost = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false });
    const m = new THREE.Mesh(geo, mat); const gm = new THREE.Mesh(geo, ghost); gm.renderOrder = 6;
    g.add(m, gm); segs.push({ m, mat, t0, t1, name });
  };
  const node = (p, r, t0, t1, name) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2a08, emissive: 0xffd060, emissiveIntensity: 0.8, roughness: 0.4 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat); m.position.copy(p);
    const gm = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false })); gm.position.copy(p); gm.renderOrder = 6;
    g.add(m, gm); segs.push({ m, mat, t0, t1, name });
  };
  const ra = F.ch.RA.c;
  const sa = F.sa.clone().lerp(ra, 0.12), av = F.av.clone();
  node(sa, 0.0028, 0.0, 0.03, 'SA düğümü');
  for (const s of [-1, 0, 1]) { // internodal pathways across the right atrium
    const mid = sa.clone().lerp(av, 0.5).lerp(ra, 0.35).addScaledVector(F.sepN, 0.006 * s).addScaledVector(F.nav, -0.004);
    mk([sa, mid, av], 0.0006, 0.0, 0.07, 'Düğümler arası yollar');
  }
  node(av, 0.0024, 0.06, 0.16, 'AV düğümü');
  const apexIn = F.A.clone().lerp(F.B, 0.16);
  const sdir = apexIn.clone().sub(av).normalize();
  const his = av.clone().addScaledVector(sdir, 0.011);
  mk([av, av.clone().lerp(his, 0.5), his], 0.0011, 0.15, 0.175, 'His demeti');
  const len = apexIn.distanceTo(his);
  for (const side of [1, -1]) {
    const pts = [his]; for (const k of [0.3, 0.62, 0.92]) pts.push(his.clone().addScaledVector(sdir, len * k).addScaledVector(F.sepN, 0.0045 * side));
    mk(pts, 0.0008, 0.17, 0.19, side > 0 ? 'Sol dal' : 'Sağ dal');
    const tip = pts[pts.length - 1];
    const c = side > 0 ? F.ch.LV : F.ch.RV; const away = side > 0 ? F.sepN : F.sepN.clone().negate();
    for (const ang of [-1.1, -0.45, 0.2, 0.85]) {
      const d = away.clone().applyAxisAngle(F.ax, ang);
      const wallR = c.r * 1.05;
      const mid = F.B.clone().addScaledVector(F.ax, F.L * 0.6).addScaledVector(d, wallR * 0.95);
      const end = F.B.clone().addScaledVector(F.ax, F.L * 0.22).addScaledVector(d, wallR);
      mk([tip, tip.clone().lerp(mid, 0.5).addScaledVector(d, 0.004), mid, end], 0.00045, 0.185, 0.225, 'Purkinje lifleri');
    }
  }
  return { group: g, segs };
}

// ---------- blood flow particles ----------
const BLOOD = { o2: new THREE.Color(0.78, 0.04, 0.06), co2: new THREE.Color(0.17, 0.25, 0.78) };
function polyline(points, radii) { // -> { pts, cum, rad }
  const n = points.length; const pts = new Float32Array(n * 3), cum = new Float32Array(n), rad = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pts.set([points[i].x, points[i].y, points[i].z], i * 3); rad[i] = radii[i];
    if (i) cum[i] = cum[i - 1] + points[i].distanceTo(points[i - 1]);
  }
  return { pts, cum, rad };
}
function treePts(q, from = 0, to = Infinity, reverse = false) {
  // part of a centreline path between arc lengths [from, to] measured from the root
  const P = [], R = []; let s = 0;
  for (let i = 0; i < q.p.length; i++) {
    if (i) s += Math.hypot(q.p[i][0] - q.p[i - 1][0], q.p[i][1] - q.p[i - 1][1], q.p[i][2] - q.p[i - 1][2]);
    if (s >= from && s <= to) { P.push(V3(q.p[i])); R.push(q.r[i]); }
  }
  if (reverse) { P.reverse(); R.reverse(); }
  return [P, R];
}
function pickWeighted(list, rnd = Math.random()) {
  const tot = list.reduce((a, q) => a + q.w, 0); let x = rnd * tot;
  for (const q of list) { x -= q.w; if (x <= 0) return q; }
  return list[list.length - 1];
}
// one route: venous inflow -> atrium -> AV valve -> ventricle -> semilunar valve -> artery;
// fullVein / fullArt follow the whole vessel tree instead of only the part next to the heart
function buildRoute(F, rig, side, fullVein, fullArt) {
  const R = side === 'R';
  const veinTree = R ? (Math.random() < 0.45 ? 'svc' : 'ivc') : 'pv';
  const vq = pickWeighted(rig.trees[veinTree]);
  const aq = pickWeighted(rig.trees[R ? 'pa' : 'aorta']);
  const [vp, vr] = treePts(vq, 0, fullVein ? Infinity : 0.03, true);
  const [ap, ar] = treePts(aq, 0, fullArt ? Infinity : (R ? 0.04 : 0.055));
  const atr = R ? F.ch.RA : F.ch.LA, ven = R ? F.ch.RV : F.ch.LV;
  const avv = F.val[R ? 'tricuspid' : 'mitral'], slv = F.val[R ? 'pulmonary' : 'aortic'];
  // chamber waypoints sit just behind the four-chamber plane so the blood stays in the visible half of a cut heart
  const behind = (q, d) => { const k = q.clone().sub(F.val.tricuspid.c).dot(F.n4) + d; return k > 0 ? q.clone().addScaledVector(F.n4, -k) : q.clone(); };
  const deep = behind(ven.c.clone().lerp(F.A, R ? 0.25 : 0.35), 0.005);
  const outflow = slv.c.clone().addScaledVector(slv.u, -0.013);
  const chain = [vp[vp.length - 1], behind(atr.c, 0.004), avv.c, deep, outflow, slv.c, ap[0]];
  const chainR = [vr[vr.length - 1], atr.r * 0.85, 0.009, ven.r * 0.85, 0.008, slv.r * 0.7, ar[0]];
  const curve = new THREE.CatmullRomCurve3(chain, false, 'centripetal');
  const lens = [0]; for (let i = 1; i < chain.length; i++) lens.push(lens[i - 1] + chain[i].distanceTo(chain[i - 1]));
  const n = Math.max(12, Math.round(lens[lens.length - 1] / 0.0015));
  const cp = [], cr = [];
  for (let i = 1; i < n; i++) {
    const u = i / n; cp.push(curve.getPointAt(u));
    const s = u * lens[lens.length - 1]; let k = 1; while (k < lens.length - 1 && lens[k] < s) k++;
    cr.push(lerp(chainR[k - 1], chainR[k], clamp((s - lens[k - 1]) / Math.max(lens[k] - lens[k - 1], 1e-6), 0, 1)));
  }
  const pl = polyline([...vp, ...cp, ...ap], [...vr, ...cr, ...ar]);
  // arc positions of the landmarks along the route
  const near = (q) => { let bi = 0, bd = 1e9; for (let i = 0; i < pl.cum.length; i++) { const d = Math.hypot(pl.pts[3 * i] - q.x, pl.pts[3 * i + 1] - q.y, pl.pts[3 * i + 2] - q.z); if (d < bd) { bd = d; bi = i; } } return pl.cum[bi]; };
  pl.sAtr = pl.cum[vp.length - 1]; pl.sAV = near(avv.c); pl.sSL = near(slv.c); pl.side = side; pl.end = pl.cum[pl.cum.length - 1];
  pl.spanAtr = Math.max(0.004, pl.sAV - pl.sAtr); pl.spanVen = Math.max(0.004, pl.sSL - pl.sAV);
  pl.leaf = ap[ap.length - 1];
  return pl;
}
function pathAt(pl, s, out) {
  const c = pl.cum; s = clamp(s, 0, pl.end);
  let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const t = (s - c[lo]) / Math.max(c[hi] - c[lo], 1e-9), P = pl.pts;
  out[0] = P[3 * lo] + (P[3 * hi] - P[3 * lo]) * t; out[1] = P[3 * lo + 1] + (P[3 * hi + 1] - P[3 * lo + 1]) * t; out[2] = P[3 * lo + 2] + (P[3 * hi + 2] - P[3 * lo + 2]) * t;
  out[3] = P[3 * hi] - P[3 * lo]; out[4] = P[3 * hi + 1] - P[3 * lo + 1]; out[5] = P[3 * hi + 2] - P[3 * lo + 2];
  out[6] = pl.rad[lo] + (pl.rad[hi] - pl.rad[lo]) * t;
}
// particles inside the heart are cut with the heart wall (uPlane); those in the great vessels stay visible
const BLOOD_VS = `
attribute vec3 color; attribute float alpha; attribute float inHeart; varying vec3 vCol; varying float vA;
uniform float uSize, uScale, uClipAll; uniform vec4 uPlane;
void main() {
  vec3 transformed = position;
  #include <project_vertex>
  gl_PointSize = uSize * uScale / -mvPosition.z;
  vCol = color; vA = alpha;
  if ((inHeart > 0.5 || uClipAll > 0.5) && dot(uPlane.xyz, position) + uPlane.w < 0.0) vA = 0.0;
}`;
const BLOOD_FS = `
varying vec3 vCol; varying float vA;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0; float r2 = dot(d, d);
  if (r2 > 1.0 || vA < 0.03) discard;
  vec3 n = vec3(d.x, -d.y, sqrt(1.0 - r2)); vec3 l = normalize(vec3(0.35, 0.6, 0.72));
  float dif = 0.3 + 0.7 * max(dot(n, l), 0.0); float sp = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  gl_FragColor = vec4(vCol * dif + 0.45 * sp, 1.0);
  if (vA < 0.97 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > vA) discard;
  #include <colorspace_fragment>
}`;
// modes: 'heart' (around the heart only), 'pulm' (pulmonary loop in full), 'body' (systemic loop in full)
const FLOW_MODES = { heart: { R: [0, 0], L: [0, 0] }, pulm: { R: [0, 1], L: [1, 0] }, body: { R: [1, 0], L: [0, 1] } };
class BloodFlow {
  constructor(F, rig, n, mode, size) {
    this.F = F; this.rig = rig; this.full = mode !== 'heart'; this.n = n;
    this.routes = { R: [], L: [] }; const m = FLOW_MODES[mode];
    for (let i = 0; i < (this.full ? 60 : 36); i++) { this.routes.R.push(buildRoute(F, rig, 'R', ...m.R)); this.routes.L.push(buildRoute(F, rig, 'L', ...m.L)); }
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), alpha = new Float32Array(n), inHeart = new Float32Array(n);
    this.p = Array.from({ length: n }, (_, i) => {
      const side = i % 2 ? 'L' : 'R'; const route = this.pick(side);
      const o = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()));
      return { side, route, s: Math.random() * route.end, holdAV: 0.002 + Math.random() * 0.85, holdSL: 0.002 + Math.random() * 0.85, o: [o.x, o.y, o.z], jitter: 0.7 + Math.random() * 0.6 };
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1)); geo.setAttribute('inHeart', new THREE.BufferAttribute(inHeart, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: BLOOD_VS, fragmentShader: BLOOD_FS, uniforms: { uSize: { value: size }, uScale: { value: 800 }, uClipAll: { value: 0 }, uPlane: { value: new THREE.Vector4(0, 0, 0, 1) } } });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.visible = false; scene.add(this.points);
    this.buf = new Float32Array(7);
    this.step(0, 0);
  }
  pick(side) { const r = this.routes[side]; return r[(Math.random() * r.length) | 0]; }
  speed(pl, s, tc, st) {
    if (s < pl.sAtr) return 0.07 * (1 - 0.6 * st.uA); // venous return never stops
    if (s < pl.sAV) return 0.035 + st.av * (0.05 + 0.22 * bump(tc, 0.58, 0.05) + 0.18 * bump(tc, 0.11, 0.04));
    if (s < pl.sSL) return 0.035 + st.sl * (0.05 + 0.5 * bump(tc, 0.3, 0.07));
    const lag = (s - pl.sSL) / 4.0; const tt = ((tc - lag) % CYC + CYC) % CYC;
    return 0.12 + 0.55 * bump(tt, 0.3, 0.08);
  }
  step(dtc, tc) {
    const st = cycleState(tc); const ga = this.points.geometry.attributes; const pos = ga.position.array, col = ga.color.array, al = ga.alpha.array, ih = ga.inHeart.array;
    const b = this.buf;
    for (let i = 0; i < this.n; i++) {
      const q = this.p[i]; const pl = q.route;
      let s = q.s + this.speed(pl, q.s, tc, st) * dtc * q.jitter;
      // closed valves hold the blood in the chamber in front of them
      if (q.s < pl.sAV && st.av < 0.35) s = Math.min(s, Math.max(q.s, pl.sAV - q.holdAV * pl.spanAtr));
      if (q.s >= pl.sAV && q.s < pl.sSL && st.sl < 0.35) s = Math.min(s, Math.max(q.s, pl.sSL - q.holdSL * pl.spanVen));
      if (s >= pl.end) { // leave the route: in the full circulation the other side of the heart takes over (lungs / body capillaries)
        q.side = this.full ? (q.side === 'R' ? 'L' : 'R') : q.side; q.route = this.pick(q.side); s = 0;
      }
      q.s = s; pathAt(q.route, s, b);
      const tl = Math.hypot(b[3], b[4], b[5]) || 1; const tx = b[3] / tl, ty = b[4] / tl, tz = b[5] / tl;
      const od = q.o[0] * tx + q.o[1] * ty + q.o[2] * tz; const r = b[6] * 0.8;
      pos[3 * i] = b[0] + (q.o[0] - od * tx) * r; pos[3 * i + 1] = b[1] + (q.o[1] - od * ty) * r; pos[3 * i + 2] = b[2] + (q.o[2] - od * tz) * r;
      const c = q.side === 'R' ? BLOOD.co2 : BLOOD.o2; col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
      ih[i] = s > pl.sAtr - 0.004 && s < pl.sSL + 0.004 ? 1 : 0;
      al[i] = sstep(0, 0.008, s) * sstep(0, 0.01, q.route.end - s);
    }
    ga.position.needsUpdate = true; ga.color.needsUpdate = true; ga.alpha.needsUpdate = true; ga.inHeart.needsUpdate = true;
  }
}

// ---------- setup & per-frame update ----------
async function setupCardio() {
  try {
    const res = await fetch(DATA + 'heart_rig.json'); if (!res.ok) throw new Error('heart_rig.json: HTTP ' + res.status);
    const rig = await res.json(); const F = rigFrame(rig);
    buildAorticValve(F);
    applyRig(F, rig);
    CARDIO.rig = rig; CARDIO.F = F;
    CARDIO.fx = buildConduction(F);
    CARDIO.flows.heart = new BloodFlow(F, rig, isMobile ? 1300 : 2400, 'heart', 0.0022);
    CARDIO.flows.pulm = new BloodFlow(F, rig, isMobile ? 1500 : 3000, 'pulm', 0.0032);
    CARDIO.flows.body = new BloodFlow(F, rig, isMobile ? 1500 : 2800, 'body', 0.0032);
    CARDIO.ready = true;
  } catch (e) { console.warn('cardio rig unavailable', e); loadErrors.push('Kalp animasyonu: ' + e.message); }
}
function cardioTick(dt) {
  if (!CARDIO.ready) return;
  const run = state.anim.heart && CARDIO.playing;
  let dtc = 0;
  if (run) {
    dtc = dt * CARDIO.speed * (CARDIO.bpm / 60) * CYC;
    let tc = CARDIO.tc + dtc;
    if (CARDIO.hold) { // play a window of the cycle once, then stop at its end
      if (tc >= CARDIO.hold[1]) { tc = CARDIO.hold[1] - 1e-4; dtc = Math.max(0, tc - CARDIO.tc); CARDIO.playing = false; onCardioHold(); }
    } else tc %= CYC;
    CARDIO.tc = tc;
  }
  const tc = CARDIO.tc, st = cycleState(tc);
  RIGU.uRigA.value = st.uA; RIGU.uRigV.value = st.uV;
  RIGU.uRigOpen.value.set(st.av, st.av, st.sl, st.sl);
  RIGU.uCycleT.value = tc;
  RIGU.uPulseFront.value.set((tc - 0.25) * 2.4, (tc - 0.25) * 1.6);
  RIGU.uPulseAmp.value = CARDIO.pulse ? 0.16 : 0.0;
  RIGU.uGlow.value = CARDIO.glow || 0;
  if (CARDIO.fx && CARDIO.fx.group.visible) for (const s of CARDIO.fx.segs) {
    const on = tc >= s.t0 - 0.004 && tc <= s.t1 + 0.03 ? 1 - sstep(s.t1, s.t1 + 0.03, tc) : 0;
    s.mat.emissiveIntensity = 0.45 + 3.2 * on;
  }
  for (const f of Object.values(CARDIO.flows)) if (f.points.visible) {
    f.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    if (dtc > 0 || f.dirty) { f.step(Math.min(dtc, 0.05), tc); f.dirty = false; }
  }
  scenarioTick(st);
}
