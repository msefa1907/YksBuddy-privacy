// ===================== Muscular system =====================
// A muscle is a thick sheet: a grid of fibre lines from an origin polyline to an insertion
// polyline (or along a centre path for straps), snapped to the body envelope at a given
// depth, then given a belly profile, tendon ends and a fibre texture running along v.
const MUSCLE_RED = lin(0x9b2a22), MUSCLE_DARK = lin(0x6e1914), TENDON = lin(0xe6dfd0);

function polyAt(pts, t) { return pts.length === 1 ? pts[0] : mixAlong(pts, clamp(t, 0, 1)); }
function catmull(pts, t) {
  if (pts.length === 1) return pts[0];
  if (pts.length === 2) return mix3(pts[0], pts[1], t);
  const n = pts.length - 1; const x = clamp(t, 0, 1) * n; const i = Math.min(Math.floor(x), n - 1); const f = x - i;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n)];
  const t2 = f * f, t3 = t2 * f;
  return [0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
}

function muscleGeo(def) {
  const nu = def.nu || (def.path ? 6 : 12), nv = def.nv || 26;
  const f = bodySDF().f;
  const depth = def.depth ?? 0.003;
  const G = []; // G[j][i]
  for (let j = 0; j <= nv; j++) {
    const v = j / nv; const row = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu; let p;
      if (def.P) p = def.P(u, v);
      else if (def.path) p = catmull(def.path, v);
      else {
        const o = polyAt(def.o, u), q = polyAt(def.i, u);
        if (def.via) {
          const m = polyAt(def.via, u); const c = [2 * m[0] - (o[0] + q[0]) / 2, 2 * m[1] - (o[1] + q[1]) / 2, 2 * m[2] - (o[2] + q[2]) / 2];
          p = [0, 1, 2].map(k => (1 - v) * (1 - v) * o[k] + 2 * v * (1 - v) * c[k] + v * v * q[k]);
        } else p = mix3(o, q, v);
      }
      row.push(p);
    }
    G.push(row);
  }
  // strap: spread across the centre path using the local surface frame
  if (def.path) {
    for (let j = 0; j <= nv; j++) {
      const v = j / nv; const c = G[j][0];
      const c2 = catmull(def.path, Math.min(v + 0.01, 1)), c1 = catmull(def.path, Math.max(v - 0.01, 0));
      const tan = norm3(sub3(c2, c1)); const nrm = def.noProject ? (def.up || [0, 0, 1]) : sdfGrad(f, c[0], c[1], c[2], 0.003);
      const side = norm3(cross3(tan, nrm));
      const w = (typeof def.w === 'function' ? def.w(v) : def.w || 0.02) * (def.wProfile ? def.wProfile(v) : (0.55 + 0.45 * Math.pow(Math.sin(Math.PI * v), 0.7)));
      for (let i = 0; i <= nu; i++) G[j][i] = add3(c, mul3(side, (i / nu - 0.5) * w));
    }
  } else if (def.belly && def.belly !== 1) {
    for (let j = 0; j <= nv; j++) {
      const v = j / nv; const c = [0, 0, 0];
      for (const p of G[j]) { c[0] += p[0] / (nu + 1); c[1] += p[1] / (nu + 1); c[2] += p[2] / (nu + 1); }
      const s = 1 + (def.belly - 1) * Math.pow(Math.sin(Math.PI * v), 0.8);
      for (let i = 0; i <= nu; i++) G[j][i] = add3(c, mul3(sub3(G[j][i], c), s));
    }
  }
  // conform to the envelope, smooth, conform again
  const N = G.map(r => r.map(() => [0, 0, 1]));
  const project = (iters) => {
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      if (!def.noProject) G[j][i] = projectTo(f, G[j][i], -depth, iters, 0.003);
      N[j][i] = def.noProject ? null : sdfGrad(f, G[j][i][0], G[j][i][1], G[j][i][2], 0.003);
    }
  };
  if (!def.noProject) {
    project(5);
    for (let it = 0; it < 2; it++) {
      const H = G.map(r => r.map(p => p.slice()));
      for (let j = 1; j < nv; j++) for (let i = 1; i < nu; i++) {
        const a = G[j - 1][i], b = G[j + 1][i], c = G[j][i - 1], d = G[j][i + 1];
        H[j][i] = mix3(G[j][i], [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4], 0.5);
      }
      for (let j = 0; j <= nv; j++) G[j] = H[j];
    }
    project(2);
  } else {
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const pu = sub3(G[j][Math.min(i + 1, nu)], G[j][Math.max(i - 1, 0)]), pv = sub3(G[Math.min(j + 1, nv)][i], G[Math.max(j - 1, 0)][i]);
      let n = norm3(cross3(pu, pv)); if (def.outward && dot3(n, sub3(G[j][i], def.outward)) < 0) n = mul3(n, -1);
      N[j][i] = n;
    }
  }
  // thickness & colour profiles
  const [t0, t1] = def.tend || [0.06, 0.1];
  const bands = def.bands || [];
  const prof = (u, v) => {
    const across = Math.pow(Math.max(Math.sin(Math.PI * u), 0), def.edge ?? 0.5);
    let along;
    if (def.tendon) along = 0.35;
    else if (v < t0 || v > 1 - t1) along = 0.16;
    else { const s = (v - t0) / Math.max(1 - t0 - t1, 1e-3); along = 0.16 + 0.84 * Math.pow(Math.sin(Math.PI * s), def.bellyPow ?? 0.55); }
    for (const b of bands) along *= 1 - 0.45 * Math.exp(-(((v - b) / 0.018) ** 2));
    return across * along;
  };
  const col = (u, v) => {
    if (def.tendon) return TENDON;
    let tk = Math.max(smoothstep(t0 + 0.03, t0 - 0.01, v), smoothstep(1 - t1 - 0.03, 1 - t1 + 0.01, v));
    for (const b of bands) tk = Math.max(tk, Math.exp(-(((v - b) / 0.012) ** 2)));
    const edge = 1 - Math.pow(Math.max(Math.sin(Math.PI * u), 0), 0.3);
    return mixc(mixc(MUSCLE_RED, MUSCLE_DARK, edge * 0.6), TENDON, tk);
  };
  const th = def.th || 0.01;
  const pos = [], uv = [], cl = [], idx = [];
  // arc lengths for UVs
  const au = G.map(r => { const a = [0]; for (let i = 1; i <= nu; i++) a.push(a[i - 1] + len3(sub3(r[i], r[i - 1]))); return a; });
  const av = []; for (let i = 0; i <= nu; i++) { const a = [0]; for (let j = 1; j <= nv; j++) a.push(a[j - 1] + len3(sub3(G[j][i], G[j - 1][i]))); av.push(a); }
  const S = 32;
  for (const side of [1, -1]) {
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv; const t = th * prof(u, v);
      const p = add3(G[j][i], mul3(N[j][i], side > 0 ? t * 0.4 : -t * 0.6));
      pos.push(...p); uv.push(au[j][i] * S, av[i][j] * S); cl.push(...col(u, v));
    }
  }
  const W = nu + 1, off = (nv + 1) * W;
  const mid = [Math.floor(nv / 2), Math.floor(nu / 2)];
  const pu = sub3(G[mid[0]][mid[1] + 1], G[mid[0]][mid[1] - 1]), pv = sub3(G[mid[0] + 1][mid[1]], G[mid[0] - 1][mid[1]]);
  const flip = dot3(cross3(pu, pv), N[mid[0]][mid[1]]) < 0;
  const quad = (a, b, c, d, f2) => { if (f2) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
    quad(a, b, c, d, flip); quad(a + off, b + off, c + off, d + off, !flip);
  }
  for (let i = 0; i < nu; i++) { // end caps (origin & insertion)
    quad(i, i + off, i + 1 + off, i + 1, flip);
    const a = nv * W + i; quad(a, a + 1, a + 1 + off, a + off, flip);
  }
  for (let j = 0; j < nv; j++) { // side seams (zero thickness, close the shell)
    const a = j * W, d = a + W; quad(a, d, d + off, a + off, flip);
    const b = j * W + nu, c = b + W; quad(b, b + off, c + off, c, flip);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}

