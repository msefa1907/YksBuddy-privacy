# Builds data/heart_rig.json for the cardiac-cycle scenario from the viewer packs:
#   - heart landmarks: chamber centres, valve centres/axes, apex, AV plane, septum, SA/AV nodes
#   - centreline trees of the great vessels (aorta, venae cavae, pulmonary arteries/veins) as
#     root->leaf paths with radii, used for blood-flow particles and the arterial pulse wave.
# Usage: python3 tools/heart_rig.py data
import sys, os, json, time
import numpy as np
import scipy.ndimage as ndi
from skimage.morphology import skeletonize
sys.path.insert(0, os.path.dirname(__file__))
from packio import load_manifest, load_layer

DATA = sys.argv[1]
t0 = time.time()
man = load_manifest(DATA)
P = {}
for L in ['heart', 'arteries', 'veins']:
    for p in load_layer(DATA, man, L):
        p['layer'] = L; P[p['en']] = p
unit = lambda v: v / np.linalg.norm(v)


def raster(V, F, lo, dims, vx):
    """Mark the voxels touched by the triangles; sampling density adapts to each triangle's size."""
    g = np.zeros(dims, bool); a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    L = np.maximum(np.maximum(np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1)), np.linalg.norm(a - c, axis=1))
    need = np.maximum(2, np.ceil(L / (0.45 * vx))).astype(int)
    for k in np.unique(need):
        m = need == k; A, B, C = a[m], b[m], c[m]
        for i in range(k + 1):
            for j in range(k + 1 - i):
                q = A + (B - A) * (i / k) + (C - A) * (j / k)
                ij = np.floor((q - lo) / vx).astype(int)
                ok = np.all((ij >= 0) & (ij < dims), axis=1); ij = ij[ok]
                g[ij[:, 0], ij[:, 1], ij[:, 2]] = True
    return g


