// ===================== Landmarks shared by every system =====================
// Height 1.75 m, anatomical position (palms forward), arms slightly abducted.

// vertebral body centres C1..L5 (index 0..23)
const SPINE_PTS = [
  [1.588, -0.022], [1.570, -0.020], [1.551, -0.017], [1.533, -0.016], [1.515, -0.018], [1.497, -0.022], [1.479, -0.028],
  [1.458, -0.036], [1.434, -0.045], [1.409, -0.054], [1.383, -0.061], [1.356, -0.066], [1.328, -0.069], [1.300, -0.070],
  [1.271, -0.069], [1.242, -0.066], [1.212, -0.062], [1.181, -0.056], [1.149, -0.049],
  [1.114, -0.040], [1.077, -0.032], [1.040, -0.027], [1.003, -0.028], [0.967, -0.036],
].map(([y, z]) => [0, y, z]);
const VERT_NAMES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1', 'L2', 'L3', 'L4', 'L5'];

// interpolated spec per vertebra
const _VSPEC_KEYS = [
  // idx, bodyW, bodyD, bodyH, canalW, canalD, spinLen, spinAng(deg, downward), transLen, pedLen
  [2, 0.0085, 0.0075, 0.0052, 0.0115, 0.0075, 0.016, 20, 0.012, 0.0055],
  [6, 0.0098, 0.0082, 0.0062, 0.0110, 0.0075, 0.030, 25, 0.017, 0.0060],
  [7, 0.0110, 0.0092, 0.0072, 0.0090, 0.0070, 0.032, 35, 0.020, 0.0065],
  [12, 0.0132, 0.0125, 0.0092, 0.0075, 0.0072, 0.036, 58, 0.020, 0.0075],
  [18, 0.0170, 0.0145, 0.0112, 0.0085, 0.0080, 0.030, 25, 0.012, 0.0085],
  [21, 0.0220, 0.0165, 0.0128, 0.0105, 0.0085, 0.030, 5, 0.028, 0.0090],
  [23, 0.0240, 0.0165, 0.0122, 0.0110, 0.0085, 0.026, 10, 0.026, 0.0090],
];
function vertSpec(i) {
  const K = _VSPEC_KEYS;
  let a = K[0], b = K[K.length - 1];
  for (let k = 0; k < K.length - 1; k++) if (i >= K[k][0] && i <= K[k + 1][0]) { a = K[k]; b = K[k + 1]; break; }
  const t = b[0] === a[0] ? 0 : clamp((i - a[0]) / (b[0] - a[0]), 0, 1);
  const v = a.map((x, j) => lerp(x, b[j], t));
  return { bodyW: v[1], bodyD: v[2], bodyH: v[3], canalW: v[4], canalD: v[5], spinLen: v[6], spinAng: v[7] * Math.PI / 180, transLen: v[8], pedLen: v[9] };
}
const _spineCurve = new THREE.CatmullRomCurve3(SPINE_PTS.map(vec), false, 'centripetal');
// local frame of vertebra i: X lateral(left), Y up the spine, Z anterior
function vertFrame(i) {
  const t = i / (SPINE_PTS.length - 1);
  const Y = _spineCurve.getTangent(t).negate(); // points listed top->bottom
  const Yv = norm3([Y.x, Y.y, Y.z]);
  let Z = sub3([0, 0, 1], mul3(Yv, Yv[2])); Z = norm3(Z);
  const X = cross3(Yv, Z);
  return { o: SPINE_PTS[i], X, Y: Yv, Z };
}
// world point from vertebra-local coords
function vLocal(i, x, y, z) {
  const F = vertFrame(i);
  return [F.o[0] + F.X[0] * x + F.Y[0] * y + F.Z[0] * z, F.o[1] + F.X[1] * x + F.Y[1] * y + F.Z[1] * z, F.o[2] + F.X[2] * x + F.Y[2] * y + F.Z[2] * z];
}
// spinal canal centre at vertebra i
function canalPoint(i) { const s = vertSpec(i); return vLocal(i, 0, 0, -(s.bodyD + s.canalD + 0.0005)); }

