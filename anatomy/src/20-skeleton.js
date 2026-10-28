// ===================== Skeletal system =====================
const BONE_AO = { ao: 0.007, aoMin: 0.42 };
const boneMesh = (shape, h, extra = {}) => meshSDF(shape, h, { ...BONE_AO, ...extra });
const E = SD.ell, C = SD.cone, S = SD.sphere;
const mirrorShape = MirX;

// subtle periosteal bumpiness
const boneTex = (s, amp = 0.00035, fr = 900) => Disp(s, (x, y, z) => amp * noise3(x * fr, y * fr, z * fr), amp);

// ---------- skull ----------
const SKULL_CAVITY = E([0, 1.669, -0.012], [0.0652, 0.0718, 0.0878]);
function skullParts() {
  const outer = U(0.012,
    E([0, 1.668, -0.012], [0.0712, 0.0775, 0.094]),
    E([0, 1.624, -0.102], [0.012, 0.006, 0.006]),        // ext. occipital protuberance
    E([0, 1.612, -0.074], [0.05, 0.02, 0.026]),          // occipital squama / nuchal area
  );
  const temporalFossa = [E([0.087, 1.645, 0.014], [0.02, 0.03, 0.034]), E([-0.087, 1.645, 0.014], [0.02, 0.03, 0.034])];
  const vault = Sub(Sub(outer, 0.01, temporalFossa), 0.0015, SKULL_CAVITY);
  // facial skeleton as a curved mask with openings
  const F0 = E([0, 1.608, 0.004], [0.063, 0.072, 0.081]);
  const F1 = E([0, 1.608, 0.004], [0.058, 0.0665, 0.0755]);
  const mask = I(0.006, Sub(F0, 0, F1), SymX(SD.plane([0.034, 0, 0.03], [1.25, 0, -1])), SD.plane([0, 1.69, 0], [0, 1, 0]), SD.plane([0, 1.581, 0], [0, -1, 0]));
  const archUp = [[-0.031, 1.576, 0.02], [-0.03, 1.576, 0.04], [-0.024, 1.577, 0.058], [-0.013, 1.578, 0.072], [0, 1.579, 0.077],
    [0.013, 1.578, 0.072], [0.024, 1.577, 0.058], [0.03, 1.576, 0.04], [0.031, 1.576, 0.02]];
  const parts = [mask,
    SD.tube(archUp, archUp.map(() => 0.0062)),
    E([0, 1.581, 0.046], [0.027, 0.0035, 0.03]),            // hard palate
    E([0, 1.655, 0.086], [0.011, 0.0075, 0.0065]),          // glabella
    C([0, 1.586, 0.084], [0, 1.585, 0.091], 0.0022, 0.0008), // anterior nasal spine
    SD.ell([0, 1.636, 0.0905], [0.0068, 0.0125, 0.0026], [[1, 0, 0], norm3([0, -0.92, 0.38]), norm3([0, 0.38, 0.92])]), // nasal bones
  ];
  for (const sx of [1, -1]) {
    parts.push(E([0.029 * sx, 1.656, 0.079], [0.019, 0.005, 0.007]));               // superciliary arch
    parts.push(E([0.05 * sx, 1.611, 0.049], [0.0095, 0.0115, 0.0095]));              // zygomatic body
    parts.push(C([0.056 * sx, 1.609, 0.038], [0.067 * sx, 1.612, -0.006], 0.0036, 0.0033)); // zygomatic arch
    parts.push(C([0.054 * sx, 1.611, -0.026], [0.051 * sx, 1.593, -0.027], 0.008, 0.0042)); // mastoid
    parts.push(C([0.044 * sx, 1.599, -0.012], [0.039 * sx, 1.575, 0.0], 0.0015, 0.0007)); // styloid
    parts.push(C([0.015 * sx, 1.598, -0.024], [0.014 * sx, 1.592, -0.018], 0.0048, 0.0038)); // occipital condyle
    parts.push(E([0.03 * sx, 1.594, 0.06], [0.018, 0.016, 0.012]));                   // maxillary body
    const rim = [0.034 * sx, 1.636, 0.07], apex = [0.015 * sx, 1.632, 0.028];
    parts.push(I(0.002, Shell(C(rim, apex, 0.0185, 0.004), 0.0011), SD.plane([0, 0, 0.074], [0, 0, 1]))); // orbital walls
  }
  let face = U(0.008, parts);
  const orbits = [E([0.034, 1.636, 0.08], [0.0185, 0.0165, 0.03]), E([-0.034, 1.636, 0.08], [0.0185, 0.0165, 0.03])];
  const nasal = [E([0, 1.597, 0.086], [0.0118, 0.0115, 0.02]), E([0, 1.611, 0.086], [0.0078, 0.0125, 0.02])];
  face = Sub(face, 0.002, orbits, nasal, SKULL_CAVITY);
  const meatus = [C([0.06, 1.616, -0.016], [0.08, 1.616, -0.016], 0.0035), C([-0.06, 1.616, -0.016], [-0.08, 1.616, -0.016], 0.0035)];
  let skull = U(0.005, vault, face);
  skull = Sub(skull, 0.0015, meatus, C([0, 1.6, -0.022], [0, 1.575, -0.024], 0.0145));
  skull = boneTex(skull, 0.00025, 600);
  // calvaria cut plane (front y 1.672 at z .08, back y 1.648 at z -.1)
  const n = norm3([0, 1, -0.135]); const o = [0, 1.672, 0.08];
  const cap = I(0, skull, SD.plane(add3(o, mul3(n, 0.0007)), mul3(n, -1)));
  const base = I(0, skull, SD.plane(add3(o, mul3(n, -0.0007)), n));
  return { cap, base };
}

// tube stretched vertically by `s` around height yc (lower bound of true distance, so safe to mesh)
function stretchY(shape, yc, s) {
  return { f: (x, y, z) => shape.f(x, yc + (y - yc) / s, z), b: [shape.b[0], yc + (shape.b[1] - yc) * s, shape.b[2], shape.b[3], yc + (shape.b[4] - yc) * s, shape.b[5]] };
}
function mandibleSDF() {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = -1 + i / 6; pts.push([0.0465 * t, 1.538, 0.077 - 0.082 * t * t]); }
  const body = stretchY(SD.tube(pts, pts.map((p, i) => 0.0046 + 0.0006 * (1 - Math.abs(i - 6) / 6))), 1.538, 2.5);
  const parts = [body, E([0, 1.528, 0.078], [0.011, 0.0065, 0.0055])];
  const ramusOl = smoothOutline([[-0.008, 1.546], [-0.011, 1.57], [-0.0145, 1.598], [-0.009, 1.603], [-0.004, 1.596], [0.003, 1.589], [0.009, 1.597], [0.013, 1.604],
    [0.0135, 1.592], [0.014, 1.572], [0.018, 1.552], [0.022, 1.541], [0.006, 1.533], [-0.004, 1.537]], 4);
  for (const sx of [1, -1]) {
    const map = (x, y, z) => [z, y, sx * x - (0.0465 + 0.0035 * (y - 1.55) / 0.05)];
    parts.push(SD.plate(ramusOl, map, 0.0044, sx > 0 ? [0.035, 1.525, -0.02, 0.06, 1.61, 0.03] : [-0.06, 1.525, -0.02, -0.035, 1.61, 0.03], 0.0015, [0.002, 0.003]));
    parts.push(E([0.051 * sx, 1.607, -0.013], [0.0088, 0.004, 0.0052]));
  }
  return boneTex(U(0.005, parts), 0.0002, 700);
}