// handy placement helpers (left side)
const armP = (t, ang, r = 0.06) => { // along humerus; ang 0 anterior, 90 lateral, 180 posterior, 270 medial
  const c = mix3(LM.humHead, LM.elbow, t); const ax = norm3(sub3(LM.elbow, LM.humHead));
  const fw = norm3(sub3([0, 0, 1], mul3(ax, ax[2]))); const lat = cross3(fw, ax).map(v => -v);
  const a = ang * Math.PI / 180; return add3(c, add3(mul3(fw, Math.cos(a) * r), mul3(lat, Math.sin(a) * r)));
};
const foreP = (t, ang, r = 0.05) => {
  const c = mix3(LM.elbow, LM.wrist, t); const ax = norm3(sub3(LM.wrist, LM.elbow));
  const fw = norm3(sub3([0, 0, 1], mul3(ax, ax[2]))); const lat = cross3(fw, ax).map(v => -v);
  const a = ang * Math.PI / 180; return add3(c, add3(mul3(fw, Math.cos(a) * r), mul3(lat, Math.sin(a) * r)));
};
const THIGH0 = [0.1, 0.87, 0.0], THIGH1 = [0.09, 0.5, 0.006];
const thighP = (t, ang, r = 0.11) => {
  const c = mix3(THIGH0, THIGH1, t); const ax = norm3(sub3(THIGH1, THIGH0));
  const fw = norm3(sub3([0, 0, 1], mul3(ax, ax[2]))); const lat = cross3(fw, ax).map(v => -v);
  const a = ang * Math.PI / 180; return add3(c, add3(mul3(fw, Math.cos(a) * r), mul3(lat, Math.sin(a) * r)));
};
const LEG0 = [0.09, 0.48, -0.004], LEG1 = [0.088, 0.08, -0.004];
const legP = (t, ang, r = 0.07) => {
  const c = mix3(LEG0, LEG1, t); const ax = norm3(sub3(LEG1, LEG0));
  const fw = [0, 0, 1]; const lat = [1, 0, 0];
  const a = ang * Math.PI / 180; return add3(c, add3(mul3(fw, Math.cos(a) * r), mul3(lat, Math.sin(a) * r)));
};
const trunkP = (y, ang, r = 0.25, zc = -0.005) => { const a = ang * Math.PI / 180; return [Math.sin(a) * r, y, zc + Math.cos(a) * r]; };
const ring = (c, R, nrm, ax0) => (u, v) => { // u radial (inner->outer), v around
  const [e1, e2] = frameFrom(nrm, ax0 || [1, 0, 0]);
  const a = v * TAU; const r = lerp(R[0], R[1], u);
  return add3(c, add3(mul3(e1, Math.cos(a) * r * (R[2] || 1)), mul3(e2, Math.sin(a) * r)));
};

