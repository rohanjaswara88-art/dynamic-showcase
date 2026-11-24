"""
Build a weapon's 3D model from its traced artwork (models/<name>/outline.json, made by trace_art.py): thin flat sheets with chamfered knife edges, raised
plates on top, lit areas as glowing inlays. Seven parts, the same ids as the site. Exports <name>/<name>.glb and app/src/assets/<name>.glb.

    blender -b --python build_weapon.py -- hal            # halcyon | ecl | eclipse | ava
    blender -b --python build_weapon.py -- hal ref 64 900 1400   # also render a face-on view (<name>/ref_view.png)
"""
import bpy, math, os, sys, json
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import weapon_kit as kit

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WID = ARGS[0]
SC = 0.00125                                  # metres per sword unit

THEMES = {
    'hal': dict(name='halcyon', prefix='Halcyon',
                pal=dict(base=(0.30, 0.46, 0.80), low=(0.46, 0.66, 0.95), mid=(0.70, 0.86, 1.0), high=(0.93, 0.98, 1.0), metal=0.15, coat=0.7, rough=(0.1, 0.25)),
                glow=(0.25, 0.7, 1.0), glow_k=2.5, eye=(0.6, 0.5, 1.0), eye_k=2.0,
                world=((0.004, 0.01, 0.03), (0.02, 0.05, 0.14), (0.25, 0.45, 0.85)),
                lights=dict(key=((0.85, 0.93, 1.0), 300), rim1=((0.4, 0.8, 1.0), 900), rim2=((0.7, 0.55, 1.0), 500), fill=((0.8, 0.9, 1.0), 120)),
                thick=('pommel', 'grip', 'core')),
    'ecl': dict(name='eclipse', prefix='Eclipse',
                pal=dict(base=(0.012, 0.012, 0.018), low=(0.02, 0.02, 0.028), mid=(0.05, 0.05, 0.065), high=(0.12, 0.12, 0.15), metal=0.9, coat=0.3, rough=(0.2, 0.4)),
                glow=(1.0, 0.08, 0.06), glow_k=4.0, eye=(1.0, 0.4, 0.3), eye_k=3.0,
                world=((0.002, 0.0, 0.0), (0.04, 0.0, 0.01), (0.35, 0.02, 0.02)),
                lights=dict(key=((1.0, 0.85, 0.85), 220), rim1=((1.0, 0.1, 0.08), 1400), rim2=((0.8, 0.1, 0.2), 600), fill=((1.0, 0.7, 0.7), 70)),
                thick=('pommel', 'grip', 'gem')),
    'ava': dict(name='avarice', prefix='Avarice',
                pal=dict(base=(0.08, 0.03, 0.2), low=(0.14, 0.06, 0.34), mid=(0.26, 0.12, 0.56), high=(0.5, 0.3, 0.92), metal=0.6, coat=0.5, rough=(0.15, 0.35)),
                glow=(0.7, 0.4, 1.0), glow_k=3.0, eye=(0.95, 0.85, 1.0), eye_k=3.0,
                world=((0.004, 0.0, 0.012), (0.06, 0.02, 0.2), (0.5, 0.18, 0.04)),
                lights=dict(key=((0.9, 0.85, 1.0), 260), rim1=((0.6, 0.3, 1.0), 1200), rim2=((1.0, 0.5, 0.15), 700), fill=((0.8, 0.7, 1.0), 90)),
                thick=('pommel', 'grip', 'eye')),
}
TH = THEMES['ecl' if WID == 'eclipse' else 'ava' if WID == 'avarice' else 'hal' if WID == 'halcyon' else WID]
NAME, PRE = TH['name'], TH['prefix']
OUT = json.load(open(os.path.join(HERE, NAME, 'outline.json')))
ORDER = OUT['order']

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials (these names are what the site keys its look on)
p = TH['pal']
M = {
    'base': kit.metal(f'{PRE}_Base', p['base'], metallic=p['metal'], coat=p['coat'], rough=p['rough'], scale=(30, 30, 30), bump=0.2, bevel=0.002),
    'low': kit.metal(f'{PRE}_Low', p['low'], metallic=p['metal'], coat=p['coat'], rough=p['rough'], scale=(30, 30, 30), bump=0.2, bevel=0.002),
    'mid': kit.metal(f'{PRE}_Mid', p['mid'], metallic=p['metal'], coat=p['coat'], rough=p['rough'], scale=(30, 30, 30), bump=0.2, bevel=0.002),
    'high': kit.metal(f'{PRE}_High', p['high'], metallic=p['metal'], coat=p['coat'], rough=p['rough'], scale=(30, 30, 30), bump=0.2, bevel=0.002),
    'face': kit.glow(f'{PRE}_Glow', TH['glow'], TH['glow_k']),
    'eye': kit.glow(f'{PRE}_Eye', TH['eye'], TH['eye_k']),
}
LEVEL_MAT = ('low', 'mid', 'high')
PLATE_H = (0.005, 0.011, 0.017)

