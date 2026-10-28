// ===================== Skin / body envelope =====================
// One SDF describes the outer body surface. Muscles are conformed to it (offset inwards),
// so it is built hierarchically for fast evaluation.
const dirArm = norm3(sub3(LM.elbow, LM.humHead));
const dirFore = norm3(sub3(LM.wrist, LM.elbow));
let _bodySDF = null;
function bodySDF() {
  if (_bodySDF) return _bodySDF;
  const H = HAND, Fo = FOOT;
  // ---- head ----
  const head = Sub(U(0.012,
    E([0, 1.668, -0.012], [0.0775, 0.084, 0.1005]),
    E([0, 1.602, 0.026], [0.0655, 0.074, 0.07]),
    E([0, 1.632, 0.03], [0.0705, 0.048, 0.066]),
    C([0.054, 1.551, -0.012], [0.02, 1.522, 0.07], 0.0105, 0.012), C([-0.054, 1.551, -0.012], [-0.02, 1.522, 0.07], 0.0105, 0.012),
    E([0, 1.521, 0.078], [0.021, 0.0135, 0.0125]),
    E([0.049, 1.578, 0.02], [0.017, 0.03, 0.03]), E([-0.049, 1.578, 0.02], [0.017, 0.03, 0.03]),
    U(0.006, C([0, 1.642, 0.092], [0, 1.61, 0.107], 0.0045, 0.0062), S([0, 1.6045, 0.1065], 0.0076),
      E([0.0102, 1.6005, 0.1005], [0.0066, 0.0054, 0.0072]), E([-0.0102, 1.6005, 0.1005], [0.0066, 0.0054, 0.0072])),
    E([0, 1.5655, 0.0948], [0.0198, 0.0054, 0.0064]), E([0, 1.5525, 0.0928], [0.0178, 0.0056, 0.0062]),
    E([0, 1.546, 0.068], [0.03, 0.024, 0.024]),
    E([0.03, 1.6555, 0.0825], [0.021, 0.0042, 0.0048]), E([-0.03, 1.6555, 0.0825], [0.021, 0.0042, 0.0048]),
    E([0.033, 1.6355, 0.0815], [0.0136, 0.0104, 0.0058]), E([-0.033, 1.6355, 0.0815], [0.0136, 0.0104, 0.0058]),
    SD.ell([0.0775, 1.622, -0.014], [0.0055, 0.029, 0.016], [norm3([1, 0, 0.25]), [0, 1, 0], norm3([-0.25, 0, 1])]),
    SD.ell([-0.0775, 1.622, -0.014], [0.0055, 0.029, 0.016], [norm3([1, 0, -0.25]), [0, 1, 0], norm3([0.25, 0, 1])]),
  ), 0.002, E([0, 1.5592, 0.102], [0.018, 0.001, 0.01]), E([0.0335, 1.6355, 0.088], [0.0112, 0.0041, 0.0085]), E([-0.0335, 1.6355, 0.088], [0.0112, 0.0041, 0.0085]));
  // ---- neck ----
  const neck = U(0.02,
    C([0, 1.585, -0.016], [0, 1.448, -0.008], 0.05, 0.056),
    E([0, 1.502, 0.049], [0.0105, 0.012, 0.0085]),
    C([0.05, 1.594, -0.028], [0.021, 1.442, 0.054], 0.0118, 0.0102), C([-0.05, 1.594, -0.028], [-0.021, 1.442, 0.054], 0.0118, 0.0102),
  );
  // ---- trunk ----
  const trunk = U(0.045,
    E([0, 1.29, -0.005], [0.153, 0.17, 0.117]),
    E([0, 1.405, -0.012], [0.165, 0.065, 0.098]),
    E([0.075, 1.345, 0.08], [0.074, 0.042, 0.018]), E([-0.075, 1.345, 0.08], [0.074, 0.042, 0.018]),
    E([0.09, 1.245, -0.058], [0.075, 0.13, 0.064]), E([-0.09, 1.245, -0.058], [0.075, 0.13, 0.064]),
    E([0, 1.085, 0.006], [0.132, 0.15, 0.096]),
    E([0.03, 1.12, -0.082], [0.026, 0.12, 0.026]), E([-0.03, 1.12, -0.082], [0.026, 0.12, 0.026]),
    E([0, 0.945, -0.006], [0.163, 0.1, 0.108]),
    E([0, 1.005, -0.006], [0.152, 0.065, 0.1]),
    E([0, 1.185, 0.012], [0.142, 0.07, 0.1]),
    E([0.07, 0.886, -0.066], [0.074, 0.085, 0.064]), E([-0.07, 0.886, -0.066], [0.074, 0.085, 0.064]),
    E([0, 0.918, 0.045], [0.085, 0.048, 0.05]),
  );
  const trapz = U(0.02, C([0.025, 1.53, -0.05], [0.158, 1.455, -0.03], 0.034, 0.03), C([-0.025, 1.53, -0.05], [-0.158, 1.455, -0.03], 0.034, 0.03));
  // ---- arms (left, folded) ----
  const arm = U(0.022,
    E([0.188, 1.41, -0.022], [0.05, 0.064, 0.052]),
    C([0.196, 1.39, -0.025], [0.236, 1.105, -0.02], 0.045, 0.035),
    SD.ellAlong([0.216, 1.245, 0.008], dirArm, 0.085, 0.029, 0.027, [1, 0, 0]),
    SD.ellAlong([0.213, 1.255, -0.045], dirArm, 0.09, 0.031, 0.029, [1, 0, 0]),
    S(LM.elbow, 0.035),
    C(LM.elbow, [0.29, 0.865, 0.0], 0.039, 0.025),
    SD.ellAlong([0.25, 1.035, -0.002], dirFore, 0.085, 0.037, 0.032, [1, 0, 0]),
    SD.ellAlong(H.at(-0.006, 0, 0), dirFore, 0.016, 0.0275, 0.0175, H.Lt),
  );
  // ---- hand (left) ----
  const fingers = [];
  for (const fg of H.fingers) {
    const sc = fg.name === 'V' ? 0.86 : fg.name === 'III' ? 1.04 : 1;
    const tip = add3(fg.tip, mul3(norm3(sub3(fg.tip, fg.dip)), 0.0035));
    fingers.push(SD.tube([fg.mcp, fg.pip, fg.dip, tip], [0.0094 * sc, 0.0086 * sc, 0.0078 * sc, 0.0068 * sc], 0.004));
  }
  const th = H.thumb; const tTip = add3(th.tip, mul3(norm3(sub3(th.tip, th.ip)), 0.0035));
  fingers.push(SD.tube([add3(th.base, mul3(H.P, 0.004)), th.mcp, th.ip, tTip], [0.0135, 0.0112, 0.0098, 0.0082], 0.004));
  const hand = U(0.004,
    U(0.012, SD.box(H.at(0.058, -0.001, 0.0005), [0.044, 0.04, 0.0115], [H.D, H.Lt, H.P], 0.0105),
      E(H.at(0.038, 0.021, 0.008), [0.026, 0.017, 0.012], [H.D, H.Lt, H.P]),
      E(H.at(0.048, -0.028, 0.006), [0.03, 0.012, 0.01], [H.D, H.Lt, H.P])),
    fingers);
  // ---- leg (left, folded) ----
  const leg = U(0.03,
    C([0.098, 0.875, -0.002], [0.092, 0.53, 0.004], 0.084, 0.052),
    E([0.106, 0.69, 0.04], [0.058, 0.15, 0.05]),
    E([0.095, 0.7, -0.036], [0.05, 0.15, 0.045]),
    E([0.06, 0.765, 0.0], [0.04, 0.1, 0.05]),
    E([0.09, 0.497, 0.008], [0.047, 0.045, 0.047]),
    S([0.09, 0.52, 0.054], 0.021),
    C([0.09, 0.47, -0.006], [0.088, 0.11, -0.003], 0.047, 0.029),
    E([0.094, 0.352, -0.032], [0.045, 0.1, 0.042]),
    E([0.1, 0.33, 0.021], [0.02, 0.1, 0.02]),
    E([0.088, 0.077, -0.004], [0.031, 0.03, 0.03]),
    S(LM.medMall, 0.0125), S(LM.latMall, 0.0125),
  );
  // ---- foot (left) ----
  const fa = [Fo.F, Fo.Lf, Fo.Uf];
  const toes = Fo.toes.map(t => {
    const j = t.joints; const tip = add3(j[j.length - 1], mul3(Fo.F, 0.004));
    const r0 = t.name === 'I' ? 0.0122 : 0.0085 - (['II', 'III', 'IV', 'V'].indexOf(t.name)) * 0.0006;
    return SD.tube([j[0], ...j.slice(1, -1), tip], [r0, ...j.slice(1, -1).map(() => r0 * 0.92), r0 * 0.8], 0.003);
  });
  const foot = I(0.004, U(0.006,
    U(0.02, E(Fo.at(-0.042, 0.003, -0.045), [0.034, 0.029, 0.031], fa),
      E(Fo.at(0.048, 0.006, -0.046), [0.062, 0.041, 0.029], fa),
      E(Fo.at(0.118, 0.006, -0.058), [0.04, 0.047, 0.017], fa)),
    toes), SD.plane([0, 0.0, 0], [0, -1, 0]));
  const limbs = U(0.025, arm, U(0.016, SD.ellAlong(H.at(0.004, 0, 0), dirFore, 0.012, 0.027, 0.0165, H.Lt), hand));
  const legs = U(0.022, leg, foot);
  let body = U(0.03, U(0.025, head, neck), U(0.035, trunk, trapz));
  body = U(0.03, body, SymX(limbs));
  body = U(0.04, body, SymX(legs));
  body = Sub(body, 0.006, S([0, 1.045, 0.107], 0.0055), E([0, 0.872, -0.128], [0.0035, 0.055, 0.03]),
    C([0, 1.4, -0.131], [0, 1.02, -0.104], 0.0035));
  // never let a subcutaneous bone pierce the skin: union with the skeleton inflated by ~3 mm
  body = U(0.01, body, skinBoneShell());
  _bodySDF = body;
  return body;
}

