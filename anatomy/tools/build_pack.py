# BodyParts3D STL -> decimated, AO-baked, compact per-layer packs for the web viewer.
import sys, os, json, gzip, math, time, numpy as np, pyfqmr
sys.path.insert(0, os.path.dirname(__file__))
from stlio import read_stl
from catalog import classify

SRC, OUT = sys.argv[1], sys.argv[2]
QUALITY = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
os.makedirs(OUT, exist_ok=True)
names = {}
for line in open(os.path.join(SRC, 'parts_list_e.txt'), encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) >= 2: names[p[0].strip('"')] = p[1]

EDGE = {'skeleton': 2.5, 'muscle': 4.4, 'nervous': 2.0, 'heart': 2.4, 'arteries': 2.2, 'veins': 2.2, 'respiratory': 3.2,
        'digestive': 3.0, 'urinary': 2.4, 'endocrine': 2.0, 'reproductive': 2.4, 'skin': 6.0}
MAXT = {'skin': 360000}
# structures that are seen up close (heart scenario, brain) keep much more of the original detail: (name regex, edge mm, max tris)
import re as _re
EDGE_PART = [
    (r'^wall of heart$', 1.15, 200000), (r'valve$', 0.7, 24000), (r'papillary', 1.0, 12000),
    (r'coronary|cardiac vein|veins of ventricle|coronary sinus|interventricular branch|marginal branch|circumflex|posterolateral|septal branches', 0.9, 12000),
    (r'^(ascending aorta|arch of aorta|superior vena cava|inferior vena cava|brachiocephalic artery, nsn|.* brachiocephalic vein)$', 1.4, 30000),
    (r'^(pulmonary artery|pulmonary vein)$', 1.6, 90000), (r'^cerebellum$', 1.3, 70000),
]
def part_edge(en, layer):
    for rx, e, mt in EDGE_PART:
        if _re.search(rx, en): return e, mt
    return EDGE[layer], MAXT.get(layer, 60000)
# body frame: x stays (left = +x), y = up (stl Z), z = anterior (-stl Y); metres; feet at y = 0
OX, OY, OZ = 0.0, -96.5, -13.5

t0 = time.time()
parts = []
for fn in sorted(os.listdir(os.path.join(SRC, 'stl'))):
    fid = fn[:-4]; en = names.get(fid, fid)
    c = classify(en)
    if c is None: continue
    tr, layer, mat, base, side = c
    tri = read_stl(os.path.join(SRC, 'stl', fn))
    v = tri.reshape(-1, 3)
    key = np.round(v * 1000).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    V = np.zeros((len(uniq), 3)); np.add.at(V, inv.ravel(), v); V /= np.bincount(inv.ravel())[:, None]
    F = inv.reshape(-1, 3)
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    e1 = V[F[:, 1]] - V[F[:, 0]]; e2 = V[F[:, 2]] - V[F[:, 0]]
    area = 0.5 * np.linalg.norm(np.cross(e1, e2), axis=1).sum()
    edge, maxt = part_edge(en, layer); edge /= QUALITY ** 0.5
    target = int(np.clip(area / (0.433 * edge * edge), 150, maxt))
    if len(F) > target:
        s = pyfqmr.Simplify(); s.setMesh(V.astype(np.float64), F.astype(np.int32))
        s.simplify_mesh(target_count=target, aggressiveness=6, preserve_border=True, verbose=False)
        V, F, _ = s.getMesh()
    V = np.stack([(V[:, 0] - OX), (V[:, 2] - OZ), -(V[:, 1] - OY)], 1) / 1000.0
    parts.append(dict(id=fid, en=en, base=base, side=side, tr=tr, layer=layer, mat=mat, V=V.astype(np.float32), F=F.astype(np.int32)))
print(f'decimated {len(parts)} parts in {time.time() - t0:.0f}s, tris {sum(len(p["F"]) for p in parts)}')

def vnormals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for k in range(3): np.add.at(N, F[:, k], n)
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l == 0] = 1
    return N / l

