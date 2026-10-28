// ===================== Organs =====================
const solid = (hex, vary = 0.08, fr = 120) => { const c = lin(hex); return (x, y, z) => { const n = 1 + vary * noise3(x * fr + 3.1, y * fr, z * fr); return [c[0] * n, c[1] * n, c[2] * n]; }; };
const wet = (s, amp = 0.0004, fr = 260) => Disp(s, (x, y, z) => amp * noise3(x * fr, y * fr + 7.7, z * fr), amp);
const organMesh = (shape, h, color, extra = {}) => meshSDF(shape, h, { ao: 0.012, aoMin: 0.55, color, ...extra });

// ---------- brain ----------
function gyriField(x, y, z) {
  const f = 78;
  const n = noise3(x * f + 11.3, y * f, z * f) * 0.85 + noise3(x * f * 2.1, y * f * 2.1 + 5.2, z * f * 2.1) * 0.28;
  return Math.abs(n);
}
function hemisphereSDF() {
  // left hemisphere (x > 0); fits inside the cranial cavity with ~3 mm margin
  const cav = Round(SKULL_CAVITY, -0.0035);
  let h = U(0.014,
    E([0.031, 1.676, -0.006], [0.031, 0.06, 0.08]),
    E([0.03, 1.66, 0.04], [0.03, 0.045, 0.04]),
    E([0.045, 1.632, 0.004], [0.022, 0.022, 0.042]),     // temporal lobe
    E([0.032, 1.652, -0.06], [0.03, 0.04, 0.032]),        // occipital lobe
  );
  h = I(0.006, h, cav, SD.plane([0.0018, 0, 0], [-1, 0, 0]));
  // keep the cerebellum space free, lateral sulcus notch
  h = Sub(h, 0.008, E([0.024, 1.606, -0.058], [0.036, 0.026, 0.034]), C([0.07, 1.648, 0.03], [0.035, 1.645, -0.01], 0.003));
  return Disp(h, (x, y, z) => 0.0024 * (1 - smoothstep(0.0, 0.15, gyriField(x, y, z))), 0.0025);
}
function brainColor(x, y, z) {
  const r = gyriField(x, y, z); const k = smoothstep(0.0, 0.2, r);
  const base = mixc(lin(0x9c6b66), lin(0xe2bdb3), k);
  return mixc(base, lin(0xc98f88), 0.25 * smoothstep(0.3, 0.8, noise3(x * 40, y * 40, z * 40) + 0.5));
}
function cerebellumSDF() {
  const c = U(0.012, E([0.023, 1.608, -0.058], [0.029, 0.021, 0.028]), E([-0.023, 1.608, -0.058], [0.029, 0.021, 0.028]), E([0, 1.605, -0.05], [0.012, 0.016, 0.02]));
  const k = TAU / 0.0042;
  return Disp(c, (x, y, z) => 0.001 * (1 - smoothstep(0, 0.4, Math.abs(Math.sin(k * (y * 0.85 - z * 0.5) + 2 * noise3(x * 60, y * 60, z * 60))))), 0.001);
}
function brainstemSDF() {
  return U(0.006, C([0, 1.655, -0.012], [0, 1.628, -0.02], 0.011, 0.012), E([0, 1.624, -0.014], [0.0135, 0.011, 0.0115]),
    C([0, 1.618, -0.02], [0, 1.588, -0.028], 0.0095, 0.0075), C([0.008, 1.66, -0.005], [0.016, 1.672, 0.0], 0.006, 0.006), C([-0.008, 1.66, -0.005], [-0.016, 1.672, 0.0], 0.006, 0.006));
}

// ---------- eye ----------
function eyeColor(c) {
  const fwd = norm3([0.08, 0.0, 1]);
  return (x, y, z) => {
    const d = norm3(sub3([x, y, z], c)); const ct = dot3(d, fwd);
    if (ct > 0.987) return lin(0x0b0a0a);
    if (ct > 0.915) {
      const a = Math.atan2(d[1], d[0]); const t = (ct - 0.915) / 0.072;
      const stri = 0.75 + 0.25 * Math.sin(a * 46 + 3 * noise3(x * 900, y * 900, 0));
      return mixc(lin(0x3f6f82), lin(0x7a5a2c), t * 0.8).map(v => v * stri);
    }
    const vein = smoothstep(0.92, 0.6, ct) * 0.15 * Math.max(0, noise3(x * 500, y * 500, z * 500));
    return [0.93 - vein * 0.1, 0.9 - vein, 0.88 - vein];
  };
}

