"""
Trace a weapon's own artwork (the SVG drawing on the site) into outlines Blender extrudes into a 3D model, the same way trace_reference.py does for the scythe.

    python trace_art.py hal|ecl|ava        # reads models/_art/<wid>/ (see app/tools/export-weapon-art.md), writes models/<name>/outline.json

For every part the exporter saves three images, all in one shared frame (sword pointing up, 1.5 px per sword unit):
  <part>_sil.png   the part's silhouette (its exact vector outline, anti-aliased),
  <part>_art.png   the part's artwork clipped to that silhouette,
  <part>_glow.png  only the artwork's pulsing (glowing) layers, clipped.
Output coordinates are (s, c): s = along the blade (sword units), c = across it. Per part: base (silhouette polygons with holes), plates (level sets of the
artwork's brightness, three stacked heights 0..2) and glow (lit areas, kind 'face' or 'eye').
Edges follow soft fields enlarged 2x with a cubic filter, so outlines are smooth with no pixel stair-steps.
"""
import json, os, sys
import cv2, numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = {'hal': 'halcyon', 'ecl': 'eclipse', 'ava': 'avarice'}
# whole parts that are a lit gem / eye, and what kind of glow they are; percentiles of brightness where the plate levels start
CONFIG = {
    'hal': dict(glow_whole={'core': 'face'}, levels=(38, 62, 86), glow_kind='face'),
    'ecl': dict(glow_whole={'gem': 'face'}, levels=(40, 66, 90), glow_kind='face'),
    'ava': dict(glow_whole={'eye': 'eye'}, levels=(40, 64, 88), glow_kind='face'),
}
K = 2

wid = sys.argv[1]
cfg = CONFIG[wid]
src = os.path.join(HERE, '_art', wid)
fr = json.load(open(os.path.join(src, 'frame.json')))
S, M, x0, x1, y0 = fr['S'], fr['M'], fr['x0'], fr['x1'], fr['y0']


def load(part, kind):
    return np.array(Image.open(os.path.join(src, f'{part}_{kind}.png')).convert('RGBA')).astype(np.float32) / 255.0


def to_sc(u, v):
    return [round(x1 + M - v / S, 2), round(u / S - M + y0, 2)]


def rings(field, off, eps=0.5, min_area=6.0, hole_min=5.0, level=0.5):
    """follow the `level` contour of a soft field enlarged K x -> polygons [outer, hole, ...] as lists of (u, v) raster pixels"""
    h, w = field.shape
    f = cv2.resize(field, (w * K, h * K), interpolation=cv2.INTER_CUBIC)
    f = cv2.GaussianBlur(f, (0, 0), 0.9)
    m = (f > level).astype(np.uint8)
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None:
        return out
    hier = hier[0]
    ou, ov = off
    for i, c in enumerate(cs):
        if hier[i][3] != -1 or cv2.contourArea(c) / (K * K) < min_area:
            continue
        ap = cv2.approxPolyDP(c, eps * K, True)[:, 0, :] / float(K) + (ou, ov)
        if len(ap) < 3:
            continue
        pg = [ap]
        j = hier[i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) / (K * K) >= hole_min:
                hp = cv2.approxPolyDP(cs[j], eps * K, True)[:, 0, :] / float(K) + (ou, ov)
                if len(hp) >= 3:
                    pg.append(hp)
            j = hier[j][0]
        out.append(pg)
    return out


def relax(ring, iters=3, keep_deg=105):
    """low-pass the wobble out of a contour but keep real corners: points where the outline turns by more than ~75 degrees stay put"""
    pts = [list(map(float, q)) for q in ring]
    n = len(pts)
    if n < 6:
        return ring
    for _ in range(iters):
        new = []
        for i in range(n):
            a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
            v1, v2 = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
            l1, l2 = (v1[0] ** 2 + v1[1] ** 2) ** 0.5, (v2[0] ** 2 + v2[1] ** 2) ** 0.5
            ang = 180.0 if l1 * l2 == 0 else np.degrees(np.arccos(np.clip((v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2), -1, 1)))
            new.append(b if ang < keep_deg else [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4])
        pts = new
    return np.array(pts)


def pack(polys, smooth=False):
    res = []
    for pg in polys:
        rr = []
        for k, ring in enumerate(pg):
            if smooth:
                ring = relax(ring)
            r = [to_sc(u, v) for u, v in ring]
            area = sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))
            if (area > 0) != (k == 0):
                r.reverse()
            rr.append(r)
        res.append(rr)
    return res


# brightness thresholds from the whole weapon, so every part is levelled on the same scale
lum_all = []
for p in fr['parts']:
    a = load(p, 'art')
    m = a[..., 3] > 0.9
    lum_all.append((0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])[m])
lum_all = np.concatenate(lum_all)
THR = [float(np.percentile(lum_all, q)) for q in cfg['levels']]
print('brightness levels', [round(t, 3) for t in THR])

out = {'wid': wid, 'order': fr['parts'], 'parts': {}}
for p in fr['parts']:
    sil = load(p, 'sil')[..., 3]
    art = load(p, 'art')
    glw = load(p, 'glow')
    ys, xs = np.nonzero(sil > 0.02)
    if len(xs) == 0:
        continue
    pad = 6
    u0, u1, v0, v1 = max(0, xs.min() - pad), min(sil.shape[1], xs.max() + pad + 1), max(0, ys.min() - pad), min(sil.shape[0], ys.max() + pad + 1)
    sl = (slice(v0, v1), slice(u0, u1))
    cov = sil[sl]
    A = art[sl]
    lum = cv2.GaussianBlur(0.299 * A[..., 0] + 0.587 * A[..., 1] + 0.114 * A[..., 2], (0, 0), 1.7)
    if p in cfg['glow_whole']:
        glowf = cov.copy()
        gkind = cfg['glow_whole'][p]
    else:
        ga = glw[sl][..., 3]
        glowf = np.clip((ga - 0.45) / 0.25, 0, 1) * cov
        gkind = cfg['glow_kind']
    off = (u0, v0)
    base = pack(rings(cov, off, eps=0.5, min_area=30, hole_min=8))
    glow = []
    gm = (glowf > 0.5).astype(np.uint8)
    n_g, lab_g, st_g, _ = cv2.connectedComponentsWithStats(cv2.dilate(gm, np.ones((3, 3), np.uint8)), connectivity=8)
    for i in range(1, n_g):
        if st_g[i, cv2.CC_STAT_AREA] < 24:
            continue
        fld = glowf * cv2.dilate((lab_g == i).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
        for pg in pack(rings(fld, off, eps=0.45, min_area=20, hole_min=8)):
            glow.append({'kind': gkind, 'rings': pg})
    plates = []
    body = cov * (1.0 - glowf)
    if p not in cfg['glow_whole']:
        for lvl, thr in enumerate(THR):
            lf = np.clip((lum - thr) / 0.04 + 0.5, 0, 1) * body
            lf = cv2.morphologyEx(lf, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
            lf = np.minimum(lf, cov)
            for pg in pack(rings(lf, off, eps=0.6, min_area=110, hole_min=30, level=0.52), smooth=True):
                plates.append({'h': lvl, 'rings': pg})
    out['parts'][p] = {'base': base, 'plates': plates, 'glow': glow}
    print(f"{p:9s} base {len(base)} polys, plates {len(plates)}, glow {len(glow)}")

dest = os.path.join(HERE, NAMES[wid])
os.makedirs(dest, exist_ok=True)
with open(os.path.join(dest, 'outline.json'), 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('outline.json', os.path.getsize(os.path.join(dest, 'outline.json')) // 1024, 'KB')