# ---------------- vessel centreline trees ----------------
# Each vessel mesh is a closed tube: fill it, union the solids of a tree and thin them to a skeleton.
def tree(names, roots, vx, prune=0.005, max_paths=400):
    ps = [P[n] for n in names if n in P]
    allv = np.concatenate([p['V'] for p in ps]); lo = allv.min(0) - 0.004
    dims = np.ceil((allv.max(0) + 0.004 - lo) / vx).astype(int) + 1
    solid = np.zeros(dims, bool)
    for p in ps: solid |= ndi.binary_fill_holes(raster(p['V'], p['F'], lo, dims, vx))
    solid = ndi.binary_closing(solid, iterations=1)
    edt = ndi.distance_transform_edt(solid) * vx
    sk = skeletonize(solid) > 0
    pts = np.argwhere(sk); n = len(pts)
    idm = -np.ones(dims, np.int64); idm[tuple(pts.T)] = np.arange(n)
    nb = [[] for _ in range(n)]
    offs = [(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1) if (i, j, k) != (0, 0, 0)]
    for o in offs:
        q = pts + o; ok = np.all((q >= 0) & (q < dims), axis=1)
        a = np.where(ok)[0]; b = idm[tuple(q[ok].T)]; m = b >= 0
        for x, y in zip(a[m], b[m]): nb[x].append(y)
    X = lo + pts * vx; R = edt[tuple(pts.T)]
    out = []
    comp = -np.ones(n, np.int64)
    for root_pt in roots:
        r0 = int(np.argmin(np.linalg.norm(X - root_pt, axis=1)))
        if comp[r0] >= 0: continue
        par = {r0: -1}; order = [r0]; qi = 0
        while qi < len(order):
            u = order[qi]; qi += 1
            for v in nb[u]:
                if v not in par: par[v] = u; order.append(v)
        for u in order: comp[u] = r0
        kids = {u: [] for u in order}
        for u in order:
            if par[u] >= 0: kids[par[u]].append(u)
        dist = {r0: 0.0}
        for u in order[1:]: dist[u] = dist[par[u]] + np.linalg.norm(X[u] - X[par[u]])
        for _ in range(4):  # prune short terminal spurs
            for lf in [u for u in kids if not kids[u] and u != r0]:
                u = lf; seg = [u]
                while par[u] >= 0 and len(kids[par[u]]) == 1: u = par[u]; seg.append(u)
                j = par[u]
                if j < 0 or j not in kids: continue
                if dist[lf] - dist[j] < max(prune, 2.5 * R[j]):
                    for s_ in seg: kids.pop(s_, None)
                    kids[j] = [k for k in kids[j] if k in kids]
        for lf in [u for u in kids if not kids[u] and u != r0]:
            path = [lf]
            while par[path[-1]] >= 0: path.append(par[path[-1]])
            path = path[::-1]; pp = X[path]; rr = R[path]
            k = 5
            if len(pp) > k:
                ker = np.ones(k) / k
                pp = np.stack([np.convolve(np.pad(pp[:, i], k // 2, mode='edge'), ker, 'valid') for i in range(3)], 1)
                rr = np.convolve(np.pad(rr, k // 2, mode='edge'), ker, 'valid')
            cum = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pp, axis=0), axis=1))])
            if cum[-1] < 0.01: continue
            s = np.linspace(0, cum[-1], max(2, int(cum[-1] / 0.003) + 1))
            pp = np.stack([np.interp(s, cum, pp[:, i]) for i in range(3)], 1); rr = np.interp(s, cum, rr)
            tail = rr[-max(2, len(rr) // 5):].mean()
            out.append({'p': np.round(pp, 4).tolist(), 'r': np.round(rr, 4).tolist(), 'w': float(round(tail ** 2 * 1e6, 3))})
    out.sort(key=lambda q: -q['w'])
    return out[:max_paths]


# ---------------- heart landmarks ----------------
wall = P['wall of heart']['V']
T = P['tricuspid valve']['V'].mean(0); M = P['mitral valve']['V'].mean(0); PV = P['pulmonary valve']['V'].mean(0)
# chamber seeds identified on four-chamber cuts of this dataset, refined to the deepest point of each cavity
SEEDS = {'RA': [-0.019, 1.251, 0.012], 'RV': [0.006, 1.241, 0.052], 'LA': [0.010, 1.258, -0.011], 'LV': [0.040, 1.238, 0.024]}
lo = wall.min(0) - 0.015; VX = 0.0008; dims = np.ceil((wall.max(0) + 0.015 - lo) / VX).astype(int) + 1
bar = np.zeros(dims, bool)
for p in P.values():
    if np.any(p['V'].max(0) < lo) or np.any(p['V'].min(0) > lo + dims * VX): continue
    bar |= raster(p['V'], p['F'], lo, dims, VX)
cav_edt = ndi.distance_transform_edt(~ndi.binary_dilation(bar)) * VX
chambers = {}
for k, s in SEEDS.items():
    ij = np.floor((np.array(s) - lo) / VX).astype(int); w = 9
    sub = cav_edt[ij[0] - w:ij[0] + w + 1, ij[1] - w:ij[1] + w + 1, ij[2] - w:ij[2] + w + 1]
    m = np.unravel_index(np.argmax(sub), sub.shape)
    c = lo + (ij - w + np.array(m)) * VX
    chambers[k] = {'c': np.round(c, 4).tolist(), 'r': round(float(sub.max()), 4)}
C = {k: np.array(v['c']) for k, v in chambers.items()}
n_av = unit(unit(C['RV'] - C['RA']) + unit(C['LV'] - C['LA']))
base = (T + M) / 2
dv = (wall - base) @ n_av
apex = wall[np.argmax(dv - 0.35 * np.linalg.norm((wall - base) - np.outer(dv, n_av), axis=1))]
axis = unit(apex - base)
sep_n = unit(C['LV'] - C['RV']); sep_c = (C['LV'] + C['RV']) / 2

asc = P['ascending aorta']['V']
u0 = unit(np.linalg.svd(asc - asc.mean(0), full_matrices=False)[2][0])
if u0[1] < 0: u0 = -u0
tproj = (asc - asc.mean(0)) @ u0
ring = asc[tproj < np.quantile(tproj, 0.06)]
ao_c = ring.mean(0); ao_r = float(np.mean(np.linalg.norm((ring - ao_c) - np.outer((ring - ao_c) @ u0, u0), axis=1)))
pv_axis = unit(np.linalg.svd(P['pulmonary valve']['V'] - PV, full_matrices=False)[2][2])
if pv_axis[1] < 0: pv_axis = -pv_axis
pv_r = float(np.percentile(np.linalg.norm((P['pulmonary valve']['V'] - PV) - np.outer((P['pulmonary valve']['V'] - PV) @ pv_axis, pv_axis), axis=1), 95))

svc = P['superior vena cava']['V']; ivc = P['inferior vena cava']['V']
svc_end = svc[svc[:, 1] < svc[:, 1].min() + 0.004].mean(0)
ivc_end = ivc[ivc[:, 1] > ivc[:, 1].max() - 0.004].mean(0)
near = lambda q: wall[np.argmin(np.linalg.norm(wall - q, axis=1))]
sa = near(svc_end + np.array([-0.009, -0.004, 0.004]))
av = near(T + (M - T) * 0.3 - n_av * 0.006)

rig = {
    'chambers': chambers,
    'valves': {
        'tricuspid': {'c': T.round(4).tolist(), 'axis': unit(C['RV'] - C['RA']).round(4).tolist()},
        'mitral': {'c': M.round(4).tolist(), 'axis': unit(C['LV'] - C['LA']).round(4).tolist()},
        'pulmonary': {'c': PV.round(4).tolist(), 'axis': pv_axis.round(4).tolist(), 'r': round(pv_r, 4)},
        'aortic': {'c': (ao_c + u0 * 0.002).round(4).tolist(), 'axis': u0.round(4).tolist(), 'r': round(ao_r, 4)},
    },
    'base': base.round(4).tolist(), 'apex': apex.round(4).tolist(), 'avNormal': n_av.round(4).tolist(),
    'septum': {'c': sep_c.round(4).tolist(), 'n': sep_n.round(4).tolist()},
    'nodes': {'sa': sa.round(4).tolist(), 'av': av.round(4).tolist()},
    'veins': {'svcEnd': svc_end.round(4).tolist(), 'ivcEnd': ivc_end.round(4).tolist()},
}
print(f'landmarks {time.time() - t0:.0f}s', json.dumps({k: rig[k] for k in ['chambers', 'apex', 'base', 'nodes']}))

AORTA = ['ascending aorta', 'arch of aorta', 'descending aorta', 'brachiocephalic artery, nsn', 'right common carotid artery', 'left common carotid artery',
         'right subclavian artery', 'left subclavian artery', 'celiac artery', 'common hepatic artery', 'left gastric artery', 'splenic artery',
         'superior mesenteric artery', 'inferior mesenteric artery', 'right renal artery', 'left renal artery', 'right common iliac artery', 'left common iliac artery',
         'right external iliac artery', 'left external iliac artery', 'right internal iliac artery', 'left internal iliac artery']
SVC = ['superior vena cava', 'right brachiocephalic vein', 'left brachiocephalic vein', 'right internal jugular vein', 'left internal jugular vein', 'right subclavian vein', 'left subclavian vein']
IVC = ['inferior vena cava', 'right renal vein', 'left renal vein', 'right common iliac vein', 'left common iliac vein', 'right external iliac vein', 'left external iliac vein',
       'right internal iliac vein', 'left internal iliac vein']
rig['trees'] = {
    'aorta': tree(AORTA, [ao_c], 0.001),
    'svc': tree(SVC, [svc_end], 0.001),
    'ivc': tree(IVC, [ivc_end], 0.001),
    'pa': tree(['pulmonary artery'], [PV + pv_axis * 0.004], 0.0008, prune=0.004, max_paths=220),
    'pv': tree(['pulmonary vein'], [C['LA'] + d for d in [np.array(v) * 0.02 for v in [[-1, 0.3, -0.5], [1, 0.3, -0.5], [-1, -0.4, -0.5], [1, -0.4, -0.5]]]], 0.0008, prune=0.004, max_paths=220),
}
for k, v in rig['trees'].items(): print(k, len(v), 'paths', 'longest %.3f m' % max(len(q['p']) * 0.0025 for q in v))
json.dump(rig, open(os.path.join(DATA, 'heart_rig.json'), 'w'), separators=(',', ':'))
print(f'done {time.time() - t0:.0f}s, {os.path.getsize(os.path.join(DATA, "heart_rig.json")) / 1024:.0f} KB')