// cheap proxies of the subcutaneous bony landmarks (clavicle, crests, condyles, malleoli…)
function skinBoneShell() {
  const Fo = FOOT;
  const left = [
    SD.tube([LM.sc, [0.05, 1.433, 0.066], [0.09, 1.441, 0.05], [0.128, 1.448, 0.018], [0.158, 1.452, -0.002], [0.167, 1.452, -0.009]], [0.0088, 0.0069, 0.0059, 0.006, 0.0062, 0.005]),
    E([0.177, 1.449, -0.016], [0.017, 0.0048, 0.0135]),
    SD.tube([cylPt(0.064, 1.404, -0.003), cylPt(0.1, 1.42, -0.012), cylPt(0.134, 1.435, -0.019), [0.162, 1.445, -0.03]], [0.0025, 0.004, 0.0052, 0.0056]),
    S(LM.medEpi, 0.0088), S(LM.latEpi, 0.0068),
    E([0.226, 1.112, -0.037], [0.0105, 0.016, 0.0105]),
    C([0.226, 1.09, -0.025], [0.252, 0.97, -0.017], 0.0098, 0.0072), C([0.252, 0.97, -0.017], [0.27, 0.866, -0.012], 0.0072, 0.0058),
    S([0.271, 0.864, -0.012], 0.0076),
    E([0.302, 0.868, 0.0], [0.0165, 0.0105, 0.0118]), C([0.314, 0.866, 0.0], LM.radStyloid, 0.0048, 0.0026),
    SD.tube([LM.asis, [0.132, 0.995, 0.035], [0.137, 1.015, 0.0], [0.128, 1.02, -0.03], [0.105, 1.012, -0.055], [0.075, 0.995, -0.072], LM.psis], [0.006, 0.0068, 0.007, 0.0068, 0.0064, 0.006, 0.006]),
    S(LM.asis, 0.0062),
    E([0.139, 0.893, 0.0], [0.0165, 0.027, 0.021]),
    E(LM.latCondyle, [0.0175, 0.023, 0.028]), E(LM.medCondyle, [0.019, 0.024, 0.029]),
    E(LM.patella, [0.021, 0.022, 0.0105]),
    E([0.088, 0.443, -0.003], [0.04, 0.024, 0.029]), E(LM.tibTub, [0.011, 0.017, 0.009]),
    C([0.089, 0.41, 0.011], [0.087, 0.15, 0.01], 0.0075, 0.0055),
    C([0.088, 0.425, 0.0], [0.087, 0.25, 0.004], 0.0175, 0.0125), C([0.087, 0.25, 0.004], [0.085, 0.095, 0.0], 0.0125, 0.0165),
    E([0.085, 0.084, 0.0], [0.024, 0.02, 0.022]), E(LM.medMall, [0.0075, 0.017, 0.0105]),
    E(LM.fibHead, [0.0105, 0.0125, 0.0105]), E(LM.latMall, [0.0085, 0.021, 0.0115]),
    C(Fo.at(-0.036, 0.004, -0.047), Fo.at(-0.058, 0.004, -0.047), 0.0165, 0.0155),
    // skull & face
    E([0.029, 1.656, 0.079], [0.019, 0.005, 0.007]), E([0.05, 1.611, 0.049], [0.0095, 0.0115, 0.0095]),
    C([0.056, 1.609, 0.038], [0.067, 1.612, -0.006], 0.0036, 0.0033), C([0.054, 1.611, -0.026], [0.051, 1.593, -0.027], 0.008, 0.0042),
    E([0.0478, 1.575, -0.001], [0.0045, 0.028, 0.013]), E([0.051, 1.607, -0.013], [0.0088, 0.004, 0.0052]),
  ];
  const mand = [];
  for (let i = 0; i <= 12; i++) { const t = -1 + i / 6; mand.push([0.0465 * t, 1.538, 0.077 - 0.082 * t * t]); }
  const center = [
    E([0, 1.668, -0.012], [0.0712, 0.0775, 0.094]),
    E([0, 1.655, 0.086], [0.011, 0.0075, 0.0065]),
    SD.ell([0, 1.636, 0.0905], [0.0068, 0.0125, 0.0026], [[1, 0, 0], norm3([0, -0.92, 0.38]), norm3([0, 0.38, 0.92])]),
    stretchY(SD.tube(mand, mand.map(() => 0.0052)), 1.538, 2.5), E([0, 1.528, 0.078], [0.011, 0.0065, 0.0055]),
    C(add3(LM.jugular, [0, 0, 0.004]), add3(LM.xiphoid, [0, 0, 0.002]), 0.0062, 0.0055),
    S(add3(canalPoint(6), [0, -0.012, -0.03]), 0.006),
  ];
  return SymX(Round(U(0, left, center), 0.0032));
}

