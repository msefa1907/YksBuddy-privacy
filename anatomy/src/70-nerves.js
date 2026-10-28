// ===================== Nervous system: spinal cord & peripheral nerves =====================
function nerveGeo(pts, r0, r1, extra = {}) {
  return sweep(pts, { r: extra.rFn || ((t) => lerp(r0, r1, t)), radial: r0 > 0.003 ? 12 : 8, step: extra.step || Math.max(0.002, r0), caps: true });
}
// root exit point of spinal nerve below vertebra i (left side)
function rootExit(i, out = 0.012) {
  const s = vertSpec(Math.min(i, 23));
  return vLocal(Math.min(i, 23), s.bodyW + out, -s.bodyH * 1.25, -s.bodyD * 0.55);
}
function rootStart(i) { const s = vertSpec(Math.min(i, 23)); return vLocal(Math.min(i, 23), s.canalW * 0.5, -s.bodyH * 0.9, -(s.bodyD + s.canalD)); }
// sacral foramina (left) used for sacral roots
const sacralRoot = (k) => { const top = [0, 0.941, -0.05], bot = [0, 0.852, -0.104]; return add3(mix3(top, bot, 0.2 + k * 0.2), [0.018 - k * 0.0018, 0, 0.012]); };

function buildNerves(T) {
  const nm = { layer: 'nervous', group: 'Çevresel sinir sistemi' };
  T('Omurilik', () => {
    const pts = [[0, 1.592, -0.027]];
    for (let i = 0; i <= 19; i++) pts.push(canalPoint(i));
    const rf = (t) => { const idx = t * 20; return idx < 4 ? 0.0056 : idx < 8 ? 0.0062 : idx < 16 ? 0.0046 : idx < 18.5 ? 0.0054 : lerp(0.0054, 0.0016, (idx - 18.5) / 1.5); };
    addPart(nerveGeo(pts, 0, 0, { rFn: rf, step: 0.003 }), 'nerve', { layer: 'nervous', group: 'Merkezi sinir sistemi', id: 'spinalCord', tr: 'Omurilik', la: 'medulla spinalis', flow: { kind: 'n', speed: 0.5 }, desc: 'Beyin ile vücut arasındaki iletim yolu ve refleks merkezi. Omurga kanalında soğancıktan L1-L2 hizasına kadar uzanır (~45 cm); dışta ak madde, içte kelebek şeklinde boz madde bulunur. 31 çift omurilik siniri çıkar.' });
    // cauda equina
    const geos = [];
    for (let k = 0; k < 5; k++) for (const sx of [1, -1]) {
      const end = mirXIf(sx, k < 1 ? rootStart(22) : sacralRoot(k - 1));
      const p0 = add3(canalPoint(19), [sx * 0.0012 * (k + 1) * 0.5, -0.004, 0]);
      const mid = add3(canalPoint(21), [sx * 0.0016 * (k + 1), 0, 0]);
      geos.push(nerveGeo([p0, mid, add3(canalPoint(23), [sx * 0.002 * (k + 1), 0, 0]), end], 0.0009, 0.0009));
    }
    addPart(mergeGeos(geos), 'nerve', { ...nm, id: 'caudaEquina', tr: 'At kuyruğu', la: 'cauda equina', desc: 'Omurilik L1-L2 hizasında sonlandığı için alt bel ve sağrı sinir kökleri omurga kanalında at kuyruğu görünümünde aşağı iner. Bel ponksiyonu bu bölgeden güvenle yapılır.', noShadow: true });
  });
  T('Omurilik sinirleri', () => {
    const geos = [];
    for (let i = 0; i <= 23; i++) {
      const a = rootStart(i), b = rootExit(i); const g = mix3(a, b, 0.62);
      geos.push(nerveGeo([a, g, b], 0.0012, 0.0016));
    }
    for (let k = 0; k < 4; k++) { const a = sacralRoot(k); geos.push(nerveGeo([add3(a, [-0.004, 0.006, -0.02]), a, add3(a, [0.01, -0.004, 0.012])], 0.0013, 0.0016)); }
    addPair(mergeGeos(geos), 'nerve', { ...nm, id: 'spinalNerves', tr: 'Omurilik sinir kökleri', la: 'nn. spinales', desc: 'Her omurilik siniri ön (motor) ve arka (duyu) kökün birleşmesiyle oluşur ve omurlar arası delikten çıkar. Arka kök üzerindeki şişkinlik spinal gangliondur.', noShadow: true });
    // intercostal nerves along the lower border of each rib
    const ic = [];
    for (const rib of ribPaths()) {
      if (rib.r > 11) continue;
      const pts = [rootExit(6 + rib.r), ...rib.pts.slice(2).map(p => add3(p, [-Math.sign(p[0]) * 0.004, -0.0078, 0.0]))];
      if (rib.cart && rib.r <= 7) pts.push(add3(rib.cart[1], [0, -0.008, 0.004]));
      ic.push(nerveGeo(pts, 0.0011, 0.0008, { step: 0.005 }));
    }
    addPair(mergeGeos(ic), 'nerve', { ...nm, id: 'intercostal', tr: 'Kaburgalar arası sinirler', la: 'nn. intercostales', desc: 'T1-T11 omurilik sinirlerinin ön dalları; kaburgalar arası kasları ve göğüs-karın derisini uyarır. Kaburga altındaki olukta en altta yer alır.', noShadow: true });
  });
  T('Kol sinirleri', () => {
    const A = [0.128, 1.398, -0.006];
    const plexus = [];
    for (let i = 4; i <= 7; i++) { const e = rootExit(i, 0.016); plexus.push(nerveGeo([rootExit(i), e, mix3(e, A, 0.5), A], 0.0022, 0.0028)); }
    addPair(mergeGeos(plexus), 'nerve', { ...nm, id: 'brachialPlexus', tr: 'Kol siniri ağı', la: 'plexus brachialis', desc: 'C5-T1 omurilik sinirlerinin ön dallarının oluşturduğu ağ; kökler, gövdeler, kordonlar ve dallar halinde düzenlenir ve tüm kolu uyarır.' });
    const nerves = [
      { id: 'median', tr: 'Orta sinir', la: 'n. medianus', r: [0.0026, 0.0018], pts: [A, [0.168, 1.33, -0.002], [0.196, 1.25, 0.004], [0.21, 1.17, 0.005], [0.228, 1.096, 0.01], [0.248, 1.04, 0.012], [0.264, 0.98, 0.013], [0.284, 0.9, 0.012], [0.293, 0.862, 0.012], H_(0.02, 0.004, 0.009), H_(0.04, 0.006, 0.009)], desc: 'Önkol bükücü kaslarını ve başparmak tarafındaki 3,5 parmağın avuç yüzü derisini uyarır. El bileğindeki karpal tünelde sıkışması "karpal tünel sendromu"na yol açar.' },
      { id: 'ulnar', tr: 'Ulnar sinir', la: 'n. ulnaris', r: [0.0024, 0.0016], pts: [A, [0.166, 1.33, -0.012], [0.186, 1.24, -0.022], [0.198, 1.15, -0.03], [0.202, 1.112, -0.036], [0.212, 1.07, -0.022], [0.24, 0.99, -0.01], [0.262, 0.9, 0.0], [0.272, 0.862, 0.005], H_(0.018, -0.015, 0.009), H_(0.04, -0.02, 0.008)], desc: 'Dirseğin iç topuzunun (medial epikondil) arkasından geçer; buraya çarpınca hissedilen karıncalanma ("komik kemik") bu sinirdendir. Elin küçük kaslarının çoğunu uyarır.' },
      { id: 'radialN', tr: 'Radial sinir', la: 'n. radialis', r: [0.0027, 0.0014], pts: [A, [0.164, 1.34, -0.03], [0.19, 1.29, -0.038], [0.216, 1.23, -0.034], [0.238, 1.17, -0.02], [0.25, 1.13, -0.004], [0.257, 1.1, 0.008], [0.266, 1.04, 0.014], [0.284, 0.96, 0.014], [0.304, 0.89, 0.008], [0.312, 0.865, 0.002], H_(0.03, 0.022, -0.011)], desc: 'Pazı kemiğinin arkasındaki spiral olukta dolanır; kolun ve önkolun tüm açıcı (ekstansör) kaslarını uyarır. Pazı kemiği kırıklarında zedelenirse "düşük el" görülür.' },
      { id: 'musculocut', tr: 'Kas-deri siniri', la: 'n. musculocutaneus', r: [0.0018, 0.0011], pts: [A, [0.16, 1.37, 0.012], [0.188, 1.3, 0.018], [0.212, 1.2, 0.016], [0.238, 1.12, 0.018], [0.258, 1.06, 0.018], [0.282, 0.96, 0.014]], desc: 'Pazı kası, kol kası ve korakobrakial kası uyarır; önkolun dış yan derisinin duyusunu sağlar.' },
      { id: 'axillaryN', tr: 'Aksiller sinir', la: 'n. axillaris', r: [0.0019, 0.0012], pts: [A, [0.158, 1.38, -0.03], [0.186, 1.37, -0.04], [0.206, 1.365, -0.028], [0.216, 1.36, -0.012]], desc: 'Pazı kemiğinin cerrahi boynu çevresinde dolanarak deltoid ve küçük yuvarlak kası uyarır.' },
    ];
    for (const n of nerves) addPair(nerveGeo(n.pts, n.r[0], n.r[1]), 'nerve', { ...nm, id: n.id, tr: n.tr, la: n.la, desc: n.desc, flow: { kind: 'n', speed: 0.45 } });
    const digital = [];
    for (const f of [HAND.thumb, ...HAND.fingers]) {
      const tip = add3(f.tip, mul3(HAND.P, 0.003)); const j1 = add3(f.mcp, mul3(HAND.P, 0.007));
      digital.push(nerveGeo([H_(0.04, f.name === 'V' || f.name === 'IV' ? -0.02 : 0.006, 0.009), j1, add3(mix3(f.mcp, f.tip, 0.5), mul3(HAND.P, 0.006)), tip], 0.0011, 0.0007));
    }
    addPair(mergeGeos(digital), 'nerve', { ...nm, id: 'digitalN', tr: 'Parmak sinirleri', la: 'nn. digitales palmares', desc: 'Orta ve ulnar sinirin parmaklara giden duyu dalları; parmak uçları vücudun dokunmaya en duyarlı bölgelerindendir.', noShadow: true });
  });
  T('Bacak sinirleri', () => {
    const sacr = [0, 1, 2].map(k => sacralRoot(k));
    const notch = [0.064, 0.9, -0.062];
    const plexus = [nerveGeo([rootExit(22), [0.04, 0.95, -0.05], notch], 0.0026, 0.003), nerveGeo([rootExit(23), [0.04, 0.935, -0.058], notch], 0.0028, 0.003),
      ...sacr.map(p => nerveGeo([p, add3(p, [0.015, -0.004, 0.004]), notch], 0.0024, 0.003))];
    addPair(mergeGeos(plexus), 'nerve', { ...nm, id: 'sacralPlexus', tr: 'Sağrı siniri ağı', la: 'plexus sacralis', desc: 'L4-S4 sinirlerinden oluşur; siyatik sinir başta olmak üzere kalça ve bacağın arka bölümünü uyaran sinirleri verir.' });
    const sciatic = [notch, [0.08, 0.875, -0.068], [0.096, 0.835, -0.06], [0.099, 0.76, -0.05], [0.097, 0.66, -0.042], [0.094, 0.58, -0.038], [0.092, 0.555, -0.037]];
    const nerves = [
      { id: 'sciatic', tr: 'Siyatik sinir', la: 'n. ischiadicus', r: [0.0048, 0.0042], pts: sciatic, desc: 'Vücudun en kalın ve en uzun siniri. Büyük siyatik çentikten çıkar, uyluğun arkasından iner ve diz arkasında tibial ve ortak fibular sinirlere ayrılır. Bel fıtığında sıkışması siyatalji ağrısı yapar.' },
      { id: 'tibialN', tr: 'Tibial sinir', la: 'n. tibialis', r: [0.0034, 0.0018], pts: [[0.092, 0.555, -0.037], [0.09, 0.5, -0.038], [0.086, 0.42, -0.036], [0.08, 0.25, -0.03], [0.071, 0.1, -0.022], [0.068, 0.072, -0.022], F_(0.0, -0.022, -0.052), F_(0.06, -0.014, -0.06), F_(0.12, -0.004, -0.064)], desc: 'Baldır kaslarını ve ayak tabanını uyarır; iç topuğun arkasından geçer.' },
      { id: 'fibularN', tr: 'Ortak fibular sinir', la: 'n. fibularis communis', r: [0.0028, 0.0014], pts: [[0.092, 0.555, -0.037], [0.108, 0.5, -0.034], [0.122, 0.45, -0.024], [0.126, 0.43, -0.008], [0.118, 0.4, 0.004], [0.114, 0.25, 0.006], [0.104, 0.1, 0.016], F_(0.05, 0.01, -0.012), F_(0.1, 0.004, -0.03)], desc: 'Baldır kemiği başının boynunu sararak deri altında yüzeyelleşir; burada yaralanırsa ayak bileği yukarı kaldırılamaz ("düşük ayak").' },
      { id: 'femoralN', tr: 'Uyluk siniri', la: 'n. femoralis', r: [0.0032, 0.0018], pts: [rootExit(21), [0.05, 1.0, -0.02], [0.07, 0.95, -0.006], [0.09, 0.905, 0.03], [0.096, 0.885, 0.048], [0.1, 0.85, 0.052], [0.106, 0.8, 0.05]], desc: 'L2-L4 köklerinden oluşur; kasık bağının altından geçerek kuadriseps kasını uyarır. Diz refleksi bu sinir yoluyla oluşur.' },
      { id: 'saphenousN', tr: 'Safen sinir', la: 'n. saphenus', r: [0.0012, 0.0008], pts: [[0.096, 0.85, 0.05], [0.08, 0.76, 0.026], [0.07, 0.62, 0.0], [0.062, 0.5, -0.02], [0.064, 0.3, -0.004], [0.066, 0.1, 0.014]], desc: 'Uyluk sinirinin en uzun duyu dalı; bacağın iç yüz derisini uyarır.' },
      { id: 'obturatorN', tr: 'Obturator sinir', la: 'n. obturatorius', r: [0.0022, 0.0014], pts: [rootExit(21, 0.008), [0.045, 0.98, -0.02], [0.05, 0.92, -0.005], [0.048, 0.872, 0.03], [0.058, 0.82, 0.03], [0.066, 0.74, 0.02]], desc: 'Obturator delikten geçerek uyluğun iç (yaklaştırıcı) kaslarını uyarır.' },
    ];
    for (const n of nerves) addPair(nerveGeo(n.pts, n.r[0], n.r[1]), 'nerve', { ...nm, id: n.id, tr: n.tr, la: n.la, desc: n.desc, flow: { kind: 'n', speed: 0.5 } });
  });
  T('Kafa çiftleri ve otonom sinirler', () => {
    // vagus (left & right differ slightly)
    const vagL = [[0.028, 1.592, -0.018], [0.032, 1.55, -0.002], [0.032, 1.5, 0.008], [0.032, 1.44, 0.012], [0.03, 1.39, 0.012], [0.026, 1.36, -0.004], [0.022, 1.32, -0.03], [0.014, 1.26, -0.026], [0.024, 1.2, -0.012], [0.04, 1.17, 0.006]];
    const vagR = [[-0.028, 1.592, -0.018], [-0.032, 1.55, -0.002], [-0.032, 1.5, 0.008], [-0.03, 1.44, 0.012], [-0.022, 1.38, 0.0], [-0.01, 1.32, -0.03], [0.0, 1.26, -0.036], [0.012, 1.2, -0.024], [0.026, 1.17, -0.006]];
    const vd = 'X. kafa çifti. Boyunda şah damarlarıyla birlikte iner; kalp, akciğerler ve sindirim kanalının parasempatik uyarımını sağlar (kalp atımını yavaşlatır, sindirimi hızlandırır).';
    addPart(nerveGeo(vagL, 0.0018, 0.0013), 'nerve', { ...nm, id: 'vagus_L', tr: 'Vagus siniri (sol)', la: 'n. vagus', desc: vd, flow: { kind: 'n', speed: 0.35 } });
    addPart(nerveGeo(vagR, 0.0018, 0.0013), 'nerve', { ...nm, id: 'vagus_R', tr: 'Vagus siniri (sağ)', la: 'n. vagus', desc: vd, flow: { kind: 'n', speed: 0.35 } });
    const phrL = [rootExit(3, 0.01), [0.03, 1.49, 0.006], [0.036, 1.43, 0.014], [0.05, 1.37, 0.026], [0.066, 1.3, 0.042], [0.074, 1.25, 0.04], [0.074, 1.215, 0.03]];
    const phrR = [mirX(rootExit(3, 0.01)), [-0.03, 1.49, 0.006], [-0.036, 1.43, 0.014], [-0.04, 1.36, 0.03], [-0.046, 1.3, 0.03], [-0.05, 1.25, 0.02], [-0.05, 1.23, 0.012]];
    const pd = 'C3-C5 köklerinden çıkar ve diyaframı uyarır ("C3, 4, 5 diyaframı canlı tutar"). Kalp zarının yanından aşağı iner.';
    addPart(nerveGeo(phrL, 0.0014, 0.0012), 'nerve', { ...nm, id: 'phrenic_L', tr: 'Frenik sinir (sol)', la: 'n. phrenicus', desc: pd, noShadow: true });
    addPart(nerveGeo(phrR, 0.0014, 0.0012), 'nerve', { ...nm, id: 'phrenic_R', tr: 'Frenik sinir (sağ)', la: 'n. phrenicus', desc: pd, noShadow: true });
    // sympathetic trunk with ganglia
    const pts = []; const gang = [];
    for (let i = 1; i <= 23; i++) { const s = vertSpec(i); pts.push(vLocal(i, s.bodyW + 0.0035, 0, s.bodyD * 0.1)); }
    const n = pts.length;
    const geo = sweep(pts, { r: (t) => { const k = t * (n - 1); const fr = k - Math.round(k); return 0.0011 + 0.0016 * Math.exp(-((fr / 0.12) ** 2)); }, radial: 8, step: 0.0015 });
    void gang;
    addPair(geo, 'nerve', { ...nm, group: 'Otonom sinir sistemi', id: 'sympTrunk', tr: 'Sempatik sinir zinciri', la: 'truncus sympathicus', desc: 'Omurganın iki yanında boncuk dizisi gibi uzanan sempatik ganglionlar. "Savaş ya da kaç" yanıtında kalp hızını artırır, bronşları genişletir, sindirimi yavaşlatır.', noShadow: true });
    // optic & olfactory
    const ch = [0, 1.633, 0.012];
    const optic = nerveGeo([add3(LM.eye, [0.0, 0, -0.0115]), add3(LM.eye, [-0.004, -0.001, -0.022]), [0.012, 1.634, 0.02], ch], 0.0018, 0.0016);
    addPair(optic, 'nerve', { ...nm, group: 'Kafa çiftleri', id: 'opticN', tr: 'Görme siniri', la: 'n. opticus (II)', desc: 'II. kafa çifti. Retinadaki görme bilgisini taşır; iki görme siniri optik kiazmada çaprazlaşır (iç yarı lifler karşı tarafa geçer).' });
    addPair(nerveGeo([[0.008, 1.646, 0.058], [0.009, 1.645, 0.036], [0.012, 1.642, 0.02]], 0.0022, 0.0012), 'nerve', { ...nm, group: 'Kafa çiftleri', id: 'olfactory', tr: 'Koku soğancığı ve yolu', la: 'bulbus et tractus olfactorius (I)', desc: 'I. kafa çifti. Burun boşluğundaki koku reseptörlerinden gelen uyarıları beyne iletir.' });
    const tri = [[0.03, 1.625, -0.005], [0.04, 1.62, 0.01]];
    addPair(mergeGeos([nerveGeo([tri[1], [0.04, 1.64, 0.05], [0.032, 1.656, 0.078]], 0.0012, 0.0008), nerveGeo([tri[1], [0.038, 1.615, 0.05], [0.028, 1.612, 0.075]], 0.0012, 0.0008), nerveGeo([tri[1], [0.045, 1.6, 0.02], [0.045, 1.56, 0.04], [0.02, 1.535, 0.074]], 0.0012, 0.0008), nerveGeo(tri, 0.0024, 0.002)]), 'nerve', { ...nm, group: 'Kafa çiftleri', id: 'trigeminal', tr: 'Üçlü sinir', la: 'n. trigeminus (V)', desc: 'V. kafa çifti; göz, üst çene ve alt çene dallarıyla yüzün duyusunu ve çiğneme kaslarını sağlar.', noShadow: true });
  });
}
function mirXIf(sx, p) { return sx > 0 ? p : mirX(p); }
