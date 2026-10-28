// ===================== Circulatory system: arteries & veins =====================
// Paths are listed heart -> periphery for arteries and periphery -> heart for veins, so the
// same point order drives the blood-flow particles.
const H_ = (d, l, p) => HAND.at(d, l, p);
const F_ = (f, l, u) => FOOT.at(f, l, u);
// superficial vessels follow the skin envelope at a given depth
function onSkin(pts, depth = 0.0035) {
  const f = bodySDF().f;
  return pts.map(p => projectTo(f, p, -depth, 5, 0.002));
}
const offsetPts = (pts, o) => pts.map(p => add3(p, o));

function vessel(pts, r0, r1, kind, extra = {}) {
  const geo = sweep(pts, { r: (t) => lerp(r0, r1, Math.pow(t, extra.rPow || 1)), radial: extra.radial || (r0 > 0.006 ? 16 : r0 > 0.003 ? 12 : 8), step: extra.step || Math.max(0.002, r0 * 0.9), caps: true });
  return geo;
}

const ARTERY_DEFS = () => {
  const brach = [[0.05, 1.44, 0.01], [0.08, 1.437, 0.01], [0.105, 1.428, 0.008], [0.135, 1.408, 0.0], [0.162, 1.375, -0.006], [0.182, 1.33, -0.006],
    [0.194, 1.26, -0.003], [0.205, 1.18, 0.001], [0.218, 1.13, 0.004], [0.229, 1.098, 0.006]];
  const fem = [[0.045, 0.956, -0.004], [0.058, 0.932, 0.008], [0.072, 0.906, 0.03], [0.08, 0.885, 0.05], [0.085, 0.85, 0.046], [0.085, 0.76, 0.032],
    [0.081, 0.66, 0.012], [0.08, 0.6, -0.012], [0.086, 0.545, -0.028], [0.089, 0.49, -0.032], [0.09, 0.455, -0.03]];
  return [
    // central
    { id: 'aorta', tr: 'Aort', la: 'aorta', pts: [[0.004, 1.296, 0.03], [0.0, 1.33, 0.04], [0.0, 1.356, 0.036], [0.008, 1.372, 0.02], [0.02, 1.37, -0.008], [0.025, 1.35, -0.034], [0.024, 1.3, -0.046], [0.021, 1.24, -0.05], [0.016, 1.18, -0.042], [0.011, 1.13, -0.026], [0.008, 1.09, -0.01], [0.005, 1.05, 0.0], [0.002, 1.012, 0.004]], r: [0.0128, 0.0088], central: true, speed: 0.3, desc: 'Vücudun en büyük atardamarı. Sol karıncıktan çıkar; çıkan aort, aort kemeri ve inen aort (göğüs ve karın) bölümlerinden oluşur. L4 hizasında iki ortak kalça atardamarına ayrılır.' },
    { id: 'brachioceph', tr: 'Kol-baş atardamar gövdesi', la: 'truncus brachiocephalicus', pts: [[0.0, 1.366, 0.03], [-0.008, 1.392, 0.03], [-0.016, 1.424, 0.026]], r: [0.0068, 0.006], central: true, speed: 0.25, desc: 'Aort kemerinin ilk dalı; sağ ortak şah atardamarı ve sağ köprücük altı atardamarına ayrılır.' },
    { id: 'rCarotidStem', tr: 'Ortak şah atardamarı (sağ)', la: 'a. carotis communis dextra', pts: [[-0.016, 1.424, 0.026], [-0.021, 1.46, 0.016], [-0.024, 1.5, 0.01], [-0.026, 1.52, 0.008]], r: [0.0042, 0.0038], central: true, speed: 0.22 },
    { id: 'lCarotidStem', tr: 'Ortak şah atardamarı (sol)', la: 'a. carotis communis sinistra', pts: [[0.008, 1.372, 0.024], [0.015, 1.42, 0.02], [0.022, 1.465, 0.014], [0.024, 1.5, 0.01], [0.026, 1.52, 0.008]], r: [0.0042, 0.0038], central: true, speed: 0.22, desc: 'Boynun iki yanında soluk borusu boyunca yükselir; tiroit kıkırdağı hizasında iç ve dış şah atardamarlarına ayrılır. Nabız boyunda bu damardan alınır.' },
    { id: 'rSubclavStem', tr: 'Köprücük altı atardamarı (sağ, başlangıç)', la: 'a. subclavia dextra', pts: [[-0.016, 1.424, 0.026], [-0.03, 1.44, 0.016], [-0.05, 1.44, 0.01]], r: [0.0048, 0.0045], central: true, speed: 0.22 },
    { id: 'lSubclavStem', tr: 'Köprücük altı atardamarı (sol, başlangıç)', la: 'a. subclavia sinistra', pts: [[0.018, 1.37, 0.0], [0.027, 1.41, 0.004], [0.036, 1.436, 0.008], [0.05, 1.44, 0.01]], r: [0.0048, 0.0045], central: true, speed: 0.22 },
    { id: 'pulmTrunk', tr: 'Akciğer atardamarı gövdesi', la: 'truncus pulmonalis', pts: [[-0.002, 1.3, 0.052], [0.003, 1.322, 0.046], [0.008, 1.336, 0.03]], r: [0.0115, 0.0105], central: true, pulm: true, speed: 0.2, desc: 'Sağ karıncıktan çıkan ve kirli (oksijeni az) kanı akciğerlere taşıyan tek atardamar gövdesi. Bu yüzden şemalarda mavi gösterilir.' },
    { id: 'pulmArtL', tr: 'Sol akciğer atardamarı', la: 'a. pulmonalis sinistra', pts: [[0.008, 1.336, 0.03], [0.03, 1.338, 0.012], [0.05, 1.33, -0.002], [0.066, 1.32, -0.008]], r: [0.008, 0.006], central: true, pulm: true, speed: 0.2 },
    { id: 'pulmArtR', tr: 'Sağ akciğer atardamarı', la: 'a. pulmonalis dextra', pts: [[0.008, 1.336, 0.03], [-0.01, 1.338, 0.014], [-0.035, 1.33, 0.002], [-0.058, 1.322, -0.006]], r: [0.008, 0.006], central: true, pulm: true, speed: 0.2 },
    { id: 'celiac', tr: 'Çölyak gövde', la: 'truncus coeliacus', pts: [[0.011, 1.14, -0.028], [0.01, 1.142, -0.008], [0.03, 1.14, -0.012], [0.06, 1.13, -0.025], [0.1, 1.14, -0.045]], r: [0.0032, 0.0022], central: true, speed: 0.18, desc: 'Karın aortunun ilk ön dalı; mide, karaciğer, dalak, pankreas ve onikiparmak bağırsağının bir kısmını besler.' },
    { id: 'hepaticArt', tr: 'Karaciğer atardamarı', la: 'a. hepatica communis', pts: [[0.01, 1.142, -0.008], [-0.015, 1.135, 0.0], [-0.035, 1.13, 0.012], [-0.05, 1.132, 0.022]], r: [0.0025, 0.0018], central: true, speed: 0.18 },
    { id: 'sma', tr: 'Üst mezenterik atardamar', la: 'a. mesenterica superior', pts: [[0.008, 1.12, -0.018], [0.007, 1.095, 0.008], [0.004, 1.06, 0.026], [-0.01, 1.01, 0.034], [-0.04, 0.97, 0.03]], r: [0.0036, 0.0022], central: true, speed: 0.18, desc: 'İnce bağırsağın tamamını ve kalın bağırsağın ilk yarısını besler.' },
    { id: 'ima', tr: 'Alt mezenterik atardamar', la: 'a. mesenterica inferior', pts: [[0.006, 1.03, -0.002], [0.025, 1.0, 0.008], [0.045, 0.97, 0.012], [0.06, 0.94, 0.02]], r: [0.0022, 0.0015], central: true, speed: 0.15 },
    { id: 'renalArtL', tr: 'Sol böbrek atardamarı', la: 'a. renalis sinistra', pts: [[0.009, 1.088, -0.012], [0.025, 1.082, -0.025], [0.04, 1.072, -0.036]], r: [0.0032, 0.0028], central: true, speed: 0.2 },
    { id: 'renalArtR', tr: 'Sağ böbrek atardamarı', la: 'a. renalis dextra', pts: [[0.004, 1.086, -0.012], [-0.015, 1.076, -0.022], [-0.04, 1.058, -0.036]], r: [0.0032, 0.0028], central: true, speed: 0.2, desc: 'Böbreklere kalp debisinin yaklaşık %20-25\'i gelir.' },
    // paired (left side; mirrored)
    { id: 'carotidInt', tr: 'İç şah atardamarı', la: 'a. carotis interna', pts: [[0.026, 1.52, 0.008], [0.03, 1.55, -0.004], [0.028, 1.58, -0.008], [0.022, 1.605, -0.004], [0.016, 1.625, 0.004]], r: [0.0028, 0.0024], speed: 0.2, desc: 'Beyni ve gözü besler; kafatasına karotis kanalından girer.' },
    { id: 'carotidExt', tr: 'Dış şah atardamarı', la: 'a. carotis externa', pts: [[0.026, 1.52, 0.008], [0.033, 1.55, 0.012], [0.045, 1.58, 0.008], [0.058, 1.61, -0.008], [0.064, 1.65, -0.006], [0.062, 1.69, 0.0]], r: [0.0026, 0.0013], speed: 0.2, desc: 'Yüz, saçlı deri ve boyun yapılarını besler; şakak atardamarı ile sonlanır.' },
    { id: 'facialArt', tr: 'Yüz atardamarı', la: 'a. facialis', pts: [[0.036, 1.555, 0.012], [0.046, 1.54, 0.03], [0.042, 1.548, 0.06], [0.03, 1.57, 0.085], [0.02, 1.61, 0.09]], r: [0.0015, 0.0009], speed: 0.15, skin: 0.006 },
    { id: 'vertebralArt', tr: 'Omurga atardamarı', la: 'a. vertebralis', pts: [[0.036, 1.436, 0.004], ...[5, 4, 3, 2, 1].map(i => { const s = vertSpec(i); return vLocal(i, s.bodyW + 0.0055, 0, -s.bodyD * 0.22); }), vLocal(0, 0.025, 0.004, -0.006), [0.012, 1.6, -0.03], [0.004, 1.615, -0.018]], r: [0.0022, 0.0018], speed: 0.2, desc: 'Boyun omurlarının enine çıkıntılarındaki deliklerden geçerek beyne çıkar; ikisi birleşerek baziler atardamarı oluşturur.' },
    { id: 'subclavian', tr: 'Köprücük altı ve kol atardamarı', la: 'a. subclavia → a. axillaris → a. brachialis', pts: brach, r: [0.0045, 0.0028], speed: 0.22, desc: 'Köprücük altı atardamarı birinci kaburgadan sonra koltuk altı, pazı kemiği boyunca da kol (brakiyal) atardamarı adını alır. Tansiyon ölçümünde dirsek önünde bu damar dinlenir.' },
    { id: 'radialArt', tr: 'Radial atardamar', la: 'a. radialis', pts: [[0.229, 1.098, 0.006], [0.248, 1.06, 0.008], [0.272, 0.98, 0.01], [0.298, 0.9, 0.01], [0.31, 0.866, 0.008], H_(0.008, 0.02, -0.006), H_(0.028, 0.012, -0.002), H_(0.04, 0.0, 0.0), H_(0.04, -0.018, 0.0)], r: [0.0018, 0.0012], speed: 0.2, desc: 'Önkolun başparmak tarafında seyreder; bilekte nabız en sık bu damardan alınır.' },
    { id: 'ulnarArt', tr: 'Ulnar atardamar', la: 'a. ulnaris', pts: [[0.229, 1.098, 0.006], [0.236, 1.06, 0.003], [0.25, 0.97, 0.004], [0.265, 0.89, 0.006], [0.274, 0.858, 0.007], H_(0.022, -0.014, 0.009), H_(0.046, -0.012, 0.0085), H_(0.052, 0.004, 0.0085), H_(0.046, 0.02, 0.008)], r: [0.0019, 0.0011], speed: 0.2, desc: 'Önkolun iç tarafında ilerler ve avuç içinde yüzeysel avuç kemerini oluşturur.' },
    ...HAND.fingers.map((f) => ({ id: 'digitalArt' + f.name, tr: 'Parmak atardamarı ' + f.name, la: 'a. digitalis palmaris', pts: [H_(0.052, f.mcp ? dot3(sub3(f.mcp, HAND.O), HAND.Lt) : 0, 0.0085), add3(f.mcp, mul3(HAND.P, 0.006)), add3(f.pip, mul3(HAND.P, 0.0055)), add3(f.dip, mul3(HAND.P, 0.005)), add3(f.tip, mul3(HAND.P, 0.003))], r: [0.0008, 0.0006], speed: 0.15 })),
    { id: 'commonIliac', tr: 'Ortak ve dış kalça atardamarı, uyluk atardamarı', la: 'a. iliaca communis → a. femoralis → a. poplitea', pts: [[0.002, 1.012, 0.004], [0.03, 0.982, 0.0], ...fem], r: [0.0062, 0.0036], speed: 0.24, desc: 'Ortak kalça atardamarı leğende iç ve dış dallara ayrılır; dış kalça atardamarı kasık bağının altından geçince uyluk (femoral) atardamarı, diz arkasında ise diz arkası (popliteal) atardamarı adını alır.' },
    { id: 'internalIliac', tr: 'İç kalça atardamarı', la: 'a. iliaca interna', pts: [[0.045, 0.956, -0.004], [0.052, 0.93, -0.035], [0.048, 0.905, -0.05], [0.06, 0.9, -0.07]], r: [0.0035, 0.0022], speed: 0.18, desc: 'Leğen organlarını, kalça kaslarını ve dış üreme organlarını besler.' },
    { id: 'deepFemoral', tr: 'Derin uyluk atardamarı', la: 'a. profunda femoris', pts: [[0.085, 0.845, 0.044], [0.098, 0.81, 0.024], [0.108, 0.74, 0.004], [0.11, 0.66, -0.012]], r: [0.003, 0.0018], speed: 0.18 },
    { id: 'antTibial', tr: 'Ön kaval atardamarı', la: 'a. tibialis anterior', pts: [[0.09, 0.455, -0.03], [0.1, 0.44, -0.012], [0.102, 0.4, 0.006], [0.099, 0.25, 0.012], [0.093, 0.11, 0.016], [0.09, 0.075, 0.02], F_(0.04, 0.0, -0.01), F_(0.08, -0.008, -0.024), F_(0.1, -0.012, -0.03)], r: [0.0022, 0.0014], speed: 0.2, desc: 'Bacağın ön bölmesini besler; ayak sırtında ayak sırtı atardamarı (a. dorsalis pedis) olarak devam eder ve burada nabız alınabilir.' },
    { id: 'postTibial', tr: 'Arka kaval atardamarı', la: 'a. tibialis posterior', pts: [[0.09, 0.455, -0.03], [0.085, 0.42, -0.032], [0.079, 0.25, -0.026], [0.07, 0.1, -0.02], [0.067, 0.07, -0.02], F_(0.0, -0.02, -0.05), F_(0.05, -0.012, -0.058), F_(0.11, 0.0, -0.062)], r: [0.0024, 0.0014], speed: 0.2, desc: 'İç topuğun (medial malleol) arkasından geçerek tabana ulaşır.' },
    { id: 'fibularArt', tr: 'Fibular atardamar', la: 'a. fibularis', pts: [[0.087, 0.43, -0.031], [0.1, 0.38, -0.03], [0.108, 0.2, -0.024], [0.11, 0.09, -0.02]], r: [0.0018, 0.0012], speed: 0.18 },
    { id: 'renalPlaceholder', skip: true },
  ];
};

