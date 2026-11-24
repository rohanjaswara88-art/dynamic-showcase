"""
VORACITY, the scythe, modelled, lit and animated entirely from code.

Run (from this folder):
    blender -b --python build_voracity.py                     # builds voracity.blend + voracity.glb
    blender -b --python build_voracity.py -- still 120        # also renders one PNG still at frame 120
    blender -b --python build_voracity.py -- anim             # also renders the MP4

The shapes follow the SVG scythe used on the site (same 7 parts, same proportions): SVG x runs up the shaft, SVG y runs
across it, scaled by 1/700 to metres. Blender: Z is up, X is across (the blade side), Y is depth.
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
K = 1 / 700.0
FPS, END = 30, 360                      # a 12 second loop
random.seed(7)

# ------------------------------------------------------------------ scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, END


def P(sx, sy, d=0.0):
    """SVG point -> Blender point (x along the shaft becomes Z)"""
    return Vector((sy * K, d, sx * K))


def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


# ------------------------------------------------------------------ materials
def mat(name, base=(0.05, 0.02, 0.1), metal=0.0, rough=0.5, emit=None, emit_strength=0.0, coat=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


def noise_bump(m, scale=60.0, strength=0.12):
    """fine surface grain so the metal catches light unevenly"""
    nt = m.node_tree
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 8
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = strength
    nt.links.new(n.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])


PULSES = []                              # value nodes that breathe


def pulse_value(m, name='Pulse'):
    v = m.node_tree.nodes.new('ShaderNodeValue'); v.name = name; v.outputs[0].default_value = 1.0
    PULSES.append(v)
    return v


M_METAL = mat('Voracity_Metal', (0.045, 0.02, 0.09), metal=0.92, rough=0.26, coat=0.35); noise_bump(M_METAL, 90, 0.08)
M_PLATE = mat('Voracity_Plate', (0.07, 0.03, 0.13), metal=0.85, rough=0.34, coat=0.25); noise_bump(M_PLATE, 40, 0.1)
M_VINE = mat('Voracity_Vine', (0.06, 0.03, 0.1), metal=0.4, rough=0.45, coat=0.2); noise_bump(M_VINE, 120, 0.2)
M_VIOLET_GLASS = mat('Voracity_Glass', (0.4, 0.1, 0.8), metal=0.0, rough=0.08, emit=(0.8, 0.2, 1.0), emit_strength=1.5)
M_EYE = mat('Voracity_Eyelet', (1.0, 0.4, 0.95), rough=0.2, emit=(1.0, 0.3, 0.9), emit_strength=5.0)
M_RING_GLOW = mat('Voracity_RingGlow', (1, 0.5, 1), rough=0.3, emit=(1.0, 0.3, 0.9), emit_strength=3.0)
for _m in (M_EYE, M_RING_GLOW):
    pv = pulse_value(_m)
    mul = _m.node_tree.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    base_strength = _m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value
    mul.inputs[1].default_value = base_strength
    _m.node_tree.links.new(pv.outputs[0], mul.inputs[0])
    _m.node_tree.links.new(mul.outputs[0], _m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'])

# the blade: dark outer plate, an inner edge that burns. U runs inner edge (0) to outer edge (1).
M_BLADE = bpy.data.materials.new('Voracity_Blade'); M_BLADE.use_nodes = True
_nt = M_BLADE.node_tree; _b = _nt.nodes['Principled BSDF']
_b.inputs['Base Color'].default_value = (0.02, 0.008, 0.045, 1); _b.inputs['Metallic'].default_value = 0.7; _b.inputs['Roughness'].default_value = 0.36
_b.inputs['Coat Weight'].default_value = 0.4; _b.inputs['Coat Roughness'].default_value = 0.06
_uv = _nt.nodes.new('ShaderNodeTexCoord'); _sep = _nt.nodes.new('ShaderNodeSeparateXYZ')
_nt.links.new(_uv.outputs['UV'], _sep.inputs[0])
_ramp = _nt.nodes.new('ShaderNodeValToRGB'); _ramp.color_ramp.interpolation = 'EASE'
_e = _ramp.color_ramp.elements; _e[0].position = 0.0; _e[0].color = (1.0, 0.42, 0.94, 1); _e[1].position = 0.46; _e[1].color = (0, 0, 0, 1)
_x = _e.new(0.1); _x.color = (1.0, 0.28, 0.9, 1); _x = _e.new(0.26); _x.color = (0.42, 0.08, 0.75, 1)
_nt.links.new(_sep.outputs['X'], _ramp.inputs['Fac'])
# a little marbling so the glow is not a flat gradient
_n = _nt.nodes.new('ShaderNodeTexNoise'); _n.inputs['Scale'].default_value = 14; _n.inputs['Detail'].default_value = 6
_mix = _nt.nodes.new('ShaderNodeMix'); _mix.data_type = 'RGBA'; _mix.blend_type = 'MULTIPLY'; _mix.inputs['Factor'].default_value = 0.6
_nt.links.new(_ramp.outputs['Color'], _mix.inputs['A']); _nt.links.new(_n.outputs['Color'], _mix.inputs['B'])
_nt.links.new(_mix.outputs['Result'], _b.inputs['Emission Color'])
_pv = pulse_value(M_BLADE); _mul = _nt.nodes.new('ShaderNodeMath'); _mul.operation = 'MULTIPLY'; _mul.inputs[1].default_value = 1.4
_nt.links.new(_pv.outputs[0], _mul.inputs[0]); _nt.links.new(_mul.outputs[0], _b.inputs['Emission Strength'])
noise_bump(M_BLADE, 70, 0.06)

# ------------------------------------------------------------------ geometry helpers
def mesh_obj(name, bm, material, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    if smooth:
        for f in bm.faces:
            f.smooth = True
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(material)
    return link(o, parent)


def cone(bm, base, direction, length, radius, segs=12, tip=0.0006):
    d = Vector(direction).normalized()
    mx = Matrix.Translation(Vector(base) + d * length / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=radius, radius2=tip, depth=length, matrix=mx)


def uvsphere_at(name, loc, r, material, scale=(1, 1, 1), parent=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=r)
    o = mesh_obj(name, bm, material, parent)
    o.location = loc; o.scale = scale
    return o


def torus(name, major, minor, material, loc, rot=(0, 0, 0), scale=(1, 1, 1), parent=None, seg=64, ring=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=seg, minor_segments=ring)
    o = bpy.context.active_object
    bpy.context.scene.collection.objects.unlink(o)
    o.name = name; o.data.name = name
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    o.location, o.rotation_euler, o.scale = loc, rot, scale
    return link(o, parent)


def tube(name, pts, radius, material, parent=None, taper=None, res=6):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = radius; cu.bevel_resolution = res; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1)
        sp.points[i].radius = taper(i / (len(pts) - 1)) if taper else 1.0
    o = bpy.data.objects.new(name, cu); o.data.materials.append(material)
    return link(o, parent)


def quad_bez(a, b, c, n=120):
    return [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]) for t in (i / n for i in range(n + 1))]


class Line:
    """a centre line in SVG space with tangents and normals (normal = (-ty, tx), as on the site)"""
    def __init__(self, pts):
        self.p = pts
        n = len(pts)
        self.n = n - 1
        self.t = []
        for i in range(n):
            a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
            tx, ty = b[0] - a[0], b[1] - a[1]; m = math.hypot(tx, ty) or 1
            self.t.append((tx / m, ty / m))

    def at(self, u):
        i = min(self.n - 1, int(u * self.n)); f = u * self.n - i
        a, b = self.p[i], self.p[i + 1]; ta, tb = self.t[i], self.t[i + 1]
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), (ta[0] + (tb[0] - ta[0]) * f, ta[1] + (tb[1] - ta[1]) * f)


def ribbon(name, cl, wa, wb, material, parent=None, t0=0.0, t1=1.0, n=90, thick=0.02, ridge=0.0):
    """a blade-like plate: edge on the +normal side at distance wa(t), the other edge at wb(t); a lens section `thick` deep"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rows = []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        (cx, cy), (tx, ty) = cl.at(min(t, 0.9999))
        nx, ny = -ty, tx
        A, B = wa(t), wb(t)
        th = thick * (min(1.0, (A + B) / 40.0) if callable(thick) is False else 1.0)
        o = ridge * (A - B) / 2
        rows.append([bm.verts.new(P(cx + nx * A, cy + ny * A, 0)), bm.verts.new(P(cx + nx * o, cy + ny * o, th)),
                     bm.verts.new(P(cx - nx * B, cy - ny * B, 0)), bm.verts.new(P(cx + nx * o, cy + ny * o, -th))])
    us = (0.0, 0.5, 1.0, 0.5)
    for i in range(n):
        r0, r1 = rows[i], rows[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            try:
                f = bm.faces.new((r0[k], r0[k2], r1[k2], r1[k]))
            except ValueError:
                continue
            for lp in f.loops:
                vi = lp.vert
                for rr, ri in ((r0, i), (r1, i + 1)):
                    if vi in rr:
                        lp[uvl].uv = (us[rr.index(vi)], ri / n)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return mesh_obj(name, bm, material, parent, smooth=False)


# ------------------------------------------------------------------ the scythe (in SVG units, then mapped)
TILT = bpy.data.objects.new('Voracity_Tilt', None); TILT.rotation_euler = (math.radians(-8), math.radians(26), 0); link(TILT)
ROOT = bpy.data.objects.new('Voracity_Root', None); ROOT.empty_display_type = 'PLAIN_AXES'; link(ROOT, TILT)
parts = {}


def part(name):
    e = bpy.data.objects.new('Part_' + name, None); e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 0.05
    link(e, ROOT); parts[name] = e
    return e


# --- shaft + vine
SH = part('shaft')
shaft_pts = [P(x, 14 * math.sin(x / 520.0)) for x in range(120, 1060, 20)]
tube('Shaft', shaft_pts, 0.024, M_METAL, SH, taper=lambda t: 1.0 + 0.1 * math.sin(t * 9))
for k, ph in enumerate((0.0, math.pi)):
    pts = []
    for i in range(0, 421):
        z = 0.2 + i * 0.0030
        sx = z / K; cx = 14 * math.sin(sx / 520.0) * K
        a = z / 0.19 * math.pi * 2 + ph
        pts.append(Vector((cx + 0.033 * math.sin(a), 0.033 * math.cos(a), z)))
    tube(f'Vine{k}', pts, 0.0065, M_VINE, SH, res=4)
    bm = bmesh.new()
    for i in range(6, 420, 14):
        p = pts[i]; out = Vector((p.x - 14 * math.sin(p.z / K / 520.0) * K, p.y, 0)).normalized()
        cone(bm, p, out + Vector((0, 0, 0.45 * (1 if i % 28 else -1))), 0.036, 0.0075, 8)
    mesh_obj(f'Thorns{k}', bm, M_PLATE, SH)


def helix_binding(name, z0, z1):
    e = part(name)
    z = z0
    for k, ph in enumerate((0.0, math.pi)):
        pts = []
        for i in range(0, 121):
            zz = z0 + (z1 - z0) * i / 120
            a = (zz - z0) / 0.1 * math.pi * 2 + ph
            pts.append(Vector((0.048 * math.sin(a) + 0.01, 0.048 * math.cos(a), zz)))
        tube(f'{name}_strand{k}', pts, 0.0125, M_VINE, e, res=6)
    for zz in (z0 - 0.012, z1 + 0.012):
        torus(f'{name}_collar', 0.037, 0.013, M_PLATE, (0.0, 0, zz), parent=e, seg=32, ring=10)
    for i in range(1, 4):
        uvsphere_at(f'{name}_bead', (0.0, 0, z0 + (z1 - z0) * i / 4), 0.0075, M_EYE, parent=e)
    return e


helix_binding('lowbind', 235 * K, 375 * K)
helix_binding('upbind', 870 * K, 1010 * K)

# --- foot talon
FT = part('foot')
torus('FootFrame', 0.062, 0.0125, M_PLATE, (0.0, 0, 0.105), rot=(math.pi / 2, 0, 0), scale=(1, 1.9, 1), parent=FT, seg=48, ring=14)
bm = bmesh.new()
cone(bm, (0, 0, 0.045), (0, 0, -1), 0.17, 0.032, 14)
cone(bm, (0.0, 0, 0.14), (0.45, 0, -0.75), 0.07, 0.014, 10)
cone(bm, (0.0, 0, 0.14), (-0.45, 0, -0.75), 0.07, 0.014, 10)
mesh_obj('FootSpike', bm, M_METAL, FT)
uvsphere_at('FootCore', (0, 0, 0.105), 0.032, M_EYE, parent=FT)

# --- ring (the maw)
RING = (1130, -20)
rc = P(*RING)
RG = part('ring')
torus('Ring', 0.136, 0.03, M_PLATE, rc, rot=(math.pi / 2, 0, 0), parent=RG, seg=72, ring=20)
torus('RingGlow', 0.103, 0.0065, M_RING_GLOW, rc, rot=(math.pi / 2, 0, 0), parent=RG, seg=72, ring=10)
torus('RingRim', 0.153, 0.004, M_VIOLET_GLASS, rc, rot=(math.pi / 2, 0, 0), parent=RG, seg=72, ring=8)
for a in (200, 262, 330):
    ar = math.radians(a)
    p = P(RING[0] + 92 * math.cos(ar), RING[1] + 92 * math.sin(ar))
    uvsphere_at('Eyelet', p, 0.024, M_EYE, parent=RG)
    torus('EyeletSocket', 0.024, 0.007, M_PLATE, p, rot=(math.pi / 2, 0, 0), parent=RG, seg=24, ring=8)

# --- blade (concave side burns)
BL = Line(quad_bez((1130, 50), (1480, 300), (1040, 790)))


def wtot(t):
    return 205 * math.pow(1 - t, 0.9) * min(1.0, 0.55 + t * 5)


wa = lambda t: wtot(t) * 0.58
wb = lambda t: wtot(t) * 0.42
BLD = part('blade')
ribbon('Blade', BL, wa, wb, M_BLADE, BLD, n=140, thick=0.028, ridge=-0.35)
bm = bmesh.new()
for i, t in enumerate((0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8)):
    (cx, cy), (tx, ty) = BL.at(t); nx, ny = -ty, tx
    bx, by = cx - nx * wb(t) * 0.95, cy - ny * wb(t) * 0.95
    dx, dy = -nx * 0.75 - tx * 0.9, -ny * 0.75 - ty * 0.9
    m = math.hypot(dx, dy)
    cone(bm, P(bx, by), Vector((dy / m, 0, dx / m)), (92 - i * 8) * K, (46 - i * 3.5) * K / 2, 10)
mesh_obj('BladeSpines', bm, M_PLATE, BLD)
for i, t in enumerate((0.07, 0.17, 0.27, 0.37, 0.48, 0.6)):
    (cx, cy), (tx, ty) = BL.at(t); nx, ny = -ty, tx
    o = -wtot(t) * 0.13
    p = P(cx + nx * o, cy + ny * o, 0.0)
    e = uvsphere_at(f'BladeEye{i}', p, 1.0, M_EYE, parent=BLD)
    e.scale = (wtot(t) * 0.2 * K, 0.012, (wtot(t) * 0.055 + 3) * K)
    e.rotation_euler = (0, math.atan2(tx, ty) - math.pi / 2, 0)
    e.location.y = 0.016

# --- mantle: three shingled plates over the blade root + thorns off the ring
MT = part('mantle')
for i in range(3):
    k1, k2, extra = 0.05 + 0.28 * i, 1.08 + 0.12 * i, 16 * i
    t0, t1 = 0.01 + 0.03 * i, 0.52 - 0.1 * i
    # the plate sits on the outer (-normal) side of the blade, from k1 to k2 of the outer half-width
    ribbon(f'MantlePlate{i}', BL, (lambda k1: (lambda t: -wb(t) * k1))(k1), (lambda k2, e: (lambda t: wb(t) * k2 + e))(k2, extra),
           M_PLATE, MT, t0=t0, t1=t1, n=40, thick=0.02 + 0.006 * i, ridge=0.0)
bm = bmesh.new()
for a, ln, base in ((180, 330, 44), (208, 240, 38), (236, 200, 36), (262, 230, 34), (290, 180, 30), (152, 150, 36), (118, 110, 30), (322, 120, 28)):
    ar = math.radians(a)
    p0 = P(RING[0] + 86 * math.cos(ar), RING[1] + 86 * math.sin(ar))
    cone(bm, p0, Vector((math.sin(ar), 0, math.cos(ar))), ln * K, base * K / 2, 12)
mesh_obj('CrownThorns', bm, M_PLATE, MT)

# ------------------------------------------------------------------ the world: floor, lights, camera
floor_m = mat('Floor', (0.012, 0.006, 0.02), metal=0.0, rough=0.3)
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14)
floor = mesh_obj('Floor', bm, floor_m, smooth=False); floor.location.z = -0.46
ring_m = mat('FloorRune', (1, 0.4, 0.95), emit=(1.0, 0.3, 0.9), emit_strength=3.0)
torus('FloorRing', 1.25, 0.008, ring_m, (0, 0, -0.455), seg=128, ring=6)
torus('FloorRing2', 1.5, 0.004, ring_m, (0, 0, -0.455), seg=128, ring=6)
bm = bmesh.new()
for i in range(72):
    a = i / 72 * math.pi * 2
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((math.cos(a) * 1.38, math.sin(a) * 1.38, -0.455)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Diagonal((0.035 if i % 3 else 0.09, 0.006, 0.004, 1)))
mesh_obj('FloorRunes', bm, ring_m, smooth=False)

