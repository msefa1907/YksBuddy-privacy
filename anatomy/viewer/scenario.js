// ===================== Scenario mode: step-by-step processes with YKS-level captions =====================
const SCN = { active: false, step: 0, labels: true, flow: true, sound: { key: null, until: 0 }, prev: null, plane: new THREE.Plane() };
const SPEEDS = [0.1, 0.25, 0.5, 1];

// camera placements and label anchors derived from the heart rig
function heartViews() {
  const F = CARDIO.F; const n4 = F.n4;
  const c = F.center.clone().lerp(F.B, 0.3);
  return {
    n4, c,
    thorax: { pos: c.clone().add(new THREE.Vector3(0.12, 0.05, 0.62)), target: c.clone().add(new THREE.Vector3(0, 0.02, 0)) },
    // the heart sits left of centre so the side panel does not cover it
    fourCh: (() => { const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n4).normalize(); const t = c.clone().addScaledVector(right, 0.03).add(new THREE.Vector3(0, 0.004, 0)); return { pos: t.clone().addScaledVector(n4, 0.38).add(new THREE.Vector3(0, 0.02, 0)), target: t }; })(),
    glass: { pos: c.clone().add(new THREE.Vector3(0.1, 0.06, 0.34)), target: c.clone().add(new THREE.Vector3(0.012, 0.012, 0)) },
    lungs: { pos: new THREE.Vector3(0.04, 1.29, 0.6), target: new THREE.Vector3(0.0, 1.265, 0) },
    body: { pos: new THREE.Vector3(0.18, 1.16, 1.5), target: new THREE.Vector3(0, 1.1, 0) },
  };
}
// a point on a vessel's centreline `arc` metres from the heart; with a cut, the first one on the visible side
function treePoint(tree, arc, cut) {
  const q = CARDIO.rig.trees[tree][0]; let s = 0, pick = null;
  for (let i = 0; i < q.p.length; i++) {
    if (i) s += Math.hypot(q.p[i][0] - q.p[i - 1][0], q.p[i][1] - q.p[i - 1][1], q.p[i][2] - q.p[i - 1][2]);
    if (s < arc) continue;
    const p = V3(q.p[i]);
    if (!cut || SCN.plane.distanceToPoint(p) > 0.003) return p;
    pick ||= p;
  }
  return pick || V3(q.p[q.p.length - 1]);
}
function anchors(names, cut) {
  const F = CARDIO.F; const v = F.val;
  const A = {
    RA: ['Sağ kulakçık', F.ch.RA.c], RV: ['Sağ karıncık', F.ch.RV.c.clone().lerp(F.A, 0.15)], LA: ['Sol kulakçık', F.ch.LA.c], LV: ['Sol karıncık', F.ch.LV.c.clone().lerp(F.A, 0.3)],
    tri: ['Triküspit kapak', v.tricuspid.c], mit: ['Mitral (biküspit) kapak', v.mitral.c], pul: ['Akciğer atardamarı kapağı', v.pulmonary.c], aov: ['Aort kapağı', v.aortic.c],
    sep: ['Karıncıklar arası bölme', F.sepC.clone().lerp(F.A, 0.35)],
    aorta: ['Aort', treePoint('aorta', 0.04, cut)], pa: ['Akciğer atardamarı', treePoint('pa', 0.025, cut)],
    svc: ['Üst ana toplardamar', treePoint('svc', 0.02, cut)], ivc: ['Alt ana toplardamar', treePoint('ivc', 0.02, cut)],
    pv: ['Akciğer toplardamarları', treePoint('pv', 0.02, cut)],
    sa: ['SA düğümü', F.sa], avn: ['AV düğümü', F.av], his: ['His demeti', F.av.clone().lerp(F.A, 0.18)],
    branches: ['Sağ ve sol dallar', F.av.clone().lerp(F.A, 0.55)], purk: ['Purkinje lifleri', F.B.clone().addScaledVector(F.ax, F.L * 0.5).addScaledVector(F.sepN, F.ch.LV.r)],
    heart: ['Kalp', F.center], lungR: ['Sağ akciğer', new THREE.Vector3(-0.08, 1.27, 0.0)], lungL: ['Sol akciğer', new THREE.Vector3(0.09, 1.25, -0.01)],
    dia: ['Diyafram', new THREE.Vector3(-0.06, 1.17, 0.05)], cap: ['Akciğer kılcalları: CO₂ verilir, O₂ alınır', new THREE.Vector3(-0.1, 1.24, -0.02)],
    desc: ['İnen aort', new THREE.Vector3(0.012, 1.05, 0.03)], body: ['Doku kılcalları: O₂ ve besin bırakılır', new THREE.Vector3(-0.05, 0.86, 0.04)],
  };
  const inside = new Set(['RA', 'RV', 'LA', 'LV', 'sep', 'sa', 'avn', 'his', 'branches', 'purk', 'tri', 'mit']);
  return names.map(k => ({ key: 'scn:' + k, text: A[k][0], pos: A[k][1].clone(), inside: inside.has(k) }));
}