const LM = {
  // head
  vertex: [0, 1.745, -0.01],
  skullC: [0, 1.662, -0.008],
  orbit: [0.033, 1.636, 0.062],
  eye: [0.0335, 1.6355, 0.0705],
  nasion: [0, 1.648, 0.088],
  chin: [0, 1.527, 0.076],
  gonion: [0.047, 1.556, -0.008],
  condyle: [0.05, 1.613, -0.012],
  mastoid: [0.052, 1.598, -0.03],
  ear: [0.074, 1.62, -0.012],
  zygoma: [0.052, 1.616, 0.052],
  hyoid: [0, 1.528, 0.03],
  larynx: [0, 1.498, 0.042],
  // shoulder girdle & arm
  sc: [0.022, 1.428, 0.062],
  ac: [0.165, 1.452, -0.008],
  acromion: [0.178, 1.449, -0.02],
  glenoid: [0.156, 1.405, -0.03],
  humHead: [0.183, 1.408, -0.028],
  coracoid: [0.138, 1.408, 0.03],
  greaterTub: [0.204, 1.413, -0.012],
  deltTub: [0.214, 1.27, -0.016],
  elbow: [0.235, 1.100, -0.02],
  medEpi: [0.204, 1.112, -0.026],
  latEpi: [0.264, 1.114, -0.02],
  olecranon: [0.227, 1.112, -0.04],
  radTub: [0.247, 1.056, -0.008],
  wrist: [0.293, 0.852, 0.002],
  radStyloid: [0.317, 0.852, 0.0],
  ulnStyloid: [0.268, 0.848, -0.016],
  // trunk
  jugular: [0, 1.425, 0.064],
  sternalAngle: [0, 1.378, 0.083],
  xiphoid: [0, 1.236, 0.1],
  xiphTip: [0, 1.205, 0.096],
  // pelvis & leg
  asis: [0.118, 0.965, 0.058],
  psis: [0.044, 0.97, -0.08],
  iliacTop: [0.135, 1.02, -0.012],
  pubic: [0.0, 0.884, 0.066],
  pubicTub: [0.022, 0.888, 0.066],
  ischTub: [0.057, 0.832, -0.028],
  hip: [0.085, 0.905, 0.025],
  trochanter: [0.142, 0.895, 0.0],
  lesserTroch: [0.11, 0.846, -0.012],
  knee: [0.09, 0.49, 0.0],
  medCondyle: [0.068, 0.503, -0.006],
  latCondyle: [0.112, 0.503, -0.006],
  patella: [0.09, 0.522, 0.048],
  tibTub: [0.09, 0.425, 0.027],
  fibHead: [0.124, 0.448, -0.018],
  ankle: [0.088, 0.072, -0.004],
  medMall: [0.066, 0.064, 0.002],
  latMall: [0.117, 0.058, -0.013],
  sacrumTop: [0, 0.945, -0.052],
  coccyx: [0, 0.83, -0.088],
};

