"""
Trace reference.jpg into outlines the Blender script extrudes into the scythe.

    python trace_reference.py            # writes outline.json (needs numpy + opencv-python)

Everything is in reference pixels turned into the scythe's own frame: s = distance up the shaft from the foot spike, c = distance across it toward the
blade side (the reference leans, this stands it up). Per part it stores
  base   the part's silhouette (polygons, each = [outer ring, hole rings...]),
  plates the raised armour plates (level sets of the painted brightness, three stacked heights 0..2; the black outline strokes stay as grooves),
  glow   the lit areas (kind 'face' = the pale burning surface, 'eye' = the deep violet ovals).

Edges are traced from soft (anti-aliased) coverage fields, not from thresholded pixels: each field is enlarged 4x with a cubic filter and the 0.5
level is followed, so the outlines are smooth curves with no pixel stair-steps while the spike tips stay sharp.
"""
import json, os
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
im = cv2.imread(os.path.join(HERE, 'reference.jpg'))
H, W = im.shape[:2]
K = 4                                                  # enlargement for contouring
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
Vv, Ss = hsv[..., 2].astype(np.float32), hsv[..., 1].astype(np.float32)
minc = im.min(axis=2).astype(np.float32)

# --- silhouette coverage: 0 on the white paper, 1 on the art, partial on the anti-aliased rim
ink = (minc < 225).astype(np.uint8)
ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
sil1 = np.zeros_like(ink)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 400:
        sil1[lab == i] = 1
near = cv2.dilate(sil1, np.ones((5, 5), np.uint8)).astype(np.float32)
cov = np.clip((250.0 - minc) / 70.0, 0, 1) * near
cov = np.maximum(cov, cv2.erode(sil1, np.ones((3, 3), np.uint8)).astype(np.float32))      # the inside is solid, whatever its colour

# --- the shaft axis -> the scythe's frame
F = np.array([592.0, 888.0]); top = np.array([330.0, 215.0])
a = (top - F) / np.linalg.norm(top - F)               # runs up the shaft
b = np.array([-a[1], a[0]])
if b[0] < 0:
    b = -b                                            # points to the blade side (right and up)


def to_sc(pt):
    d = np.array(pt, float) - F
    return [round(float(d @ a), 2), round(float(d @ b), 2)]


def poly(pts):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m


yy = np.arange(H)[:, None] * np.ones((1, W))
REG = {
    'foot': (yy >= 640).astype(np.uint8),
    'lowbind': ((yy >= 520) & (yy < 640)).astype(np.uint8),
    'shaft': ((yy >= 350) & (yy < 520)).astype(np.uint8),
    'upbind': poly([(262, 185), (345, 180), (400, 230), (460, 300), (478, 350), (262, 350)]),
    'ring': poly([(0, 140), (215, 140), (262, 125), (262, 350), (0, 350)]),
    'mantle': poly([(80, 0), (420, 0), (330, 70), (262, 125), (215, 140), (80, 140)]),
}
ORDER = ['foot', 'lowbind', 'shaft', 'upbind', 'ring', 'mantle']
taken = np.zeros((H, W), np.uint8)
PART = {}
for name in ORDER:
    PART[name] = (REG[name] & (1 - taken)).astype(np.uint8)
    taken |= REG[name]
PART['blade'] = ((1 - taken) & (yy < 350)).astype(np.uint8)


def rings(field, region=None, eps=0.5, min_area=6.0, hole_min=5.0, level=0.5):
    """follow the `level` contour of a soft 1x field (times a hard region mask) after enlarging it K x
    -> polygons [outer, hole, ...] in 1x pixel coordinates"""
    f = cv2.resize(field.astype(np.float32), (W * K, H * K), interpolation=cv2.INTER_CUBIC)
    if region is not None:
        f = f * cv2.resize(region.astype(np.float32), (W * K, H * K), interpolation=cv2.INTER_NEAREST)
    f = cv2.GaussianBlur(f, (0, 0), 1.6)
    m = (f > level).astype(np.uint8)
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None:
        return out
    hier = hier[0]
    for i, c in enumerate(cs):
        if hier[i][3] != -1:
            continue
        if cv2.contourArea(c) / (K * K) < min_area:
            continue
        ap = cv2.approxPolyDP(c, eps * K, True)[:, 0, :] / float(K)
        if len(ap) < 3:
            continue
        pg = [ap]
        j = hier[i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) / (K * K) >= hole_min:
                hp = cv2.approxPolyDP(cs[j], eps * K, True)[:, 0, :] / float(K)
                if len(hp) >= 3:
                    pg.append(hp)
            j = hier[j][0]
        out.append(pg)
    return out


def orient(ring, ccw):
    r = [to_sc(p) for p in ring]
    area = sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))
    if (area > 0) != ccw:
        r.reverse()
    return r


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
    return [[orient(relax(r) if smooth else r, k == 0) for k, r in enumerate(pg)] for pg in polys]


# --- lit areas as a soft field (bright AND coloured), and the dark armour body = the art minus the lit areas
Vs = cv2.GaussianBlur(Vv, (0, 0), 0.9)
Sg = cv2.GaussianBlur(Ss, (0, 0), 0.9)
glowf = np.clip((Vs - 128.0) / 24.0, 0, 1) * np.clip((Sg - 22.0) / 28.0, 0, 1) * (cov > 0.5)
glowf = cv2.morphologyEx(glowf, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
bodyf = cov * (1.0 - glowf)
Lb = cv2.GaussianBlur(Vv, (0, 0), 1.9)
LEVELS = (40, 64, 92)

out = {'parts': {}}
for name, pm in PART.items():
    base = pack(rings(cov, pm, eps=0.5, min_area=25, hole_min=6))
    gm = ((glowf > 0.5) & (pm > 0)).astype(np.uint8)
    n_g, lab_g, st_g, _ = cv2.connectedComponentsWithStats(cv2.dilate(gm, np.ones((3, 3), np.uint8)), connectivity=8)
    glow = []
    for i in range(1, n_g):
        if st_g[i, cv2.CC_STAT_AREA] < 14:
            continue
        mk = (lab_g == i)
        kind = 'eye' if float(im[..., 1][mk & (gm > 0)].mean()) < 105 else 'face'      # BGR: index 1 is green; the ovals are the deeper violet
        fld = glowf * cv2.dilate(mk.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
        for pg in pack(rings(fld, pm, eps=0.45, min_area=10, hole_min=4)):
            glow.append({'kind': kind, 'rings': pg})
    plates = []
    for lvl, thr in enumerate(LEVELS):
        lf = np.clip((Lb - thr) / 7.0 + 0.5, 0, 1) * bodyf
        lf = cv2.morphologyEx(lf, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))          # bridge the hairline black strokes: they only alias into jagged dark lines at screen size
        lf = np.minimum(lf, cov)
        for pg in pack(rings(lf, pm, eps=0.6, min_area=90, hole_min=26, level=0.52), smooth=True):
            plates.append({'h': lvl, 'rings': pg})
    out['parts'][name] = {'base': base, 'plates': plates, 'glow': glow}
    print(f"{name:8s} base {len(base)} polys, plates {len(plates)}, glow {len(glow)}")

with open(os.path.join(HERE, 'outline.json'), 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('outline.json', os.path.getsize(os.path.join(HERE, 'outline.json')) // 1024, 'KB')