const VEIN_DEFS = () => {
  return [
    // central (periphery -> heart)
    { id: 'svc', tr: 'Üst ana toplardamar', la: 'v. cava superior', pts: [[-0.03, 1.398, 0.026], [-0.031, 1.36, 0.026], [-0.031, 1.318, 0.022]], r: [0.0098, 0.0102], central: true, speed: 0.12, desc: 'Baş, boyun, kollar ve göğüs duvarının kirli kanını sağ kulakçığa getirir.' },
    { id: 'ivc', tr: 'Alt ana toplardamar', la: 'v. cava inferior', pts: [[-0.006, 0.986, 0.0], [-0.017, 1.04, 0.002], [-0.02, 1.1, -0.006], [-0.022, 1.16, -0.004], [-0.022, 1.21, 0.004], [-0.024, 1.245, 0.01], [-0.026, 1.268, 0.013]], r: [0.0108, 0.012], central: true, speed: 0.12, desc: 'Vücudun en büyük toplardamarı; diyaframın altındaki tüm bölgelerin kirli kanını sağ kulakçığa taşır.' },
    { id: 'brachiocephVL', tr: 'Sol kol-baş toplardamarı', la: 'v. brachiocephalica sinistra', pts: [[0.04, 1.43, 0.024], [0.02, 1.415, 0.036], [0.0, 1.406, 0.038], [-0.022, 1.4, 0.03], [-0.03, 1.398, 0.026]], r: [0.0068, 0.0075], central: true, speed: 0.12 },
    { id: 'brachiocephVR', tr: 'Sağ kol-baş toplardamarı', la: 'v. brachiocephalica dextra', pts: [[-0.04, 1.43, 0.022], [-0.034, 1.412, 0.025], [-0.03, 1.398, 0.026]], r: [0.0068, 0.0075], central: true, speed: 0.12 },
    { id: 'renalVL', tr: 'Sol böbrek toplardamarı', la: 'v. renalis sinistra', pts: [[0.04, 1.068, -0.032], [0.022, 1.076, -0.012], [0.004, 1.078, 0.012], [-0.017, 1.076, 0.004]], r: [0.0036, 0.004], central: true, speed: 0.12 },
    { id: 'renalVR', tr: 'Sağ böbrek toplardamarı', la: 'v. renalis dextra', pts: [[-0.04, 1.054, -0.032], [-0.03, 1.058, -0.016], [-0.019, 1.062, 0.0]], r: [0.0036, 0.004], central: true, speed: 0.12 },
    { id: 'portal', tr: 'Kapı toplardamarı', la: 'v. portae hepatis', pts: [[0.092, 1.112, -0.04], [0.06, 1.1, -0.022], [0.03, 1.09, -0.01], [0.002, 1.084, -0.004], [-0.018, 1.1, 0.004], [-0.035, 1.125, 0.014], [-0.048, 1.135, 0.02]], r: [0.003, 0.0062], central: true, portal: true, speed: 0.1, desc: 'Sindirim kanalından emilen besinleri içeren kanı karaciğere taşır (dalak ve mezenterik toplardamarların birleşmesiyle oluşur). Karaciğer bu kanı işledikten sonra karaciğer toplardamarlarıyla alt ana toplardamara verir.' },
    { id: 'smv', tr: 'Üst mezenterik toplardamar', la: 'v. mesenterica superior', pts: [[-0.045, 0.97, 0.034], [-0.012, 1.01, 0.038], [-0.002, 1.05, 0.03], [0.002, 1.084, -0.004]], r: [0.0022, 0.0034], central: true, portal: true, speed: 0.1 },
    { id: 'sagSinus', tr: 'Üst sagittal sinüs', la: 'sinus sagittalis superior', pts: [[0, 1.69, 0.07], [0, 1.73, 0.03], [0, 1.738, -0.02], [0, 1.72, -0.07], [0, 1.66, -0.098], [0.01, 1.632, -0.096]], r: [0.0018, 0.0034], central: true, speed: 0.08, desc: 'Beyin zarları (dura mater) arasındaki toplardamar kanalı; beynin kirli kanını ve beyin omurilik sıvısını toplar.' },
    { id: 'pulmVeinL', tr: 'Sol akciğer toplardamarları', la: 'vv. pulmonales sinistrae', pts: [[0.064, 1.3, -0.012], [0.045, 1.302, -0.014], [0.03, 1.306, -0.014]], r: [0.0052, 0.0058], central: true, pulmV: true, speed: 0.12, desc: 'Akciğerlerden temizlenmiş (oksijenli) kanı sol kulakçığa getiren toplardamarlar; bu yüzden kırmızı gösterilir.' },
    { id: 'pulmVeinR', tr: 'Sağ akciğer toplardamarları', la: 'vv. pulmonales dextrae', pts: [[-0.058, 1.296, -0.01], [-0.03, 1.3, -0.016], [-0.008, 1.306, -0.016]], r: [0.0052, 0.0058], central: true, pulmV: true, speed: 0.12 },
    // paired
    { id: 'intJugular', tr: 'İç şah toplardamarı', la: 'v. jugularis interna', pts: [[0.03, 1.594, -0.022], [0.035, 1.56, -0.004], [0.037, 1.51, 0.01], [0.039, 1.465, 0.018], [0.04, 1.43, 0.024]], r: [0.004, 0.0062], speed: 0.12, desc: 'Beyin, yüz ve boynun kirli kanını toplar; şah atardamarının dış yanında seyreder.' },
    { id: 'extJugular', tr: 'Dış şah toplardamarı', la: 'v. jugularis externa', pts: [[0.058, 1.585, -0.012], [0.062, 1.54, -0.004], [0.06, 1.49, 0.004], [0.056, 1.452, 0.01], [0.048, 1.438, 0.016]], r: [0.0018, 0.0026], speed: 0.1, skin: 0.004 },
    { id: 'subclavV', tr: 'Köprücük altı ve koltuk altı toplardamarı', la: 'v. subclavia → v. axillaris', pts: [[0.18, 1.33, 0.004], [0.16, 1.372, 0.006], [0.132, 1.402, 0.008], [0.1, 1.424, 0.016], [0.07, 1.432, 0.02], [0.04, 1.43, 0.024]], r: [0.0042, 0.0058], speed: 0.12 },
    { id: 'brachialV', tr: 'Kol toplardamarı', la: 'v. brachialis', pts: [[0.226, 1.1, 0.01], [0.214, 1.15, 0.006], [0.2, 1.24, 0.003], [0.186, 1.31, 0.004], [0.18, 1.33, 0.004]], r: [0.0022, 0.0032], speed: 0.1 },
    { id: 'cephalic', tr: 'Sefalik ven', la: 'v. cephalica', pts: [H_(0.03, 0.02, -0.013), [0.31, 0.875, -0.004], [0.296, 0.96, 0.006], [0.278, 1.04, 0.016], [0.262, 1.1, 0.024], [0.248, 1.18, 0.026], [0.232, 1.28, 0.03], [0.2, 1.37, 0.04], [0.16, 1.4, 0.04], [0.132, 1.402, 0.012]], r: [0.0016, 0.0026], speed: 0.1, skin: 0.0035, desc: 'Kolun dış (başparmak) tarafındaki yüzeyel toplardamar; deltoid-göğüs oluğundan geçerek koltuk altı toplardamarına dökülür.' },
    { id: 'basilic', tr: 'Bazilik ven', la: 'v. basilica', pts: [H_(0.03, -0.022, -0.012), [0.268, 0.88, -0.012], [0.25, 0.97, -0.006], [0.232, 1.05, 0.004], [0.216, 1.1, 0.012], [0.206, 1.17, 0.014], [0.2, 1.24, 0.003]], r: [0.0016, 0.0026], speed: 0.1, skin: 0.0035, desc: 'Kolun iç tarafındaki yüzeyel toplardamar; kolun ortasında derine geçerek kol toplardamarına katılır.' },
    { id: 'medCubital', tr: 'Dirsek orta toplardamarı', la: 'v. mediana cubiti', pts: [[0.262, 1.08, 0.022], [0.245, 1.094, 0.022], [0.226, 1.106, 0.02], [0.214, 1.114, 0.016]], r: [0.0018, 0.002], speed: 0.1, skin: 0.003, desc: 'Dirsek önünde sefalik ve bazilik venleri birleştirir; kan alma ve damar yolu açmada en sık kullanılan toplardamardır.' },
    { id: 'femoralV', tr: 'Uyluk ve kalça toplardamarı', la: 'v. femoralis → v. iliaca communis', pts: [[0.086, 0.455, -0.036], [0.085, 0.5, -0.036], [0.08, 0.555, -0.03], [0.074, 0.61, -0.014], [0.075, 0.66, 0.01], [0.077, 0.76, 0.03], [0.076, 0.85, 0.045], [0.072, 0.885, 0.048], [0.062, 0.91, 0.03], [0.048, 0.935, 0.008], [0.028, 0.968, -0.004], [-0.006, 0.986, 0.0]], r: [0.0036, 0.0068], speed: 0.12 },
    { id: 'greatSaph', tr: 'Büyük safen ven', la: 'v. saphena magna', pts: [F_(0.07, -0.024, -0.028), [0.064, 0.085, 0.022], [0.062, 0.16, 0.012], [0.062, 0.3, 0.004], [0.058, 0.43, -0.012], [0.056, 0.5, -0.022], [0.058, 0.6, -0.006], [0.062, 0.7, 0.014], [0.068, 0.79, 0.036], [0.073, 0.85, 0.05], [0.074, 0.866, 0.048]], r: [0.0017, 0.0028], speed: 0.1, skin: 0.0035, desc: 'Vücudun en uzun toplardamarı; ayak sırtından kasığa kadar bacağın iç yüzünde deri altında uzanır. Varis en sık burada görülür; baypas ameliyatlarında greft olarak kullanılır.' },
    { id: 'smallSaph', tr: 'Küçük safen ven', la: 'v. saphena parva', pts: [F_(0.06, 0.03, -0.035), [0.122, 0.06, -0.032], [0.106, 0.15, -0.05], [0.096, 0.3, -0.07], [0.092, 0.43, -0.05], [0.088, 0.47, -0.04]], r: [0.0014, 0.0022], speed: 0.1, skin: 0.0035 },
  ];
};