world = bpy.data.worlds.new('World'); scene.world = world; world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
bg = wn['Background']; bg.inputs['Color'].default_value = (0.012, 0.004, 0.03, 1); bg.inputs['Strength'].default_value = 1.0
_tc = wn.new('ShaderNodeTexCoord'); _sp = wn.new('ShaderNodeSeparateXYZ'); _rp = wn.new('ShaderNodeValToRGB')
wl.new(_tc.outputs['Generated'], _sp.inputs[0]); wl.new(_sp.outputs['Z'], _rp.inputs['Fac'])
_re = _rp.color_ramp.elements; _re[0].position = 0.42; _re[0].color = (0.004, 0.002, 0.012, 1); _re[1].position = 1.0; _re[1].color = (0.35, 0.12, 0.75, 1)
_mid = _re.new(0.62); _mid.color = (0.06, 0.02, 0.16, 1)
wl.new(_rp.outputs['Color'], bg.inputs['Color'])
try:                                     # a light haze so beams of light show
    vs = wn.new('ShaderNodeVolumeScatter'); vs.inputs['Density'].default_value = 0.0035; vs.inputs['Anisotropy'].default_value = 0.35
    vs.inputs['Color'].default_value = (0.55, 0.3, 0.9, 1)
    wl.new(vs.outputs[0], wn['World Output'].inputs['Volume'])
