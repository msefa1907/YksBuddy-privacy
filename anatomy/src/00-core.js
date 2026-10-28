import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Everything in this atlas is generated procedurally at load time: bones and organs are
// signed distance fields (SDF) meshed with surface nets, vessels/nerves/ribs are swept
// tubes and muscles are sheets conformed to the body envelope. Units are metres,
// +y up, +z anterior, +x is the body's LEFT side. Bilateral parts are modelled on the
// left side and mirrored.

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const vec = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const arr = (v) => (v.isVector3 ? [v.x, v.y, v.z] : v);
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len3 = (a) => Math.sqrt(dot3(a, a));
const norm3 = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mirX = (p) => [-p[0], p[1], p[2]];
// sRGB hex -> linear rgb triple for vertex colours
const lin = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255].map(c => Math.pow(c, 2.2));
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Perlin noise ----------
const _perm = new Uint8Array(512);
(() => {
  const r = mulberry32(1337); const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
})();
const _fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function _grad(h, x, y, z) {
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise3(x, y, z) {
  let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
  const u = _fade(x), v = _fade(y), w = _fade(z), P = _perm;
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(
    lerp(lerp(_grad(P[AA] & 15, x, y, z), _grad(P[BA] & 15, x - 1, y, z), u),
      lerp(_grad(P[AB] & 15, x, y - 1, z), _grad(P[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(_grad(P[AA + 1] & 15, x, y, z - 1), _grad(P[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(_grad(P[AB + 1] & 15, x, y - 1, z - 1), _grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}
function fbm3(x, y, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}

// ---------- SDF toolkit ----------
// A shape is { f(x,y,z) -> signed distance, b: [minx,miny,minz,maxx,maxy,maxz] }.
const BIG = 1e3;
function boxDist(b, x, y, z) {
  const dx = Math.max(b[0] - x, 0, x - b[3]);
  const dy = Math.max(b[1] - y, 0, y - b[4]);
  const dz = Math.max(b[2] - z, 0, z - b[5]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
const smax = (a, b, k) => -smin(-a, -b, k);
const expandBox = (b, e) => [b[0] - e, b[1] - e, b[2] - e, b[3] + e, b[4] + e, b[5] + e];
function boxOfPoints(pts, pad = 0) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], p[i] - pad); b[i + 3] = Math.max(b[i + 3], p[i] + pad); }
  return b;
}

// orthonormal frame with w along `dir` and u roughly along `hint`
function frameFrom(dir, hint = [1, 0, 0]) {
  const w = norm3(dir);
  let u = sub3(hint, mul3(w, dot3(hint, w)));
  if (len3(u) < 1e-6) u = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  u = norm3(sub3(u, mul3(w, dot3(u, w))));
  const v = cross3(w, u);
  return [u, v, w];
}

const SD = {
  sphere(c, r) {
    const [cx, cy, cz] = c;
    return { f: (x, y, z) => { const dx = x - cx, dy = y - cy, dz = z - cz; return Math.sqrt(dx * dx + dy * dy + dz * dz) - r; }, b: [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r] };
  },
  // ellipsoid; optional axes [u,v,w] (orthonormal) with radii r=[ru,rv,rw]
  ell(c, r, ax) {
    const [cx, cy, cz] = c; const [a, b, d] = r; const mn = Math.min(a, b, d);
    const ia = 1 / a, ib = 1 / b, id = 1 / d, ia2 = ia * ia, ib2 = ib * ib, id2 = id * id;
    if (!ax) {
      return {
        f: (x, y, z) => {
          const px = x - cx, py = y - cy, pz = z - cz;
          const k0 = Math.sqrt(px * px * ia2 + py * py * ib2 + pz * pz * id2);
          const k1 = Math.sqrt(px * px * ia2 * ia2 + py * py * ib2 * ib2 + pz * pz * id2 * id2);
          const v = k1 > 1e-12 ? k0 * (k0 - 1) / k1 : -mn;
          // the approximation can undershoot; never report less than the distance to the box
          if (v > 0) { const ex = Math.max(Math.abs(px) - a, 0), ey = Math.max(Math.abs(py) - b, 0), ez = Math.max(Math.abs(pz) - d, 0); const bd = Math.sqrt(ex * ex + ey * ey + ez * ez); return bd > v ? bd : v; }
          return v;
        }, b: [cx - a, cy - b, cz - d, cx + a, cy + b, cz + d]
      };
    }
    const [U, Vv, W] = ax;
    const ex = Math.abs(U[0]) * a + Math.abs(Vv[0]) * b + Math.abs(W[0]) * d;
    const ey = Math.abs(U[1]) * a + Math.abs(Vv[1]) * b + Math.abs(W[1]) * d;
    const ez = Math.abs(U[2]) * a + Math.abs(Vv[2]) * b + Math.abs(W[2]) * d;
    return {
      f: (x, y, z) => {
        const px = x - cx, py = y - cy, pz = z - cz;
        const lu = px * U[0] + py * U[1] + pz * U[2], lv = px * Vv[0] + py * Vv[1] + pz * Vv[2], lw = px * W[0] + py * W[1] + pz * W[2];
        const k0 = Math.sqrt(lu * lu * ia2 + lv * lv * ib2 + lw * lw * id2);
        const k1 = Math.sqrt(lu * lu * ia2 * ia2 + lv * lv * ib2 * ib2 + lw * lw * id2 * id2);
        const v = k1 > 1e-12 ? k0 * (k0 - 1) / k1 : -mn;
        if (v > 0) { const qx = Math.max(Math.abs(lu) - a, 0), qy = Math.max(Math.abs(lv) - b, 0), qz = Math.max(Math.abs(lw) - d, 0); const bd = Math.sqrt(qx * qx + qy * qy + qz * qz); return bd > v ? bd : v; }
        return v;
      }, b: [cx - ex, cy - ey, cz - ez, cx + ex, cy + ey, cz + ez]
    };
  },
  // ellipsoid whose long axis (radius rl) runs from point a to b direction; cross radii r1 (along hint) r2
  ellAlong(c, dir, rl, r1, r2, hint = [1, 0, 0]) {
    const [u, v, w] = frameFrom(dir, hint);
    return SD.ell(c, [r1, r2, rl], [u, v, w]);
  },
  // round cone between points a,b with radii r1,r2 (Inigo Quilez)
  cone(a, b, r1, r2) {
    if (r2 === undefined) r2 = r1;
    const [ax, ay, az] = a; const bax = b[0] - ax, bay = b[1] - ay, baz = b[2] - az;
    const l2 = bax * bax + bay * bay + baz * baz; const rr = r1 - r2; const a2 = l2 - rr * rr; const il2 = 1 / l2;
    const bb = [Math.min(a[0] - r1, b[0] - r2), Math.min(a[1] - r1, b[1] - r2), Math.min(a[2] - r1, b[2] - r2),
      Math.max(a[0] + r1, b[0] + r2), Math.max(a[1] + r1, b[1] + r2), Math.max(a[2] + r1, b[2] + r2)];
    if (a2 <= 1e-12) { const big = r1 > r2 ? SD.sphere(a, r1) : SD.sphere(b, r2); return big; }
    return {
      f: (x, y, z) => {
        const pax = x - ax, pay = y - ay, paz = z - az;
        const yy = pax * bax + pay * bay + paz * baz; const zz = yy - l2;
        const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
        const x2 = qx * qx + qy * qy + qz * qz; const y2 = yy * yy * l2; const z2 = zz * zz * l2;
        const k = Math.sign(rr) * rr * rr * x2;
        if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
        if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
        return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
      }, b: bb
    };
  },
  // rounded box with half-size h, optional axes, rounding r
  box(c, h, ax, r = 0) {
    const [cx, cy, cz] = c; const [hx, hy, hz] = [h[0] - r, h[1] - r, h[2] - r];
    const [U, Vv, W] = ax || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const ex = Math.abs(U[0]) * h[0] + Math.abs(Vv[0]) * h[1] + Math.abs(W[0]) * h[2];
    const ey = Math.abs(U[1]) * h[0] + Math.abs(Vv[1]) * h[1] + Math.abs(W[1]) * h[2];
    const ez = Math.abs(U[2]) * h[0] + Math.abs(Vv[2]) * h[1] + Math.abs(W[2]) * h[2];
    return {
      f: (x, y, z) => {
        const px = x - cx, py = y - cy, pz = z - cz;
        const qx = Math.abs(px * U[0] + py * U[1] + pz * U[2]) - hx;
        const qy = Math.abs(px * Vv[0] + py * Vv[1] + pz * Vv[2]) - hy;
        const qz = Math.abs(px * W[0] + py * W[1] + pz * W[2]) - hz;
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
        return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
      }, b: [cx - ex, cy - ey, cz - ez, cx + ex, cy + ey, cz + ez]
    };
  },
  // torus in plane perpendicular to axis n, major R minor r
  torus(c, n, R, r) {
    const [u, v, w] = frameFrom(n);
    const e = R + r;
    return {
      f: (x, y, z) => {
        const px = x - c[0], py = y - c[1], pz = z - c[2];
        const lu = px * u[0] + py * u[1] + pz * u[2], lv = px * v[0] + py * v[1] + pz * v[2], lw = px * w[0] + py * w[1] + pz * w[2];
        const q = Math.sqrt(lu * lu + lv * lv) - R;
        return Math.sqrt(q * q + lw * lw) - r;
      }, b: [c[0] - e, c[1] - e, c[2] - e, c[0] + e, c[1] + e, c[2] + e]
    };
  },
  // half-space: points with dot(p - o, n) > 0 are outside
  plane(o, n) {
    const nn = norm3(n); const d = dot3(o, nn);
    return { f: (x, y, z) => x * nn[0] + y * nn[1] + z * nn[2] - d, b: [-BIG, -BIG, -BIG, BIG, BIG, BIG] };
  },
  // chain of round cones through points with per-point radii (smooth tube)
  tube(pts, radii, k = 0) {
    const parts = [];
    for (let i = 0; i < pts.length - 1; i++) parts.push(SD.cone(pts[i], pts[i + 1], radii[i], radii[i + 1]));
    return parts.length === 1 ? parts[0] : U(k, parts);
  },
  // thin plate: 2D polygon (in local u,v) extruded along w with thickness th(u,v);
  // map(x,y,z) -> [u,v,w] gives local coords (can be curved). Box must be supplied.
  // edge = [extra thickness at the rim, falloff width] thickens borders (crests, margins).
  plate(poly, map, th, box, round = 0.0015, edge = null) {
    const P = poly.flat();
    const thf = typeof th === 'function' ? th : () => th;
    const eAdd = edge ? edge[0] : 0, eW = edge ? edge[1] : 1;
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const [u, v] of poly) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    return {
      f: (x, y, z) => {
        const q = map(x, y, z);
        const tb = thf(q[0], q[1]);
        const twc = Math.abs(q[2]) - (tb + eAdd) * 0.5;
        const du = Math.max(u0 - q[0], 0, q[0] - u1), dv = Math.max(v0 - q[1], 0, q[1] - v1);
        const db = Math.sqrt(du * du + dv * dv);
        if (twc > 0.005 || db > 0.005) return Math.max(Math.max(twc, db) * 0.8, boxDist(box, x, y, z));
        const d2 = sdPolygon(q[0], q[1], P);
        const t = tb + (eAdd ? eAdd * Math.exp(Math.min(d2, 0) / eW) : 0);
        const dw = Math.abs(q[2]) - t * 0.5 + round;
        const d2r = d2 + round;
        const ox = Math.max(d2r, 0), oy = Math.max(dw, 0);
        return Math.min(Math.max(d2r, dw), 0) + Math.sqrt(ox * ox + oy * oy) - round;
      }, b: box
    };
  },
};

function sdPolygon(px, py, P) {
  const n = P.length / 2;
  let d = (px - P[0]) * (px - P[0]) + (py - P[1]) * (py - P[1]); let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const vix = P[2 * i], viy = P[2 * i + 1], vjx = P[2 * j], vjy = P[2 * j + 1];
    const ex = vjx - vix, ey = vjy - viy, wx = px - vix, wy = py - viy;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    const bx = wx - ex * t, by = wy - ey * t;
    const dd = bx * bx + by * by; if (dd < d) d = dd;
    const c1 = py >= viy, c2 = py < vjy, c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

// smooth closed outline through control points (Catmull-Rom), returns [[u,v],...]
function smoothOutline(ctrl, per = 8) {
  const out = []; const n = ctrl.length;
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

// union with bounding-box culling; large unions are split into a box hierarchy
function boxDist2(b, x, y, z) {
  const dx = Math.max(b[0] - x, 0, x - b[3]);
  const dy = Math.max(b[1] - y, 0, y - b[4]);
  const dz = Math.max(b[2] - z, 0, z - b[5]);
  return dx * dx + dy * dy + dz * dz;
}
function U(k, ...shapes) {
  shapes = shapes.flat(Infinity).filter(Boolean);
  if (shapes.length === 1) return shapes[0];
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const s of shapes) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], s.b[i]); b[i + 3] = Math.max(b[i + 3], s.b[i + 3]); }
  if (shapes.length > 6) {
    const ext = [b[3] - b[0], b[4] - b[1], b[5] - b[2]]; const ax = ext.indexOf(Math.max(...ext));
    const sorted = shapes.slice().sort((p, q) => (p.b[ax] + p.b[ax + 3]) - (q.b[ax] + q.b[ax + 3]));
    const mid = sorted.length >> 1;
    return U(k, U(k, sorted.slice(0, mid)), U(k, sorted.slice(mid)));
  }
  const n = shapes.length; const fs = shapes.map(s => s.f); const bs = shapes.map(s => s.b);
  const bd = new Float64Array(n);
  return {
    f: (x, y, z) => {
      // the nearest child bounds the result; children whose box is farther than that bound
      // (+k) cannot change it. The rest are folded in a FIXED order: smooth min is not
      // associative, so a position-dependent order would make the field jump.
      let m = 0;
      for (let i = 0; i < n; i++) { bd[i] = boxDist2(bs[i], x, y, z); if (bd[i] < bd[m]) m = i; }
      const vm = fs[m](x, y, z);
      const lim = vm + k, lim2 = lim * lim;
      let d = Infinity;
      for (let i = 0; i < n; i++) {
        let v;
        if (i === m) v = vm;
        else { if (lim <= 0 || bd[i] >= lim2) continue; v = fs[i](x, y, z); }
        d = d === Infinity ? v : smin(d, v, k);
      }
      return d;
    }, b: expandBox(b, k * 0.3)
  };
}
// subtract b (and more) from a
function Sub(a, k, ...cut) {
  cut = cut.flat(Infinity).filter(Boolean);
  const cf = cut.map(s => s.f), cb = cut.map(s => s.b);
  return {
    f: (x, y, z) => {
      let d = a.f(x, y, z);
      for (let i = 0; i < cf.length; i++) {
        if (boxDist(cb[i], x, y, z) + d >= k) continue;
        d = smax(d, -cf[i](x, y, z), k);
      }
      return d;
    }, b: a.b
  };
}
function I(k, a, ...others) {
  const b = a.b.slice();
  for (const o of others) for (let i = 0; i < 3; i++) { b[i] = Math.max(b[i], o.b[i]); b[i + 3] = Math.min(b[i + 3], o.b[i + 3]); }
  const fs = others.map(o => o.f);
  return { f: (x, y, z) => { let d = a.f(x, y, z); for (const f of fs) d = smax(d, f(x, y, z), k); return d; }, b };
}
const Round = (s, r) => ({ f: (x, y, z) => s.f(x, y, z) - r, b: expandBox(s.b, r) });
const Shell = (s, t) => ({ f: (x, y, z) => Math.abs(s.f(x, y, z)) - t, b: expandBox(s.b, t) });
function Disp(s, fn, amp) { return { f: (x, y, z) => s.f(x, y, z) + fn(x, y, z), b: expandBox(s.b, amp) }; }
function MirX(s) { return { f: (x, y, z) => s.f(-x, y, z), b: [-s.b[3], s.b[1], s.b[2], -s.b[0], s.b[4], s.b[5]] }; }
function SymX(s) { const m = Math.max(Math.abs(s.b[0]), Math.abs(s.b[3])); return { f: (x, y, z) => s.f(Math.abs(x), y, z), b: [-m, s.b[1], s.b[2], m, s.b[4], s.b[5]] }; }
// shape defined in a local frame (origin o, axes ax=[X,Y,Z]) placed into world
function Place(s, o, ax) {
  const [X, Y, Z] = ax;
  const cs = [];
  for (let i = 0; i < 8; i++) {
    const l = [(i & 1) ? s.b[3] : s.b[0], (i & 2) ? s.b[4] : s.b[1], (i & 4) ? s.b[5] : s.b[2]];
    cs.push([o[0] + X[0] * l[0] + Y[0] * l[1] + Z[0] * l[2], o[1] + X[1] * l[0] + Y[1] * l[1] + Z[1] * l[2], o[2] + X[2] * l[0] + Y[2] * l[1] + Z[2] * l[2]]);
  }
  return {
    f: (x, y, z) => {
      const px = x - o[0], py = y - o[1], pz = z - o[2];
      return s.f(px * X[0] + py * X[1] + pz * X[2], px * Y[0] + py * Y[1] + pz * Y[2], px * Z[0] + py * Z[1] + pz * Z[2]);
    }, b: boxOfPoints(cs)
  };
}

// ---------- Surface nets mesher ----------
const _tet = [[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]];
function sdfGrad(f, x, y, z, e) {
  let gx = 0, gy = 0, gz = 0;
  for (let k = 0; k < 4; k++) { const t = _tet[k]; const v = f(x + t[0] * e, y + t[1] * e, z + t[2] * e); gx += t[0] * v; gy += t[1] * v; gz += t[2] * v; }
  const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  return [gx / l, gy / l, gz / l];
}

const STATS = { evals: 0, tris: 0, meshes: 0 };
let H_MUL = 1; // global mesh resolution multiplier (quality setting)
const setQuality = (m) => { H_MUL = m; };

// Adaptive sampling: blocks whose corners prove (via the Lipschitz bound) that no surface
// passes through them are filled by interpolation; only a thin band around the surface is
// evaluated exactly. opts: { ao: distance, aoMin, color(x,y,z,n)->[r,g,b], keepField, lip }
function meshSDF(shape, h, opts = {}) {
  h *= H_MUL;
  const f = shape.f;
  let b = opts.box || shape.b;
  // snap to a world-aligned lattice so neighbouring regions meshed separately share vertices
  if (opts.align) b = [Math.floor(b[0] / h) * h, Math.floor(b[1] / h) * h, Math.floor(b[2] / h) * h, b[3], b[4], b[5]];
  const pad = 2.5 * h;
  const x0 = b[0] - pad, y0 = b[1] - pad, z0 = b[2] - pad;
  const nx = Math.ceil((b[3] + pad - x0) / h) + 1, ny = Math.ceil((b[4] + pad - y0) / h) + 1, nz = Math.ceil((b[5] + pad - z0) / h) + 1;
  const sy = nx, sz = nx * ny, N = nx * ny * nz;
  if (N > 6e7) throw new Error('grid too large ' + N);
  const vals = new Float32Array(N); const done = new Uint8Array(N);
  const L = opts.lip || 1.35;
  let evals = 0;
  const node = (ix, iy, iz) => {
    const i = ix + iy * sy + iz * sz;
    if (!done[i]) { vals[i] = f(x0 + ix * h, y0 + iy * h, z0 + iz * h); done[i] = 1; evals++; }
    return vals[i];
  };
  const farB = [];
  const block = (bx, by, bz, s) => {
    const ex = Math.min(bx + s, nx - 1), ey = Math.min(by + s, ny - 1), ez = Math.min(bz + s, nz - 1);
    if (ex <= bx || ey <= by || ez <= bz) return;
    let mn = Infinity, neg = 0;
    for (let c = 0; c < 8; c++) {
      const v = node((c & 1) ? ex : bx, (c & 2) ? ey : by, (c & 4) ? ez : bz);
      const a = v < 0 ? -v : v; if (a < mn) mn = a; if (v < 0) neg++;
    }
    const dx = ex - bx, dy = ey - by, dz = ez - bz;
    if ((neg === 0 || neg === 8) && mn > Math.sqrt(dx * dx + dy * dy + dz * dz) * h * L) { farB.push(bx, by, bz, ex, ey, ez); return; }
    if (s <= 2) {
      for (let iz = bz; iz <= ez; iz++) for (let iy = by; iy <= ey; iy++) for (let ix = bx; ix <= ex; ix++) node(ix, iy, iz);
      return;
    }
    const hs = s >> 1;
    for (let k = 0; k < 8; k++) block(bx + ((k & 1) ? hs : 0), by + ((k & 2) ? hs : 0), bz + ((k & 4) ? hs : 0), hs);
  };
  const S0 = 16;
  for (let bz = 0; bz < nz - 1; bz += S0) for (let by = 0; by < ny - 1; by += S0) for (let bx = 0; bx < nx - 1; bx += S0) block(bx, by, bz, S0);
  // fill skipped nodes by trilinear interpolation of their block corners
  for (let q = 0; q < farB.length; q += 6) {
    const bx = farB[q], by = farB[q + 1], bz = farB[q + 2], ex = farB[q + 3], ey = farB[q + 4], ez = farB[q + 5];
    const c000 = vals[bx + by * sy + bz * sz], c100 = vals[ex + by * sy + bz * sz], c010 = vals[bx + ey * sy + bz * sz], c110 = vals[ex + ey * sy + bz * sz];
    const c001 = vals[bx + by * sy + ez * sz], c101 = vals[ex + by * sy + ez * sz], c011 = vals[bx + ey * sy + ez * sz], c111 = vals[ex + ey * sy + ez * sz];
    const ix0 = 1 / (ex - bx), iy0 = 1 / (ey - by), iz0 = 1 / (ez - bz);
    for (let iz = bz; iz <= ez; iz++) {
      const tz = (iz - bz) * iz0;
      for (let iy = by; iy <= ey; iy++) {
        const ty = (iy - by) * iy0;
        const a0 = lerp(lerp(c000, c010, ty), lerp(c001, c011, ty), tz), a1 = lerp(lerp(c100, c110, ty), lerp(c101, c111, ty), tz);
        let i = bx + iy * sy + iz * sz;
        for (let ix = bx; ix <= ex; ix++, i++) if (!done[i]) { vals[i] = lerp(a0, a1, (ix - bx) * ix0); done[i] = 2; }
      }
    }
  }
  STATS.evals += evals;
  // one vertex per surface cell
  const cx = nx - 1, cy = ny - 1, czn = nz - 1;
  const cellIdx = new Int32Array(cx * cy * czn).fill(-1);
  const pos = [];
  const off = [0, 1, sy, sy + 1, sz, sz + 1, sz + sy, sz + sy + 1];
  const EA = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3], EB = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];
  const cv = new Float64Array(8);
  const keep = opts.keep || null;
  for (let iz = 0; iz < czn; iz++) for (let iy = 0; iy < cy; iy++) {
    let i = iy * sy + iz * sz;
    for (let ix = 0; ix < cx; ix++, i++) {
      if (!done[i]) continue;
      if (keep && !keep(x0 + (ix + 0.5) * h, y0 + (iy + 0.5) * h, z0 + (iz + 0.5) * h)) continue;
      let mask = 0;
      for (let c = 0; c < 8; c++) { const v = vals[i + off[c]]; cv[c] = v; if (v < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let px = 0, py = 0, pz = 0, cnt = 0;
      for (let e = 0; e < 12; e++) {
        const a = EA[e], bb = EB[e]; const va = cv[a], vb = cv[bb];
        if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        px += (a & 1) + ((bb & 1) - (a & 1)) * t;
        py += ((a >> 1) & 1) + (((bb >> 1) & 1) - ((a >> 1) & 1)) * t;
        pz += ((a >> 2) & 1) + (((bb >> 2) & 1) - ((a >> 2) & 1)) * t;
        cnt++;
      }
      cellIdx[ix + iy * cx + iz * cx * cy] = pos.length / 3;
      pos.push(x0 + (ix + px / cnt) * h, y0 + (iy + py / cnt) * h, z0 + (iz + pz / cnt) * h);
    }
  }
  const idx = [];
  const cell = (ix, iy, iz) => cellIdx[ix + iy * cx + iz * cx * cy];
  const quad = (a, b2, c, d) => { if (a >= 0 && b2 >= 0 && c >= 0 && d >= 0) idx.push(a, b2, c, a, c, d); };
  for (let iz = 1; iz < czn; iz++) for (let iy = 1; iy < cy; iy++) for (let ix = 1; ix < cx; ix++) {
    const i = ix + iy * sy + iz * sz; const inA = vals[i] < 0;
    if (inA !== (vals[i + 1] < 0)) {
      const c0 = cell(ix, iy - 1, iz - 1), c1 = cell(ix, iy, iz - 1), c2 = cell(ix, iy, iz), c3 = cell(ix, iy - 1, iz);
      inA ? quad(c0, c1, c2, c3) : quad(c0, c3, c2, c1);
    }
    if (inA !== (vals[i + sy] < 0)) {
      const c0 = cell(ix - 1, iy, iz - 1), c1 = cell(ix - 1, iy, iz), c2 = cell(ix, iy, iz), c3 = cell(ix, iy, iz - 1);
      inA ? quad(c0, c1, c2, c3) : quad(c0, c3, c2, c1);
    }
    if (inA !== (vals[i + sz] < 0)) {
      const c0 = cell(ix - 1, iy - 1, iz), c1 = cell(ix, iy - 1, iz), c2 = cell(ix, iy, iz), c3 = cell(ix - 1, iy, iz);
      inA ? quad(c0, c1, c2, c3) : quad(c0, c3, c2, c1);
    }
  }
  const field = { vals, x0, y0, z0, h, nx, ny, nz };
  const samp = fieldSampler(field);
  const nv = pos.length / 3;
  const P = new Float32Array(pos); const Nn = new Float32Array(nv * 3); const Cc = new Float32Array(nv * 3);
  const e = h * 0.5;
  const aoD = opts.ao ?? 0; const aoMin = opts.aoMin ?? 0.35;
  for (let i = 0; i < nv; i++) {
    let x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
    const g = sdfGrad(f, x, y, z, e);
    const d = clamp(f(x, y, z), -h, h);
    x -= g[0] * d; y -= g[1] * d; z -= g[2] * d;
    P[3 * i] = x; P[3 * i + 1] = y; P[3 * i + 2] = z;
    Nn[3 * i] = g[0]; Nn[3 * i + 1] = g[1]; Nn[3 * i + 2] = g[2];
    let ao = 1;
    if (aoD > 0) {
      let occ = 0, sca = 1;
      for (let s = 1; s <= 4; s++) {
        const hr = aoD * s / 4; const dd = samp(x + g[0] * hr, y + g[1] * hr, z + g[2] * hr);
        occ += Math.max(hr - dd, 0) * sca; sca *= 0.7;
      }
      ao = clamp(1 - 1.3 * occ / aoD, 0, 1);
    }
    const col = opts.color ? opts.color(x, y, z, g) : null;
    const k = aoMin + (1 - aoMin) * ao;
    Cc[3 * i] = (col ? col[0] : 1) * k; Cc[3 * i + 1] = (col ? col[1] : 1) * k; Cc[3 * i + 2] = (col ? col[2] : 1) * k;
  }
  STATS.evals += nv * 5;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  geo.setIndex(new THREE.BufferAttribute(nv > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  if (opts.keepField) geo.userData.field = field;
  return geo;
}

// trilinear sampler over a kept field
function fieldSampler(F) {
  const { vals, x0, y0, z0, h, nx, ny, nz } = F; const sy = nx, sz = nx * ny;
  const s = (x, y, z) => {
    let gx = (x - x0) / h, gy = (y - y0) / h, gz = (z - z0) / h;
    gx = clamp(gx, 0, nx - 1.001); gy = clamp(gy, 0, ny - 1.001); gz = clamp(gz, 0, nz - 1.001);
    const ix = gx | 0, iy = gy | 0, iz = gz | 0; const fx = gx - ix, fy = gy - iy, fz = gz - iz;
    const i = ix + iy * sy + iz * sz;
    const c00 = lerp(vals[i], vals[i + 1], fx), c10 = lerp(vals[i + sy], vals[i + sy + 1], fx);
    const c01 = lerp(vals[i + sz], vals[i + sz + 1], fx), c11 = lerp(vals[i + sz + sy], vals[i + sz + sy + 1], fx);
    return lerp(lerp(c00, c10, fy), lerp(c01, c11, fy), fz);
  };
  return s;
}
// move point p onto iso-surface f = target (negative = inside)
function projectTo(f, p, target, iters = 4, e = 0.003) {
  let [x, y, z] = p;
  for (let i = 0; i < iters; i++) {
    const g = sdfGrad(f, x, y, z, e); const d = f(x, y, z) - target;
    x -= g[0] * d; y -= g[1] * d; z -= g[2] * d;
  }
  return [x, y, z];
}

// ---------- swept tubes ----------
// pts: control points ([x,y,z] or Vector3). opts: r (number|t=>r), rx/ry (t=>r) for elliptic,
// rMod(t,theta) multiplier, radial, step, up (fixed reference => B tends to `up`), caps, color(t)->[r,g,b]
function sweep(pts, opts = {}) {
  const V = pts.map(vec);
  const curve = V.length === 2 ? new THREE.LineCurve3(V[0], V[1]) : new THREE.CatmullRomCurve3(V, !!opts.closed, 'centripetal');
  const len = curve.getLength();
  const seg = opts.seg || Math.max(4, Math.ceil(len / (opts.step || 0.004)));
  const P = curve.getSpacedPoints(seg);
  const n = P.length; const radial = opts.radial || 12;
  const rf = typeof opts.r === 'function' ? opts.r : () => (opts.r ?? 0.003);
  const rxf = opts.rx || rf, ryf = opts.ry || rf;
  const T = [], N = [], Bn = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, n - 1)];
    T.push(b.clone().sub(a).normalize());
  }
  if (opts.up) {
    const up = vec(opts.up);
    for (let i = 0; i < n; i++) {
      let bb = up.clone().sub(T[i].clone().multiplyScalar(T[i].dot(up)));
      if (bb.lengthSq() < 1e-8) bb = Bn[i - 1] ? Bn[i - 1].clone() : new THREE.Vector3(1, 0, 0);
      bb.normalize(); Bn.push(bb); N.push(bb.clone().cross(T[i]).normalize());
    }
  } else {
    let n0 = Math.abs(T[0].y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
    n0.sub(T[0].clone().multiplyScalar(T[0].dot(n0))).normalize();
    N.push(n0); Bn.push(T[0].clone().cross(n0).normalize());
    for (let i = 1; i < n; i++) {
      const nn = N[i - 1].clone().sub(T[i].clone().multiplyScalar(T[i].dot(N[i - 1]))).normalize();
      N.push(nn); Bn.push(T[i].clone().cross(nn).normalize());
    }
  }
  const pos = [], nor = [], uv = [], col = [], idx = [];
  let arc = 0;
  const ring = (i, t) => {
    const rx = rxf(t), ry = ryf(t);
    const c = opts.color ? opts.color(t) : null;
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * TAU; const cs = Math.cos(th), sn = Math.sin(th);
      const m = opts.rMod ? opts.rMod(t, th) : 1;
      const ox = N[i].x * cs * rx * m + Bn[i].x * sn * ry * m, oy = N[i].y * cs * rx * m + Bn[i].y * sn * ry * m, oz = N[i].z * cs * rx * m + Bn[i].z * sn * ry * m;
      pos.push(P[i].x + ox, P[i].y + oy, P[i].z + oz);
      const nx = N[i].x * cs / rx + Bn[i].x * sn / ry, ny = N[i].y * cs / rx + Bn[i].y * sn / ry, nz = N[i].z * cs / rx + Bn[i].z * sn / ry;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nor.push(nx / l, ny / l, nz / l);
      uv.push(j / radial, arc * (opts.uvScale || 40));
      if (c) col.push(c[0], c[1], c[2]); else col.push(1, 1, 1);
    }
  };
  for (let i = 0; i < n; i++) { if (i > 0) arc += P[i].distanceTo(P[i - 1]); ring(i, i / (n - 1)); }
  const R = radial + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * R + j, b = (i + 1) * R + j, c = (i + 1) * R + j + 1, d = i * R + j + 1;
    idx.push(a, d, c, a, c, b);
  }
  if (opts.caps !== false) {
    for (const end of [0, 1]) {
      const i = end ? n - 1 : 0; const t = end ? 1 : 0; const dir = end ? T[i] : T[i].clone().negate();
      const rx = rxf(t), ry = ryf(t); const c = opts.color ? opts.color(t) : [1, 1, 1];
      const rings = 3;
      let prev = i * R;
      for (let k = 1; k <= rings; k++) {
        const ph = (k / (rings + 1)) * Math.PI / 2; const cr = Math.cos(ph), sr = Math.sin(ph);
        const start = pos.length / 3;
        for (let j = 0; j <= radial; j++) {
          const th = (j / radial) * TAU; const cs = Math.cos(th), sn = Math.sin(th);
          const m = opts.rMod ? opts.rMod(t, th) : 1;
          const o = N[i].clone().multiplyScalar(cs * rx * cr * m).add(Bn[i].clone().multiplyScalar(sn * ry * cr * m)).add(dir.clone().multiplyScalar(Math.min(rx, ry) * sr));
          pos.push(P[i].x + o.x, P[i].y + o.y, P[i].z + o.z);
          const nn = o.clone().normalize(); nor.push(nn.x, nn.y, nn.z); uv.push(j / radial, 0); col.push(c[0], c[1], c[2]);
        }
        for (let j = 0; j < radial; j++) {
          const a = prev + j, b = start + j, cc = start + j + 1, d = prev + j + 1;
          if (end) idx.push(a, d, cc, a, cc, b); else idx.push(a, b, cc, a, cc, d);
        }
        prev = start;
      }
      const pole = pos.length / 3; const o = dir.clone().multiplyScalar(Math.min(rx, ry));
      pos.push(P[i].x + o.x, P[i].y + o.y, P[i].z + o.z); nor.push(dir.x, dir.y, dir.z); uv.push(0.5, 0); col.push(c[0], c[1], c[2]);
      for (let j = 0; j < radial; j++) { if (end) idx.push(prev + j, prev + j + 1, pole); else idx.push(prev + j, pole, prev + j + 1); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  geo.userData.path = P.map(p => [p.x, p.y, p.z]);
  return geo;
}

function mirrorGeometry(g) {
  const m = g.clone();
  const p = m.attributes.position, n = m.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (n) n.setX(i, -n.getX(i)); }
  const ix = m.index;
  if (ix) for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); }
  if (g.userData.path) m.userData.path = g.userData.path.map(mirX);
  m.computeBoundingSphere(); m.computeBoundingBox();
  return m;
}

// merge several (indexed) geometries with identical attribute sets
function mergeGeos(list) {
  list = list.filter(Boolean);
  if (list.length === 1) return list[0];
  const names = Object.keys(list[0].attributes);
  let total = 0, totalIdx = 0;
  for (const g of list) { total += g.attributes.position.count; totalIdx += g.index.count; }
  const out = new THREE.BufferGeometry();
  for (const nm of names) {
    const sz = list[0].attributes[nm].itemSize; const a = new Float32Array(total * sz); let o = 0;
    for (const g of list) { a.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; }
    out.setAttribute(nm, new THREE.BufferAttribute(a, sz));
  }
  const I32 = total > 65535 ? Uint32Array : Uint16Array; const ia = new I32(totalIdx); let o = 0, base = 0;
  for (const g of list) { const s = g.index.array; for (let i = 0; i < s.length; i++) ia[o + i] = s[i] + base; o += s.length; base += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(ia, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

