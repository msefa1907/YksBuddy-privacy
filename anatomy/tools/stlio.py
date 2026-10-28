import numpy as np
def read_stl(path):
    with open(path, 'rb') as f:
        data = f.read()
    n = np.frombuffer(data, dtype='<u4', count=1, offset=80)[0]
    if 84 + n * 50 != len(data):
        raise ValueError('not binary stl ' + path)
    rec = np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')])
    arr = np.frombuffer(data, dtype=rec, count=n, offset=84)
    return arr['v'].astype(np.float64)  # (n,3,3)