function coronaryPaths() {
  const v = ventriclesSDF(), a = atriaSDF(); const f = U(0.004, v, a).f;
  const P = (pts) => pts.map(p => projectTo(f, p, 0.0012, 6, 0.0015));
  return {
    lad: P([[0.012, 1.302, 0.036], [0.022, 1.302, 0.05], [0.028, 1.288, 0.064], [0.038, 1.27, 0.074], [0.052, 1.25, 0.078], [0.064, 1.234, 0.076], [0.071, 1.222, 0.07]]),
    lcx: P([[0.022, 1.302, 0.05], [0.04, 1.298, 0.03], [0.052, 1.285, 0.008], [0.055, 1.27, -0.01], [0.05, 1.255, -0.02]]),
    rca: P([[-0.004, 1.302, 0.04], [-0.022, 1.29, 0.045], [-0.036, 1.272, 0.034], [-0.044, 1.255, 0.012], [-0.04, 1.24, -0.008], [-0.02, 1.232, -0.012], [0.005, 1.228, -0.008]]),
    cardiacV: P([[0.06, 1.245, 0.065], [0.05, 1.27, 0.06], [0.045, 1.29, 0.04], [0.045, 1.285, 0.01], [0.03, 1.28, -0.012], [0.0, 1.27, -0.012]]),
  };
}