const MUSCLES = () => [
  // ---------- head & neck ----------
  { g: 'Baş', id: 'temporalis', tr: 'Şakak kası', la: 'm. temporalis', o: [[0.066, 1.672, 0.055], [0.078, 1.695, 0.012], [0.077, 1.69, -0.035], [0.068, 1.662, -0.07]], i: [[0.05, 1.605, 0.016], [0.052, 1.604, 0.006]], depth: 0.0035, th: 0.007, tend: [0.02, 0.25], nu: 12, desc: 'Yelpaze şeklindeki çiğneme kası; alt çeneyi yukarı kaldırır ve geri çeker.' },
  { g: 'Baş', id: 'masseter', tr: 'Çiğneme kası', la: 'm. masseter', o: [[0.058, 1.609, 0.038], [0.066, 1.611, 0.0]], i: [[0.052, 1.55, 0.024], [0.05, 1.548, -0.008]], depth: 0.003, th: 0.009, belly: 1.15, tend: [0.12, 0.06], desc: 'Vücuttaki en güçlü kaslardan biri; dişleri sıkarken yanaktaki sertlik bu kastır. Alt çeneyi yukarı kaldırır.' },
  { g: 'Baş', id: 'frontalis', tr: 'Alın kası', la: 'venter frontalis m. occipitofrontalis', o: [[0.002, 1.73, 0.055], [0.04, 1.725, 0.042], [0.06, 1.71, 0.025]], i: [[0.003, 1.664, 0.088], [0.03, 1.662, 0.085], [0.054, 1.655, 0.067]], depth: 0.0025, th: 0.0025, tend: [0.25, 0.02], edge: 0.3, desc: 'Kaşları kaldırır ve alında yatay kırışıklıklar oluşturur.' },
  { g: 'Baş', id: 'orbOculi', tr: 'Göz çevresi halka kası', la: 'm. orbicularis oculi', P: ring([0.0335, 1.636, 0.085], [0.0125, 0.024, 1.15], [0, 0.1, 1]), nu: 6, nv: 30, depth: 0.0018, th: 0.0025, tend: [0, 0], edge: 0.4, desc: 'Göz kapaklarını kapatır; göz kırpma ve sıkıca kapama hareketini sağlar.' },
  { g: 'Baş', id: 'zygomaticus', tr: 'Büyük elmacık kası', la: 'm. zygomaticus major', path: [[0.054, 1.612, 0.058], [0.04, 1.585, 0.077], [0.025, 1.561, 0.09]], w: 0.008, nu: 4, nv: 14, depth: 0.0028, th: 0.0035, tend: [0.05, 0.05], desc: 'Ağız köşesini yukarı ve dışa çeker: gülümseme kası.' },
  { g: 'Baş', id: 'sternocleido', tr: 'Göğüs-köprücük-meme kası', la: 'm. sternocleidomastoideus', o: [[0.056, 1.6, -0.022], [0.048, 1.596, -0.036]], i: [[0.01, 1.432, 0.07], [0.045, 1.437, 0.062]], depth: 0.0022, th: 0.012, belly: 1.25, tend: [0.08, 0.1], desc: 'Boynun yan yüzünde belirgin şerit; başı karşı tarafa döndürür ve öne eğer. Boynun ön ve arka üçgenlerini ayıran önemli bir işarettir.' },
  { g: 'Sırt', id: 'trapezius', tr: 'Trapez kası', la: 'm. trapezius', o: [[0, 1.63, -0.098], [0, 1.56, -0.07], [0, 1.47, -0.078], [0, 1.36, -0.125], [0, 1.23, -0.125], [0, 1.13, -0.108]], i: [[0.13, 1.468, 0.016], [0.172, 1.462, -0.016], [0.16, 1.45, -0.05], [0.12, 1.43, -0.085], [0.075, 1.405, -0.105]], via: [[0.04, 1.56, -0.05], [0.09, 1.5, -0.055], [0.1, 1.44, -0.095], [0.06, 1.37, -0.125], [0.04, 1.27, -0.124]], nu: 18, nv: 26, depth: 0.003, th: 0.008, tend: [0.08, 0.05], desc: 'Sırtın üst kısmındaki elmas biçimli yüzeyel kas. Kürek kemiğini yukarı kaldırır (omuz silkme), içe çeker ve döndürür; başı arkaya eğer.' },
  // ---------- trunk ----------
  { g: 'Göğüs', id: 'pectoralis', tr: 'Büyük göğüs kası', la: 'm. pectoralis major', o: [[0.085, 1.444, 0.05], [0.04, 1.434, 0.068], [0.016, 1.405, 0.09], [0.014, 1.33, 0.1], [0.02, 1.27, 0.105], [0.05, 1.236, 0.104], [0.085, 1.245, 0.095]], i: [[0.2, 1.392, 0.016], [0.206, 1.36, 0.012]], via: [[0.15, 1.43, 0.06], [0.13, 1.41, 0.08], [0.12, 1.38, 0.09], [0.12, 1.34, 0.095], [0.13, 1.31, 0.09], [0.15, 1.3, 0.075], [0.17, 1.31, 0.05]], nu: 18, nv: 24, depth: 0.0035, th: 0.012, tend: [0.03, 0.14], desc: 'Göğsün ön yüzündeki yelpaze biçimli kas; kolu öne ve içe getirir, içe döndürür. Şınav ve itme hareketlerinin ana kasıdır.' },
  { g: 'Göğüs', id: 'pectoralisMinor', tr: 'Küçük göğüs kası', la: 'm. pectoralis minor', o: [[0.07, 1.385, 0.085], [0.085, 1.33, 0.09], [0.1, 1.28, 0.083]], i: [[0.138, 1.408, 0.036]], depth: 0.018, th: 0.006, tend: [0.05, 0.15], desc: 'Büyük göğüs kasının altında; kürek kemiğinin korakoid çıkıntısını öne-aşağı çeker.' },
  { g: 'Göğüs', id: 'serratus', tr: 'Ön dişli kas', la: 'm. serratus anterior', o: [[0.118, 1.33, 0.07], [0.135, 1.285, 0.062], [0.146, 1.24, 0.048], [0.15, 1.2, 0.032], [0.148, 1.165, 0.015]], i: [[0.128, 1.38, -0.05], [0.13, 1.33, -0.06], [0.125, 1.3, -0.07], [0.115, 1.28, -0.075], [0.1, 1.27, -0.08]], via: [[0.15, 1.34, 0.02], [0.16, 1.3, 0.005], [0.165, 1.26, -0.01], [0.16, 1.23, -0.02], [0.155, 1.2, -0.03]], nu: 15, nv: 18, depth: 0.004, th: 0.007, tend: [0.03, 0.05], digit: 5, desc: 'Göğüs yan duvarında testere dişi gibi parmaksı uzantılarla kaburgalara tutunur; kürek kemiğini göğüs kafesine bastırır ve öne çeker ("boksör kası").' },
  { g: 'Karın', id: 'rectusAbd', tr: 'Düz karın kası', la: 'm. rectus abdominis', o: [[0.005, 0.888, 0.074], [0.03, 0.89, 0.072]], i: [[0.006, 1.226, 0.104], [0.075, 1.25, 0.096]], belly: 1.25, depth: 0.0028, th: 0.011, tend: [0.07, 0.03], bands: [0.5, 0.68, 0.84], nu: 8, nv: 30, edge: 0.35, desc: 'Karın ön duvarında dikey uzanan kas; kiriş bölmeleri (intersectio tendinea) ile "altı kas" görünümü verir. Gövdeyi öne büker ve karın içi basıncını artırır.' },
  { g: 'Karın', id: 'extOblique', tr: 'Dış eğik karın kası', la: 'm. obliquus externus abdominis', o: [[0.12, 1.28, 0.07], [0.142, 1.21, 0.045], [0.152, 1.14, 0.018], [0.145, 1.08, -0.02], [0.135, 1.05, -0.045]], i: [[0.07, 1.21, 0.1], [0.075, 1.12, 0.105], [0.078, 1.0, 0.1], [0.11, 0.96, 0.07], [0.138, 1.01, 0.02]], nu: 14, nv: 18, depth: 0.0035, th: 0.008, tend: [0.04, 0.2], desc: 'Karnın en dıştaki yan kası; lifleri "eller cepte" yönünde aşağı-içe uzanır. Gövdeyi büker ve karşı tarafa döndürür.' },
  { g: 'Sırt', id: 'latissimus', tr: 'Geniş sırt kası', la: 'm. latissimus dorsi', o: [[0, 1.3, -0.124], [0, 1.18, -0.118], [0, 1.06, -0.1], [0.04, 1.0, -0.095], [0.1, 1.02, -0.07], [0.13, 1.04, -0.04]], i: [[0.195, 1.362, 0.004], [0.196, 1.345, 0.0]], via: [[0.09, 1.29, -0.118], [0.12, 1.21, -0.108], [0.14, 1.16, -0.09], [0.155, 1.14, -0.07], [0.165, 1.15, -0.05], [0.17, 1.16, -0.035]], nu: 18, nv: 26, depth: 0.003, th: 0.009, tend: [0.16, 0.1], desc: 'Vücudun en geniş kası. Kolu arkaya ve içe çeker, içe döndürür; barfiks ve kürek çekme hareketlerinin ana kasıdır.' },
  { g: 'Sırt', id: 'infraspinatus', tr: 'Diken altı kası', la: 'm. infraspinatus', o: [cylPt(0.068, 1.39, -0.01), cylPt(0.072, 1.33, -0.01), cylPt(0.082, 1.29, -0.01)], i: [[0.206, 1.402, -0.03], [0.203, 1.395, -0.034]], depth: 0.008, th: 0.012, nu: 10, tend: [0.04, 0.15], desc: 'Rotator manşet kaslarından; kolu dışa döndürür ve omuz eklemini sabitler.' },
  { g: 'Sırt', id: 'teresMajor', tr: 'Büyük yuvarlak kas', la: 'm. teres major', o: [[0.09, 1.285, -0.088], [0.1, 1.29, -0.085]], i: [[0.19, 1.35, -0.008], [0.192, 1.335, -0.01]], via: [[0.14, 1.31, -0.075], [0.145, 1.31, -0.07]], depth: 0.005, th: 0.013, belly: 1.4, nu: 8, tend: [0.04, 0.15], desc: 'Kolu içe döndürür ve arkaya çeker; arka koltuk altı kıvrımını oluşturur.' },
  { g: 'Sırt', id: 'rhomboid', tr: 'Eşkenar dörtgen kaslar', la: 'mm. rhomboidei', o: [[0, 1.46, -0.098], [0, 1.37, -0.12]], i: [[0.068, 1.43, -0.098], [0.075, 1.29, -0.095]], depth: 0.012, th: 0.006, nu: 10, tend: [0.05, 0.03], desc: 'Trapezin altında; kürek kemiklerini omurgaya doğru çeker.' },
  { g: 'Sırt', id: 'erector', tr: 'Omurga dikleştirici kas', la: 'm. erector spinae', o: [[0.012, 0.95, -0.105], [0.05, 0.975, -0.095]], i: [[0.015, 1.47, -0.08], [0.05, 1.37, -0.115]], via: [[0.014, 1.15, -0.112], [0.058, 1.15, -0.105]], depth: 0.012, th: 0.03, belly: 1.15, nu: 8, nv: 32, tend: [0.08, 0.05], desc: 'Omurganın iki yanında uzanan kas sütunları (iliocostalis, longissimus, spinalis). Gövdeyi dik tutar ve geriye büker.' },
  // ---------- shoulder & arm ----------
  { g: 'Omuz', id: 'deltoid', tr: 'Deltoid kas', la: 'm. deltoideus', o: [[0.125, 1.452, 0.04], [0.155, 1.458, 0.018], [0.18, 1.458, -0.015], [0.168, 1.448, -0.048], [0.13, 1.43, -0.072]], i: [[0.22, 1.282, -0.008], [0.22, 1.272, -0.02]], via: [[0.18, 1.4, 0.05], [0.212, 1.41, 0.02], [0.228, 1.4, -0.016], [0.214, 1.39, -0.055], [0.185, 1.38, -0.075]], nu: 16, nv: 22, depth: 0.003, th: 0.02, tend: [0.03, 0.12], desc: 'Omzun yuvarlak hatlarını veren üçgen kas. Kolu yana kaldırır (abdüksiyon); ön lifleri öne, arka lifleri arkaya hareket ettirir. Aşı yapılan kastır.' },
  { g: 'Kol', id: 'biceps', tr: 'Pazı kası', la: 'm. biceps brachii', o: [armP(0.08, -25), armP(0.06, 15)], i: [foreP(0.1, 20, 0.04), foreP(0.1, 30, 0.04)], via: [armP(0.55, -12), armP(0.55, 12)], belly: 1.9, nu: 10, nv: 26, depth: 0.0025, th: 0.024, tend: [0.16, 0.16], desc: 'Kolun ön yüzündeki iki başlı kas. Dirseği büker ve önkolu dışa döndürür (supinasyon) — vida sıkma hareketi.' },
  { g: 'Kol', id: 'brachialis', tr: 'Kol kası', la: 'm. brachialis', o: [armP(0.45, -40), armP(0.45, 40)], i: [foreP(0.12, 0, 0.04), foreP(0.12, 10, 0.04)], belly: 1.5, depth: 0.012, th: 0.016, tend: [0.05, 0.15], desc: 'Pazı kasının altında; dirseğin asıl bükücü kasıdır.' },
  { g: 'Kol', id: 'triceps', tr: 'Üç başlı kol kası', la: 'm. triceps brachii', o: [armP(0.08, 200), armP(0.1, 165)], i: [armP(0.97, 180), armP(0.97, 172)], via: [armP(0.5, 205), armP(0.5, 150)], belly: 1.5, nu: 12, nv: 26, depth: 0.0025, th: 0.024, tend: [0.05, 0.26], desc: 'Kolun arka yüzünü kaplayan üç başlı kas; dirseği açar (ekstansiyon). Pazı kasının antagonistidir.' },
  { g: 'Önkol', id: 'brachioradialis', tr: 'Kol-önkol kası', la: 'm. brachioradialis', path: [armP(0.7, 95, 0.05), armP(0.92, 70, 0.05), foreP(0.25, 70, 0.04), foreP(0.6, 80, 0.035), foreP(0.97, 85, 0.03)], w: 0.024, wProfile: (v) => 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * Math.min(v * 1.5, 1)), 0.7), nv: 24, depth: 0.0025, th: 0.012, tend: [0.04, 0.42], desc: 'Önkolun başparmak tarafındaki yüzeyel kas; önkol yarı-pronasyondayken dirseği büker.' },
  { g: 'Önkol', id: 'flexorGroup', tr: 'Önkol bükücü kasları', la: 'mm. flexores antebrachii superficiales', o: [foreP(0.0, 300, 0.05), foreP(0.03, 250, 0.05)], i: [H_(0.012, 0.016, 0.012), H_(0.014, -0.014, 0.012)], via: [foreP(0.45, 0, 0.05), foreP(0.45, 290, 0.05)], belly: 1.35, nu: 14, nv: 26, depth: 0.0025, th: 0.014, tend: [0.04, 0.42], desc: 'Medial epikondilden başlayan yüzeyel bükücüler: yuvarlak pronatör, radial ve ulnar el bileği bükücüleri, uzun avuç içi kası ve yüzeysel parmak bükücüsü. El bileğini ve parmakları büker.' },
  { g: 'Önkol', id: 'extensorGroup', tr: 'Önkol açıcı kasları', la: 'mm. extensores antebrachii', o: [foreP(0.0, 120, 0.05), foreP(0.03, 165, 0.05)], i: [H_(0.012, 0.016, -0.012), H_(0.014, -0.016, -0.011)], via: [foreP(0.45, 120, 0.05), foreP(0.45, 200, 0.05)], belly: 1.3, nu: 14, nv: 26, depth: 0.0025, th: 0.012, tend: [0.04, 0.4], desc: 'Lateral epikondilden başlayan açıcılar: radial ve ulnar el bileği açıcıları, parmak açıcı kası. Tenisçi dirseği bu kasların başlangıç tendonunun iltihabıdır.' },
  { g: 'El', id: 'thenar', tr: 'Tenar kaslar (başparmak tümseği)', la: 'eminentia thenaris', o: [H_(0.018, 0.006, 0.011), H_(0.02, 0.016, 0.011)], i: [add3(HAND.thumb.mcp, mul3(HAND.P, 0.006))], belly: 1.4, nu: 8, nv: 14, depth: 0.0035, th: 0.011, tend: [0.05, 0.12], desc: 'Başparmak kökündeki kas grubu; başparmağın karşı gelme (opozisyon) hareketini sağlar.' },
  { g: 'El', id: 'hypothenar', tr: 'Hipotenar kaslar', la: 'eminentia hypothenaris', o: [H_(0.018, -0.012, 0.011), H_(0.02, -0.02, 0.009)], i: [add3(HAND.fingers[3].mcp, mul3(HAND.P, 0.004))], belly: 1.3, nu: 6, nv: 14, depth: 0.0035, th: 0.008, tend: [0.05, 0.12], desc: 'Serçe parmak tarafındaki avuç tümseği; serçe parmağı hareket ettirir.' },
  // ---------- hip & thigh ----------
  { g: 'Kalça', id: 'gluteusMax', tr: 'Büyük kalça kası', la: 'm. gluteus maximus', o: [[0.075, 1.0, -0.098], [0.035, 0.96, -0.118], [0.012, 0.9, -0.125], [0.012, 0.855, -0.115]], i: [[0.158, 0.87, -0.03], [0.15, 0.82, -0.045], [0.13, 0.785, -0.055]], via: [[0.12, 0.96, -0.11], [0.1, 0.91, -0.135], [0.085, 0.86, -0.13], [0.075, 0.81, -0.11]], nu: 14, nv: 20, depth: 0.004, th: 0.03, tend: [0.04, 0.12], desc: 'Vücudun en büyük kası. Kalçayı açar (ekstansiyon) ve dışa döndürür; merdiven çıkma, koşma ve oturduğu yerden kalkmada güç verir.' },
  { g: 'Kalça', id: 'gluteusMed', tr: 'Orta kalça kası', la: 'm. gluteus medius', o: [[0.13, 1.005, 0.035], [0.137, 1.02, -0.005], [0.12, 1.02, -0.045], [0.09, 1.0, -0.07]], i: [[0.155, 0.91, 0.005], [0.155, 0.905, -0.012]], depth: 0.004, th: 0.018, nu: 12, tend: [0.04, 0.12], desc: 'Kalçayı yana açar; yürürken leğenin karşı tarafa düşmesini önler.' },
  { g: 'Kalça', id: 'tfl', tr: 'Geniş fasya gerici kas', la: 'm. tensor fasciae latae', o: [[0.122, 0.968, 0.064], [0.13, 0.975, 0.05]], i: [[0.158, 0.86, 0.02], [0.16, 0.86, 0.004]], belly: 1.2, depth: 0.003, th: 0.012, tend: [0.05, 0.1], desc: 'İliotibial bandı gererek diz ve kalçayı stabilize eder.' },
  { g: 'Uyluk', id: 'itBand', tr: 'İliotibial bant', la: 'tractus iliotibialis', path: [[0.158, 0.87, 0.01], [0.16, 0.75, 0.0], [0.15, 0.6, 0.0], [0.13, 0.48, 0.005]], w: 0.03, tendon: true, nv: 22, nu: 5, depth: 0.0022, th: 0.004, desc: 'Uyluğun dış yüzünde kalçadan kaval kemiğine uzanan kalın fasya şeridi.' },
  { g: 'Uyluk', id: 'sartorius', tr: 'Terzi kası', la: 'm. sartorius', path: [[0.12, 0.962, 0.066], [0.1, 0.86, 0.075], [0.075, 0.74, 0.06], [0.055, 0.62, 0.03], [0.05, 0.52, -0.005], [0.068, 0.44, 0.014]], w: 0.024, nv: 32, depth: 0.0025, th: 0.009, tend: [0.03, 0.08], desc: 'Vücudun en uzun kası. Uyluğu çapraz geçer; bağdaş kurma pozisyonunu sağlar (terzi oturuşu).' },
  { g: 'Uyluk', id: 'rectusFem', tr: 'Düz uyluk kası', la: 'm. rectus femoris', o: [thighP(0.06, 5), thighP(0.06, 20)], i: [[0.088, 0.552, 0.06], [0.095, 0.552, 0.06]], via: [thighP(0.5, 0), thighP(0.5, 20)], belly: 1.9, depth: 0.0025, th: 0.026, tend: [0.12, 0.12], desc: 'Kuadriseps grubunun ortadaki kası; hem kalça hem diz eklemini geçtiği için uyluğu büker ve dizi açar.' },
  { g: 'Uyluk', id: 'vastusLat', tr: 'Dış geniş kas', la: 'm. vastus lateralis', o: [thighP(0.08, 65), thighP(0.08, 110)], i: [[0.104, 0.555, 0.055], [0.116, 0.54, 0.04]], via: [thighP(0.5, 55), thighP(0.5, 115)], belly: 1.6, nu: 12, depth: 0.0025, th: 0.03, tend: [0.04, 0.1], desc: 'Kuadriseps grubunun en büyük kası; uyluğun dış yüzünü oluşturur ve dizi açar.' },
  { g: 'Uyluk', id: 'vastusMed', tr: 'İç geniş kas', la: 'm. vastus medialis', o: [thighP(0.35, 300), thighP(0.4, 330)], i: [[0.074, 0.548, 0.05], [0.083, 0.56, 0.056]], via: [thighP(0.75, 305), thighP(0.75, 340)], belly: 1.5, depth: 0.0025, th: 0.03, tend: [0.03, 0.08], bellyPow: 0.4, desc: 'Diz kapağının iç üstünde "gözyaşı damlası" görünümlü kas; patellanın içe doğru stabilizasyonunu sağlar.' },
  { g: 'Uyluk', id: 'adductorLong', tr: 'Uzun yaklaştırıcı kas', la: 'm. adductor longus', o: [[0.022, 0.885, 0.07], [0.03, 0.885, 0.068]], i: [thighP(0.55, 285), thighP(0.5, 300)], belly: 1.8, depth: 0.003, th: 0.015, tend: [0.08, 0.05], desc: 'Uyluğu gövdeye yaklaştırır (addüksiyon).' },
  { g: 'Uyluk', id: 'gracilis', tr: 'İnce kas', la: 'm. gracilis', path: [[0.016, 0.862, 0.058], [0.03, 0.76, 0.02], [0.042, 0.64, -0.004], [0.052, 0.52, -0.016], [0.066, 0.44, 0.006]], w: 0.022, nv: 28, depth: 0.0025, th: 0.007, tend: [0.04, 0.2], desc: 'Uyluğun en içteki yüzeyel kası; uyluğu yaklaştırır, dizi büker.' },
  { g: 'Uyluk', id: 'adductorMag', tr: 'Büyük yaklaştırıcı kas', la: 'm. adductor magnus', o: [[0.03, 0.85, -0.01], [0.055, 0.83, -0.045]], i: [thighP(0.85, 270), thighP(0.7, 220)], belly: 1.4, depth: 0.004, th: 0.02, tend: [0.03, 0.08], desc: 'Yaklaştırıcı grubun en büyüğü; uyluğun iç-arka bölümünü doldurur.' },
  { g: 'Uyluk', id: 'bicepsFem', tr: 'İki başlı uyluk kası', la: 'm. biceps femoris', o: [[0.065, 0.83, -0.075], [0.075, 0.825, -0.07]], i: [[0.124, 0.455, -0.022], [0.126, 0.46, -0.016]], via: [thighP(0.5, 165), thighP(0.5, 140)], belly: 1.7, depth: 0.0025, th: 0.022, tend: [0.08, 0.2], desc: 'Hamstring grubunun dış kası; dizi büker ve kalçayı açar.' },
  { g: 'Uyluk', id: 'semitend', tr: 'Yarı kirişli kas', la: 'm. semitendinosus', o: [[0.06, 0.828, -0.078], [0.064, 0.826, -0.074]], i: [[0.068, 0.442, -0.004], [0.07, 0.442, 0.0]], via: [thighP(0.5, 200), thighP(0.5, 185)], belly: 2.2, depth: 0.0025, th: 0.018, tend: [0.06, 0.38], desc: 'Hamstring grubunun iç kası; uzun kirişiyle kaval kemiğinin iç yüzüne (pes anserinus) tutunur.' },
  { g: 'Uyluk', id: 'semimemb', tr: 'Yarı zarlı kas', la: 'm. semimembranosus', o: [[0.056, 0.832, -0.064]], i: [[0.066, 0.47, -0.03], [0.072, 0.47, -0.032]], via: [thighP(0.6, 215), thighP(0.6, 200)], belly: 2.6, depth: 0.009, th: 0.018, tend: [0.25, 0.08], desc: 'Hamstring grubundan; yarı kirişli kasın altında yer alır.' },
  // ---------- leg ----------
  { g: 'Bacak', id: 'gastroMed', tr: 'Baldır kası (iç baş)', la: 'm. gastrocnemius, caput mediale', o: [[0.07, 0.515, -0.036], [0.08, 0.515, -0.04]], i: [[0.084, 0.26, -0.062], [0.09, 0.25, -0.062]], via: [legP(0.25, 220), legP(0.25, 195)], belly: 1.9, depth: 0.0025, th: 0.024, tend: [0.05, 0.12], bellyPow: 0.45, desc: 'Baldırın yüzeyel kası; ayak bileğini aşağı büker (parmak ucunda yükselme) ve dizi büker. Aşil tendonuyla topuğa tutunur.' },
  { g: 'Bacak', id: 'gastroLat', tr: 'Baldır kası (dış baş)', la: 'm. gastrocnemius, caput laterale', o: [[0.108, 0.515, -0.034], [0.115, 0.51, -0.03]], i: [[0.09, 0.28, -0.062], [0.096, 0.28, -0.06]], via: [legP(0.25, 150), legP(0.25, 170)], belly: 1.7, depth: 0.0025, th: 0.02, tend: [0.05, 0.12], bellyPow: 0.45 },
  { g: 'Bacak', id: 'soleus', tr: 'Dil balığı kası', la: 'm. soleus', o: [legP(0.12, 140, 0.06), legP(0.15, 230, 0.06)], i: [[0.085, 0.13, -0.044], [0.091, 0.13, -0.044]], via: [legP(0.55, 125), legP(0.55, 240)], belly: 1.4, depth: 0.007, th: 0.02, tend: [0.04, 0.15], desc: 'Baldır kasının altında yer alan yassı kas; ayakta dururken sürekli çalışır ve venöz dönüşe yardım eder ("ikinci kalp").' },
  { g: 'Bacak', id: 'achilles', tr: 'Aşil tendonu', la: 'tendo calcaneus', path: [[0.09, 0.26, -0.06], [0.089, 0.16, -0.052], [0.089, 0.08, -0.054], [0.089, 0.035, -0.068]], w: (v) => lerp(0.03, 0.014, Math.min(v * 1.6, 1)), wProfile: () => 1, tendon: true, nv: 18, nu: 5, depth: 0.003, th: 0.008, desc: 'Vücudun en kalın ve en güçlü tendonu; baldır kaslarını topuk kemiğine bağlar.' },
  { g: 'Bacak', id: 'tibialisAnt', tr: 'Ön kaval kası', la: 'm. tibialis anterior', path: [legP(0.08, 40), legP(0.35, 30), legP(0.6, 20), legP(0.88, 5), [0.08, 0.06, 0.04], F_(0.07, -0.018, -0.026)], w: 0.024, wProfile: (v) => v < 0.62 ? 0.6 + 0.4 * Math.sin(Math.PI * v / 0.62) : 0.35, nv: 28, depth: 0.0025, th: 0.016, tend: [0.03, 0.4], desc: 'Kaval kemiğinin dış yanında; ayağı yukarı kaldırır (dorsifleksiyon) ve içe çevirir.' },
  { g: 'Bacak', id: 'extDigLong', tr: 'Uzun parmak açıcı kas', la: 'm. extensor digitorum longus', path: [legP(0.06, 70), legP(0.4, 60), legP(0.7, 45), legP(0.9, 30), F_(0.04, 0.01, -0.005), F_(0.11, 0.012, -0.03)], w: 0.016, wProfile: (v) => v < 0.65 ? 0.6 + 0.4 * Math.sin(Math.PI * v / 0.65) : 0.5, nv: 26, depth: 0.003, th: 0.011, tend: [0.03, 0.38], desc: 'Ayak parmaklarını açar (yukarı kaldırır).' },
  { g: 'Bacak', id: 'fibularis', tr: 'Uzun fibular kas', la: 'm. fibularis longus', path: [legP(0.05, 100), legP(0.4, 95), legP(0.75, 105), [0.12, 0.08, -0.032], F_(-0.01, 0.03, -0.045)], w: 0.02, wProfile: (v) => v < 0.6 ? 0.6 + 0.4 * Math.sin(Math.PI * v / 0.6) : 0.4, nv: 24, depth: 0.003, th: 0.013, tend: [0.04, 0.42], desc: 'Bacağın dış yüzünde; ayağı dışa çevirir (eversiyon) ve ayak kemerini destekler.' },
];

