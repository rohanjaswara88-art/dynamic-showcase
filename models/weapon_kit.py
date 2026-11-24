"""Blender helpers shared by the weapon builders: procedural metal / glow materials and the flat-sheet solid builder."""
import bpy, math
from mathutils import Vector, Matrix


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


STAND = Matrix.Rotation(math.pi / 2, 4, 'X')               # curves are drawn in XY (x = across, y = along); this stands them up in XZ


def solid(scene, name, polys, half, material, parent, sc, bevel=0.0, dy=0.0):
    """polys: [[outer, hole, ...], ...] (each ring a list of [s, c] in sword units) -> one mesh: a flat sheet 2*half thick with chamfered edges"""
    if not polys:
        return None
    cu = bpy.data.curves.new(name + '_c', 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'; cu.extrude = half; cu.resolution_u = 1
    for pg in polys:
        for ring in pg:
            sp = cu.splines.new('POLY'); sp.points.add(len(ring) - 1); sp.use_cyclic_u = True
            for i, (s, c) in enumerate(ring):
                sp.points[i].co = (c * sc, s * sc, 0, 1)
    co = bpy.data.objects.new(name + '_c', cu); scene.collection.objects.link(co)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(co.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(co); bpy.data.curves.remove(cu)
    me.transform(Matrix.Translation((0, dy, 0)) @ STAND); me.name = name
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, me); o.data.materials.append(material)
    if bevel:
        md = o.modifiers.new('Chamfer', 'BEVEL'); md.width = bevel; md.segments = 1; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(35)
    scene.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o