// regions meshed at different resolution (overlapping by ~1 cm so no seams open up)
const SKIN_REGIONS = {
  head: { keep: (x, y) => y > 1.466 && Math.abs(x) < 0.16, box: [-0.17, 1.462, -0.13, 0.17, 1.76, 0.13], h: 0.0022 },
  hand: { keep: (x, y, z) => x > 0.2 && dot3(sub3([x, y, z], HAND.O), HAND.D) > -0.022, box: [0.2, 0.62, -0.05, 0.37, 0.88, 0.06], h: 0.0017 },
  foot: { keep: (x, y) => x > 0 && y < 0.116, box: [0.03, -0.004, -0.09, 0.15, 0.12, 0.23], h: 0.0023 },
  torsoU: { keep: (x, y, z) => (y <= 1.476 || Math.abs(x) >= 0.15) && y >= 1.05 && !(Math.abs(x) > 0.2 && dot3(sub3([Math.abs(x), y, z], HAND.O), HAND.D) > -0.012), box: [-0.4, 1.03, -0.16, 0.4, 1.56, 0.14], h: 0.0044 },
  torsoL: { keep: (x, y, z) => y < 1.058 && y >= 0.594 && !(Math.abs(x) > 0.2 && dot3(sub3([Math.abs(x), y, z], HAND.O), HAND.D) > -0.012), box: [-0.4, 0.594, -0.16, 0.4, 1.066, 0.14], h: 0.0044 },
  legs: { keep: (x, y) => y < 0.61 && y >= 0.104, box: [-0.16, 0.1, -0.1, 0.16, 0.612, 0.09], h: 0.0044 },
};

