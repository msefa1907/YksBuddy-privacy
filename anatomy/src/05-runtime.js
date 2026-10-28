// ===================== Build runtime =====================
// Model building is split into tasks. Tasks run in Web Workers (same source as this page,
// loaded from a blob) and return plain "part records" (typed arrays + metadata) that the
// main thread turns into meshes as they arrive. Without workers the same tasks run inline.
const IS_WORKER = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
const SHARED = {};
let _outbox = null;

function packGeo(geo, mat, meta) {
  const attrs = {};
  for (const k of ['position', 'normal', 'color', 'uv']) if (geo.attributes[k]) attrs[k] = geo.attributes[k].array;
  return { mat, meta, attrs, index: geo.index.array, path: geo.userData.path || null };
}
function addPart(geo, mat, meta) {
  if (!_outbox) throw new Error('addPart outside of a task');
  _outbox.push(packGeo(geo, mat, meta));
}
function addPair(geoL, mat, meta) {
  addPart(geoL, mat, { ...meta, id: meta.id + '_L', side: 'sol', tr: meta.tr + ' (sol)' });
  addPart(mirrorGeometry(geoL), mat, { ...meta, id: meta.id + '_R', side: 'sağ', tr: meta.tr + ' (sağ)', pivot: meta.pivot ? mirX(meta.pivot) : undefined });
}
function planTasks() {
  const tasks = [];
  const T = (label, fn, opts = {}) => tasks.push({ label, fn, needs: opts.needs || [], provides: opts.provides || null, first: !!opts.first });
  if (typeof buildSkin === 'function') buildSkin(T);
  buildSkeleton(T);
  if (typeof buildOrgans === 'function') buildOrgans(T);
  if (typeof buildMuscles === 'function') buildMuscles(T);
  if (typeof buildVessels === 'function') buildVessels(T);
  if (typeof buildNerves === 'function') buildNerves(T);
  return tasks;
}
function runTask(task) {
  _outbox = [];
  try { task.fn(); return _outbox; } finally { _outbox = null; }
}

if (IS_WORKER) {
  const tasks = planTasks();
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'shared') { SHARED[m.key] = m.data; return; }
    if (m.type !== 'run') return;
    const task = tasks[m.index]; let recs = [], err = null;
    const t0 = performance.now();
    try { recs = runTask(task); } catch (ex) { err = String((ex && ex.stack) || ex); }
    const transfer = new Set();
    for (const r of recs) { for (const k in r.attrs) transfer.add(r.attrs[k].buffer); transfer.add(r.index.buffer); }
    const shared = task.provides && SHARED[task.provides] ? { key: task.provides, data: SHARED[task.provides] } : null;
    self.postMessage({ type: 'done', index: m.index, recs, err, shared, ms: performance.now() - t0 }, [...transfer]);
  };
  self.postMessage({ type: 'ready' });
}