# ---------------------------------------------------------------- the parts
TILT = bpy.data.objects.new(f'{PRE}_Lean', None); scene.collection.objects.link(TILT)
n = len(ORDER)
parts = {}
for i, pid in enumerate(ORDER):
    d = OUT['parts'].get(pid)
    if not d:
        continue
    e = bpy.data.objects.new('Part_' + pid, None); e.empty_display_size = 0.05; scene.collection.objects.link(e); e.parent = TILT; parts[pid] = e
    thick = pid in TH['thick']
    half, bev = (0.008, 0.003) if thick else (0.0045, 0.0038)
    dy = -(i - (n - 1) / 2) * 0.004                       # drawn later = nearer the viewer, so overlapping parts sit in the right order
    kit.solid(scene, f'{pid}_base', d['base'], half, M['base'], e, SC, bev, dy)
    for k in range(3):
        pl = [q['rings'] for q in d['plates'] if q['h'] == k]
        kit.solid(scene, f'{pid}_plates{k}', pl, half + PLATE_H[k], M[LEVEL_MAT[k]], e, SC, 0.004, dy)
    for kind in ('face', 'eye'):
        gl = [g['rings'] for g in d['glow'] if g['kind'] == kind]
        kit.solid(scene, f'{pid}_glow_{kind}', gl, half + 0.0007, M[kind], e, SC, 0.0, dy)

# ---------------------------------------------------------------- stage for the render
world = bpy.data.worlds.new('World'); scene.world = world; world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
bg = wn['Background']; bg.inputs['Strength'].default_value = 1.0
tc = wn.new('ShaderNodeTexCoord'); sp = wn.new('ShaderNodeSeparateXYZ'); rp = wn.new('ShaderNodeValToRGB')
wl.new(tc.outputs['Generated'], sp.inputs[0]); wl.new(sp.outputs['Z'], rp.inputs['Fac'])
w0, w1, w2 = TH['world']
re_ = rp.color_ramp.elements; re_[0].position = 0.4; re_[0].color = (*w0, 1); re_[1].position = 1.0; re_[1].color = (*w2, 1)
md = re_.new(0.62); md.color = (*w1, 1)
wl.new(rp.outputs['Color'], bg.inputs['Color'])


def light(name, loc, energy, color, size=2.0):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
    o = bpy.data.objects.new(name, ld); o.location = loc; scene.collection.objects.link(o)
    return o


TARGET = bpy.data.objects.new('FocusTarget', None); TARGET.location = (0.0, 0, 0.9); scene.collection.objects.link(TARGET)
L = TH['lights']
ls = [light('Key', (-3.0, -3.2, 3.6), L['key'][1], L['key'][0], 2.6), light('Rim1', (3.4, 2.4, 2.4), L['rim1'][1], L['rim1'][0], 1.6),
      light('Rim2', (-3.2, 2.8, 2.0), L['rim2'][1], L['rim2'][0], 1.6), light('Fill', (-1.5, -4.2, 1.6), L['fill'][1], L['fill'][0], 3.5)]
for l in ls:
    tt = l.constraints.new('TRACK_TO'); tt.target = TARGET; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'
cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 50
CAM = bpy.data.objects.new('Camera', cam_d); scene.collection.objects.link(CAM); scene.camera = CAM; CAM.location = (0, -3.3, 1.0)
tt = CAM.constraints.new('TRACK_TO'); tt.target = TARGET; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'

scene.render.engine = 'CYCLES'
cy = scene.cycles
cy.device = 'CPU'; cy.samples = 48; cy.use_adaptive_sampling = True; cy.use_denoising = True
cy.max_bounces = 8; cy.diffuse_bounces = 3; cy.glossy_bounces = 5; cy.sample_clamp_indirect = 8.0
try:
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - High Contrast'
except Exception as ex:
    print('view', ex)

# ---------------------------------------------------------------- export for the web (just the sword: parts and their meshes)
bpy.ops.object.select_all(action='DESELECT')


def sel(o):
    o.select_set(True)
    for c in o.children:
        sel(c)


sel(TILT)
bpy.context.view_layer.objects.active = TILT
web = os.path.join(HERE, '..', 'app', 'src', 'assets', NAME + '.glb')
for path in (os.path.join(HERE, NAME, NAME + '.glb'), web):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=False, use_selection=True, export_apply=True, export_yup=True)
print('SAVED glb', NAME)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, NAME, NAME + '.blend'))

if ARGS[1:2] == ['ref']:
    TILT.rotation_euler = (0, math.radians(-8), 0)
    cy.samples = int(ARGS[2]) if len(ARGS) > 2 else 48
    scene.render.resolution_x, scene.render.resolution_y = (int(ARGS[3]), int(ARGS[4])) if len(ARGS) > 4 else (900, 1400)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.join(HERE, NAME, 'ref_view.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