// ---- hand frame (left). D distal, Lt lateral (thumb side), P palmar/anterior ----
const HAND = (() => {
  const D = norm3([0.15, -0.985, 0.06]);
  let Lt = sub3([1, 0, 0], mul3(D, D[0])); Lt = norm3(Lt);
  const P = cross3(D, Lt);
  const O = [0.293, 0.848, 0.003];
  const at = (d, l, p) => [O[0] + D[0] * d + Lt[0] * l + P[0] * p, O[1] + D[1] * d + Lt[1] * l + P[1] * p, O[2] + D[2] * d + Lt[2] * l + P[2] * p];
  // rotate a local direction (d,l,p)
  const dirLocal = (d, l, p) => norm3([D[0] * d + Lt[0] * l + P[0] * p, D[1] * d + Lt[1] * l + P[1] * p, D[2] * d + Lt[2] * l + P[2] * p]);
  // fingers II..V: base of metacarpal, MCP, PIP, DIP, tip (world coords) and radii
  const spec = [
    // name, baseL, baseD, mcL, mcLen, prox, mid, dist, spreadDeg, palmArch
    ['II', 0.017, 0.030, 0.025, 0.066, 0.040, 0.024, 0.018, 7, -0.002],
    ['III', 0.004, 0.031, 0.007, 0.064, 0.045, 0.028, 0.019, 0, 0.0],
    ['IV', -0.008, 0.030, -0.011, 0.058, 0.042, 0.026, 0.018, -6, -0.002],
    ['V', -0.018, 0.028, -0.027, 0.052, 0.033, 0.020, 0.016, -13, -0.006],
  ];
  const fingers = spec.map(([nm, bl, bd, ml, mcLen, pr, mi, di, spr, arch]) => {
    const base = at(bd, bl, 0.0);
    const mcp = at(bd + mcLen, ml, arch);
    let a = spr * Math.PI / 180, flex = 0.12;
    const pts = [mcp]; let cur = mcp; let ang = 0;
    for (const len of [pr, mi, di]) {
      ang += flex;
      const dd = Math.cos(a) * Math.cos(ang), ll = Math.sin(a) * Math.cos(ang), pp = Math.sin(ang);
      const dir = dirLocal(dd, ll, pp);
      cur = add3(cur, mul3(dir, len)); pts.push(cur);
      flex = 0.16;
    }
    return { name: nm, base, mcp, pip: pts[1], dip: pts[2], tip: pts[3], lens: [pr, mi, di] };
  });
  // thumb: CMC on trapezium, MCP, IP, tip
  const tCmc = at(0.022, 0.026, 0.009);
  const tMcp = add3(tCmc, mul3(dirLocal(0.72, 0.55, 0.42), 0.045));
  const tIp = add3(tMcp, mul3(dirLocal(0.82, 0.32, 0.47), 0.032));
  const tTip = add3(tIp, mul3(dirLocal(0.82, 0.22, 0.53), 0.025));
  const thumb = { name: 'I', base: tCmc, mcp: tMcp, ip: tIp, tip: tTip };
  return { D, Lt, P, O, at, dirLocal, fingers, thumb };
})();

// ---- foot frame (left). F forward, Lf lateral, Uf up; origin at ankle joint ----
const FOOT = (() => {
  const a = 0.08; const F = norm3([Math.sin(a), 0, Math.cos(a)]);
  const Lf = norm3([Math.cos(a), 0, -Math.sin(a)]);
  const Uf = [0, 1, 0];
  const O = [0.087, 0.07, -0.006];
  const at = (f, l, u) => [O[0] + F[0] * f + Lf[0] * l + Uf[0] * u, O[1] + F[1] * f + Lf[1] * l + Uf[1] * u, O[2] + F[2] * f + Lf[2] * l + Uf[2] * u];
  const meta = [
    // name, base(f,l,u), head(f,l,u), shaftR, headR, phalanx lengths
    ['I', [0.078, -0.019, -0.034], [0.140, -0.024, -0.055], 0.0075, 0.0105, [0.029, 0.024]],
    ['II', [0.080, -0.005, -0.031], [0.150, -0.006, -0.058], 0.0045, 0.0065, [0.025, 0.013, 0.010]],
    ['III', [0.079, 0.007, -0.034], [0.146, 0.008, -0.059], 0.0043, 0.0062, [0.023, 0.012, 0.009]],
    ['IV', [0.077, 0.017, -0.039], [0.138, 0.020, -0.060], 0.0042, 0.0060, [0.021, 0.011, 0.009]],
    ['V', [0.068, 0.027, -0.046], [0.127, 0.032, -0.061], 0.0042, 0.0058, [0.017, 0.009, 0.008]],
  ];
  const toes = meta.map(([nm, b, h, sr, hr, lens]) => {
    const base = at(...b), head = at(...h);
    const joints = [head]; let cur = h.slice();
    const spread = nm === 'I' ? -0.04 : nm === 'V' ? 0.12 : (nm === 'IV' ? 0.07 : nm === 'III' ? 0.03 : 0);
    lens.forEach((len, k) => {
      const lift = k === 0 ? 0.12 : -0.35;
      cur = [cur[0] + len * Math.cos(lift), cur[1] + len * Math.sin(spread), cur[2] + len * Math.sin(lift)];
      joints.push(at(...cur));
    });
    return { name: nm, base, head, sr, hr, lens, joints };
  });
  return { F, Lf, Uf, O, at, toes };
})();