// teeth along the arches. upper: crowns point down; lower: crowns point up
const TOOTH_ARCH = [
  // x, z, type (0 incisor,1 lateral incisor,2 canine,3 premolar,4 molar), crown half-width
  [0.0046, 0.0785, 0, 0.0043], [0.0122, 0.0755, 1, 0.0034], [0.0188, 0.0695, 2, 0.0039], [0.0232, 0.0615, 3, 0.0036],
  [0.0262, 0.0538, 3, 0.0035], [0.0288, 0.0442, 4, 0.0052], [0.0306, 0.0335, 4, 0.0049], [0.0315, 0.0235, 4, 0.0045],
];
function toothSDF(x, z, type, w, upper) {
  const dirY = upper ? -1 : 1;
  const yOcc = upper ? 1.5605 : 1.5598;
  const crownH = type <= 2 ? 0.0095 : 0.0072;
  const tipY = yOcc; const crownBase = yOcc - dirY * crownH;
  const ang = Math.atan2(x, z - 0.035); // arch tangent orientation
  const tan = [Math.cos(ang), 0, -Math.sin(ang)], rad = [Math.sin(ang), 0, Math.cos(ang)];
  const s = upper ? 1 : 0.94; const zz = upper ? z : z - 0.0035;
  const cx = x * s, c = [cx, 0, zz];
  const parts = [];
  const mid = (tipY + crownBase) / 2;
  if (type <= 1) {
    parts.push(SD.ell([c[0], mid, c[2]], [w, crownH * 0.55, 0.0028], [tan, [0, 1, 0], rad]));
  } else if (type === 2) {
    parts.push(SD.ell([c[0], mid - dirY * 0.001, c[2]], [w * 0.85, crownH * 0.5, 0.0036], [tan, [0, 1, 0], rad]));
    parts.push(C([c[0], mid, c[2]], [c[0], tipY - dirY * 0.0003, c[2]], 0.0032, 0.0008));
  } else {
    const r = type === 3 ? 0.0036 : 0.0048;
    parts.push(SD.box([c[0], mid - dirY * 0.0005, c[2]], [w * 0.92, crownH * 0.42, r], [tan, [0, 1, 0], rad], 0.0024));
    const cusps = type === 3 ? [[0, 0.0016], [0, -0.0016]] : [[0.0024, 0.0022], [-0.0024, 0.0022], [0.0024, -0.0022], [-0.0024, -0.0022]];
    for (const [a, b] of cusps) parts.push(S(add3([c[0], tipY - dirY * 0.0016, c[2]], add3(mul3(tan, a), mul3(rad, b))), 0.0019));
  }
  const rootLen = type === 2 ? 0.017 : type === 4 ? 0.012 : 0.013;
  const rootEnd = crownBase - dirY * rootLen;
  if (type === 4) {
    for (const a of [-0.0022, 0.0022]) parts.push(C(add3([c[0], crownBase + dirY * 0.001, c[2]], mul3(tan, a)), add3([c[0], rootEnd, c[2]], mul3(tan, a * 1.3)), 0.0026, 0.0009));
  } else parts.push(C([c[0], crownBase + dirY * 0.001, c[2]], [c[0], rootEnd, c[2]], type <= 1 ? 0.0024 : 0.0028, 0.0009));
  return U(0.0015, parts);
}
// colour enamel vs root (root slightly yellow)
function toothColor(upper) {
  return (x, y) => {
    const t = upper ? smoothstep(1.5695, 1.5735, y) : smoothstep(1.551, 1.547, y);
    return [lerp(1.0, 0.93, t), lerp(1.0, 0.86, t), lerp(0.98, 0.68, t)];
  };
}