// ---------- heart ----------
const HEART = { B: [0.0, 1.302, 0.02], A: [0.071, 1.222, 0.069], C: [0.02, 1.27, 0.038] };
function ventriclesSDF() {
  const { B, A } = HEART; const ax = norm3(sub3(A, B));
  return wet(U(0.016,
    SD.ellAlong(mix3(B, A, 0.44), ax, 0.06, 0.045, 0.04, [0, 0, 1]),
    C(mix3(B, A, 0.15), A, 0.04, 0.011),
    E(add3(mix3(B, A, 0.38), [-0.013, 0.0, 0.019]), [0.034, 0.03, 0.024]),   // right ventricle
    E(add3(B, [-0.004, 0.004, 0.034]), [0.014, 0.012, 0.012]),               // conus arteriosus
  ), 0.0004, 200);
}
function atriaSDF() {
  return wet(U(0.01,
    E([-0.03, 1.292, 0.018], [0.025, 0.027, 0.024]),
    E([0.012, 1.309, -0.012], [0.03, 0.02, 0.021]),
    SD.ellAlong([-0.023, 1.318, 0.043], [0.3, 0.2, 1], 0.014, 0.008, 0.012),
    SD.ellAlong([0.037, 1.318, 0.035], [-0.2, 0.1, 1], 0.013, 0.007, 0.011),
  ), 0.0004, 200);
}
function heartColor(x, y, z) {
  const base = lin(0x8e2722);
  // epicardial fat along the coronary (AV) groove
  const { B, A } = HEART; const ax = norm3(sub3(A, B));
  const s = dot3(sub3([x, y, z], B), ax);
  const fat = Math.exp(-(((s - 0.004) / 0.008) ** 2)) * 0.8 + 0.25 * Math.max(0, noise3(x * 90, y * 90, z * 90));
  return mixc(base, lin(0xd9b25c), clamp(fat, 0, 0.85));
}

// ---------- lungs ----------
const DOME_R = E([-0.025, 1.105, -0.005], [0.116, 0.13, 0.1]);
const DOME_L = E([0.03, 1.09, -0.005], [0.116, 0.13, 0.1]);
const MEDIASTINUM = U(0.02, E(HEART.C, [0.06, 0.058, 0.058]), C([0.0, 1.47, 0.0], [0.0, 1.32, 0.0], 0.016), C([0, 1.47, -0.045], [0, 1.15, -0.06], 0.026),
  C([0.02, 1.37, -0.02], [0.022, 1.2, -0.045], 0.016));
function lungSDF(side) {
  const sx = side;
  let l = U(0.035,
    E([0.073 * sx, 1.29, -0.012], [0.055, 0.135, 0.08]),
    E([0.078 * sx, 1.2, -0.022], [0.06, 0.06, 0.084]),
    C([0.05 * sx, 1.46, -0.012], [0.07 * sx, 1.36, -0.01], 0.022, 0.045),
  );
  l = Sub(l, 0.012, MEDIASTINUM, sx > 0 ? DOME_L : DOME_R);
  // fissures between lobes
  const nO = norm3([0.0, 0.64, 0.77]); const oO = [0, 1.29, -0.015];
  const oblique = { f: (x, y, z) => Math.abs((x - oO[0]) * nO[0] + (y - oO[1]) * nO[1] + (z - oO[2]) * nO[2]) - 0.0009, b: [-BIG, -BIG, -BIG, BIG, BIG, BIG] };
  const cuts = [oblique];
  if (sx < 0) {
    const horiz = { f: (x, y, z) => Math.max(Math.abs(y - 1.322) - 0.0009, -((x - oO[0]) * nO[0] + (y - oO[1]) * nO[1] + (z - oO[2]) * nO[2])), b: [-BIG, -BIG, -BIG, BIG, BIG, BIG] };
    cuts.push(horiz);
  }
  l = Sub(l, 0.0015, cuts);
  return Disp(l, (x, y, z) => 0.0005 * noise3(x * 300, y * 300, z * 300), 0.0005);
}
function lungColor(x, y, z) {
  const n = noise3(x * 120, y * 120, z * 120) + 0.5 * noise3(x * 400, y * 400, z * 400);
  const spots = smoothstep(0.35, 0.7, n) * 0.35;
  return mixc(lin(0xe8a7a3), lin(0x7d5a63), spots);
}
// bronchial tree grown inside a lung SDF
function bronchialTree(side, lung) {
  const rnd = mulberry32(side > 0 ? 91 : 37);
  const branches = [];
  const carina = [0, 1.336, 0.004];
  const main = side > 0 ? [[0.02, 1.33, 0.0], [0.045, 1.314, -0.008]] : [[-0.018, 1.328, 0.0], [-0.033, 1.31, -0.004]];
  branches.push({ pts: [carina, ...main], r0: 0.0068, r1: 0.0058 });
  const grow = (p, dir, len, r, gen) => {
    if (gen > 6 || r < 0.0011) return;
    for (const sgn of [1, -1]) {
      const rnd3 = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
      let perp = norm3(cross3(dir, norm3(rnd3)));
      const ang = (0.42 + rnd() * 0.25) * sgn;
      let nd = norm3(add3(mul3(dir, Math.cos(ang)), mul3(perp, Math.sin(ang))));
      // steer toward the lung interior
      const probe = add3(p, mul3(nd, len));
      const g = sdfGrad(lung.f, probe[0], probe[1], probe[2], 0.003);
      const dl = lung.f(probe[0], probe[1], probe[2]);
      if (dl > -0.008) nd = norm3(sub3(nd, mul3(g, 0.9)));
      nd = norm3(add3(nd, [0, -0.08, 0]));
      const L = len * (0.82 + rnd() * 0.2);
      const q = add3(p, mul3(nd, L));
      if (lung.f(q[0], q[1], q[2]) > -0.002) continue;
      const mid = add3(mix3(p, q, 0.5), mul3(perp, 0.002 * (rnd() - 0.5)));
      branches.push({ pts: [p, mid, q], r0: r, r1: r * 0.82 });
      grow(q, nd, L * 0.8, r * 0.74, gen + 1);
    }
  };
  const start = main[1]; const d0 = norm3([0.35 * side, -0.9, -0.15]);
  // lobar bronchi
  const lobes = side > 0 ? [[0.3, 0.75, 0.1], [0.4, -0.8, -0.15], [0.5, -0.6, 0.45]] : [[-0.4, 0.7, 0.05], [-0.4, -0.2, 0.7], [-0.35, -0.85, -0.2]];
  for (const lb of lobes) {
    const dir = norm3(lb); const q = add3(start, mul3(dir, 0.022));
    branches.push({ pts: [start, mix3(start, q, 0.5), q], r0: 0.0052, r1: 0.0044 });
    grow(q, dir, 0.026, 0.0038, 1);
  }
  void d0;
  const geos = branches.map(b => sweep(b.pts, { r: (t) => lerp(b.r0, b.r1, t), radial: 8, step: 0.004, color: () => lin(0xe9d6c4), caps: true }));
  return mergeGeos(geos);
}