const HEART_ONLY = { heart: 1, arteries: 1, veins: 1 };
const STEPS = [
  {
    title: 'Kalbin yeri ve yapısı', view: 'thorax', layers: { skeleton: 0.22, respiratory: 0.16, heart: 1, arteries: 1, veins: 1 }, speed: 1,
    labels: ['heart', 'aorta', 'pa', 'svc', 'ivc', 'lungR', 'lungL'],
    text: 'Kalp göğüs boşluğunda, iki akciğerin arasında, göğüs kemiğinin arkasında ve biraz solda yer alır. Yumruk büyüklüğünde, kaslı bir pompadır. Duvarı üç katmandan oluşur: dışta epikard, ortada kalp kası (miyokard), içte endokard. Kalp kası çizgilidir ama istemsiz çalışır. Yüzeyindeki koroner damarlar kalp kasının kendisini besler.',
  },
  {
    title: 'Dört odacık ve kapaklar', view: 'fourCh', cut: true, layers: HEART_ONLY, flow: 'heart', speed: 0.35,
    labels: ['RA', 'RV', 'LA', 'LV', 'tri', 'mit', 'sep', 'aorta', 'svc', 'ivc'],
    text: 'Kalpte iki kulakçık ve iki karıncık vardır. Sağ taraf vücuttan gelen oksijence fakir kanı (mavi), sol taraf akciğerlerden gelen oksijence zengin kanı (kırmızı) taşır; aradaki bölme iki kanın karışmasını önler. Kulakçık ile karıncık arasında sağda triküspit, solda mitral (biküspit) kapak; karıncık çıkışlarında yarım ay kapaklar bulunur. Kapaklar kanın geri dönmesini engeller. Kanı tüm vücuda pompalayan sol karıncığın duvarı en kalındır.',
  },
  {
    title: 'Uyarı iletim sistemi', view: 'fourCh', cut: true, layers: HEART_ONLY, conduction: true, glow: 1, flow: false, speed: 0.1, ecg: true,
    labels: ['sa', 'avn', 'his', 'branches', 'purk'],
    text: 'Kalp uyarısını kendisi üretir (otomatizma). Uyarı sağ kulakçıktaki SA düğümünde doğar ve kulakçıklara yayılır; kulakçıklar kasılır. AV düğümü uyarıyı kısa bir süre geciktirir, böylece karıncıklar kulakçıklar boşalınca kasılır. Uyarı His demeti, sağ–sol dallar ve Purkinje lifleriyle karıncıklara yayılır. EKG’de P dalgası kulakçıkların, QRS karıncıkların uyarılmasını, T dalgası karıncıkların dinlenmeye geçişini gösterir. Kalp hızını sempatik sinirler ve adrenalin artırır, parasempatik sinirler azaltır.',
  },
  {
    title: '1 · Kulakçık sistolü', view: 'fourCh', cut: true, layers: HEART_ONLY, flow: 'heart', glow: 0.22, speed: 0.15, ecg: true, hold: [0.0, 0.16],
    labels: ['RA', 'LA', 'tri', 'mit'],
    text: 'SA düğümünden gelen uyarıyla kulakçıklar kasılır. Kulakçıklardaki kan, açık olan triküspit ve mitral kapaklardan karıncıklara geçer ve karıncıklar tamamen dolar. Bu sırada karıncıklar gevşektir; yarım ay kapaklar kapalıdır.',
  },
  {
    title: '2 · Karıncık sistolü', view: 'fourCh', cut: true, layers: HEART_ONLY, flow: 'heart', glow: 0.22, speed: 0.15, ecg: true, hold: [0.16, 0.45],
    labels: ['RV', 'LV', 'tri', 'mit', 'aorta'],
    text: 'Uyarı karıncıklara ulaşınca karıncıklar kasılır. İçerideki basınç artınca AV kapaklar (triküspit ve mitral) kapanır: 1. kalp sesi (“lub”). Basınç atardamarlardakini geçince yarım ay kapaklar açılır; sağ karıncık kanı akciğer atardamarına, sol karıncık aorta pompalar. Bu sırada gevşeyen kulakçıklar toplardamarlardan gelen kanla dolmaya başlar.',
  },
  {
    title: '3 · Diyastol', view: 'fourCh', cut: true, layers: HEART_ONLY, flow: 'heart', glow: 0.22, speed: 0.15, ecg: true, hold: [0.45, 0.8],
    labels: ['RA', 'LA', 'tri', 'mit'],
    text: 'Karıncıklar gevşer ve basınçları düşer. Atardamarlardaki kan geri kaçmaya çalışınca yarım ay kapaklar kapanır: 2. kalp sesi (“dub”). Karıncık basıncı kulakçıklarınkinin altına inince AV kapaklar açılır ve kanın büyük bölümü kendiliğinden karıncıklara akar. Kalp kası bu evrede dinlenir.',
  },
  {
    title: 'Tam kalp döngüsü', view: 'fourCh', cut: true, layers: HEART_ONLY, flow: 'heart', glow: 0.18, speed: 0.35, ecg: true,
    labels: ['RA', 'RV', 'LA', 'LV'],
    text: 'Bir kalp döngüsü yaklaşık 0,8 saniye sürer (dakikada ~72 atım): kulakçık sistolü ~0,1 sn, karıncık sistolü ~0,3 sn, genel diyastol ~0,4 sn. Her kasılmada sol karıncık yaklaşık 70 mL kan pompalar; bu da dakikada yaklaşık 5 litre eder (kalp debisi).',
  },
  {
    title: 'Kan kalbe nasıl girer, nasıl çıkar?', view: 'glass', layers: { heart: 0.28, arteries: 0.3, veins: 0.3 }, flow: 'heart', speed: 0.3, ecg: true, pulse: true,
    labels: ['svc', 'ivc', 'RA', 'RV', 'pul', 'pa', 'pv', 'LA', 'LV', 'aov', 'aorta'],
    text: 'Kalp duvarı saydamlaştırıldı. Oksijence fakir kan üst ve alt ana toplardamarlarla sağ kulakçığa gelir, sağ karıncıktan akciğer atardamarına pompalanır. Akciğerlerden dönen oksijence zengin kan akciğer toplardamarlarıyla sol kulakçığa gelir, sol karıncıktan aorta pompalanır. İki karıncık aynı anda kasılır ve eşit miktarda kan pompalar.',
  },
  {
    title: 'Küçük dolaşım (akciğer dolaşımı)', view: 'lungs', layers: { respiratory: 0.1, heart: 0.55, arteries: 0.35, veins: 0.35 }, flow: 'pulm', speed: 0.5, pulse: true,
    labels: ['RV', 'pa', 'cap', 'pv', 'LA'],
    text: 'Sağ karıncık → akciğer atardamarı → akciğer kılcalları → akciğer toplardamarları → sol kulakçık. Akciğerlerde kan CO₂ bırakıp O₂ alır; oksijence fakir kan (mavi) oksijence zengin hâle gelir (kırmızı). Akciğer atardamarı oksijence fakir kan taşıyan tek atardamar, akciğer toplardamarı oksijence zengin kan taşıyan tek toplardamardır.',
  },
  {
    title: 'Büyük dolaşım (sistemik dolaşım)', view: 'body', layers: { skeleton: 0.12, heart: 0.55, arteries: 0.32, veins: 0.32 }, flow: 'body', speed: 0.6, pulse: true,
    labels: ['LV', 'aorta', 'desc', 'body', 'ivc', 'svc', 'RA'],
    text: 'Sol karıncık → aort → atardamarlar → doku kılcalları → toplardamarlar → üst ve alt ana toplardamar → sağ kulakçık. Dokulara O₂ ve besin bırakılır, CO₂ ve atıklar alınır. Her kasılmada aort duvarında başlayan basınç dalgası atardamarlar boyunca yayılır; bileğimizde hissettiğimiz nabız budur.',
  },
];

