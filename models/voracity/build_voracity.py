"""
VORACITY, the scythe: modelled, shaded, lit and animated entirely from code, for Cycles (path-traced).

Run (from this folder):
    blender -b --python build_voracity.py                       # builds voracity.blend + voracity.glb
    blender -b --python build_voracity.py -- still 120          # also renders one PNG still at frame 120
    blender -b --python build_voracity.py -- anim               # also renders voracity_turntable.mp4

The shape comes from reference.jpg: trace_reference.py turns it into outline.json (silhouette, plates, lit areas, cut into the seven parts) and this
script extrudes that into thin chamfered sheets. Seven parts, same names as the site. Re-trace with:  python trace_reference.py
Blender: Z up, X across (the blade side), Y depth.
"""
import bpy, bmesh, math, os, sys, random, json
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SC = 0.002                              # metres per reference pixel
K = SC
KE = 1 / 700.0                          # the site's explode unit
FPS, END = 30, 360                      # a 12 second loop
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, END


def P(sx, sy, d=0.0):
    return Vector((sy * K, d, sx * K))


def Q(s, c, d=0.0):
    return Vector((c * SC, d * SC, s * SC))


def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


# ============================================================== materials
def nodes_of(m):
    m.use_nodes = True
    return m.node_tree, m.node_tree.nodes['Principled BSDF']


