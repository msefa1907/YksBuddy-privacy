// ===================== Export: print-quality images for worksheets, MP4 videos for lessons =====================
const EXPORT = { bg: 'white', labels: 'names', size: 3000, busy: false };
const CREDIT = '3B model: BodyParts3D © 2008 DBCLS (CC BY-SA 2.1 JP) · Corpus Atlas';
const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs';
const THEMES = {
  dark: { box: 'rgba(7,11,15,0.84)', boxLine: 'rgba(176,198,214,0.28)', text: '#e4e9ec', line: 'rgba(228,233,236,0.6)', dot: '#6fd0e0', dim: '#8b9aa6' },
  white: { box: 'rgba(255,255,255,0.94)', boxLine: '#3c4650', text: '#11161b', line: '#2c343c', dot: '#c0392b', dim: '#5c6670' },
};
THEMES.transparent = THEMES.white;

// render the scene into a width×height buffer (page layout untouched); returns a restore function
function beginExportView(width, height) {
  const prev = { pr: renderer.getPixelRatio(), aspect: camera.aspect, decor: decor.map(d => d.visible) };
  decor.forEach(d => (d.visible = false));
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  camera.aspect = width / height; camera.updateProjectionMatrix();
  for (const f of Object.values(CARDIO.flows)) f.mat.uniforms.uScale.value = height / (2 * Math.tan(camera.fov * Math.PI / 360));
  return () => {
    decor.forEach((d, i) => (d.visible = prev.decor[i]));
    renderer.setPixelRatio(prev.pr); renderer.setSize(innerWidth, innerHeight);
    camera.aspect = prev.aspect; camera.updateProjectionMatrix();
  };
}
function paintBackground(ctx, w, h, bg) {
  if (bg === 'transparent') return;
  if (bg === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); return; }
  const g = ctx.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.38, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#142231'); g.addColorStop(0.45, '#0b131b'); g.addColorStop(1, '#070b0f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// labels in the same two-column layout as on screen; mode 'numbers' draws numbered circles (for questions)