// ---------- entering / leaving ----------
function enterScenario() {
  if (!CARDIO.ready) return;
  SCN.prev = { layers: Object.fromEntries(LAYERS.map(l => [l.key, [l.on, layerOpacity[l.key]]])), split: state.split, cut: state.cut, palette: LOOK.palette };
  setPalette('atlas'); // oxygen-rich red / oxygen-poor blue is what the steps explain
  SCN.active = true; SCN.views = heartViews(); document.body.classList.add('scn'); document.body.classList.remove('show-layers');
  if (state.cut) $('tCut').click();
  setSplit(false); select(null);
  $('scn').hidden = false;
  goStep(0);
}
function exitScenario() {
  SCN.active = false; document.body.classList.remove('scn'); $('scn').hidden = true;
  setHeartCut(false); showFlow(null); CARDIO.fx.group.visible = false;
  Object.assign(CARDIO, { hold: null, playing: true, speed: 1, glow: 0, pulse: false });
  for (const l of LAYERS) { const [on, op] = SCN.prev.layers[l.key]; setLayer(l.key, on); setOpacity(l.key, op); const sl = $('op_' + l.key); if (sl) sl.value = Math.round(op * 100); }
  setSplit(SCN.prev.split); setPalette(SCN.prev.palette);
  flyTo(HOME[0], HOME[1]);
  renderInfo();
}
function setHeartCut(on) {
  const pl = SCN.plane;
  if (on) {
    const V = SCN.views; const F = CARDIO.F;
    // four-chamber plane through both AV valves and the apex; the side facing the camera is removed
    pl.setFromNormalAndCoplanarPoint(V.n4.clone().negate(), F.val.tricuspid.c.clone().addScaledVector(V.n4, 0.002));
  }
  // heart and vessels are cut; blood particles are cut only inside the heart, so ejected blood stays visible
  for (const [k, m] of Object.entries(MATS)) {
    const cut = on && RIG_LAYERS.has(k.split(':')[0]);
    if (!!m.clippingPlanes !== cut) { m.clippingPlanes = cut ? [pl] : null; m.needsUpdate = true; }
  }
  for (const [b, h] of hlCache) { h.clippingPlanes = b.clippingPlanes; h.needsUpdate = true; }
  for (const f of Object.values(CARDIO.flows)) { f.mat.uniforms.uPlane.value.set(pl.normal.x, pl.normal.y, pl.normal.z, on ? pl.constant : 1e3); f.mat.uniforms.uClipAll.value = on ? 1 : 0; }
  for (const s of CARDIO.fx.segs) s.mat.clippingPlanes = null;
  markShadows();
}
function showFlow(kind) {
  for (const [k, f] of Object.entries(CARDIO.flows)) { f.points.visible = kind === k && SCN.flow; f.dirty = true; }
}
function goStep(i) {
  SCN.step = clamp(i, 0, STEPS.length - 1); const S = STEPS[SCN.step];
  for (const l of LAYERS) { const v = S.layers[l.key] || 0; setLayer(l.key, v > 0); if (v > 0) { setOpacity(l.key, v); const sl = $('op_' + l.key); if (sl) sl.value = Math.round(v * 100); } }
  setHeartCut(!!S.cut);
  SCN.flowKind = S.flow || null; showFlow(SCN.flowKind);
  CARDIO.fx.group.visible = !!S.conduction;
  Object.assign(CARDIO, { speed: S.speed, glow: S.glow || 0, pulse: !!S.pulse, playing: true });
  state.anim.heart = true; $('aHeart').classList.add('on');
  CARDIO.hold = S.hold ? S.hold.slice() : null;
  if (S.hold) CARDIO.tc = S.hold[0];
  const v = SCN.views[S.view]; flyTo(v.pos, v.target, 1.1);
  SCN.anchorList = anchors(S.labels || [], !!S.cut);
  renderScenario();
}
function onCardioHold() { renderScenarioControls(); }
function replayStep() { const S = STEPS[SCN.step]; if (S.hold) CARDIO.tc = S.hold[0]; CARDIO.playing = true; renderScenarioControls(); }
function scenarioLabels() {
  if (!SCN.active || !SCN.labels) return null;
  // anchors inside the heart that fall on the removed side are moved onto the cut surface
  const S = STEPS[SCN.step];
  if (S.cut) for (const a of SCN.anchorList) if (a.inside) { const d = SCN.plane.distanceToPoint(a.pos); if (d < 0) a.pos.addScaledVector(SCN.plane.normal, -d + 0.001); }
  return SCN.anchorList;
}