def tex_scratches(nt, bsdf, scale=(60, 60, 4), bump_strength=0.18, rough=(0.2, 0.5), pits=True, bevel=0.0025, ao=True, base_color=None):
    """forged-metal surface: brushed streaks along the shaft, pitting, rounded-edge highlights, crevice darkening"""
    N = nt.nodes
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    streak = N.new('ShaderNodeTexNoise'); streak.inputs['Scale'].default_value = 18; streak.inputs['Detail'].default_value = 10; streak.inputs['Roughness'].default_value = 0.7
    nt.links.new(mp.outputs['Vector'], streak.inputs['Vector'])
    fine = N.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 420; fine.inputs['Detail'].default_value = 6
    nt.links.new(tc.outputs['Object'], fine.inputs['Vector'])
    # roughness varies between the two limits
    rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = rough[0]; rr.inputs['To Max'].default_value = rough[1]
    rr.inputs['From Min'].default_value = 0.3; rr.inputs['From Max'].default_value = 0.75
    nt.links.new(streak.outputs['Fac'], rr.inputs['Value'])
    nt.links.new(rr.outputs['Result'], bsdf.inputs['Roughness'])
    # bump = streaks + fine grain (+ pits)
    comb = N.new('ShaderNodeMath'); comb.operation = 'ADD'
    nt.links.new(streak.outputs['Fac'], comb.inputs[0]); nt.links.new(fine.outputs['Fac'], comb.inputs[1])
    last = comb.outputs[0]
    if pits:
        vor = N.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 140
        nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
        sm = N.new('ShaderNodeMath'); sm.operation = 'SMOOTH_MIN'
        pw = N.new('ShaderNodeMath'); pw.operation = 'MULTIPLY'; pw.inputs[1].default_value = 0.6
        nt.links.new(vor.outputs['Distance'], pw.inputs[0])
        add2 = N.new('ShaderNodeMath'); add2.operation = 'ADD'
        nt.links.new(comb.outputs[0], add2.inputs[0]); nt.links.new(pw.outputs[0], add2.inputs[1])
        last = add2.outputs[0]
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = bump_strength; bump.inputs['Distance'].default_value = 0.002
    nt.links.new(last, bump.inputs['Height'])
    if bevel:
        bv = N.new('ShaderNodeBevel'); bv.inputs['Radius'].default_value = bevel; bv.samples = 6
        nt.links.new(bv.outputs['Normal'], bump.inputs['Normal'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    if ao and base_color is not None:
        ao_n = N.new('ShaderNodeAmbientOcclusion'); ao_n.inputs['Distance'].default_value = 0.03
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        mx.inputs['A'].default_value = (*base_color, 1)
        nt.links.new(ao_n.outputs['Color'], mx.inputs['B'])
        nt.links.new(mx.outputs['Result'], bsdf.inputs['Base Color'])


def metal(name, base, metallic=1.0, coat=0.0, rough=(0.22, 0.5), scale=(60, 60, 4), bump=0.18, bevel=0.0025):
    m = bpy.data.materials.new(name); nt, b = nodes_of(m)
    b.inputs['Base Color'].default_value = (*base, 1); b.inputs['Metallic'].default_value = metallic
    if coat:
        b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.05
    tex_scratches(nt, b, scale=scale, bump_strength=bump, rough=rough, bevel=bevel, base_color=base)
    return m


PULSES = []


def pulse_value(m):
    v = m.node_tree.nodes.new('ShaderNodeValue'); v.name = 'Pulse'; v.outputs[0].default_value = 1.0
    PULSES.append(v)
    return v


def glow(name, color, strength, rough=0.25):
    m = bpy.data.materials.new(name); nt, b = nodes_of(m)
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Subsurface Weight'].default_value = 0.4; b.inputs['Subsurface Radius'].default_value = (0.4, 0.1, 0.6)
    pv = pulse_value(m); mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = strength
    nt.links.new(pv.outputs[0], mul.inputs[0]); nt.links.new(mul.outputs[0], b.inputs['Emission Strength'])
    return m


M_METAL = metal('Voracity_ForgedMetal', (0.075, 0.05, 0.12), coat=0.15, rough=(0.26, 0.5), scale=(50, 50, 5), bump=0.22)
M_PLATE = metal('Voracity_Plate', (0.05, 0.03, 0.09), metallic=0.75, coat=0.25, rough=(0.3, 0.5), scale=(40, 40, 8), bump=0.3, bevel=0.003)
M_DARK = metal('Voracity_BlackIron', (0.03, 0.02, 0.055), metallic=0.8, rough=(0.3, 0.55), scale=(70, 70, 3), bump=0.35)

M_VINE = bpy.data.materials.new('Voracity_Vine'); _nt, _b = nodes_of(M_VINE)
_b.inputs['Base Color'].default_value = (0.05, 0.025, 0.08, 1); _b.inputs['Metallic'].default_value = 0.25
_b.inputs['Subsurface Weight'].default_value = 0.12; _b.inputs['Subsurface Radius'].default_value = (0.3, 0.05, 0.5)
_b.inputs['Coat Weight'].default_value = 0.3; _b.inputs['Coat Roughness'].default_value = 0.25
tex_scratches(_nt, _b, scale=(30, 30, 30), bump_strength=0.55, rough=(0.3, 0.6), pits=True, bevel=0.0015, base_color=(0.05, 0.025, 0.08))

M_EYE = glow('Voracity_Eyelet', (1.0, 0.2, 0.8), 1.5)
M_RING_GLOW = glow('Voracity_RingGlow', (1.0, 0.22, 0.85), 0.45)
M_GLASS = glow('Voracity_VioletGlass', (0.7, 0.16, 1.0), 0.6, rough=0.08)

M_BLADE = metal('Voracity_Blade', (0.035, 0.02, 0.065), metallic=0.8, coat=0.3, rough=(0.25, 0.45), scale=(30, 30, 30), bump=0.25, bevel=0.002)


# ============================================================== geometry helpers
def mesh_obj(name, bm, material, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    if smooth:
        for f in bm.faces:
            f.smooth = True
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(material)
    return link(o, parent)


def add_bevel(o, w=0.0016, seg=2, angle=38):
    md = o.modifiers.new('Bevel', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(angle)


def uvsphere_at(name, loc, r, material, scale=(1, 1, 1), parent=None):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=18, radius=r)
    o = mesh_obj(name, bm, material, parent); o.location = loc; o.scale = scale
    return o


def torus(name, major, minor, material, loc, rot=(0, 0, 0), scale=(1, 1, 1), parent=None, seg=96, ring=24):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=seg, minor_segments=ring)
    o = bpy.context.active_object
    bpy.context.scene.collection.objects.unlink(o)
    o.name = name; o.data.name = name; o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    o.location, o.rotation_euler, o.scale = loc, rot, scale
    return link(o, parent)


def tube(name, pts, radius, material, parent=None, taper=None, res=8, caps=True, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = radius; cu.bevel_resolution = res; cu.use_fill_caps = caps
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    if cyclic:
        sp.use_cyclic_u = True
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1)
        sp.points[i].radius = taper(i / (len(pts) - 1)) if taper else 1.0
    o = bpy.data.objects.new(name, cu); o.data.materials.append(material)
    return link(o, parent)


def talon(name, base, direction, length, radius, material, parent=None, curl=(0, 0, 0), n=14):
    """a curved, tapering horn: starts at `base` heading along `direction`, bends toward `curl`"""
    d = Vector(direction).normalized(); b = Vector(base); c = Vector(curl)
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(b + d * length * t + c * length * t * t)
    return tube(name, pts, radius, material, parent, taper=lambda t: max(0.04, (1 - t) ** 0.85), res=6)


def quad_bez(a, b, c, n=160):
    return [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]) for t in (i / n for i in range(n + 1))]


