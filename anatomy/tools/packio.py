# Reads the viewer packs (data/manifest.json + <layer>.bin.gz) back into numpy meshes.
import json, gzip, os
import numpy as np


def load_manifest(data_dir):
    return json.load(open(os.path.join(data_dir, 'manifest.json'), encoding='utf-8'))


def _varints(buf, count):
    out = np.empty(count, dtype=np.int64); o = 0
    for k in range(count):
        z = 0; sh = 0
        while True:
            b = buf[o]; o += 1
            z |= (b & 0x7F) << sh; sh += 7
            if not b & 0x80: break
        out[k] = (z >> 1) ^ -(z & 1)
    return out


def load_layer(data_dir, man, layer, want=None):
    """Yields dicts {id, en, base, side, mat, V (n,3) float64, F (m,3) int64} for parts of a layer."""
    L = man['layers'][layer]
    raw = gzip.decompress(open(os.path.join(data_dir, L['file']), 'rb').read())
    gmin = np.array(man['gmin']); gsize = np.array(man['gsize'])
    for p in L['parts']:
        if want and not want(p): continue
        nv, off = p['nv'], p['off']
        d = np.frombuffer(raw, dtype='<i2', count=3 * nv, offset=off).reshape(3, nv).astype(np.int64)
        V = (gmin[:, None] + (np.cumsum(d, axis=1) & 0xFFFF) / 65535.0 * gsize[:, None]).T
        head = nv * (8 if p.get('tw') else 7)
        F = np.cumsum(_varints(raw[off + head: off + head + p['ib']], p['nt'] * 3)).reshape(-1, 3)
        yield dict(id=p['id'], en=p['en'], base=p['base'], side=p['side'], mat=p['mat'], V=V, F=F)