function intercostalGeos() {
  const ribs = ribPaths(); const geos = [];
  for (let r = 0; r < 10; r++) {
    const A = ribs[r].pts.slice(1), B = ribs[r + 1].pts.slice(1);
    const def = {
      P: (u, v) => mix3(add3(mixAlong(A, u * 0.92), [0, -0.004, 0]), add3(mixAlong(B, u * (r < 6 ? 0.92 : 0.8)), [0, 0.004, 0]), v),
      noProject: true, outward: [0, 1.25, 0.0], nu: 16, nv: 3, th: 0.0028, tend: [0, 0], edge: 0.2,
    };
    geos.push(muscleGeo(def));
  }
  return mergeGeos(geos);
}

function tendonStraps() {
  // finger flexor (palmar) and extensor (dorsal) tendons
  const geos = [];
  for (const f of [HAND.thumb, ...HAND.fingers]) {
    const isT = f.name === 'I';
    const pal = [H_(0.0, isT ? 0.018 : 0.0, 0.011), H_(0.03, isT ? 0.022 : dot3(sub3(f.base, HAND.O), HAND.Lt), 0.009), add3(f.mcp, mul3(HAND.P, 0.0072)), add3(isT ? f.ip : f.pip, mul3(HAND.P, 0.0068)), add3(isT ? f.ip : f.dip, mul3(HAND.P, 0.0058))];
    const dor = [H_(-0.004, isT ? 0.022 : 0.0, -0.011), add3(f.base, mul3(HAND.P, -0.0072)), add3(f.mcp, mul3(HAND.P, -0.0075)), add3(isT ? f.ip : f.pip, mul3(HAND.P, -0.0068)), add3(f.tip, mul3(add3(HAND.P, mul3(HAND.D, 0.3)), -0.007))];
    geos.push(sweep(pal, { rx: () => 0.0018, ry: () => 0.0011, radial: 6, step: 0.004, color: () => TENDON }));
    geos.push(sweep(dor, { rx: () => 0.0016, ry: () => 0.0008, radial: 6, step: 0.004, color: () => TENDON }));
  }
  return mergeGeos(geos);
}