function paintLabels(ctx, w, h, k, mode, th) {
  if (mode === 'none') return [];
  const items = layoutLabels(labelItems(w, h), w, h, 24 * k, 120 * k);
  items.sort((a, b) => a.side - b.side || a.ly - b.ly).forEach((it, i) => (it.n = i + 1));
  ctx.font = `500 ${13 * k}px "IBM Plex Sans", "Segoe UI", sans-serif`; ctx.textBaseline = 'middle';
  for (const it of items) {
    const tip = it.ex - it.side * 18 * k;
    ctx.strokeStyle = th.line; ctx.lineWidth = 1.3 * k; ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(tip, it.ly); ctx.lineTo(it.ex, it.ly); ctx.stroke();
    ctx.fillStyle = th.dot; ctx.beginPath(); ctx.arc(it.x, it.y, 3.2 * k, 0, TAU); ctx.fill();
    if (mode === 'numbers') {
      const r = 11 * k, cx = it.lx + it.side * r;
      ctx.fillStyle = th.box; ctx.strokeStyle = th.boxLine; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.arc(cx, it.ly, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.fillText(String(it.n), cx, it.ly + 0.5 * k);
    } else {
      const tw = ctx.measureText(it.text).width, px = 7 * k, bh = 21 * k;
      const bx = it.side < 0 ? it.lx - tw - 2 * px : it.lx;
      ctx.fillStyle = th.box; ctx.strokeStyle = th.boxLine; ctx.lineWidth = 1 * k; roundRect(ctx, bx, it.ly - bh / 2, tw + 2 * px, bh, 5 * k); ctx.fill(); ctx.stroke();
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.fillText(it.text, bx + px, it.ly + 0.5 * k);
    }
  }
  ctx.textAlign = 'left';
  return items;
}
function paintCredit(ctx, w, h, k, th) {
  ctx.font = `400 ${10.5 * k}px "IBM Plex Sans", sans-serif`; ctx.fillStyle = th.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(CREDIT, w - 14 * k, h - 12 * k); ctx.textAlign = 'left';
}
function renderFrame() {
  renderer.shadowMap.needsUpdate = renderer.shadowMap.enabled;
  renderer.render(scene, camera);
}

async function exportPNG() {
  if (EXPORT.busy) return; EXPORT.busy = true; dlgOut('Görsel hazırlanıyor…');
  await document.fonts?.ready; await new Promise(r => setTimeout(r, 30));
  const W = EXPORT.size, H = Math.round(W * innerHeight / innerWidth); const k = H / innerHeight;
  const restore = beginExportView(W, H);
  let items = [];
  try {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    renderFrame();
    paintBackground(ctx, W, H, EXPORT.bg); ctx.drawImage(renderer.domElement, 0, 0);
    const th = THEMES[EXPORT.bg];
    items = paintLabels(ctx, W, H, k, EXPORT.labels, th); paintCredit(ctx, W, H, k, th);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const key = EXPORT.labels === 'numbers' && items.length ? `<p class="key"><b>Cevap anahtarı:</b> ${items.map(it => `${it.n}. ${it.text}`).join(' · ')}</p>` : '';
    deliver(blob, `${exportName()}.png`, key);
  } catch (e) { console.error(e); dlgOut('Görsel oluşturulamadı: ' + e.message); }
  finally { restore(); EXPORT.busy = false; }
}
function exportName() {
  const base = SCN.active ? `kalp-${SCN.step + 1}-${STEPS[SCN.step].title}` : 'corpus-atlas';
  return fold(base).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------- video: deterministic frame-by-frame render of the current scenario step ----------
function paintHud(ctx, w, h, k, st) {
  const S = STEPS[SCN.step];
  const pad = 26 * k, bw = 560 * k; const showEcg = S.ecg || S.hold;
  const bh = (showEcg ? 214 : 118) * k; const x = pad, y = h - pad - bh;
  ctx.fillStyle = 'rgba(9,14,19,0.82)'; roundRect(ctx, x, y, bw, bh, 12 * k); ctx.fill();
  ctx.strokeStyle = 'rgba(176,198,214,0.18)'; ctx.lineWidth = 1 * k; ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e0715d'; ctx.font = `500 ${12 * k}px "IBM Plex Mono", monospace`; ctx.fillText('KALP VE DOLAŞIM', x + 20 * k, y + 28 * k);
  ctx.fillStyle = '#e8dcc0'; ctx.font = `600 ${34 * k}px "Cormorant Garamond", Georgia, serif`; ctx.fillText(S.title, x + 20 * k, y + 64 * k);
  ctx.fillStyle = '#e4e9ec'; ctx.font = `600 ${17 * k}px "IBM Plex Sans", sans-serif`; ctx.fillText(st.phase.tr, x + 20 * k, y + 94 * k);
  ctx.fillStyle = '#a9b6bf'; ctx.font = `400 ${14 * k}px "IBM Plex Sans", sans-serif`; ctx.fillText(st.phase.sub, x + 20 * k, y + 114 * k);
  if (!showEcg) return;
  const ex = x + 20 * k, ey = y + 128 * k, ew = bw - 40 * k, eh = 52 * k; const tc = CARDIO.tc;
  ctx.fillStyle = 'rgba(111,208,224,0.08)'; ctx.fillRect(ex, ey, 0.16 / CYC * ew, eh);
  ctx.fillStyle = 'rgba(224,113,93,0.10)'; ctx.fillRect(ex + 0.16 / CYC * ew, ey, 0.29 / CYC * ew, eh);
  ctx.strokeStyle = '#9fe3b5'; ctx.lineWidth = 2 * k; ctx.beginPath();
  for (let i = 0; i <= 200; i++) { const t = i / 200 * CYC; const px = ex + t / CYC * ew, py = ey + eh * 0.62 - ecgAt(t) * eh * 0.5; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(ex + tc / CYC * ew, ey); ctx.lineTo(ex + tc / CYC * ew, ey + eh); ctx.stroke();
  const chips = [[`AV kapaklar: ${st.av > 0.5 ? 'açık' : 'kapalı'}`, st.av > 0.5], [`Yarım ay kapaklar: ${st.sl > 0.5 ? 'açık' : 'kapalı'}`, st.sl > 0.5]];
  if (tc > 0.18 && tc < 0.26) chips.push(['1. kalp sesi (lub)', null]); if (tc > 0.44 && tc < 0.52) chips.push(['2. kalp sesi (dub)', null]);
  ctx.font = `500 ${12.5 * k}px "IBM Plex Mono", monospace`; let cx = ex; const cy = ey + eh + 12 * k;
  for (const [t, open] of chips) {
    const tw = ctx.measureText(t).width + 16 * k;
    ctx.fillStyle = open === null ? '#e8dcc0' : open ? 'rgba(60,160,100,0.3)' : 'rgba(224,113,93,0.26)'; roundRect(ctx, cx, cy, tw, 22 * k, 11 * k); ctx.fill();
    ctx.fillStyle = open === null ? '#070b0f' : open ? '#bff3d0' : '#ffd2c8'; ctx.textBaseline = 'middle'; ctx.fillText(t, cx + 8 * k, cy + 11.5 * k); ctx.textBaseline = 'alphabetic';
    cx += tw + 8 * k;
  }
}
async function exportVideo() {
  if (EXPORT.busy || !SCN.active) return;
  if (!('VideoEncoder' in window) || !('VideoFrame' in window)) { dlgOut('Bu tarayıcı video kaydını desteklemiyor. Chrome veya Edge ile deneyin.'); return; }
  EXPORT.busy = true; dlgOut('Video hazırlanıyor…');
  const W = 1920, H = 1080, fps = 30; const k = H / 900;
  const S = STEPS[SCN.step]; const rate = CARDIO.speed * (CARDIO.bpm / 60) * CYC;
  const secs = S.hold ? (S.hold[1] - S.hold[0]) / rate + 1.2 : S.flow === 'pulm' || S.flow === 'body' ? 9 : Math.min(12, 2 * CYC / rate);
  const nFrames = Math.round(secs * fps);
  let restore = null; const saved = { tc: CARDIO.tc, playing: CARDIO.playing, paused: state.paused };
  try {
    // H.264 plays everywhere (and in video editors); VP9 in MP4 is the fallback where no H.264 encoder exists
    let codec = null, kind = null;
    for (const [c, kd] of [['avc1.640028', 'avc'], ['avc1.4d0028', 'avc'], ['avc1.42e028', 'avc'], ['vp09.00.40.08', 'vp9']]) {
      const sup = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 14e6, framerate: fps }).catch(() => null);
      if (sup && sup.supported) { codec = c; kind = kd; break; }
    }
    if (!codec) throw new Error('uygun video kodlayıcı bulunamadı');
    const { Muxer, ArrayBufferTarget } = await import(MUXER_URL);
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: kind, width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
    let encErr = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { encErr = e; } });
    enc.configure({ codec, width: W, height: H, bitrate: 14e6, framerate: fps });
    state.paused = true; await document.fonts?.ready;
    if (S.hold) CARDIO.tc = S.hold[0];
    CARDIO.playing = true; for (const f of Object.values(CARDIO.flows)) f.dirty = true;
    restore = beginExportView(W, H);
    // the on-screen view leaves room for the side panel; in the video the caption box sits bottom-left instead
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const shift = right.multiplyScalar(-0.1 * camera.position.distanceTo(controls.target));
    camera.position.add(shift); controls.target.add(shift);
    const unshift = () => { camera.position.sub(shift); controls.target.sub(shift); controls.update(); };
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    const restoreView = restore; restore = () => { unshift(); restoreView(); };
    for (let i = 0; i < nFrames; i++) {
      if (encErr) throw encErr;
      cardioTick(i ? 1 / fps : 0); controls.update();
      renderFrame();
      paintBackground(ctx, W, H, 'dark'); ctx.drawImage(renderer.domElement, 0, 0);
      if (SCN.labels) paintLabels(ctx, W, H, k, 'names', THEMES.dark);
      paintHud(ctx, W, H, k, cycleState(CARDIO.tc)); paintCredit(ctx, W, H, k, THEMES.dark);
      const frame = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(frame, { keyFrame: i % (fps * 2) === 0 }); frame.close();
      if (enc.encodeQueueSize > 6 || i % 10 === 0) { dlgOut(`Video kaydediliyor… %${Math.round(i / nFrames * 100)}`); await new Promise(r => setTimeout(r, 0)); }
    }
    await enc.flush(); muxer.finalize(); enc.close();
    deliver(new Blob([muxer.target.buffer], { type: 'video/mp4' }), `${exportName()}.mp4`, kind === 'vp9' ? '<p class="hint">Not: bu tarayıcıda H.264 kodlayıcı olmadığı için video VP9 ile kaydedildi; bazı video düzenleyiciler açamayabilir.</p>' : '');
  } catch (e) { console.error(e); dlgOut('Video oluşturulamadı: ' + (e.message || e)); }
  finally {
    if (restore) restore();
    Object.assign(CARDIO, { tc: saved.tc, playing: saved.playing }); state.paused = saved.paused; EXPORT.busy = false;
  }
}