class Line:
    def __init__(self, pts):
        self.p = pts; n = len(pts); self.n = n - 1; self.t = []
        for i in range(n):
            a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
            tx, ty = b[0] - a[0], b[1] - a[1]; m = math.hypot(tx, ty) or 1
            self.t.append((tx / m, ty / m))

    def at(self, u):
        i = min(self.n - 1, int(u * self.n)); f = u * self.n - i
        a, b = self.p[i], self.p[i + 1]; ta, tb = self.t[i], self.t[i + 1]
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), (ta[0] + (tb[0] - ta[0]) * f, ta[1] + (tb[1] - ta[1]) * f)


def glow_color(u):
    stops = [(0.0, (1.0, 0.72, 1.0)), (0.05, (1.0, 0.4, 0.95)), (0.24, (0.72, 0.14, 0.95)), (0.44, (0.16, 0.02, 0.36)), (0.56, (0.0, 0.0, 0.0))]
    if u >= stops[-1][0]:
        return (0.0, 0.0, 0.0, 1.0)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if u <= b:
            f = (u - a) / (b - a)
            return (ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f, 1.0)
    return (0.0, 0.0, 0.0, 1.0)


# a forged blade section: (s, y). s = +1 inner edge ... -1 outer edge. Bevelled edges and a shallow fuller down the middle.
UP = [(1.0, 0.0), (0.93, 0.7), (0.62, 1.4), (0.2, 1.9), (0.04, 1.3), (-0.12, 1.55), (-0.5, 1.7), (-0.9, 0.95), (-1.0, 0.0)]


def forged_blade(name, cl, wa, wb, material, parent=None, t0=0.0, t1=1.0, n=150, thick=0.017, taper_thick=0.55, sec=UP, dy=0.0, smooth=True):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); col = bm.loops.layers.float_color.new('Glow')
    ring = [(s, y) for s, y in sec] + [(s, -y) for s, y in reversed(sec[1:-1])]
    rows = []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        (cx, cy), (tx, ty) = cl.at(min(t, 0.9999)); nx, ny = -ty, tx
        A, B = wa(t), wb(t); th = thick * (1 - taper_thick * t)
        row = []
        for s, y in ring:
            off = s * A if s >= 0 else s * B
            row.append(bm.verts.new(P(cx + nx * off, cy + ny * off, y * th + dy)))
        rows.append(row)
    L = len(ring)
    for i in range(n):
        for k in range(L):
            k2 = (k + 1) % L
            try:
                f = bm.faces.new((rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]))
            except ValueError:
                continue
            for lp in f.loops:
                for ri in (i, i + 1):
                    if lp.vert in rows[ri]:
                        s = ring[rows[ri].index(lp.vert)][0]
                        lp[uvl].uv = ((1 - s) / 2, (t0 + (t1 - t0) * ri / n))
                        lp[col] = glow_color((1 - s) / 2)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, material, parent, smooth=smooth)


# ============================================================== the scythe
# Built from outline.json, which trace_reference.py makes from reference.jpg: the real silhouette (every spike, cutout and hole), cut into the seven
# parts, extruded into thin flat sheets with chamfered knife edges, with the raised armour plates and the lit areas on top.
# Coordinates are (s, c): s = distance up the shaft from the foot spike, c = distance across it toward the blade side, in reference pixels (2 mm each).
TILT = bpy.data.objects.new('Voracity_Tilt', None); TILT.rotation_euler = (math.radians(-8), math.radians(26), 0); link(TILT)
ROOT = bpy.data.objects.new('Voracity_Root', None); link(ROOT, TILT)
parts = {}