// ---------- digestive ----------
function smallIntestinePath() {
  const rnd = mulberry32(2024);
  const C0 = [0.004, 0.982, 0.03], R = [0.078, 0.068, 0.046];
  const start = [0.042, 1.052, 0.018], end = [-0.074, 0.955, 0.022];
  const pts = [start]; let p = start.slice(); let dir = norm3([-0.2, -0.6, 0.6]);
  const step = 0.0075, N = 300; const grid = new Map();
  const keyOf = (q) => `${Math.floor(q[0] / 0.02)},${Math.floor(q[1] / 0.02)},${Math.floor(q[2] / 0.02)}`;
  const addP = (q, i) => { const k = keyOf(q); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); };
  addP(p, 0);
  for (let i = 1; i < N; i++) {
    const t = i / N;
    let steer = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const rel = [(p[0] - C0[0]) / R[0], (p[1] - C0[1]) / R[1], (p[2] - C0[2]) / R[2]];
    const e = len3(rel);
    if (e > 0.8) steer = add3(steer, mul3(norm3(rel), -1.6 * (e - 0.8) * 4));
    // repel from earlier loops
    const [kx, ky, kz] = keyOf(p).split(',').map(Number);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const lst = grid.get(`${kx + a},${ky + b},${kz + c}`); if (!lst) continue;
      for (const j of lst) {
        if (i - j < 8) continue;
        const d = sub3(p, pts[j]); const L = len3(d);
        if (L < 0.026 && L > 1e-6) steer = add3(steer, mul3(d, (0.026 - L) / L * 60));
      }
    }
    if (t > 0.8) steer = add3(steer, mul3(norm3(sub3(end, p)), (t - 0.8) * 14));
    dir = norm3(add3(mul3(dir, 2.2), mul3(norm3(steer), 0.9)));
    p = add3(p, mul3(dir, step));
    pts.push(p); addP(p, i);
  }
  pts.push(end);
  return pts.filter((q, i) => i % 2 === 0 || i === pts.length - 1);
}
const COLON = [[-0.079, 0.948, 0.026], [-0.093, 0.985, 0.014], [-0.1, 1.04, 0.004], [-0.099, 1.088, 0.008], [-0.088, 1.108, 0.028],
  [-0.058, 1.082, 0.07], [-0.02, 1.058, 0.084], [0.025, 1.062, 0.082], [0.065, 1.09, 0.06], [0.098, 1.128, 0.012],
  [0.112, 1.1, -0.016], [0.11, 1.03, -0.014], [0.104, 0.975, -0.006], [0.088, 0.94, 0.012], [0.058, 0.928, 0.034],
  [0.026, 0.934, 0.022], [0.012, 0.918, -0.018], [0.002, 0.898, -0.05], [0.0, 0.864, -0.062], [0.0, 0.84, -0.06], [0.0, 0.822, -0.05]];
function colonRadius(t) {
  const k = [[0, 0.028], [0.06, 0.024], [0.2, 0.021], [0.45, 0.02], [0.58, 0.018], [0.7, 0.016], [0.8, 0.014], [0.86, 0.016], [0.92, 0.018], [0.97, 0.011], [1, 0.007]];
  for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1][0]) return lerp(k[i][1], k[i + 1][1], (t - k[i][0]) / (k[i + 1][0] - k[i][0]));
  return 0.007;
}