# ---- voxel ambient occlusion, per group of layers ----
GROUPS = [['skeleton'], ['muscle'], ['nervous'], ['heart', 'arteries', 'veins', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'], ['skin']]
VOX = 0.003
dirs = []
rng = np.random.default_rng(3)
gold = math.pi * (3 - math.sqrt(5))
for i in range(20):  # cosine weighted hemisphere (z up)
    r = math.sqrt((i + 0.5) / 20); th = i * gold
    dirs.append([r * math.cos(th), r * math.sin(th), math.sqrt(max(0, 1 - r * r))])
dirs = np.array(dirs)
steps = np.array([0.004, 0.007, 0.011, 0.016, 0.022, 0.03, 0.04])
for g in GROUPS:
    ps = [p for p in parts if p['layer'] in g]
    if not ps: continue
    allv = np.concatenate([p['V'] for p in ps])
    lo = allv.min(0) - 0.05; hi = allv.max(0) + 0.05
    dims = np.ceil((hi - lo) / VOX).astype(int) + 1
    occ = np.zeros(dims, dtype=bool)
    for p in ps:  # sample triangle surfaces into the grid
        V, F = p['V'], p['F']
        a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
        for u, w in [(0, 0), (1, 0), (0, 1), (1 / 3, 1 / 3), (0.5, 0), (0, 0.5), (0.5, 0.5), (0.2, 0.6), (0.6, 0.2), (0.2, 0.2)]:
            q = a + (b - a) * u + (c - a) * w
            ij = ((q - lo) / VOX).astype(int)
            occ[ij[:, 0], ij[:, 1], ij[:, 2]] = True
    for p in ps:
        V = p['V']; N = vnormals(V, p['F'])
        # tangent frame
        t = np.where(np.abs(N[:, :1]) < 0.9, np.array([[1, 0, 0]]), np.array([[0, 1, 0]]))
        T = np.cross(N, t); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
        B = np.cross(N, T)
        hit = np.zeros(len(V))
        start = V + N * 0.0035
        for d in dirs:
            D = T * d[0] + B * d[1] + N * d[2]
            h = np.zeros(len(V), dtype=bool)
            for s in steps:
                q = start + D * s
                ij = np.floor((q - lo) / VOX).astype(int)
                ok = np.all((ij >= 0) & (ij < dims), axis=1)
                hh = np.zeros(len(V), dtype=bool)
                hh[ok] = occ[ij[ok, 0], ij[ok, 1], ij[ok, 2]]
                h |= hh
            hit += h
        p['ao'] = np.clip(1.0 - 1.15 * hit / len(dirs), 0, 1)
print(f'ao done {time.time() - t0:.0f}s')

# ---- tendon weight: thin parts of a muscle (tendons, aponeuroses) read white and glossy ----
# Local thickness = distance along the inward normal to the opposite wall of the same part,
# found by marching through a 0.7 mm voxelisation of the part's own surface.
TVOX = 0.0007
def tendon_weight(V, F):
    N = vnormals(V, F)
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    n = 7; pts = []
    for i in range(n + 1):
        for j in range(n + 1 - i):
            pts.append(a + (b - a) * (i / n) + (c - a) * (j / n))
    P = np.concatenate(pts)
    lo = V.min(0) - 0.002
    dims = np.floor((V.max(0) + 0.002 - lo) / TVOX).astype(np.int64) + 2
    def lin(Q):
        ij = np.floor((Q - lo) / TVOX).astype(np.int64)
        ok = np.all((ij >= 0) & (ij < dims), axis=1)
        return ok, (ij[:, 0] * dims[1] + ij[:, 1]) * dims[2] + ij[:, 2]
    _, k = lin(P); keys = np.unique(k)
    T = np.full(len(V), np.inf)
    for d in np.arange(0.0014, 0.03, 0.0005):
        alive = np.where(np.isinf(T))[0]
        if not len(alive): break
        ok, k = lin(V[alive] - N[alive] * d)
        pos = np.minimum(np.searchsorted(keys, k), len(keys) - 1)
        T[alive[ok & (keys[pos] == k)]] = d
    # thin relative to the part's own belly (so uniformly thin facial muscles stay muscle) and thin in absolute terms
    fin = T[np.isfinite(T)]
    ref = np.percentile(fin, 75) if len(fin) > 20 else 0.01
    ss = lambda e0, e1, v: (lambda x: x * x * (3 - 2 * x))(np.clip((v - e0) / (e1 - e0), 0, 1))
    w = ss(0.55, 0.32, T / ref) * ss(0.0055, 0.0035, T)
    # a few rounds of neighbour averaging along mesh edges
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    deg = np.bincount(E[:, 0], minlength=len(V)) + np.bincount(E[:, 1], minlength=len(V))
    for _ in range(3):
        acc = np.bincount(E[:, 0], weights=w[E[:, 1]], minlength=len(V)) + np.bincount(E[:, 1], weights=w[E[:, 0]], minlength=len(V))
        w = 0.5 * w + 0.5 * acc / np.maximum(deg, 1)
    return w
for p in parts:
    if p['mat'] == 'tendon': p['tw'] = np.ones(len(p['V']))
    elif p['mat'] == 'muscle': p['tw'] = tendon_weight(p['V'], p['F'])
print(f'tendons done {time.time() - t0:.0f}s')

# ---- encode ----
allv = np.concatenate([p['V'] for p in parts]); gmin = allv.min(0) - 0.001; gmax = allv.max(0) + 0.001; gsize = (gmax - gmin)
def morton(c):
    c = np.clip((c * 1023).astype(np.int64), 0, 1023)
    def spread(x):
        x = (x | (x << 16)) & 0x030000FF; x = (x | (x << 8)) & 0x0300F00F; x = (x | (x << 4)) & 0x030C30C3; x = (x | (x << 2)) & 0x09249249
        return x
    return spread(c[:, 0]) | (spread(c[:, 1]) << 1) | (spread(c[:, 2]) << 2)
def varints(vals):
    out = bytearray()
    for x in vals.tolist():
        while True:
            b = x & 0x7F; x >>= 7
            if x: out.append(b | 0x80)
            else: out.append(b); break
    return bytes(out)

layers = {}
for p in parts: layers.setdefault(p['layer'], []).append(p)
manifest = {'version': 2, 'gmin': gmin.tolist(), 'gsize': gsize.tolist(), 'layers': {}, 'source': 'BodyParts3D 3.0, (c) The Database Center for Life Science, CC BY-SA 2.1 JP'}
total_bytes = 0
for layer, ps in layers.items():
    blob = bytearray(); entries = []
    for p in ps:
        V, F, ao = p['V'], p['F'], p['ao']
        cen = V[F].mean(1); bb0 = V.min(0); bbs = np.maximum(V.max(0) - bb0, 1e-6)
        F = F[np.argsort(morton((cen - bb0) / bbs), kind='stable')]
        order = np.full(len(V), -1, dtype=np.int64); seq = []
        for i in F.ravel():
            if order[i] < 0: order[i] = len(seq); seq.append(i)
        seq = np.array(seq); F = order[F]; V = V[seq]; ao = ao[seq]
        tw = p['tw'][seq] if 'tw' in p else None
        q = np.round((V - gmin) / gsize * 65535).astype(np.int64)
        dq = np.diff(q, axis=0, prepend=np.zeros((1, 3), dtype=np.int64)).astype(np.int16)
        idx = F.ravel(); d = np.diff(idx, prepend=0); zz = ((d << 1) ^ (d >> 63)).astype(np.int64)
        ib = varints(zz)
        off = len(blob)
        blob += dq[:, 0].tobytes() + dq[:, 1].tobytes() + dq[:, 2].tobytes()
        blob += np.round(ao * 255).astype(np.uint8).tobytes()
        if tw is not None: blob += np.round(np.clip(tw, 0, 1) * 255).astype(np.uint8).tobytes()
        blob += ib
        entries.append({'id': p['id'], 'en': p['en'], 'base': p['base'], 'side': p['side'], 'tr': p['tr'], 'mat': p['mat'], 'nv': int(len(V)), 'nt': int(len(F)), 'off': off, 'ib': len(ib), **({'tw': 1} if tw is not None else {})})
    gz = gzip.compress(bytes(blob), 9)
    open(os.path.join(OUT, f'{layer}.bin.gz'), 'wb').write(gz)
    total_bytes += len(gz)
    manifest['layers'][layer] = {'file': f'{layer}.bin.gz', 'size': len(gz), 'raw': len(blob), 'parts': entries}
    print(layer, len(ps), 'parts', sum(e['nt'] for e in entries), 'tris', f'{len(gz) / 1e6:.2f} MB gz (raw {len(blob) / 1e6:.2f})')
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'total {total_bytes / 1e6:.2f} MB, {sum(len(p["F"]) for p in parts)} tris, {time.time() - t0:.0f}s')