def part(name):
    e = bpy.data.objects.new('Part_' + name, None); e.empty_display_size = 0.05
    link(e, ROOT); parts[name] = e
    return e


OUTLINE = json.load(open(os.path.join(HERE, 'outline.json')))['parts']
STAND = Matrix.Rotation(math.pi / 2, 4, 'X')               # the curves are drawn in XY (x = c, y = s); this stands them up in XZ


def solid(name, polys, half, material, parent, bevel=0.0, flip=False):
    """polys: [[outer, hole, ...], ...] (each ring a list of [s, c]) -> one mesh, a flat sheet 2*half thick with chamfered edges"""
    if not polys:
        return None
    cu = bpy.data.curves.new(name + '_c', 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'; cu.extrude = half; cu.resolution_u = 1
    for pg in polys:
        for ring in pg:
            ring = ring[::-1] if flip else ring
            sp = cu.splines.new('POLY'); sp.points.add(len(ring) - 1); sp.use_cyclic_u = True
            for i, (s, c) in enumerate(ring):
                sp.points[i].co = (c * SC, s * SC, 0, 1)
    co = bpy.data.objects.new(name + '_c', cu); bpy.context.scene.collection.objects.link(co)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(co.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(co); bpy.data.curves.remove(cu)
    me.transform(STAND); me.name = name
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, me); o.data.materials.append(material)
    if bevel:
        md = o.modifiers.new('Chamfer', 'BEVEL'); md.width = bevel; md.segments = 1; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(35)
    return link(o, parent)


# per part: half thickness of the sheet, chamfer width, material of the sheet
SPEC = {
    'blade':   dict(half=0.0045, bevel=0.0042, mat='blade'),
    'mantle':  dict(half=0.0055, bevel=0.0036, mat='blade'),
    'ring':    dict(half=0.0095, bevel=0.0040, mat='dark'),
    'upbind':  dict(half=0.0105, bevel=0.0040, mat='dark'),
    'shaft':   dict(half=0.0100, bevel=0.0040, mat='dark'),
    'lowbind': dict(half=0.0100, bevel=0.0040, mat='dark'),
    'foot':    dict(half=0.0100, bevel=0.0040, mat='dark'),
}
PLATE_H = (0.007, 0.015, 0.024)
PLATE_MAT = (M_DARK, M_PLATE, M_METAL)           # low plates darkest, the top rank lightest, so the layers read
FLIP = False
MATS = {'blade': M_BLADE, 'dark': M_DARK}
for pname in ('foot', 'lowbind', 'shaft', 'upbind', 'ring', 'mantle', 'blade'):
    P_ = part(pname); d = OUTLINE[pname]; sp_ = SPEC[pname]
    base = solid('Blade' if pname == 'blade' else f'{pname}_base', d['base'], sp_['half'], MATS[sp_['mat']], P_, sp_['bevel'], FLIP)
    for k in range(3):                                                  # the raised plates, three heights so they read as layers
        pl = [p['rings'] for p in d['plates'] if p['h'] == k]
        solid(f'{pname}_plates{k}', pl, sp_['half'] + PLATE_H[k], PLATE_MAT[k], P_, 0.0062, FLIP)
    for kind, mat in (('face', M_RING_GLOW), ('eye', M_GLASS)):          # the lit areas, a hair above the sheet (the plates stand proud of them)
        gl = [g['rings'] for g in d['glow'] if g['kind'] == kind]
        solid(f'{pname}_glow_{kind}', gl, sp_['half'] + 0.0007, mat, P_, 0.0, FLIP)

# ============================================================== stage
floor_m = bpy.data.materials.new('Obsidian'); fnt, fb = nodes_of(floor_m)
fb.inputs['Base Color'].default_value = (0.004, 0.003, 0.007, 1); fb.inputs['Roughness'].default_value = 0.07
fn = fnt.nodes.new('ShaderNodeTexNoise'); fn.inputs['Scale'].default_value = 3.0; fn.inputs['Detail'].default_value = 8
fr = fnt.nodes.new('ShaderNodeMapRange'); fr.inputs['To Min'].default_value = 0.05; fr.inputs['To Max'].default_value = 0.3
fnt.links.new(fn.outputs['Fac'], fr.inputs['Value']); fnt.links.new(fr.outputs['Result'], fb.inputs['Roughness'])
fb2 = fnt.nodes.new('ShaderNodeTexNoise'); fb2.inputs['Scale'].default_value = 260; bmp = fnt.nodes.new('ShaderNodeBump'); bmp.inputs['Strength'].default_value = 0.03
fnt.links.new(fb2.outputs['Fac'], bmp.inputs['Height']); fnt.links.new(bmp.outputs['Normal'], fb.inputs['Normal'])
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=16)
floor = mesh_obj('Floor', bm, floor_m, smooth=False); floor.location.z = -0.46
rune_m = glow('FloorRune', (1.0, 0.3, 0.9), 2.2)
torus('FloorRing', 1.25, 0.008, rune_m, (0, 0, -0.455), seg=160, ring=8)
torus('FloorRing2', 1.5, 0.004, rune_m, (0, 0, -0.455), seg=160, ring=8)
bm = bmesh.new()
for i in range(72):
    a = i / 72 * math.pi * 2
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((math.cos(a) * 1.38, math.sin(a) * 1.38, -0.455)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Diagonal((0.035 if i % 3 else 0.09, 0.006, 0.004, 1)))
mesh_obj('FloorRunes', bm, rune_m, smooth=False)