// ---------- dialog ----------
function deliver(blob, name, extra = '') {
  const url = URL.createObjectURL(blob); const isVid = blob.type.startsWith('video');
  const mb = (blob.size / 1e6).toFixed(1).replace('.', ',');
  dlgOut(`${isVid ? `<video src="${url}" controls playsinline></video>` : `<img src="${url}" alt="Dışa aktarılan görsel">`}
    <p class="hint"><a class="btn on" href="${url}" download="${name}">İndir (${mb} MB)</a> İndirme başlamazsa ${isVid ? 'videoya' : 'görsele'} sağ tıklayıp “Farklı kaydet”i seçin.</p>${extra}`);
  try { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* the preview link remains */ }
}
function dlgOut(html) { const o = $('dOut'); if (o) o.innerHTML = html; }
function openExport() {
  const d = $('dlg'); d.hidden = false;
  const seg = (key, opts) => opts.map(([v, t]) => `<button type="button" data-k="${key}" data-v="${v}" class="${String(EXPORT[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('');
  d.querySelector('.box').innerHTML = `
    <button class="close" type="button" aria-label="Kapat">×</button>
    <h3>Dışa aktar</h3>
    <p class="lead">Ekrandaki görünüm baskıya uygun çözünürlükte kaydedilir. Görseller ve videolar BodyParts3D verisinden türetildiği için kaynak satırı otomatik eklenir.</p>
    <div class="row"><span>Arka plan</span><div class="seg">${seg('bg', [['white', 'Beyaz'], ['dark', 'Koyu'], ['transparent', 'Şeffaf']])}</div></div>
    <div class="row"><span>Etiketler</span><div class="seg">${seg('labels', [['names', 'Adlarıyla'], ['numbers', 'Numaralı (soru)'], ['none', 'Yok']])}</div></div>
    <div class="row"><span>Genişlik</span><div class="seg">${seg('size', [[2000, '2000 px'], [3000, '3000 px'], [4000, '4000 px']])}</div></div>
    <div class="acts"><button class="btn on" type="button" id="dPng">PNG oluştur</button>${SCN.active ? '<button class="btn" type="button" id="dVid">Bu adımın videosu (MP4, 1080p)</button>' : ''}</div>
    <div id="dOut"></div>`;
  d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const v = b.dataset.v; EXPORT[b.dataset.k] = isNaN(+v) ? v : +v; d.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelector('.close').onclick = () => { d.hidden = true; };
  $('dPng').onclick = () => exportPNG();
  if (SCN.active) $('dVid').onclick = () => exportVideo();
  if (!SCN.active || STEPS[SCN.step]) {
    const lab = SCN.active ? SCN.labels : state.labels;
    if (!lab) dlgOut('<p class="hint">İpucu: etiketli görsel için önce etiketleri açın.</p>');
  }
}
$('tExport').addEventListener('click', openExport);
$('dlg').addEventListener('click', (e) => { if (e.target.id === 'dlg') $('dlg').hidden = true; });