function psoasGeo() {
  const path = [[0.022, 1.13, -0.035], [0.035, 1.06, -0.03], [0.048, 0.99, -0.024], [0.062, 0.94, -0.006], [0.074, 0.9, 0.03], [0.09, 0.87, 0.03], [0.108, 0.846, -0.004]];
  return sweep(path, { r: (t) => 0.006 + 0.012 * Math.sin(Math.PI * Math.min(t * 1.15, 1)) ** 0.7, radial: 14, step: 0.004, color: (t) => t > 0.9 ? TENDON : MUSCLE_RED, uvScale: 32 });
}

function buildMuscles(T) {
  const defs = MUSCLES();
  const groups = {};
  for (const d of defs) (groups[d.g] ||= []).push(d);
  for (const [g, list] of Object.entries(groups)) {
    T(`Kaslar: ${g}`, () => {
      for (const d of list) {
        const geo = muscleGeo(d);
        addPair(geo, 'muscle', { layer: 'muscle', group: `Kaslar · ${g}`, id: d.id, tr: d.tr, la: d.la, desc: d.desc || 'İskelet kası.' });
      }
    });
  }
  T('Kaslar: derin ve kirişler', () => {
    addPair(intercostalGeos(), 'muscle', { layer: 'muscle', group: 'Kaslar · Göğüs', id: 'intercostals', tr: 'Kaburgalar arası kaslar', la: 'mm. intercostales', desc: 'Kaburgalar arasını dolduran kaslar. Dış kaburgalar arası kaslar soluk almada kaburgaları yukarı-dışa kaldırır; iç kaburgalar arası kaslar zorlu soluk vermede görev alır.' });
    addPair(tendonStraps(), 'muscle', { layer: 'muscle', group: 'Kaslar · El', id: 'handTendons', tr: 'Parmak kirişleri', la: 'tendines mm. flexorum et extensorum digitorum', desc: 'Önkol kaslarının parmaklara uzanan kirişleri; avuç yüzündekiler parmakları büker, sırt yüzündekiler açar. Tendon kılıfları içinde kayarak hareket ederler.', noShadow: true });
    addPair(psoasGeo(), 'muscle', { layer: 'muscle', group: 'Kaslar · Karın', id: 'psoas', tr: 'Büyük bel kası', la: 'm. psoas major', desc: 'Bel omurlarından başlayıp uyluk kemiğinin küçük trokanterine tutunur; uyluğu büken en güçlü kastır.' });
  });
}