world = bpy.data.worlds.new('World'); scene.world = world; world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
bg = wn['Background']; bg.inputs['Strength'].default_value = 1.0
tc = wn.new('ShaderNodeTexCoord'); sp = wn.new('ShaderNodeSeparateXYZ'); rp = wn.new('ShaderNodeValToRGB')
wl.new(tc.outputs['Generated'], sp.inputs[0]); wl.new(sp.outputs['Z'], rp.inputs['Fac'])
re_ = rp.color_ramp.elements; re_[0].position = 0.4; re_[0].color = (0.002, 0.001, 0.006, 1); re_[1].position = 1.0; re_[1].color = (0.08, 0.03, 0.2, 1)
md = re_.new(0.6); md.color = (0.03, 0.012, 0.09, 1)
wl.new(rp.outputs['Color'], bg.inputs['Color'])
vs = wn.new('ShaderNodeVolumeScatter'); vs.inputs['Density'].default_value = 0.0011; vs.inputs['Anisotropy'].default_value = 0.4
vs.inputs['Color'].default_value = (0.6, 0.35, 0.95, 1)
wl.new(vs.outputs[0], wn['World Output'].inputs['Volume'])


def light(name, kind, loc, energy, color, size=2.0, parent=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA':
        ld.size = size
    o = bpy.data.objects.new(name, ld); o.location = loc; link(o, parent)
    return o


TARGET = bpy.data.objects.new('FocusTarget', None); TARGET.location = (0.05, 0, 0.95); link(TARGET)
RIG = bpy.data.objects.new('LightRig', None); link(RIG)
key = light('Key', 'AREA', (-3.0, -3.2, 3.6), 260, (0.95, 0.85, 1.0), 2.6, RIG)
rim1 = light('RimMagenta', 'AREA', (3.4, 2.4, 2.4), 1500, (1.0, 0.25, 0.85), 1.6, RIG)
rim2 = light('RimBlue', 'AREA', (-3.2, 2.8, 2.0), 520, (0.35, 0.3, 1.0), 1.6, RIG)
front = light('Fill', 'AREA', (-1.5, -4.2, 1.6), 38, (0.85, 0.7, 1.0), 3.5, RIG)
strip1 = light('StripL', 'AREA', (-1.6, -1.2, 1.2), 70, (1.0, 0.35, 0.9), 0.3, RIG); strip1.data.shape = 'RECTANGLE'; strip1.data.size = 0.18; strip1.data.size_y = 3.0
strip2 = light('StripR', 'AREA', (1.7, -1.0, 1.0), 70, (0.5, 0.4, 1.0), 0.3, RIG); strip2.data.shape = 'RECTANGLE'; strip2.data.size = 0.18; strip2.data.size_y = 3.0
top = light('Beam', 'SPOT', (0.4, -0.2, 6.2), 1300, (0.9, 0.7, 1.0)); top.data.spot_size = math.radians(26); top.data.spot_blend = 0.8
for l in (key, rim1, rim2, top, strip1, strip2, front):
    tt = l.constraints.new('TRACK_TO'); tt.target = TARGET; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'

cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 38
cam_d.dof.use_dof = True; cam_d.dof.focus_object = TARGET; cam_d.dof.aperture_fstop = 2.4
CAM = bpy.data.objects.new('Camera', cam_d); link(CAM); scene.camera = CAM
tt = CAM.constraints.new('TRACK_TO'); tt.target = TARGET; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'

# embers rising off the blade, and a few motes of dust drifting in the beam
ember_m = glow('Ember', (1.0, 0.5, 0.95), 18.0)
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
ember = mesh_obj('EmberProto', bm, ember_m); ember.hide_render = True; ember.hide_viewport = True
bladeo = bpy.data.objects['Blade']
bladeo.modifiers.new('Embers', 'PARTICLE_SYSTEM')
ps = bladeo.particle_systems[0].settings
ps.count = 600; ps.frame_start = 1; ps.frame_end = END; ps.lifetime = 90; ps.lifetime_random = 0.6
ps.emit_from = 'FACE'; ps.normal_factor = 0.18; ps.factor_random = 0.25
ps.render_type = 'OBJECT'; ps.instance_object = ember; ps.particle_size = 0.0042; ps.size_random = 0.7
try:
    ps.effector_weights.gravity = -0.08; ps.brownian_factor = 0.35
except Exception:
    pass

# ============================================================== animation
def key_loc(o, f, v):
    o.location = v; o.keyframe_insert('location', frame=f)


def key_rot(o, f, v):
    o.rotation_euler = v; o.keyframe_insert('rotation_euler', frame=f)


for f in range(-30, END + 31, 15):
    key_rot(ROOT, f, (0, 0, math.radians(68) * math.sin(2 * math.pi * f / END) - math.radians(20)))
    key_rot(RIG, f, (0, 0, -math.pi * f / END))
for f in range(-30, END + 31, 15):
    key_loc(ROOT, f, (0, 0, 0.05 * math.sin(2 * math.pi * f / 120)))

EX = {'foot': (-250, 20), 'lowbind': (-90, -170), 'shaft': (0, 0), 'upbind': (80, 170), 'ring': (120, -250), 'mantle': (380, -70), 'blade': (190, 150)}
for name, (dx, dy) in EX.items():
    ex = Vector((dy * KE * 1.25, 0, dx * KE * 1.25))
    for f, s in ((1, 0), (80, 0), (165, 1), (250, 1), (335, 0), (END + 1, 0)):
        key_loc(parts[name], f, ex * s)
for f, z in ((1, 0.95), (120, 1.3), (250, 1.3), (335, 0.95), (END + 1, 0.95)):
    key_loc(TARGET, f, (0.05, 0, z))
for f, (d, h) in ((1, (3.9, 0.9)), (120, (6.6, 1.2)), (250, (6.6, 1.2)), (335, (3.9, 0.9)), (END + 1, (3.9, 0.9))):
    key_loc(CAM, f, (-d * 0.28, -d, h + 0.5))
for v in PULSES:
    for f in range(0, END + 31, 15):
        v.outputs[0].default_value = 1.0 + 0.45 * math.sin(2 * math.pi * f / 60) + 0.15 * math.sin(2 * math.pi * f / 23)
        v.outputs[0].keyframe_insert('default_value', frame=f)
for l, base in ((rim1, 1500), (rim2, 520)):
    for f in range(0, END + 31, 15):
        l.data.energy = base * (1 + 0.3 * math.sin(2 * math.pi * f / 60 + (0 if l is rim1 else 2)))
        l.data.keyframe_insert('energy', frame=f)

# ============================================================== render: Cycles, denoised
scene.render.engine = 'CYCLES'
cy = scene.cycles
cy.device = 'CPU'; cy.samples = 64; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.02
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
cy.max_bounces = 10; cy.diffuse_bounces = 3; cy.glossy_bounces = 6; cy.transmission_bounces = 4; cy.volume_bounces = 2
cy.caustics_reflective = False; cy.caustics_refractive = False; cy.sample_clamp_indirect = 8.0
scene.render.use_motion_blur = True; scene.render.motion_blur_shutter = 0.3
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
try:
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - High Contrast'; scene.view_settings.exposure = -0.1
except Exception as ex:
    print('view', ex)

try:                                       # bloom around the glow
    ng = bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = ng.nodes.new('CompositorNodeRLayers'); gl = ng.nodes.new('CompositorNodeGlare'); out = ng.nodes.new('NodeGroupOutput')
    for name, vals in (('Type', ['BLOOM', 'Bloom']), ('Quality', ['HIGH', 'High']), ('Threshold', [0.9]), ('Strength', [0.5]), ('Size', [0.62]), ('Smoothness', [0.6])):
        for v in vals:
            try:
                gl.inputs[name].default_value = v; break
            except Exception:
                continue
    ng.links.new(rl.outputs['Image'], gl.inputs['Image']); ng.links.new(gl.outputs['Image'], out.inputs['Image'])
    scene.compositing_node_group = ng
except Exception as ex:
    print('glare skipped', ex)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'voracity.blend'))
