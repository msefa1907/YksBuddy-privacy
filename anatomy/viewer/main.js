// ===================== Startup =====================
let revealed = false;
function revealStage() { if (revealed) return; revealed = true; $('loader').classList.add('done'); }
buildPresetUI();
(async () => {
  try {
    animate();
    await loadAll();
    setupAnimation();
    await setupCardio();
    buildLayerUI();
    applyPreset(currentPreset);
    setOpacity('skin', layerOpacity.skin);
    setProgress(1, `${(STATS.loadMs / 1000).toFixed(1)} sn'de hazır`);
    $('buildInfo').textContent = `${(STATS.bytes / 1e6).toFixed(1)} MB · ${(STATS.loadMs / 1000).toFixed(1)} sn · ${STATS.workers || 1} iş parçacığı`;
    if (loadErrors.length) { $('err').textContent = loadErrors.join('\n'); console.warn(loadErrors); }
    revealStage();
    window.__anatomy.ready = true;
  } catch (e) {
    console.error(e); $('err').textContent = String((e && e.stack) || e);
  }
})();