// ---------- vertebrae ----------
function ellCyl(W, D, H, r = 0.0012) {
  return {
    f: (x, y, z) => {
      const k = Math.sqrt((x / W) ** 2 + (z / D) ** 2);
      const d2 = (k - 1) * Math.min(W, D) + r;
      const dy = Math.abs(y) - H + r;
      const ox = Math.max(d2, 0), oy = Math.max(dy, 0);
      return Math.min(Math.max(d2, dy), 0) + Math.sqrt(ox * ox + oy * oy) - r;
    }, b: [-W, -H, -D, W, H, D]
  };
}
function vertebraLocal(i) {
  const s = vertSpec(i);
  const { bodyW: W, bodyD: D, bodyH: H } = s;
  const cz = -(D + s.canalD);              // canal centre z
  const backZ = cz - s.canalD - 0.0015;    // lamina junction
  const parts = []; const cuts = [];
  const cervical = i <= 6, lumbar = i >= 19;
  if (i === 0) {
    // atlas: ring with lateral masses, no body
    const ring = [[0, 0, 0.007], [0.009, 0, 0.004], [0.015, 0, -0.006], [0.013, 0.0, -0.018], [0.006, 0, -0.025], [0, 0.0, -0.027]];
    const full = ring.concat(ring.slice(0, -1).reverse().map(p => [-p[0], p[1], p[2]]));
    parts.push(SD.tube(full, full.map((p, k) => (k === 0 || k === full.length - 1) ? 0.0035 : 0.0028), 0.002));
    parts.push(E([0, 0, 0.0075], [0.004, 0.005, 0.0028]));
    for (const sx of [1, -1]) {
      parts.push(E([0.0135 * sx, 0.0005, -0.004], [0.0058, 0.0058, 0.0085]));
      parts.push(C([0.016 * sx, 0, -0.005], [0.031 * sx, -0.001, -0.007], 0.0045, 0.0042));
      cuts.push(C([0.025 * sx, 0.01, -0.006], [0.025 * sx, -0.01, -0.006], 0.0022));
    }
    parts.push(E([0, -0.001, -0.027], [0.004, 0.0045, 0.0035]));
    let at = U(0.003, parts);
    return Sub(at, 0.0012, cuts, E([0, 0, -0.008], [0.011, 0.03, 0.0125]));
  }
  parts.push(ellCyl(W, D, H, 0.0016));
  if (i === 1) { parts.push(C([0, H * 0.6, 0.0005], [0, H + 0.0155, 0.0015], 0.0047, 0.0036)); }
  if (cervical) for (const sx of [1, -1]) parts.push(C([sx * W * 0.82, H * 0.6, -D * 0.2], [sx * W * 0.92, H * 1.25, -D * 0.25], 0.0018, 0.0012)); // uncinate
  for (const sx of [1, -1]) {
    const pedA = [sx * W * 0.62, 0.0006, -D * 0.72];
    const pedB = [sx * (s.canalW + 0.0012), 0.0006, cz + 0.001];
    parts.push(C(pedA, pedB, lumbar ? 0.0042 : 0.0031, lumbar ? 0.0042 : 0.0032));
    // lamina
    parts.push(C(pedB, [sx * 0.0015, -0.0012, backZ], lumbar ? 0.0034 : 0.0026, 0.0028));
    parts.push(C(add3(pedB, [0, -0.002, -0.001]), [sx * 0.0015, -H * 0.9, backZ - 0.001], 0.0022, 0.0022));
    // articular processes
    parts.push(E(add3(pedB, [0, H * 1.0, -0.0025]), [lumbar ? 0.0042 : 0.0034, H * 0.65, 0.0034]));
    parts.push(E(add3(pedB, [-sx * 0.0008, -H * 1.05, -0.004]), [lumbar ? 0.0038 : 0.0031, H * 0.6, 0.0032]));
    // transverse process
    let tEnd;
    if (cervical) tEnd = [sx * (W + s.transLen), -0.001, -D * 0.25];
    else if (lumbar) tEnd = [sx * (W + s.transLen * 0.86), 0.0005, cz * 0.55];
    else tEnd = [sx * (W + s.transLen * 0.86), 0.0025, cz - 0.0055];
    const tStart = [sx * (s.canalW + 0.0018), 0.0004, cz + (cervical ? 0.003 : 0)];
    parts.push(C(tStart, tEnd, cervical ? 0.0035 : lumbar ? 0.0034 : 0.0045, cervical ? 0.0025 : lumbar ? 0.0022 : 0.004));
    if (cervical && i <= 5) cuts.push(C([sx * (W + 0.0055), 0.01, -D * 0.22], [sx * (W + 0.0055), -0.01, -D * 0.22], 0.0021));
    if (!cervical && !lumbar) parts.push(S(tEnd, 0.0045));
  }
  // spinous process
  const sa = s.spinAng; const sp0 = [0, -0.0015, backZ + 0.001];
  const dir = [0, -Math.sin(sa), -Math.cos(sa)];
  const spEnd = add3(sp0, mul3(dir, s.spinLen));
  if (lumbar) {
    parts.push(SD.ell(add3(sp0, mul3(dir, s.spinLen * 0.55)), [0.0028, 0.0085, s.spinLen * 0.55], [[1, 0, 0], norm3(cross3(dir, [1, 0, 0])), dir]));
  } else if (cervical && i < 6) {
    parts.push(C(sp0, spEnd, 0.0032, 0.0022));
    for (const sx of [1, -1]) parts.push(S(add3(spEnd, [sx * 0.0024, 0, 0]), 0.0026)); // bifid tip
  } else {
    parts.push(C(sp0, spEnd, 0.0034, 0.0024));
    parts.push(S(spEnd, 0.0034));
  }
  let v = U(0.0028, parts);
  v = Sub(v, 0.0012, cuts, Place(ellCyl(s.canalW, s.canalD, 0.05, 0.0005), [0, 0, cz], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
  return v;
}
function vertebraSDF(i) {
  const F = vertFrame(i);
  return boneTex(Place(vertebraLocal(i), F.o, [F.X, F.Y, F.Z]), 0.00018, 1600);
}
function discSDF(i) {
  // disc between vertebra i and i+1
  const A = vertFrame(i), Bf = vertFrame(i + 1); const sa = vertSpec(i), sb = vertSpec(i + 1);
  const o = mix3(A.o, Bf.o, 0.5);
  const Y = norm3(sub3(A.o, Bf.o)); let Z = norm3(sub3([0, 0, 1], mul3(Y, Y[2]))); const X = cross3(Y, Z);
  const gap = len3(sub3(A.o, Bf.o)) - sa.bodyH - sb.bodyH;
  return Place(ellCyl((sa.bodyW + sb.bodyW) * 0.49, (sa.bodyD + sb.bodyD) * 0.49, Math.max(gap * 0.5 + 0.0004, 0.001), 0.0012), o, [X, Y, Z]);
}

// ---------- sacrum & coccyx ----------
function sacrumSDF() {
  const top = [0, 0.941, -0.05], bot = [0, 0.852, -0.104];
  const Ydir = norm3(sub3(top, bot)); const X = [1, 0, 0]; const Wn = cross3(X, Ydir);
  const o = mix3(top, bot, 0.5);
  const map = (x, y, z) => {
    const p = [x - o[0], y - o[1], z - o[2]];
    const v = dot3(p, Ydir);
    return [p[0], v, dot3(p, Wn) - 5.5 * v * v + 0.012 * smoothstep(0.0, 0.05, v)];
  };
  const ol = smoothOutline([[0, 0.054], [0.028, 0.054], [0.05, 0.049], [0.054, 0.032], [0.042, 0.006], [0.028, -0.022], [0.015, -0.044], [0, -0.053],
    [-0.015, -0.044], [-0.028, -0.022], [-0.042, 0.006], [-0.054, 0.032], [-0.05, 0.049], [-0.028, 0.054]], 5);
  const th = (u, v) => lerp(0.01, 0.034, smoothstep(-0.045, 0.045, v)) * (1 - 0.3 * smoothstep(0.025, 0.05, Math.abs(u)));
  const plate = SD.plate(ol, map, th, [-0.06, 0.83, -0.135, 0.06, 0.975, -0.01], 0.002);
  const parts = [plate, Place(ellCyl(0.024, 0.016, 0.007), [0, 0.936, -0.042], [[1, 0, 0], Ydir, Wn])];
  for (let k = 0; k < 4; k++) parts.push(E(add3(mix3(top, bot, 0.12 + k * 0.21), mul3(Wn, -0.016 + k * 0.004)), [0.003, 0.006, 0.004]));
  for (const sx of [1, -1]) parts.push(E(add3(top, [0.017 * sx, 0.006, -0.026]), [0.0055, 0.007, 0.006]));
  let sac = U(0.004, parts);
  const holes = [];
  for (let k = 0; k < 4; k++) for (const sx of [1, -1]) {
    const c = add3(mix3(top, bot, 0.2 + k * 0.2), [sx * (0.018 - k * 0.0018), 0, 0]);
    holes.push(C(add3(c, mul3(Wn, 0.03)), add3(c, mul3(Wn, -0.006)), 0.0033 - k * 0.0003));
  }
  sac = Sub(sac, 0.0012, holes, Place(ellCyl(0.01, 0.0055, 0.06, 0.001), add3(mix3(top, bot, 0.3), mul3(Wn, -0.01)), [[1, 0, 0], Ydir, Wn]));
  return boneTex(sac, 0.00025, 700);
}
function coccyxSDF() {
  const pts = [[0, 0.851, -0.104], [0, 0.842, -0.104], [0, 0.834, -0.1], [0, 0.828, -0.093]];
  return U(0.002, [C(pts[0], pts[1], 0.0055, 0.0045), C(pts[1], pts[2], 0.0042, 0.0035), C(pts[2], pts[3], 0.0033, 0.0022),
    S(pts[0], 0.0058), S(pts[1], 0.0045), S(pts[2], 0.0036)]);
}

// ---------- hip bone (left) ----------
function hipBoneSDF() {
  const O = [0.0968, 0.971, -0.006];
  const e1 = norm3([0.472, -0.032, 0.881]);
  const e2 = norm3(sub3([0.437, 0.874, -0.214], mul3(e1, dot3([0.437, 0.874, -0.214], e1))));
  const nW = cross3(e1, e2);
  const map = (x, y, z) => {
    const p = [x - O[0], y - O[1], z - O[2]];
    const u = dot3(p, e1), v = dot3(p, e2);
    const H = 0.013 * ((u + 0.01) / 0.08) ** 2 - 0.0065 - 0.012 * smoothstep(-0.04, -0.075, v) * smoothstep(0.0, -0.06, u);
    return [u, v, dot3(p, nW) - H];
  };
  const ol = smoothOutline([[0.068, -0.008], [0.062, -0.026], [0.056, -0.041], [0.048, -0.052], [0.038, -0.072], [0.0, -0.08], [-0.03, -0.072],
    [-0.05, -0.064], [-0.072, -0.045], [-0.09, -0.03], [-0.093, -0.017], [-0.078, 0.016], [-0.045, 0.046], [0.008, 0.063], [0.044, 0.047], [0.064, 0.016]], 5);
  const th = (u, v) => 0.0035 + 0.016 * smoothstep(-0.035, -0.075, v);
  const wing = SD.plate(ol, map, th, [0.03, 0.87, -0.1, 0.16, 1.04, 0.075], 0.0012, [0.007, 0.006]);
  const H = LM.hip;
  const nOpen = norm3([1, -0.6, 0.55]);
  const cup = I(0.002, Sub(S(H, 0.0305), 0.001, S(H, 0.0252)), SD.plane(add3(H, mul3(nOpen, 0.006)), nOpen));
  const parts = [wing, cup,
    S(LM.asis, 0.0058), E([0.106, 0.935, 0.051], [0.006, 0.008, 0.006]),          // ASIS, AIIS
    E([0.078, 0.925, 0.012], [0.017, 0.02, 0.02]),                                  // body of ilium
    E([0.051, 0.952, -0.068], [0.011, 0.026, 0.016]),                               // auricular region
    S(LM.psis, 0.006),
    C([0.07, 0.885, -0.008], [0.061, 0.84, -0.022], 0.0118, 0.0112),               // ischium
    E(LM.ischTub, [0.011, 0.016, 0.0135]),
    C([0.06, 0.876, -0.04], [0.051, 0.872, -0.053], 0.0042, 0.0015),               // ischial spine
    SD.tube([[0.06, 0.83, -0.014], [0.05, 0.828, 0.004], [0.04, 0.834, 0.024], [0.027, 0.85, 0.046], [0.014, 0.867, 0.059]], [0.0068, 0.006, 0.0058, 0.0058, 0.007], 0.003),
    SD.tube([[0.074, 0.894, 0.046], [0.05, 0.893, 0.059], [0.024, 0.888, 0.066]], [0.0088, 0.0078, 0.0088], 0.003),
    E([0.011, 0.879, 0.063], [0.0085, 0.0175, 0.0095]),
    S(LM.pubicTub, 0.0042),
  ];
  let hb = U(0.005, parts);
  hb = Sub(hb, 0.001, S(H, 0.0245));
  return boneTex(hb, 0.00025, 700);
}

// ---------- long bones (left) ----------
function femurSDF() {
  const H = LM.hip;
  const parts = [
    S(H, 0.0235),
    C(H, [0.123, 0.879, 0.006], 0.0158, 0.0175),
    E([0.139, 0.893, 0.0], [0.0165, 0.027, 0.021]),
    C([0.14, 0.912, -0.004], [0.134, 0.87, -0.006], 0.011, 0.014),
    E(LM.lesserTroch, [0.008, 0.009, 0.008]),
    C([0.127, 0.865, 0.005], [0.112, 0.69, 0.011], 0.0168, 0.0142),
    C([0.112, 0.69, 0.011], [0.095, 0.56, 0.004], 0.0142, 0.0185),
    C([0.118, 0.81, -0.01], [0.103, 0.6, -0.007], 0.0055, 0.0055), // linea aspera
    E([0.09, 0.528, 0.0], [0.034, 0.026, 0.022]),
    E(LM.latCondyle, [0.0175, 0.023, 0.028]),
    E(LM.medCondyle, [0.019, 0.024, 0.029]),
    S([0.064, 0.516, -0.003], 0.007), S([0.117, 0.518, -0.004], 0.006), // epicondyles
  ];
  let f = U(0.008, parts);
  f = Sub(f, 0.004, E([0.09, 0.486, -0.02], [0.0085, 0.024, 0.024]), C([0.09, 0.53, 0.031], [0.09, 0.495, 0.028], 0.0065));
  return boneTex(f, 0.0003, 700);
}
function patellaSDF() {
  return boneTex(U(0.004, E(LM.patella, [0.021, 0.022, 0.0105]), C([0.09, 0.515, 0.047], [0.09, 0.496, 0.043], 0.008, 0.003)), 0.0002, 900);
}
function tibiaSDF() {
  const parts = [
    I(0.003, E([0.088, 0.456, -0.003], [0.041, 0.019, 0.029]), SD.plane([0, 0.4715, 0], [0, 1, 0])),
    E([0.088, 0.443, -0.003], [0.04, 0.024, 0.029]),
    S([0.083, 0.47, -0.002], 0.0045), S([0.093, 0.47, -0.002], 0.0045),
    E(LM.tibTub, [0.011, 0.017, 0.009]),
    C([0.088, 0.425, 0.0], [0.087, 0.25, 0.004], 0.0175, 0.0125),
    C([0.087, 0.25, 0.004], [0.085, 0.095, 0.0], 0.0125, 0.0165),
    C([0.089, 0.41, 0.011], [0.087, 0.15, 0.01], 0.0075, 0.0055), // anterior crest
    I(0.003, E([0.085, 0.084, 0.0], [0.024, 0.02, 0.022]), SD.plane([0, 0.0685, 0], [0, -1, 0])),
    E(LM.medMall, [0.0075, 0.017, 0.0105]),
  ];
  return boneTex(U(0.007, parts), 0.0003, 700);
}
function fibulaSDF() {
  return boneTex(U(0.005,
    E(LM.fibHead, [0.0105, 0.0125, 0.0105]),
    C([0.123, 0.44, -0.017], [0.12, 0.25, -0.016], 0.0068, 0.0058),
    C([0.12, 0.25, -0.016], [0.118, 0.085, -0.013], 0.0058, 0.0068),
    E(LM.latMall, [0.0085, 0.021, 0.0115]),
  ), 0.00025, 900);
}
function humerusSDF() {
  const parts = [
    S(LM.humHead, 0.0228),
    E(LM.greaterTub, [0.012, 0.016, 0.013]),
    E([0.191, 1.404, 0.006], [0.0075, 0.01, 0.0075]),
    C([0.198, 1.392, -0.02], [0.216, 1.25, -0.017], 0.0135, 0.0112),
    C([0.216, 1.25, -0.017], [0.233, 1.13, -0.021], 0.0112, 0.0125),
    E(LM.deltTub, [0.0065, 0.02, 0.0065]),
    E([0.234, 1.117, -0.022], [0.031, 0.013, 0.0105]),
    S(LM.medEpi, 0.0088), S(LM.latEpi, 0.0068),
    E([0.222, 1.099, -0.017], [0.0115, 0.0105, 0.0128]),
    S([0.248, 1.1, -0.013], 0.0098),
  ];
  let h = U(0.007, parts);
  h = Sub(h, 0.003, E([0.234, 1.124, -0.034], [0.0095, 0.013, 0.006]), E([0.234, 1.124, -0.008], [0.009, 0.009, 0.004]));
  return boneTex(h, 0.0003, 800);
}
function ulnaSDF() {
  let u = U(0.005,
    E([0.226, 1.112, -0.037], [0.0105, 0.016, 0.0105]),
    E([0.224, 1.083, -0.008], [0.0075, 0.0075, 0.0085]),
    C([0.226, 1.09, -0.025], [0.252, 0.97, -0.017], 0.0098, 0.0072),
    C([0.252, 0.97, -0.017], [0.27, 0.866, -0.012], 0.0072, 0.0058),
    S([0.271, 0.864, -0.012], 0.0076),
    C([0.269, 0.862, -0.016], [0.268, 0.846, -0.018], 0.0028, 0.0017),
  );
  u = Sub(u, 0.002, S([0.222, 1.099, -0.017], 0.0135), S([0.248, 1.084, -0.012], 0.0115));
  return boneTex(u, 0.00025, 900);
}
function radiusSDF() {
  let r = U(0.004,
    I(0.001, E([0.248, 1.0835, -0.012], [0.0108, 0.0062, 0.0108]), E([0.248, 1.08, -0.012], [0.02, 0.0075, 0.02])),
    C([0.248, 1.079, -0.012], [0.247, 1.058, -0.01], 0.0062, 0.0062),
    E(LM.radTub, [0.0055, 0.009, 0.0055]),
    C([0.248, 1.06, -0.01], [0.274, 0.975, -0.006], 0.0068, 0.0075),
    C([0.274, 0.975, -0.006], [0.3, 0.885, -0.0], 0.0075, 0.0105),
    E([0.302, 0.868, 0.0], [0.0165, 0.0105, 0.0118]),
    C([0.314, 0.866, 0.0], LM.radStyloid, 0.0048, 0.0026),
  );
  r = Sub(r, 0.002, S([0.248, 1.1, -0.013], 0.0102));
  return boneTex(r, 0.00025, 900);
}

// ---------- hand (left) ----------
function carpalDefs() {
  const H = HAND; const ax = [H.D, H.Lt, H.P];
  const c = (nm, la, d, l, p, r) => ({ nm, la, shape: SD.box(H.at(d, l, p), r, ax, Math.min(...r) * 0.75) });
  return [
    c('Kayık kemiği', 'os scaphoideum', 0.0095, 0.0145, 0.0012, [0.0082, 0.0078, 0.0064]),
    c('Ay kemiği', 'os lunatum', 0.0084, 0.0012, 0.0002, [0.0072, 0.0064, 0.0078]),
    c('Üçgen kemik', 'os triquetrum', 0.0112, -0.0106, -0.001, [0.0068, 0.0056, 0.0064]),
    { nm: 'Bezelye kemiği', la: 'os pisiforme', shape: E(H.at(0.0118, -0.0132, 0.0082), [0.0042, 0.0038, 0.0038], ax) },
    c('Büyük trapez kemiği', 'os trapezium', 0.0222, 0.0212, 0.0042, [0.0062, 0.0062, 0.0066]),
    c('Küçük trapez kemiği', 'os trapezoideum', 0.0232, 0.0116, 0.0002, [0.0062, 0.0048, 0.0062]),
    c('Başlı kemik', 'os capitatum', 0.0226, 0.0015, -0.0008, [0.0098, 0.0056, 0.0078]),
    { nm: 'Çengel kemiği', la: 'os hamatum', shape: U(0.003, SD.box(H.at(0.0222, -0.0105, -0.001), [0.0082, 0.0062, 0.0072], ax, 0.0045), C(H.at(0.024, -0.0115, 0.002), H.at(0.025, -0.0118, 0.0095), 0.0032, 0.0022)) },
  ];
}
function phalanxSDF(a, b, rBase, rHead, distal) {
  const dir = norm3(sub3(b, a));
  const a2 = add3(a, mul3(dir, 0.0013)), b2 = add3(b, mul3(dir, -0.0013));
  const parts = [
    C(add3(a2, mul3(dir, rBase * 0.6)), add3(b2, mul3(dir, -rHead * 0.6)), rBase * 0.62, rHead * 0.55),
    SD.ellAlong(add3(a2, mul3(dir, rBase * 0.55)), dir, rBase * 0.6, rBase * 1.02, rBase * 0.85),
  ];
  if (distal) parts.push(SD.ellAlong(add3(b2, mul3(dir, -rHead * 0.7)), dir, rHead * 0.8, rHead * 0.95, rHead * 0.6));
  else parts.push(SD.ellAlong(add3(b2, mul3(dir, -rHead * 0.8)), dir, rHead * 0.8, rHead * 0.98, rHead * 0.85));
  return U(0.0018, parts);
}
function metacarpalSDF(base, head, rB, rS, rH) {
  const dir = norm3(sub3(head, base));
  const b2 = add3(base, mul3(dir, 0.0012)), h2 = add3(head, mul3(dir, -0.0014));
  return U(0.0025,
    SD.ellAlong(add3(b2, mul3(dir, rB * 0.7)), dir, rB * 0.75, rB, rB * 0.9),
    C(add3(b2, mul3(dir, rB)), add3(h2, mul3(dir, -rH)), rS, rS * 0.92),
    S(add3(h2, mul3(dir, -rH * 0.95)), rH));
}

// ---------- foot (left) ----------
function tarsalDefs() {
  const F = FOOT; const ax = [F.F, F.Lf, F.Uf]; const at = F.at;
  return [
    { nm: 'Aşık kemiği', la: 'talus', shape: U(0.004, E(at(-0.004, 0.0, -0.013), [0.026, 0.0155, 0.0135], ax), I(0.002, E(at(-0.004, 0, -0.008), [0.024, 0.014, 0.011], ax), SD.plane(at(0, 0, -0.0035), [0, 1, 0])), C(at(0.012, -0.003, -0.016), at(0.034, -0.009, -0.021), 0.0105, 0.0112)) },
    { nm: 'Topuk kemiği', la: 'calcaneus', shape: U(0.007, E(at(-0.017, 0.004, -0.043), [0.036, 0.0155, 0.0185], ax), C(at(-0.036, 0.004, -0.047), at(-0.058, 0.004, -0.047), 0.0165, 0.0155), C(at(0.0, 0.007, -0.041), at(0.037, 0.011, -0.044), 0.0145, 0.012), E(at(-0.006, -0.016, -0.03), [0.011, 0.007, 0.0045], ax)) },
    { nm: 'Kayık kemiği (ayak)', la: 'os naviculare', shape: E(at(0.049, -0.013, -0.024), [0.0075, 0.0158, 0.0128], ax) },
    { nm: 'Küp kemiği', la: 'os cuboideum', shape: SD.box(at(0.055, 0.017, -0.041), [0.013, 0.0105, 0.0105], ax, 0.004) },
    { nm: 'İç çivi kemiği', la: 'os cuneiforme mediale', shape: SD.box(at(0.068, -0.0175, -0.031), [0.0105, 0.0072, 0.0145], ax, 0.0035) },
    { nm: 'Orta çivi kemiği', la: 'os cuneiforme intermedium', shape: SD.box(at(0.0655, -0.0045, -0.026), [0.0082, 0.0055, 0.0105], ax, 0.003) },
    { nm: 'Dış çivi kemiği', la: 'os cuneiforme laterale', shape: SD.box(at(0.0665, 0.0068, -0.029), [0.0098, 0.0058, 0.0108], ax, 0.003) },
  ];
}

// ---------- ribs ----------
const RIB_W = [0.058, 0.088, 0.106, 0.118, 0.127, 0.134, 0.139, 0.141, 0.14, 0.135, 0.125, 0.108];
const RIB_DROP = [0.035, 0.055, 0.075, 0.09, 0.1, 0.11, 0.12, 0.125, 0.12, 0.11, 0.072, 0.048];
const RIB_END = [6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 4, 3];
const RIB_STY = [1.412, 1.378, 1.352, 1.326, 1.302, 1.275, 1.248];
const RIB_NORM = [[0.45, 0.0, 0.06], [0.70, 0.08, 0.16], [0.90, 0.26, 0.3], [1.0, 0.48, 0.45], [0.97, 0.66, 0.6], [0.84, 0.82, 0.75], [0.62, 0.94, 0.88], [0.36, 1.0, 1.0]];
const sternumZ = (y) => 0.064 + clamp((1.425 - y) / 0.189, 0, 1.2) * 0.036 - 0.004;
function ribPaths() {
  const ribs = [];
  for (let r = 1; r <= 12; r++) {
    const vi = 6 + r; const s = vertSpec(vi);
    const P0 = vLocal(vi, s.bodyW + 0.0015, 0.004, -s.bodyD * 0.5);
    const P1 = vLocal(vi, s.bodyW + s.transLen * 0.86, 0.001, -(s.bodyD + s.canalD + 0.005));
    const a = RIB_W[r - 1];
    const zBack = P1[2] - 0.014;
    const yFront = r <= 7 ? RIB_STY[r - 1] : P1[1] - RIB_DROP[r - 1];
    const zFront = r <= 7 ? sternumZ(yFront) : [0.088, 0.078, 0.062, 0.03, 0.0][r - 8];
    const pts = [P0, P1];
    for (let j = 0; j <= RIB_END[r - 1]; j++) {
      const [un, wn, sn] = RIB_NORM[j];
      const x = Math.max(un * a, P1[0] + 0.006 * (j + 1));
      pts.push([x, P1[1] - RIB_DROP[r - 1] * sn, lerp(zBack, zFront, wn)]);
    }
    // ensure x grows smoothly near the back for short upper ribs
    ribs.push({ r, pts, zFront, yFront });
  }
  // costal cartilages
  for (const rib of ribs) {
    const r = rib.r; const end = rib.pts[rib.pts.length - 1];
    if (r <= 7) {
      const st = [r === 1 ? 0.024 : r === 2 ? 0.019 : 0.0165 + (r - 3) * 0.0008, RIB_STY[r - 1], sternumZ(RIB_STY[r - 1]) + 0.002];
      const mid = [lerp(end[0], st[0], 0.55), lerp(end[1], st[1], 0.35) - (r >= 5 ? 0.008 : 0), lerp(end[2], st[2], 0.7) + 0.006];
      rib.cart = [end, mid, st];
    } else if (r <= 10) {
      const above = ribs[r - 2].cart; // join cartilage of rib above
      const tgt = mixAlong(above, 0.62);
      const mid = [lerp(end[0], tgt[0], 0.5), lerp(end[1], tgt[1], 0.45) - 0.006, lerp(end[2], tgt[2], 0.5) + 0.01];
      rib.cart = [end, mid, tgt];
    } else {
      const dir = norm3(sub3(end, rib.pts[rib.pts.length - 2]));
      rib.cart = [end, add3(end, mul3(dir, 0.012)), add3(end, mul3(dir, 0.02))];
    }
  }
  return ribs;
}
function mixAlong(pts, t) {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const l = len3(sub3(pts[i], pts[i - 1])); L.push(l); tot += l; }
  let d = t * tot;
  for (let i = 1; i < pts.length; i++) { if (d <= L[i - 1]) return mix3(pts[i - 1], pts[i], d / L[i - 1]); d -= L[i - 1]; }
  return pts[pts.length - 1];
}
function ribGeometry(rib) {
  const r = rib.r;
  const wide = r === 1 ? 0.0085 : r <= 2 ? 0.0072 : r >= 11 ? 0.0055 : 0.0068;
  return sweep(rib.pts, {
    rx: (t) => lerp(0.0042, 0.0028, smoothstep(0, 0.25, t)),
    ry: (t) => lerp(0.0045, wide, smoothstep(0.02, 0.3, t)) * (1 - 0.15 * smoothstep(0.8, 1, t)),
    up: [0, 1, 0], radial: 10, step: 0.005,
    color: () => [0.93, 0.93, 0.93],
  });
}
function cartilageGeometry(rib) {
  const r = rib.r;
  return sweep(rib.cart, { rx: () => 0.0034, ry: (t) => (r <= 7 ? lerp(0.0058, 0.0062, t) : lerp(0.0052, 0.004, t)), up: [0, 1, 0], radial: 10, step: 0.005 });
}

// ---------- sternum ----------
function sternumSDF() {
  const o = [0, 1.33, 0.086]; const e2 = norm3([0, 0.983, -0.181]); const nW = cross3([1, 0, 0], e2);
  const map = (x, y, z) => { const p = [x - o[0], y - o[1], z - o[2]]; return [p[0], dot3(p, e2), dot3(p, nW)]; };
  const half = [[0, 0.091], [0.011, 0.097], [0.024, 0.095], [0.029, 0.085], [0.026, 0.07], [0.018, 0.05], [0.0145, 0.043], [0.016, 0.03], [0.018, 0.0],
    [0.019, -0.04], [0.017, -0.07], [0.012, -0.095], [0.0075, -0.101], [0.0055, -0.12], [0, -0.132]];
  const ol = half.concat(half.slice(1, -1).reverse().map(([u, v]) => [-u, v]));
  const th = (u, v) => v > 0.044 ? 0.0115 : v > -0.098 ? 0.0088 : 0.0042;
  return boneTex(SD.plate(smoothOutline(ol, 4), map, th, [-0.035, 1.18, 0.05, 0.035, 1.44, 0.12], 0.0018), 0.0002, 900);
}

// ---------- clavicle & scapula (left) ----------
function clavicleSDF() {
  const pts = [LM.sc, [0.05, 1.433, 0.066], [0.09, 1.441, 0.05], [0.128, 1.448, 0.018], [0.158, 1.452, -0.002], [0.167, 1.452, -0.009]];
  return boneTex(U(0.004, SD.tube(pts, [0.0088, 0.0069, 0.0059, 0.006, 0.0062, 0.005], 0.002), E([0.157, 1.452, -0.004], [0.012, 0.0042, 0.009]), E(add3(LM.sc, [0.003, 0, 0]), [0.007, 0.0095, 0.009])), 0.00025, 900);
}
const SCAP = { zc: 0.11, R: 0.2253 };
const cylPt = (u, v, w) => { const th = u / SCAP.R, Rr = SCAP.R - w; return [Rr * Math.sin(th), v, SCAP.zc - Rr * Math.cos(th)]; };
function scapulaSDF() {
  const map = (x, y, z) => {
    const dz = z - SCAP.zc; const r = Math.sqrt(x * x + dz * dz);
    return [SCAP.R * Math.atan2(x, -dz), y, SCAP.R - r - 0.003];
  };
  const ol = smoothOutline([[0.07, 1.446], [0.064, 1.412], [0.066, 1.36], [0.073, 1.312], [0.083, 1.276], [0.092, 1.28], [0.108, 1.31], [0.124, 1.348],
    [0.136, 1.378], [0.142, 1.398], [0.131, 1.414], [0.116, 1.422], [0.104, 1.426], [0.088, 1.437]], 6);
  const th = (u) => 0.0026 + 0.005 * smoothstep(0.115, 0.14, u);
  const blade = SD.plate(ol, map, th, [0.04, 1.26, -0.12, 0.16, 1.46, -0.03], 0.001, [0.0035, 0.004]);
  const spine = [cylPt(0.064, 1.404, -0.003), cylPt(0.088, 1.414, -0.009), cylPt(0.112, 1.425, -0.015), cylPt(0.134, 1.435, -0.019), [0.162, 1.445, -0.03], LM.acromion];
  const parts = [blade, SD.tube(spine, [0.0022, 0.0034, 0.0044, 0.0052, 0.0056, 0.0055], 0.003)];
  for (let k = 0; k < 6; k++) { const u = 0.068 + k * 0.013; const v = 1.405 + k * 0.0042; parts.push(C(cylPt(u, v, 0.0), cylPt(u, v + 0.001, -0.004 - k * 0.0026), 0.0017, 0.0022)); }
  parts.push(E([0.177, 1.449, -0.016], [0.017, 0.0048, 0.0135]));
  parts.push(SD.ellAlong(LM.glenoid, [1, 0, 0.25], 0.0052, 0.0118, 0.0172, [0, 0, 1]));
  parts.push(C(cylPt(0.136, 1.397, 0.002), LM.glenoid, 0.0085, 0.0098));
  parts.push(SD.tube([cylPt(0.113, 1.424, 0.002), cylPt(0.128, 1.43, 0.008), [0.141, 1.422, 0.022], LM.coracoid], [0.0056, 0.0053, 0.0048, 0.0042], 0.002));
  let sc = U(0.004, parts);
  sc = Sub(sc, 0.0015, SD.ellAlong(add3(LM.glenoid, [0.006, 0, 0.0015]), [1, 0, 0.25], 0.0028, 0.0105, 0.016, [0, 0, 1]));
  return boneTex(sc, 0.0002, 800);
}
function hyoidSDF() {
  const pts = [[-0.019, 1.53, 0.012], [-0.013, 1.528, 0.026], [0, 1.527, 0.032], [0.013, 1.528, 0.026], [0.019, 1.53, 0.012]];
  return U(0.002, SD.tube(pts, [0.0018, 0.0026, 0.0034, 0.0026, 0.0018], 0.002));
}

// ---------- build tasks ----------
function buildSkeleton(T) {
  const sk = (geo, mat, meta) => addPart(geo, mat, { layer: 'skeleton', ...meta });
  const pair = (geo, mat, meta) => addPair(geo, mat, { layer: 'skeleton', ...meta });
  T('Kafatası tavanı', () => {
    const { cap } = skullParts();
    sk(boneMesh(cap, 0.0021), 'bone', { id: 'calvaria', tr: 'Kafatası tavanı', la: 'calvaria', desc: 'Frontal, parietal ve oksipital kemiklerin üst kısmından oluşan kubbe. Beyni korur; görünümde kaldırarak beyni açığa çıkarabilirsiniz.' });
  });
  T('Kafatası', () => {
    const { base } = skullParts();
    sk(boneMesh(base, 0.0016), 'bone', { id: 'skull', tr: 'Kafatası ve yüz kemikleri', la: 'cranium et ossa faciei', desc: 'Kafa tabanı, şakak kemikleri, göz çukurları (orbita), elmacık kemikleri, burun kemikleri ve üst çene (maxilla). Kafatası 22 kemikten oluşur; alt çene dışındakiler dikişlerle (sutura) oynamaz şekilde birleşir.' });
  });
  T('Alt çene ve dişler', () => {
    sk(boneMesh(mandibleSDF(), 0.0013), 'bone', { id: 'mandible', tr: 'Alt çene kemiği', la: 'mandibula', desc: 'Kafatasının tek hareketli kemiği. Şakak-çene ekleminde (articulatio temporomandibularis) hareket ederek çiğneme ve konuşmayı sağlar.' });
    for (const upper of [true, false]) {
      const geos = [];
      for (const [x, z, type, w] of TOOTH_ARCH) for (const sx of [1, -1]) geos.push(meshSDF(toothSDF(x * sx, z, type, w, upper), 0.0006, { ao: 0.002, aoMin: 0.6, color: toothColor(upper) }));
      sk(mergeGeos(geos), 'tooth', { id: upper ? 'teethU' : 'teethL', tr: upper ? 'Üst dişler' : 'Alt dişler', la: upper ? 'dentes maxillares' : 'dentes mandibulares', desc: 'Her çenede 16 diş: 4 kesici, 2 köpek, 4 küçük azı, 6 büyük azı. Mine (enamel) vücudun en sert dokusudur.' });
    }
    sk(boneMesh(hyoidSDF(), 0.0008), 'bone', { id: 'hyoid', tr: 'Dil kemiği', la: 'os hyoideum', desc: 'Başka hiçbir kemikle eklem yapmayan U şeklinde kemik; dil ve gırtlak kaslarına tutunma yeri sağlar.' });
  });
  for (let i = 0; i < 24; i++) {
    const nm = VERT_NAMES[i];
    T(`Omur ${nm}`, () => {
      const region = i < 7 ? 'Boyun omuru' : i < 19 ? 'Göğüs omuru' : 'Bel omuru';
      const special = i === 0 ? ' (atlas)' : i === 1 ? ' (axis)' : i === 6 ? ' (vertebra prominens)' : '';
      const desc = i === 0 ? 'Kafatasını taşıyan halka şeklindeki ilk boyun omuru; gövdesi yoktur. "Evet" baş hareketi bu eklemde olur.'
        : i === 1 ? 'Dens (diş çıkıntısı) atlasın içine uzanır; başın sağa-sola dönme ("hayır") hareketi bu eksen etrafında gerçekleşir.'
          : i < 7 ? 'Boyun omurlarının enine çıkıntılarında omurga atardamarının geçtiği delikler (foramen transversarium) bulunur.'
            : i < 19 ? 'Göğüs omurları kaburgalarla eklem yapar; dikensi çıkıntıları uzun ve aşağı doğru eğiktir.'
              : 'Bel omurları vücut ağırlığını taşıdığı için en büyük gövdeli omurlardır.';
      sk(boneMesh(vertebraSDF(i), i < 7 ? 0.001 : i < 19 ? 0.0012 : 0.0014), 'bone', { id: 'v' + nm, tr: `${region} ${nm}${special}`, la: `vertebra ${i < 7 ? 'cervicalis' : i < 19 ? 'thoracica' : 'lumbalis'} ${nm}`, desc, group: 'Omurga' });
    });
  }
  T('Omurlar arası diskler', () => {
    const geos = [];
    for (let i = 1; i < 23; i++) geos.push(meshSDF(discSDF(i), 0.0015, { ao: 0.003, aoMin: 0.6 }));
    sk(mergeGeos(geos), 'disc', { id: 'discs', tr: 'Omurlar arası diskler', la: 'disci intervertebrales', desc: 'Dışta lifli halka (anulus fibrosus), içte jelimsi çekirdekten (nucleus pulposus) oluşan amortisörler. Omurganın esnekliğini sağlar; fıtıklaşınca sinir köküne bası yapabilir.' });
  });
  T('Sağrı ve kuyruk sokumu', () => {
    sk(boneMesh(sacrumSDF(), 0.0014), 'bone', { id: 'sacrum', tr: 'Sağrı kemiği', la: 'os sacrum', desc: '5 omurun kaynaşmasıyla oluşan üçgen kemik. Kalça kemikleriyle sakroiliak eklemi yaparak leğen kemeri halkasını tamamlar.' });
    sk(boneMesh(coccyxSDF(), 0.001), 'bone', { id: 'coccyx', tr: 'Kuyruk sokumu kemiği', la: 'os coccygis', desc: '3-5 küçük omurun kaynaşmasından oluşan körelmiş kuyruk.' });
  });
  T('Kaburgalar', () => {
    const ribs = ribPaths();
    for (const rib of ribs) {
      const kind = rib.r <= 7 ? 'gerçek kaburga' : rib.r <= 10 ? 'yalancı kaburga' : 'serbest (yüzen) kaburga';
      pair(ribGeometry(rib), 'bone', { id: 'rib' + rib.r, tr: `${rib.r}. kaburga`, la: `costa ${['prima', 'secunda', 'tertia', 'quarta', 'quinta', 'sexta', 'septima', 'octava', 'nona', 'decima', 'undecima', 'duodecima'][rib.r - 1]}`, desc: `${rib.r}. kaburga bir ${kind}dır. ${rib.r <= 7 ? 'Kendi kıkırdağıyla doğrudan göğüs kemiğine bağlanır.' : rib.r <= 10 ? 'Kıkırdağı üstteki kaburganın kıkırdağına katılır.' : 'Ön ucu serbesttir; göğüs kemiğine bağlanmaz.'}`, group: 'Göğüs kafesi' });
    }
    pair(mergeGeos(ribs.map(cartilageGeometry)), 'cartilage', { id: 'costalCart', tr: 'Kaburga kıkırdakları', la: 'cartilagines costales', desc: 'Hiyalin kıkırdaktan yapılmış bu bağlantılar göğüs kafesine esneklik kazandırır ve solunumda genişlemesine izin verir.', group: 'Göğüs kafesi' });
    sk(boneMesh(sternumSDF(), 0.0013), 'bone', { id: 'sternum', tr: 'Göğüs kemiği', la: 'sternum', desc: 'Sap (manubrium), gövde (corpus) ve kılıç çıkıntısından (processus xiphoideus) oluşan yassı kemik. Kırmızı kemik iliği içerir.', group: 'Göğüs kafesi' });
  });
  T('Omuz kemeri', () => {
    pair(boneMesh(clavicleSDF(), 0.0014), 'bone', { id: 'clavicle', tr: 'Köprücük kemiği', la: 'clavicula', desc: 'Kolu gövdeye bağlayan tek kemik bağlantısı; S şeklindedir ve en sık kırılan kemiklerdendir.', group: 'Omuz kemeri' });
    pair(boneMesh(scapulaSDF(), 0.0013), 'bone', { id: 'scapula', tr: 'Kürek kemiği', la: 'scapula', desc: 'Üçgen yassı kemik; eklem çukuru (cavitas glenoidalis) pazı kemiğinin başıyla omuz eklemini yapar. Spina, akromiyon ve korakoid çıkıntısı kaslara tutunma yeridir.', group: 'Omuz kemeri' });
  });
  T('Kol kemikleri', () => {
    pair(boneMesh(humerusSDF(), 0.0019), 'bone', { id: 'humerus', tr: 'Pazı kemiği', la: 'humerus', desc: 'Üst kolun uzun kemiği. Başı kürek kemiğiyle omuz eklemini, alt ucu radius ve ulna ile dirsek eklemini yapar.', group: 'Üst ekstremite' });
    pair(boneMesh(ulnaSDF(), 0.0014), 'bone', { id: 'ulna', tr: 'Dirsek kemiği', la: 'ulna', desc: 'Önkolun iç (serçe parmak) tarafındaki kemik. Olekranon çıkıntısı dirseğin sivri ucunu oluşturur.', group: 'Üst ekstremite' });
    pair(boneMesh(radiusSDF(), 0.0014), 'bone', { id: 'radius', tr: 'Önkol dış kemiği', la: 'radius', desc: 'Önkolun başparmak tarafındaki kemik; ulna etrafında dönerek elin içe-dışa dönmesini (pronasyon/supinasyon) sağlar.', group: 'Üst ekstremite' });
  });
  T('El kemikleri', () => {
    for (const c of carpalDefs()) pair(boneMesh(boneTex(c.shape, 0.00015, 1500), 0.0009), 'bone', { id: 'carp_' + c.la, tr: c.nm, la: c.la, desc: 'El bileği (karpal) kemiklerinden biri. 8 karpal kemik iki sıra halinde dizilir ve bileğin esnek hareketini sağlar.', group: 'El' });
    const names = { I: 'Başparmak', II: 'İşaret parmağı', III: 'Orta parmak', IV: 'Yüzük parmağı', V: 'Serçe parmak' };
    const all = [HAND.thumb, ...HAND.fingers];
    for (const f of all) {
      const isT = f.name === 'I';
      const rB = isT ? 0.0062 : f.name === 'V' ? 0.0045 : 0.0052, rS = isT ? 0.0042 : f.name === 'V' ? 0.0029 : 0.0034, rH = isT ? 0.0058 : f.name === 'V' ? 0.0045 : 0.0052;
      pair(boneMesh(metacarpalSDF(f.base, f.mcp, rB, rS, rH), 0.0009), 'bone', { id: 'mc' + f.name, tr: `${f.name}. el tarak kemiği`, la: `os metacarpi ${f.name}`, desc: 'Avuç içinin iskeletini oluşturan beş tarak kemiğinden biri.', group: 'El' });
      const joints = isT ? [f.mcp, f.ip, f.tip] : [f.mcp, f.pip, f.dip, f.tip];
      const segNames = isT ? ['proksimal', 'distal'] : ['proksimal', 'orta', 'distal'];
      for (let k = 0; k < joints.length - 1; k++) {
        const distal = k === joints.length - 2;
        const s = (isT ? 1.15 : f.name === 'V' ? 0.82 : 1) * (k === 0 ? 1 : k === 1 && !distal ? 0.86 : 0.76);
        pair(boneMesh(phalanxSDF(joints[k], joints[k + 1], 0.0049 * s, 0.0041 * s, distal), 0.0008), 'bone', { id: `ph_${f.name}_${k}`, tr: `${names[f.name]} ${segNames[k]} falanksı`, la: `phalanx ${segNames[k] === 'orta' ? 'media' : segNames[k] === 'proksimal' ? 'proximalis' : 'distalis'} digiti ${f.name}`, desc: 'Parmak kemiği (falanks). Başparmakta 2, diğer parmaklarda 3 falanks bulunur; elde toplam 14.', group: 'El' });
      }
    }
  });
  T('Leğen kemeri', () => {
    pair(boneMesh(hipBoneSDF(), 0.0015), 'bone', { id: 'hipbone', tr: 'Kalça kemiği', la: 'os coxae', desc: 'İlium, iskium ve pubis kemiklerinin asetabulumda kaynaşmasıyla oluşur. Asetabulum uyluk kemiğinin başıyla kalça eklemini yapar.', group: 'Leğen' });
  });
  T('Bacak kemikleri', () => {
    pair(boneMesh(femurSDF(), 0.0021), 'bone', { id: 'femur', tr: 'Uyluk kemiği', la: 'femur', desc: 'İnsan vücudunun en uzun ve en güçlü kemiği. Boyun kısmı kalça kırıklarının en sık görüldüğü yerdir.', group: 'Alt ekstremite' });
    pair(boneMesh(patellaSDF(), 0.0012), 'bone', { id: 'patella', tr: 'Diz kapağı kemiği', la: 'patella', desc: 'Vücudun en büyük sesamoid kemiği; kuadriseps tendonunun içinde gelişir ve diz eklemini korur.', group: 'Alt ekstremite' });
    pair(boneMesh(tibiaSDF(), 0.002), 'bone', { id: 'tibia', tr: 'Kaval kemiği', la: 'tibia', desc: 'Bacağın ağırlık taşıyan ana kemiği. Ön kenarı (kaval) deri altında hissedilir; alt ucu iç topuğu (medial malleol) oluşturur.', group: 'Alt ekstremite' });
    pair(boneMesh(fibulaSDF(), 0.0015), 'bone', { id: 'fibula', tr: 'Baldır kemiği', la: 'fibula', desc: 'Tibianın dışında yer alan ince kemik; ağırlık taşımaz ama kas tutunması ve dış topuk (lateral malleol) ile ayak bileği stabilitesi sağlar.', group: 'Alt ekstremite' });
  });
  T('Ayak kemikleri', () => {
    for (const t of tarsalDefs()) pair(boneMesh(boneTex(t.shape, 0.0002, 1000), 0.0011), 'bone', { id: 'tar_' + t.la, tr: t.nm, la: t.la, desc: 'Ayak bileği (tarsal) kemiklerinden biri. Ayakta 7 tarsal kemik vardır; topuk kemiği en büyüğüdür.', group: 'Ayak' });
    for (const t of FOOT.toes) {
      pair(boneMesh(metacarpalSDF(t.base, t.head, t.sr * 1.35, t.sr, t.hr), 0.001), 'bone', { id: 'mt' + t.name, tr: `${t.name}. ayak tarak kemiği`, la: `os metatarsi ${t.name}`, desc: 'Ayak tarağını oluşturan beş metatarsal kemikten biri; ayak kemerlerinin yapısına katılır.', group: 'Ayak' });
      const segNames = t.name === 'I' ? ['proksimal', 'distal'] : ['proksimal', 'orta', 'distal'];
      for (let k = 0; k < t.joints.length - 1; k++) {
        const distal = k === t.joints.length - 2; const s = t.name === 'I' ? 1.35 : 1;
        const rr = (k === 0 ? 0.0042 : k === 1 && !distal ? 0.0034 : 0.003) * s;
        pair(boneMesh(phalanxSDF(t.joints[k], t.joints[k + 1], rr, rr * 0.85, distal), 0.0009), 'bone', { id: `tph_${t.name}_${k}`, tr: `${t.name}. ayak parmağı ${segNames[k]} falanksı`, la: `phalanx digiti pedis ${t.name}`, desc: 'Ayak parmağı kemiği. Başparmakta 2, diğer parmaklarda 3 falanks bulunur.', group: 'Ayak' });
      }
    }
  });
}