print('SAVED blend')
try:                                       # the web model: only the scythe (no floor, lights or embers), glow colours kept
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for c in o.children:
            sel(c)
    sel(TILT)
    bpy.context.view_layer.objects.active = ROOT
    web = os.path.join(HERE, '..', '..', 'app', 'src', 'assets', 'voracity.glb')
    os.makedirs(os.path.dirname(web), exist_ok=True)
    for path in (os.path.join(HERE, 'voracity.glb'), web):
        try:
            bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=False, use_selection=True,
                                      export_apply=True, export_yup=True, export_vertex_color='ACTIVE')
        except TypeError:
            bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=False, use_selection=True, export_apply=True, export_yup=True)
    print('SAVED glb')
except Exception as ex:
    print('glb skipped', ex)

if ARGS[:1] == ['ref']:                    # face-on, no animation, leaning like the reference drawing: ref [samples] [width height]
    for o in (ROOT, RIG, TARGET, CAM):
        o.animation_data_clear()
    scene.frame_set(1)
    TILT.rotation_euler = (0, 0, 0); ROOT.rotation_euler = (0, math.radians(-21), 0); ROOT.location = (0, 0, 0); RIG.rotation_euler = (0, 0, 0)
    for p_ in parts.values():
        p_.animation_data_clear(); p_.location = (0, 0, 0)
    TARGET.location = (-0.45, 0, 0.9); CAM.location = (-0.45, -3.4, 0.95); cam_d.lens = 50
    if 'head' in ARGS:                                   # a close-up of the head
        TARGET.location = (-0.3, 0, 1.62); CAM.location = (-0.3, -2.0, 1.66)
    cy.samples = int(ARGS[1]) if len(ARGS) > 1 else 48
    scene.render.resolution_x, scene.render.resolution_y = (int(ARGS[2]), int(ARGS[3])) if len(ARGS) > 3 and ARGS[3].isdigit() else (900, 1100)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.join(HERE, 'head_view.png' if 'head' in ARGS else 'ref_view.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED ref')
elif ARGS[:1] == ['still']:
    scene.frame_set(int(ARGS[1]) if len(ARGS) > 1 else 1)
    cy.samples = int(ARGS[2]) if len(ARGS) > 2 else 48
    if len(ARGS) > 4:
        scene.render.resolution_x, scene.render.resolution_y = int(ARGS[3]), int(ARGS[4])
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.join(HERE, f'still_{scene.frame_current:03d}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
elif ARGS[:1] == ['anim']:
    # anim [width height samples first last]
    a = [int(v) for v in ARGS[1:]] + [1280, 720, 48, 1, END][len(ARGS) - 1:] if len(ARGS) > 1 else [1280, 720, 48, 1, END]
    scene.render.resolution_x, scene.render.resolution_y, cy.samples = a[0], a[1], a[2]
    scene.frame_start, scene.frame_end = a[3], a[4]
    try:
        scene.render.image_settings.media_type = 'VIDEO'
    except Exception:
        pass
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'; scene.render.ffmpeg.codec = 'H264'; scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.filepath = os.path.join(HERE, 'voracity_turntable.mp4')
    bpy.ops.render.render(animation=True)
    print('RENDERED anim')