// ---------- panel ----------
const ECG_W = 300, ECG_H = 64;
function ecgPath() {
  let d = '';
  for (let i = 0; i <= 240; i++) { const t = i / 240 * CYC; d += (i ? 'L' : 'M') + (t / CYC * ECG_W).toFixed(1) + ',' + (ECG_H * 0.62 - ecgAt(t) * ECG_H * 0.5).toFixed(1); }
  return d;
}
function renderScenario() {
  const S = STEPS[SCN.step]; const box = $('scn');
  box.innerHTML = `
    <div class="eyebrow"><span><b>Süreç</b> · Kalp ve dolaşım</span><span>${SCN.step + 1} / ${STEPS.length}</span></div>
    <h2>${S.title}</h2>
    <p class="txt">${S.text}</p>
    <div class="live">
      <div class="phase"><b id="scPhase"></b><span id="scTime"></span></div>
      <div class="sub" id="scSub"></div>
      <svg class="ecg" viewBox="0 0 ${ECG_W} ${ECG_H}" preserveAspectRatio="none" aria-label="EKG">
        <rect x="0" y="0" width="${(0.16 / CYC * ECG_W).toFixed(1)}" height="${ECG_H}" fill="rgba(111,208,224,0.07)"/>
        <rect x="${(0.16 / CYC * ECG_W).toFixed(1)}" y="0" width="${(0.29 / CYC * ECG_W).toFixed(1)}" height="${ECG_H}" fill="rgba(224,113,93,0.08)"/>
        <path d="${ecgPath()}" fill="none" stroke="#9fe3b5" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
        <text x="${(0.05 / CYC * ECG_W).toFixed(1)}" y="12" fill="#8b9aa6" font-size="9" text-anchor="middle">P</text>
        <text x="${(0.19 / CYC * ECG_W).toFixed(1)}" y="9" fill="#8b9aa6" font-size="9" text-anchor="middle">QRS</text>
        <text x="${(0.44 / CYC * ECG_W).toFixed(1)}" y="12" fill="#8b9aa6" font-size="9" text-anchor="middle">T</text>
        <line id="scCur" x1="0" x2="0" y1="0" y2="${ECG_H}" stroke="#e8dcc0" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="chips"><span id="chAV">AV kapaklar</span><span id="chSL">Yarım ay kapaklar</span><span id="chS1">1. ses</span><span id="chS2">2. ses</span></div>
    </div>
    <div class="steps">${STEPS.map((s, i) => `<button type="button" class="${i === SCN.step ? 'on' : ''}" data-i="${i}" title="${s.title}">${i + 1}</button>`).join('')}</div>
    <div class="ctl" id="scCtl"></div>
    <div class="opts">
      <label><input type="checkbox" id="scLab" ${SCN.labels ? 'checked' : ''}> Etiketler</label>
      <label><input type="checkbox" id="scFlow" ${SCN.flow ? 'checked' : ''}> Kan akışı</label>
    </div>
    <div class="exp">
      <button class="btn" type="button" id="exOpen">Föy görseli / video kaydet</button>
    </div>`;
  box.querySelectorAll('.steps button').forEach(b => b.onclick = () => goStep(+b.dataset.i));
  $('scLab').onchange = (e) => { SCN.labels = e.target.checked; };
  $('scFlow').onchange = (e) => { SCN.flow = e.target.checked; showFlow(SCN.flowKind); };
  $('exOpen').onclick = () => openExport();
  renderScenarioControls();
  SCN.lastPhase = null;
}
function renderScenarioControls() {
  const S = STEPS[SCN.step]; const c = $('scCtl'); if (!c) return;
  const ended = S.hold && !CARDIO.playing && CARDIO.tc >= S.hold[1] - 0.001;
  c.innerHTML = `
    <button class="btn" type="button" data-a="prev" ${SCN.step === 0 ? 'disabled' : ''}>‹ Önceki</button>
    <button class="btn on" type="button" data-a="play">${ended ? '↻ Tekrar' : CARDIO.playing ? '❚❚ Durdur' : '▶ Oynat'}</button>
    <button class="btn" type="button" data-a="next" ${SCN.step === STEPS.length - 1 ? 'disabled' : ''}>Sonraki ›</button>
    <span class="grow"></span>
    <div class="speed" role="group" aria-label="Hız">${SPEEDS.map(v => `<button type="button" data-s="${v}" class="${Math.abs(CARDIO.speed - v) < 1e-6 ? 'on' : ''}">${String(v).replace('.', ',')}×</button>`).join('')}</div>
    <button class="btn" type="button" data-a="exit">Çık</button>`;
  c.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'prev') goStep(SCN.step - 1);
    if (a === 'next') goStep(SCN.step + 1);
    if (a === 'exit') exitScenario();
    if (a === 'play') { if (ended) replayStep(); else { CARDIO.playing = !CARDIO.playing; renderScenarioControls(); } }
  });
  c.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { CARDIO.speed = +b.dataset.s; renderScenarioControls(); });
}
function scenarioTick(st) {
  if (!SCN.active) return;
  const tc = CARDIO.tc;
  if (SCN.lastPhase !== st.phase) {
    SCN.lastPhase = st.phase; $('scPhase').textContent = st.phase.tr; $('scSub').textContent = st.phase.sub;
  }
  $('scTime').textContent = (tc / CYC * 60 / CARDIO.bpm).toFixed(2).replace('.', ',') + ' sn';
  $('scCur').setAttribute('x1', (tc / CYC * ECG_W).toFixed(1)); $('scCur').setAttribute('x2', (tc / CYC * ECG_W).toFixed(1));
  const av = $('chAV'), sl = $('chSL');
  av.textContent = 'AV kapaklar: ' + (st.av > 0.5 ? 'açık' : 'kapalı'); av.className = st.av > 0.5 ? 'open' : 'shut';
  sl.textContent = 'Yarım ay kapaklar: ' + (st.sl > 0.5 ? 'açık' : 'kapalı'); sl.className = st.sl > 0.5 ? 'open' : 'shut';
  $('chS1').className = tc > 0.18 && tc < 0.26 ? 'snd' : ''; $('chS1').textContent = '1. ses (lub)';
  $('chS2').className = tc > 0.44 && tc < 0.52 ? 'snd' : ''; $('chS2').textContent = '2. ses (dub)';
}
$('pHeart').addEventListener('click', () => enterScenario());