// ---------- kidneys ----------
function kidneySDF(side, y) {
  const c = [0.06 * side, y, -0.055];
  const axis = norm3([-0.25 * side, 1, -0.15]);
  const medial = norm3(sub3([-side, 0, 0.35], mul3(axis, dot3([-side, 0, 0.35], axis))));
  const k = SD.ell(c, [0.03, 0.019, 0.054], [medial, cross3(axis, medial), axis]);
  return wet(Sub(k, 0.008, S(add3(c, mul3(medial, 0.034)), 0.0135)), 0.0003, 300);
}

// ---------- build ----------
function buildOrgans(T) {
  const nerv = { layer: 'nervous', group: 'Merkezi sinir sistemi' };
  T('Beyin yarımküreleri', () => {
    addPair(organMesh(hemisphereSDF(), 0.00125, brainColor, { lip: 2.6, ao: 0.004, aoMin: 0.45 }), 'brain', { ...nerv, id: 'brain', tr: 'Beyin yarımküresi', la: 'hemispherium cerebri', desc: 'Beynin en büyük bölümü. Kıvrımlar (gyrus) ve oluklar (sulcus) yüzey alanını artırır; düşünme, öğrenme, bellek, istemli hareketler ve duyuların yorumlanması kabuk (korteks) bölümünde gerçekleşir. Sol yarımküre vücudun sağ tarafını yönetir.' });
  });
  T('Beyincik ve beyin sapı', () => {
    addPart(organMesh(cerebellumSDF(), 0.001, (x, y, z) => mixc(lin(0x8f5f5a), lin(0xdcb3aa), smoothstep(-0.6, 0.6, Math.sin(TAU / 0.0042 * (y * 0.85 - z * 0.5)))), { lip: 3.5, ao: 0.003, aoMin: 0.5 }), 'brain', { ...nerv, id: 'cerebellum', tr: 'Beyincik', la: 'cerebellum', desc: 'Denge, kas tonusu ve hareketlerin koordinasyonundan sorumludur. Yaprakçık (folia) adı verilen ince paralel kıvrımları vardır; beyindeki nöronların yarısından fazlası buradadır.' });
    addPart(organMesh(brainstemSDF(), 0.0009, solid(0xd8b0a2, 0.05)), 'brain', { ...nerv, id: 'brainstem', tr: 'Beyin sapı', la: 'truncus encephali', desc: 'Orta beyin, pons ve soğancık (medulla oblongata) bölümlerinden oluşur. Solunum, kalp atımı ve kan basıncı gibi yaşamsal refleks merkezleri soğancıktadır.' });
    addPart(organMesh(S([0, 1.634, 0.004], 0.0048), 0.0006, solid(0xc98a4a, 0.05)), 'endocrine', { layer: 'endocrine', group: 'Endokrin', id: 'pituitary', tr: 'Hipofiz bezi', la: 'hypophysis', desc: '"Ana bez" olarak bilinir; büyüme hormonu, TSH, ACTH, FSH, LH, prolaktin, ADH ve oksitosin salgılanmasıyla diğer bezleri yönetir.' });
  });
  T('Gözler', () => {
    const c = LM.eye;
    addPair(meshSDF(U(0.002, S(c, 0.0118), S(add3(c, [0.0008, 0, 0.0082]), 0.0062)), 0.0006, { color: eyeColor(c), ao: 0, aoMin: 1 }), 'eye', { layer: 'nervous', group: 'Duyu organları', id: 'eye', tr: 'Göz küresi', la: 'bulbus oculi', desc: 'Sert tabaka (sklera), damar tabaka ve ağ tabakadan (retina) oluşur. Kornea ve mercek ışığı kırarak retinaya odaklar; iris göz bebeği çapını ayarlar.' });
  });
  // ---- heart ----
  T('Kalp', () => {
    const hm = { layer: 'heart', group: 'Kalp' };
    addPart(organMesh(ventriclesSDF(), 0.0013, heartColor, { ao: 0.008 }), 'heart', { ...hm, id: 'heart_v', tr: 'Kalp karıncıkları', la: 'ventriculi cordis', anim: 'heartV', pivot: HEART.C, desc: 'Kalbin kasılarak kanı pompalayan odacıkları. Sol karıncık oksijenli kanı aort ile tüm vücuda (büyük dolaşım), sağ karıncık kirli kanı akciğer atardamarı ile akciğerlere (küçük dolaşım) gönderir. Sol karıncık duvarı en kalın olandır.' });
    addPart(organMesh(atriaSDF(), 0.0013, solid(0x9a3a32, 0.08), { ao: 0.008 }), 'heart', { ...hm, id: 'heart_a', tr: 'Kalp kulakçıkları', la: 'atria cordis', anim: 'heartA', pivot: [-0.005, 1.302, 0.012], desc: 'Kanı toplayan ince duvarlı odacıklar. Sağ kulakçığa üst ve alt ana toplardamarlar, sol kulakçığa akciğer toplardamarları açılır. Kalp pili (SA düğümü) sağ kulakçık duvarındadır.' });
  });
  // ---- respiratory ----
  const resp = { layer: 'respiratory', group: 'Solunum' };
  T('Akciğerler', () => {
    addPart(organMesh(lungSDF(-1), 0.0027, lungColor, { ao: 0.01, aoMin: 0.6 }), 'lung', { ...resp, id: 'lung_R', tr: 'Sağ akciğer', la: 'pulmo dexter', anim: 'lungs', pivot: [-0.04, 1.32, -0.01], desc: 'Üç loblu (üst, orta, alt) akciğer. Gaz değişimi yaklaşık 300 milyon alveolde difüzyonla gerçekleşir; toplam alveol yüzeyi ~70 m²\'dir.' });
    addPart(organMesh(lungSDF(1), 0.0027, lungColor, { ao: 0.01, aoMin: 0.6 }), 'lung', { ...resp, id: 'lung_L', tr: 'Sol akciğer', la: 'pulmo sinister', anim: 'lungs', pivot: [0.045, 1.32, -0.01], desc: 'İki loblu akciğer; kalbe yer açan kalp çentiği (incisura cardiaca) nedeniyle sağ akciğerden biraz küçüktür.' });
  });
  T('Bronş ağacı', () => {
    addPart(bronchialTree(-1, lungSDF(-1)), 'airway', { ...resp, id: 'bronchi_R', tr: 'Sağ bronş ağacı', la: 'arbor bronchialis dextra', desc: 'Ana bronş lob, segment bronşlarına ve sonunda bronşiyollere dallanır. Sağ ana bronş daha kısa, geniş ve dikey olduğundan yabancı cisimler çoğunlukla sağa kaçar.' });
    addPart(bronchialTree(1, lungSDF(1)), 'airway', { ...resp, id: 'bronchi_L', tr: 'Sol bronş ağacı', la: 'arbor bronchialis sinistra', desc: 'Sol ana bronş aort kemerinin altından geçer, sağdakinden daha uzun ve yataydır.' });
  });
  T('Soluk borusu ve gırtlak', () => {
    const tr = [[0, 1.488, 0.038], [0, 1.45, 0.031], [0, 1.4, 0.021], [0, 1.36, 0.011], [0, 1.336, 0.004]];
    addPart(sweep(tr, { r: 0.0088, radial: 18, step: 0.0015, rMod: (t, th) => (1 + 0.07 * Math.pow(Math.abs(Math.sin(t * 0.16 / 0.0042 * Math.PI)), 3)) * (Math.sin(th) < -0.6 ? 0.93 : 1), color: (t) => lin(0xe6d3c2) }), 'airway', { ...resp, id: 'trachea', tr: 'Soluk borusu', la: 'trachea', desc: 'Arkası açık C şeklindeki 16-20 hiyalin kıkırdak halkası sayesinde hep açık kalır. İç yüzeyi silli epitelle kaplıdır; mukusu ve tozu yukarı taşır.' });
    const thy = I(0.002, Shell(E([0, 1.502, 0.034], [0.019, 0.017, 0.014]), 0.0014), SD.plane([0, 0, 0.03], [0, 0, -1]));
    const lar = U(0.003, thy, Shell(Place(ellCyl(0.0105, 0.0105, 0.004), [0, 1.485, 0.034], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]), 0.0012),
      SD.ellAlong([0, 1.517, 0.028], [0, 1, -0.6], 0.012, 0.009, 0.0016, [1, 0, 0]));
    addPart(organMesh(lar, 0.0008, solid(0xd9cfc0, 0.05), { ao: 0.003 }), 'airway', { ...resp, id: 'larynx', tr: 'Gırtlak', la: 'larynx', desc: 'Ses tellerini barındıran kıkırdak yapı. Tiroid kıkırdağı (Âdem elması), krikoid kıkırdak ve yutkunurken soluk yolunu kapatan gırtlak kapağından (epiglottis) oluşur.' });
  });
  T('Diyafram', () => {
    const domes = U(0.035, DOME_R, DOME_L);
    let d = I(0.004, Shell(domes, 0.002), SD.plane([0, 1.145, 0.0], [0, -1, 0.62]));
    d = Sub(d, 0.002, C([0.022, 1.25, -0.03], [0.03, 1.1, -0.01], 0.008), C([-0.022, 1.25, 0.005], [-0.02, 1.1, -0.005], 0.0105), C([0.012, 1.25, -0.05], [0.01, 1.1, -0.04], 0.011));
    const col = (x, y, z) => mixc(lin(0x9c3a2e), lin(0xe0d6c8), smoothstep(1.205, 1.225, y) * smoothstep(0.06, 0.02, Math.abs(x - 0.005)));
    addPart(organMesh(d, 0.0022, col, { ao: 0.006 }), 'diaphragm', { ...resp, id: 'diaphragm', tr: 'Diyafram', la: 'diaphragma', anim: 'diaphragm', desc: 'Göğüs ve karın boşluğunu ayıran kubbe şeklindeki kas. Kasılınca düzleşir, göğüs hacmi artar ve hava akciğerlere dolar (soluk alma). Ortasında beyaz bir kiriş merkez (centrum tendineum) bulunur.' });
  });
  // ---- digestive ----
  const dig = { layer: 'digestive', group: 'Sindirim' };
  T('Yemek borusu ve mide', () => {
    const es = [[0, 1.512, 0.006], [0, 1.47, 0.004], [0.002, 1.42, -0.002], [0.006, 1.37, -0.012], [0.01, 1.32, -0.026], [0.016, 1.26, -0.03], [0.025, 1.205, -0.016], [0.038, 1.172, -0.002]];
    addPart(sweep(es, { rx: () => 0.0085, ry: () => 0.0062, radial: 12, step: 0.004, color: () => lin(0xc98a7a) }), 'digest', { ...dig, id: 'esophagus', tr: 'Yemek borusu', la: 'oesophagus', desc: 'Yutağı mideye bağlayan ~25 cm\'lik kas borusu. Peristaltik dalgalarla besinleri mideye iter; diyaframdaki özofagus aralığından geçer.' });
    addPart(sweep([[0, 1.6, -0.005], [0, 1.57, 0.002], [0, 1.535, 0.006], [0, 1.512, 0.006]], { rx: () => 0.0135, ry: () => 0.0095, radial: 14, step: 0.003, color: () => lin(0xc4847a) }), 'digest', { ...dig, id: 'pharynx', tr: 'Yutak', la: 'pharynx', desc: 'Hem solunum hem sindirim yolunun ortak bölümü. Yutma refleksi sırasında gırtlak kapağı soluk yolunu kapatır.' });
    const st = [[0.072, 1.18, -0.005], [0.077, 1.142, 0.016], [0.064, 1.102, 0.04], [0.035, 1.086, 0.058], [0.003, 1.093, 0.06], [-0.018, 1.104, 0.05]];
    const stomach = wet(U(0.02, SD.tube(st, [0.041, 0.039, 0.034, 0.026, 0.018, 0.012], 0.012), E([0.06, 1.16, 0.012], [0.035, 0.035, 0.03])), 0.0004, 150);
    addPart(organMesh(stomach, 0.0016, (x, y, z) => mixc(lin(0xe0a08a), lin(0xb86a5e), smoothstep(-0.3, 0.6, noise3(x * 70, y * 70, z * 70)))), 'digest', { ...dig, id: 'stomach', tr: 'Mide', la: 'gaster', desc: 'J şeklindeki kese; kardiya, fundus, gövde ve pilor bölümlerinden oluşur. Mide bezleri HCl ve pepsinojen salgılar; protein sindirimi burada başlar. Pilor kapakçığı besin geçişini onikiparmak bağırsağına düzenler.' });
  });
  T('Karaciğer ve safra kesesi', () => {
    let liv = U(0.03, E([-0.058, 1.168, 0.002], [0.084, 0.058, 0.084]), E([0.018, 1.188, 0.036], [0.06, 0.028, 0.05]), E([-0.092, 1.14, -0.012], [0.045, 0.06, 0.07]));
    liv = I(0.01, liv, Round(DOME_R, -0.003), SD.plane([-0.04, 1.11, 0.06], [-0.15, -1, -0.25]));
    liv = Sub(liv, 0.006, E([0.0, 1.21, 0.075], [0.004, 0.03, 0.03]), S([0.045, 1.135, 0.01], 0.032));
    addPart(organMesh(wet(liv, 0.0005, 120), 0.002, solid(0x7b2a1d, 0.1, 60)), 'digest', { ...dig, id: 'liver', tr: 'Karaciğer', la: 'hepar', desc: 'Vücudun en büyük iç organı (~1,5 kg). Safra üretir; glikozu glikojen olarak depolar; plazma proteinleri (albümin, fibrinojen) üretir; zararlı maddeleri etkisizleştirir ve amonyağı üreye çevirir.' });
    addPart(organMesh(U(0.008, C([-0.054, 1.112, 0.064], [-0.046, 1.138, 0.044], 0.01, 0.0065), C([-0.046, 1.138, 0.044], [-0.04, 1.15, 0.03], 0.004, 0.0028)), 0.0009, solid(0x5a7048, 0.06)), 'digest', { ...dig, id: 'gallbladder', tr: 'Safra kesesi', la: 'vesica biliaris', desc: 'Karaciğerin ürettiği safrayı depolar ve yoğunlaştırır. Yağlı besin onikiparmak bağırsağına geldiğinde kasılarak safrayı boşaltır; safra yağları emülsifiye eder.' });
  });
  T('Dalak ve pankreas', () => {
    const spl = SD.ell([0.108, 1.152, -0.058], [0.018, 0.044, 0.03], [norm3([0.85, 0.1, -0.5]), norm3([-0.15, 1, -0.1]), norm3([0.5, 0.1, 0.86])]);
    addPart(organMesh(wet(Sub(spl, 0.01, S([0.07, 1.15, -0.03], 0.03)), 0.0004, 150), 0.0013, solid(0x6b2236, 0.08)), 'digest', { layer: 'digestive', group: 'Lenfatik', id: 'spleen', tr: 'Dalak', la: 'splen (lien)', desc: 'En büyük lenfatik organ. Yaşlı alyuvarları parçalar, kan depolar ve bağışıklık hücreleri (lenfositler) üretir. Dolaşım sistemine bağlı çalışır.' });
    const pan = [[-0.034, 1.074, 0.012], [-0.012, 1.083, 0.012], [0.015, 1.09, 0.004], [0.048, 1.098, -0.012], [0.075, 1.11, -0.03], [0.095, 1.12, -0.042]];
    const pancreas = Disp(SD.tube(pan, [0.017, 0.012, 0.011, 0.0105, 0.009, 0.0065], 0.008), (x, y, z) => 0.0012 * Math.abs(noise3(x * 220, y * 220, z * 220)), 0.0012);
    addPart(organMesh(pancreas, 0.0011, solid(0xe8c08a, 0.1, 200), { lip: 1.8 }), 'digest', { ...dig, id: 'pancreas', tr: 'Pankreas', la: 'pancreas', desc: 'Hem ekzokrin hem endokrin bez. Sindirim enzimleri (tripsin, lipaz, amilaz) ve bikarbonat salgılar; Langerhans adacıkları kan şekerini düzenleyen insülin ve glukagon üretir.' });
  });
  T('İnce bağırsak', () => {
    const duo = [[-0.018, 1.104, 0.05], [-0.038, 1.102, 0.036], [-0.054, 1.084, 0.022], [-0.057, 1.05, 0.014], [-0.042, 1.028, 0.014], [-0.005, 1.022, 0.012], [0.026, 1.03, 0.01], [0.04, 1.05, 0.016]];
    addPart(sweep(duo, { r: 0.0125, radial: 14, step: 0.003, color: () => lin(0xdf9f86) }), 'digest', { ...dig, id: 'duodenum', tr: 'Onikiparmak bağırsağı', la: 'duodenum', desc: 'İnce bağırsağın ilk ~25 cm\'lik C şeklindeki bölümü; safra ve pankreas öz suyu buraya açılır.' });
    const path = smallIntestinePath();
    addPart(sweep(path, { r: 0.0108, radial: 12, step: 0.004, color: (t) => mixc(lin(0xeba48e), lin(0xd88b7c), t) }), 'digest', { ...dig, id: 'smallInt', tr: 'İnce bağırsak (jejunum ve ileum)', la: 'jejunum et ileum', desc: 'Yaklaşık 6 m uzunluğundaki sindirim ve emilim merkezi. İç yüzeyindeki villus ve mikrovilluslar emilim yüzeyini ~200 m²\'ye çıkarır. Besinlerin büyük kısmı burada emilir.' });
  });
  T('Kalın bağırsak', () => {
    const L = 0.95;
    addPart(sweep(COLON, {
      r: colonRadius, radial: 18, step: 0.003,
      rMod: (t, th) => {
        if (t > 0.88) return 1;
        const s = t * L / 0.032; const hb = Math.pow(Math.abs(Math.sin(s * Math.PI)), 0.5);
        const m3 = ((th % (TAU / 3)) + TAU / 3) % (TAU / 3); const tae = Math.min(m3, TAU / 3 - m3);
        return (0.86 + 0.16 * hb) * (1 - 0.1 * Math.exp(-((tae / 0.18) ** 2)));
      },
      color: (t) => t > 0.88 ? lin(0xc77c6c) : mixc(lin(0xd6a07e), lin(0xc48a6c), t),
    }), 'digest', { ...dig, id: 'colon_t', tr: 'Kalın bağırsak', la: 'intestinum crassum (colon)', desc: 'Kör bağırsak, çıkan-transvers-inen-sigmoid kolon ve rektumdan oluşur (~1,5 m). Su ve mineralleri emer; bakteriler K ve B vitamini üretir. Cepler (haustra) ve uzunlamasına kas bantları (taenia coli) karakteristiktir.' });
    addPart(sweep([[-0.074, 0.936, 0.02], [-0.07, 0.918, 0.03], [-0.062, 0.905, 0.026], [-0.056, 0.902, 0.016]], { r: (t) => lerp(0.0045, 0.0038, t), radial: 10, step: 0.002, color: () => lin(0xd49a80) }), 'digest', { ...dig, id: 'appendix', tr: 'Apandis', la: 'appendix vermiformis', desc: 'Kör bağırsağa bağlı ~8 cm\'lik solucan biçimli uzantı; lenf dokusu bakımından zengindir. İltihaplanmasına apandisit denir.' });
  });
  T('Tükürük bezleri ve dil', () => {
    addPair(organMesh(SD.ellAlong([0.056, 1.588, 0.0], [0.1, 1, -0.2], 0.019, 0.008, 0.012), 0.0013, solid(0xd7b07c, 0.12, 300)), 'digest', { ...dig, id: 'parotid', tr: 'Kulak altı tükürük bezi', la: 'glandula parotidea', desc: 'En büyük tükürük bezi. Salgıladığı tükürükteki amilaz (pityalin) nişasta sindirimini ağızda başlatır.' });
    addPart(organMesh(U(0.01, E([0, 1.566, 0.036], [0.019, 0.0075, 0.027]), E([0, 1.556, 0.016], [0.018, 0.012, 0.018])), 0.0013, solid(0xc7655f, 0.1, 300)), 'digest', { ...dig, id: 'tongue', tr: 'Dil', la: 'lingua', desc: 'Çizgili kaslardan oluşan, tat tomurcukları taşıyan organ; çiğneme, yutma ve konuşmada görev alır.' });
  });
  // ---- urinary ----
  const uri = { layer: 'urinary', group: 'Boşaltım' };
  T('Böbrekler', () => {
    const kd = 'Kanı süzerek idrar oluşturur. Her böbrekte ~1 milyon nefron bulunur; günde ~180 L süzüntüden ~1,5 L idrar oluşur. Su-tuz dengesini, kan basıncını (renin) ve alyuvar üretimini (eritropoietin) düzenler.';
    addPart(organMesh(kidneySDF(1, 1.075), 0.0014, solid(0x8e3b2c, 0.08)), 'urinary', { ...uri, id: 'kidney_L', tr: 'Sol böbrek', la: 'ren sinister', desc: kd });
    addPart(organMesh(kidneySDF(-1, 1.058), 0.0014, solid(0x8e3b2c, 0.08)), 'urinary', { ...uri, id: 'kidney_R', tr: 'Sağ böbrek', la: 'ren dexter', desc: kd + ' Karaciğer nedeniyle soldakinden biraz aşağıdadır.' });
    for (const sx of [1, -1]) {
      const yk = sx > 0 ? 1.075 : 1.058;
      const u = [[0.036 * sx, yk - 0.01, -0.04], [0.04 * sx, yk - 0.05, -0.03], [0.044 * sx, 0.97, -0.022], [0.05 * sx, 0.925, -0.024], [0.048 * sx, 0.89, -0.012], [0.03 * sx, 0.872, 0.018], [0.016 * sx, 0.868, 0.03]];
      addPart(sweep(u, { r: 0.0026, radial: 8, step: 0.004, color: () => lin(0xd9b08a) }), 'urinary', { ...uri, id: sx > 0 ? 'ureter_L' : 'ureter_R', tr: `Üreter (${sx > 0 ? 'sol' : 'sağ'})`, la: 'ureter', desc: 'Böbrekten idrar kesesine idrar taşıyan ~25 cm\'lik kas borusu; idrarı peristaltik hareketlerle iletir.' });
    }
  });
  T('İdrar kesesi', () => {
    const bl = U(0.008, E([0, 0.876, 0.035], [0.03, 0.026, 0.026]), C([0, 0.858, 0.038], [0, 0.832, 0.042], 0.005, 0.003));
    addPart(organMesh(wet(bl, 0.0003, 200), 0.0012, solid(0xd99a85, 0.06)), 'urinary', { ...uri, id: 'bladder', tr: 'İdrar kesesi', la: 'vesica urinaria', desc: 'İdrarı geçici olarak depolayan kaslı kese (~400-600 mL). Duvarındaki düz kas (detrusor) kasılarak idrarı üretraya boşaltır.' });
  });
  // ---- endocrine ----
  const end = { layer: 'endocrine', group: 'Endokrin' };
  T('Endokrin bezler', () => {
    const thy = U(0.006, SD.ellAlong([0.016, 1.476, 0.03], [0.2, 1, 0.3], 0.02, 0.0085, 0.0085), SD.ellAlong([-0.016, 1.476, 0.03], [-0.2, 1, 0.3], 0.02, 0.0085, 0.0085), E([0, 1.466, 0.039], [0.01, 0.0055, 0.0045]));
    addPart(organMesh(wet(thy, 0.0003, 300), 0.0008, solid(0xa33a46, 0.08)), 'endocrine', { ...end, id: 'thyroid', tr: 'Tiroit bezi', la: 'glandula thyroidea', desc: 'Kelebek şeklindeki bez; metabolizma hızını ayarlayan tiroksin (T4) ve T3 ile kandaki kalsiyumu düşüren kalsitonini salgılar. Hormon üretimi için iyot gerekir.' });
    for (const sx of [1, -1]) {
      const yk = sx > 0 ? 1.075 : 1.058;
      const ad = SD.ellAlong([0.048 * sx, yk + 0.05, -0.05], [-0.4 * sx, 1, -0.1], 0.013, 0.012, 0.0045, [0, 0, 1]);
      addPart(organMesh(wet(ad, 0.0004, 300), 0.0007, solid(0xd49a3c, 0.1)), 'endocrine', { ...end, id: sx > 0 ? 'adrenal_L' : 'adrenal_R', tr: `Böbreküstü bezi (${sx > 0 ? 'sol' : 'sağ'})`, la: 'glandula suprarenalis', desc: 'Kabuk bölgesi kortizol ve aldosteron, öz bölgesi adrenalin ve noradrenalin salgılar; stres yanıtını ve su-tuz dengesini düzenler.' });
    }
  });
}