except Exception as ex:
    print('volume skipped', ex)


def light(name, kind, loc, energy, color, size=2.0, parent=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA':
        ld.size = size
        try:
            ld.volume_factor = 0.0           # only the spot beam shows in the haze
        except Exception:
            pass
    o = bpy.data.objects.new(name, ld); o.location = loc
    link(o, parent)
    return o


TARGET = bpy.data.objects.new('FocusTarget', None); TARGET.location = (0.15, 0, 0.82); link(TARGET)
RIG = bpy.data.objects.new('LightRig', None); link(RIG)                 # spins slowly so the highlights travel over the metal
key = light('Key', 'AREA', (-3.0, -3.2, 3.6), 260, (0.95, 0.85, 1.0), 2.6, RIG)
rim1 = light('RimMagenta', 'AREA', (3.4, 2.4, 2.4), 800, (1.0, 0.25, 0.85), 1.6, RIG)
rim2 = light('RimBlue', 'AREA', (-3.2, 2.8, 2.0), 420, (0.35, 0.3, 1.0), 1.6, RIG)
strip1 = light('StripL', 'AREA', (-1.6, -1.2, 1.2), 70, (1.0, 0.35, 0.9), 0.3, RIG); strip1.data.shape = 'RECTANGLE'; strip1.data.size = 0.18; strip1.data.size_y = 3.0
strip2 = light('StripR', 'AREA', (1.7, -1.0, 1.0), 70, (0.5, 0.4, 1.0), 0.3, RIG); strip2.data.shape = 'RECTANGLE'; strip2.data.size = 0.18; strip2.data.size_y = 3.0
top = light('Beam', 'SPOT', (0.4, -0.2, 6.2), 900, (0.9, 0.7, 1.0), parent=None)
top.data.spot_size = math.radians(30); top.data.spot_blend = 0.7
try:
    top.data.volume_factor = 1.0
except Exception:
    pass
for l in (key, rim1, rim2, top, strip1, strip2):
    tt = l.constraints.new('TRACK_TO'); tt.target = TARGET; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'

cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 50
cam_d.dof.use_dof = True; cam_d.dof.focus_object = TARGET; cam_d.dof.aperture_fstop = 3.2
CAM = bpy.data.objects.new('Camera', cam_d); link(CAM); scene.camera = CAM
tt = CAM.constraints.new('TRACK_TO'); tt.target = TARGET; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'

# ------------------------------------------------------------------ embers rising off the blade
ember_m = mat('Ember', (1, 0.5, 1), emit=(1.0, 0.45, 0.95), emit_strength=14.0)
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
ember = mesh_obj('EmberProto', bm, ember_m); ember.hide_render = True; ember.hide_viewport = True
blade_obj = bpy.data.objects['Blade']
blade_obj.modifiers.new('Embers', 'PARTICLE_SYSTEM')
ps = blade_obj.particle_systems[0].settings
ps.count = 700; ps.frame_start = 1; ps.frame_end = END; ps.lifetime = 90; ps.lifetime_random = 0.6
ps.emit_from = 'FACE'; ps.normal_factor = 0.18; ps.factor_random = 0.25
ps.render_type = 'OBJECT'; ps.instance_object = ember; ps.particle_size = 0.0045; ps.size_random = 0.7
try:
    ps.effector_weights.gravity = -0.08
    ps.brownian_factor = 0.35
except Exception:
    pass

# ------------------------------------------------------------------ animation
def key_loc(obj, f, v):
    obj.location = v; obj.keyframe_insert('location', frame=f)


def key_rot(obj, f, v):
    obj.rotation_euler = v; obj.keyframe_insert('rotation_euler', frame=f)


# turntable (keys run past both ends so the speed does not ease at the loop point)
for f in range(-30, END + 31, 30):
    key_rot(ROOT, f, (0, 0, 2 * math.pi * f / END))
for f in range(-30, END + 31, 30):
    key_rot(RIG, f, (0, 0, -2 * math.pi * f / END * 0.5))
# the scythe floats
base_z = 0.0
for f in range(-30, END + 31, 15):
    key_loc(ROOT, f, (0, 0, base_z + 0.05 * math.sin(2 * math.pi * f / 120)))

# pull apart / put back together, the way the site does it. Offsets are the site's, in metres.
EX = {'foot': (-250, 20), 'lowbind': (-90, -170), 'shaft': (0, 0), 'upbind': (80, 170), 'ring': (150, -210), 'mantle': (60, -130), 'blade': (260, 40)}
for name, (dx, dy) in EX.items():
    ex = Vector((dy * K * 1.25, 0, dx * K * 1.25))
    for f, s in ((1, 0), (80, 0), (165, 1), (250, 1), (335, 0), (END + 1, 0)):
        key_loc(parts[name], f, ex * s)

# the camera looks higher while the parts are out
for f, z in ((1, 0.82), (120, 1.2), (250, 1.2), (335, 0.82), (END + 1, 0.82)):
    key_loc(TARGET, f, (0.15, 0, z))
# camera: wide when the parts are out
for f, (d, h) in ((1, (4.9, 0.9)), (120, (7.8, 1.2)), (250, (7.8, 1.2)), (335, (4.9, 0.9)), (END + 1, (4.9, 0.9))):
    key_loc(CAM, f, (-d * 0.28, -d, h + 0.5))

# the glow breathes (a value node per material; every material shares the same beat)
for v in PULSES:
    nt = v.id_data
    for f in range(0, END + 31, 15):
        v.outputs[0].default_value = 1.0 + 0.45 * math.sin(2 * math.pi * f / 60) + 0.15 * math.sin(2 * math.pi * f / 23)
        v.outputs[0].keyframe_insert('default_value', frame=f)
# lights pulse with it
for l in (rim1, rim2):
    for f in range(0, END + 31, 15):
        l.data.energy = (800 if l is rim1 else 420) * (1 + 0.3 * math.sin(2 * math.pi * f / 60 + (0 if l is rim1 else 2)))
        l.data.keyframe_insert('energy', frame=f)

# ------------------------------------------------------------------ render setup
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.render.film_transparent = False
for attr, val in (('volumetric_tile_size', '2'), ('volumetric_samples', 96), ('taa_render_samples', 48), ('use_raytracing', True), ('use_shadows', True), ('use_volumetric_shadows', True)):
    try:
        setattr(scene.eevee, attr, val)
    except Exception as ex:
        print('eevee', attr, 'skipped')
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - High Contrast'
    scene.view_settings.exposure = -0.2
except Exception as ex:
    print('view', ex)

# bloom: the glow should bleed (EEVEE Next has no built-in bloom, so it is done in the compositor)
try:
    ng = bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = ng.nodes.new('CompositorNodeRLayers'); gl = ng.nodes.new('CompositorNodeGlare'); out = ng.nodes.new('NodeGroupOutput')
    def setin(name, vals):
        for v in vals:
            try:
                gl.inputs[name].default_value = v
                return
            except Exception:
                continue
        print('glare input not set', name)
    setin('Type', ['BLOOM', 'Bloom', 'FOG_GLOW', 'Fog Glow'])
    setin('Quality', ['HIGH', 'High'])
    setin('Threshold', [0.9]); setin('Strength', [0.55]); setin('Size', [0.62]); setin('Smoothness', [0.6])
    ng.links.new(rl.outputs['Image'], gl.inputs['Image'])
    ng.links.new(gl.outputs['Image'], out.inputs['Image'])
    scene.compositing_node_group = ng
    print('GLARE ok', [i.name for i in gl.inputs])
except Exception as ex:
    print('glare skipped', ex)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'voracity.blend'))
print('SAVED blend')

# glTF for the web (geometry, materials, the explode / spin animation)
try:
    bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'voracity.glb'), export_format='GLB', export_animations=True,
                              export_apply=True, export_yup=True)
    print('SAVED glb')
except Exception as ex:
    print('glb skipped', ex)

if ARGS[:1] == ['still']:
    scene.eevee.taa_render_samples = 16
    scene.frame_set(int(ARGS[1]) if len(ARGS) > 1 else 1)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.join(HERE, f'still_{scene.frame_current:03d}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
elif ARGS[:1] == ['anim']:
    scene.eevee.taa_render_samples = 32
    scene.eevee.volumetric_samples = 80
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    try:
        scene.render.image_settings.media_type = 'VIDEO'
    except Exception:
        pass
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'; scene.render.ffmpeg.codec = 'H264'; scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.filepath = os.path.join(HERE, 'voracity_turntable.mp4')
    bpy.ops.render.render(animation=True)
    print('RENDERED anim')