function buildVessels(T) {
  const art = { layer: 'arteries', group: 'Atardamarlar' }, ven = { layer: 'veins', group: 'Toplardamarlar' };
  const defaultDesc = { a: 'Oksijence zengin kanı kalpten dokulara taşıyan atardamar. Duvarı kalın ve esnektir.', v: 'Kirli kanı dokulardan kalbe geri taşıyan toplardamar. Duvarı ince, içinde geri akışı önleyen kapakçıklar bulunur.' };
  const emit = (d, kind) => {
    if (d.skip) return;
    const pts = d.skin ? onSkin(d.pts, d.skin) : d.pts;
    const geo = vessel(pts, d.r[0], d.r[1], kind);
    const mat = d.pulm ? 'pulmArtery' : d.pulmV ? 'pulmVein' : d.portal ? 'portal' : kind === 'a' ? 'artery' : 'vein';
    const meta = { ...(kind === 'a' ? art : ven), id: d.id, tr: d.tr, la: d.la, desc: d.desc || defaultDesc[kind], flow: { kind: d.pulm ? 'v' : d.pulmV ? 'a' : kind, speed: d.speed || 0.12 }, noShadow: d.r[0] < 0.002 };
    if (d.central) addPart(geo, mat, meta); else addPair(geo, mat, meta);
  };
  T('Atardamarlar', () => { for (const d of ARTERY_DEFS()) emit(d, 'a'); });
  T('Toplardamarlar', () => { for (const d of VEIN_DEFS()) emit(d, 'v'); });
  T('Koroner damarlar', () => {
    const c = coronaryPaths();
    const m = { pivot: HEART.C, anim: 'heartV', noShadow: true };
    addPart(mergeGeos([vessel(c.lad, 0.0016, 0.0009, 'a'), vessel(c.lcx, 0.0014, 0.0009, 'a'), vessel(c.rca, 0.0016, 0.0009, 'a')]), 'artery', { ...art, ...m, id: 'coronary', tr: 'Koroner atardamarlar', la: 'aa. coronariae', desc: 'Kalp kasını besleyen atardamarlar (sol ön inen dal, sirkumfleks ve sağ koroner arter). Tıkanmaları kalp krizine (miyokard enfarktüsü) yol açar.' });
    addPart(vessel(c.cardiacV, 0.0012, 0.0018, 'v'), 'vein', { ...ven, ...m, id: 'cardiacVein', tr: 'Büyük kalp toplardamarı', la: 'v. cordis magna', desc: 'Kalp kasının kirli kanını toplayarak koroner sinüs aracılığıyla sağ kulakçığa döker.' });
  });
  T('Kaburgalar arası damarlar', () => {
    const geos = [];
    for (const rib of ribPaths()) {
      if (rib.r < 2 || rib.r > 11) continue;
      const vi = 6 + rib.r;
      const start = [0.02, SPINE_PTS[vi][1] - 0.006, -0.05];
      const pts = [start, ...rib.pts.slice(1, -1).map(p => add3(p, [-Math.sign(p[0]) * 0.0035, -0.0062, 0]))];
      geos.push(vessel(pts, 0.0011, 0.0008, 'a', { radial: 6, step: 0.005 }));
    }
    addPair(mergeGeos(geos), 'artery', { ...art, id: 'intercostalArt', tr: 'Kaburgalar arası atardamarlar', la: 'aa. intercostales posteriores', desc: 'Göğüs aortundan çıkar ve her kaburganın alt kenarındaki olukta, toplardamar ve sinirle birlikte (yukarıdan aşağı: ven-arter-sinir) seyreder.', noShadow: true });
  });
}