function skinColor(x, y, z) {
  // subtle regional tint: lips, palms/soles lighter, cheeks warmer
  let r = 1, g = 1, b = 1;
  const lip = Math.exp(-(((y - 1.559) / 0.008) ** 2) - ((x / 0.02) ** 2)) * smoothstep(0.09, 0.1, z);
  r -= lip * 0.02; g -= lip * 0.22; b -= lip * 0.16;
  const cheek = Math.exp(-((((Math.abs(x) - 0.045) / 0.018) ** 2) + ((y - 1.6) / 0.02) ** 2)) * smoothstep(0.06, 0.08, z);
  g -= cheek * 0.06; b -= cheek * 0.05;
  return [r, g, b];
}

function buildSkin(T) {
  const meta = { layer: 'skin', group: 'Deri', noShadow: true };
  const desc = 'Vücudun en büyük organı (yetişkinde ~2 m²). Epidermis, dermis ve deri altı yağ dokusundan oluşur; koruma, ısı düzenleme, duyu ve D vitamini sentezinde görev alır.';
  T('Deri: göğüs ve kollar', () => {
    const R = SKIN_REGIONS.torsoU;
    addPart(meshSDF(bodySDF(), R.h, { box: R.box, keep: R.keep, color: skinColor, ao: 0, aoMin: 1, lip: 2.4, align: true }), 'skin', { ...meta, id: 'skinTorsoU', tr: 'Deri (göğüs ve kollar)', la: 'cutis', desc });
  });
  T('Deri: karın ve kalça', () => {
    const R = SKIN_REGIONS.torsoL;
    addPart(meshSDF(bodySDF(), R.h, { box: R.box, keep: R.keep, color: skinColor, ao: 0, aoMin: 1, lip: 2.4, align: true }), 'skin', { ...meta, id: 'skinTorsoL', tr: 'Deri (karın, kalça ve uyluk)', la: 'cutis', desc });
  });
  T('Deri: bacaklar', () => {
    const R = SKIN_REGIONS.legs;
    addPart(meshSDF(bodySDF(), R.h, { box: R.box, keep: R.keep, color: skinColor, ao: 0, aoMin: 1, lip: 2.4, align: true }), 'skin', { ...meta, id: 'skinLegs', tr: 'Deri (bacaklar)', la: 'cutis', desc });
  });
  T('Deri: baş ve yüz', () => {
    const R = SKIN_REGIONS.head;
    addPart(meshSDF(bodySDF(), R.h, { box: R.box, keep: R.keep, color: skinColor, ao: 0, aoMin: 1, lip: 2.4 }), 'skin', { ...meta, id: 'skinHead', tr: 'Deri (baş ve yüz)', la: 'cutis faciei', desc });
  });
  T('Deri: eller', () => {
    const R = SKIN_REGIONS.hand;
    addPair(meshSDF(bodySDF(), R.h, { box: R.box, keep: R.keep, ao: 0, aoMin: 1, lip: 2.4 }), 'skin', { ...meta, id: 'skinHand', tr: 'Deri (el)', la: 'cutis manus', desc });
  });
  T('Deri: ayaklar', () => {
    const R = SKIN_REGIONS.foot;
    addPair(meshSDF(bodySDF(), R.h, { box: R.box, keep: R.keep, ao: 0, aoMin: 1, lip: 2.4 }), 'skin', { ...meta, id: 'skinFoot', tr: 'Deri (ayak)', la: 'cutis pedis', desc });
  });
}
