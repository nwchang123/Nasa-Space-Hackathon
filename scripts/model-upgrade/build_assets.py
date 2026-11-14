"""Rebuild the four site assets with Blender Python, in metres.

Run: blender -b --disable-autoexec --python scripts/model-upgrade/build_assets.py -- all
Intermediate GLBs, packed editable .blends and measured anchors go to assets-raw/model-upgrade.
Coordinates below use the application's +Y up frame; B() converts to Blender's +Z up frame.
No online generators, geometry downloads (apart from the credited NASA MER), or image models.
"""
import bpy
import bmesh
import json
import math
import sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'assets-raw/model-upgrade'
WORK.mkdir(parents=True, exist_ok=True)
PI = math.pi
TAU = 2 * PI
MATS = {}


def B(p):
    return Vector((p[0], -p[2], p[1]))


def G(p):
    return (p[0], p[2], -p[1])


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def group(name, at=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = B(at)
    o.parent = parent
    return o


def put(o, name, mat=None, parent=None):
    o.name = name
    if mat:
        o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def image(name, pixels, noncolor=False):
    n = pixels.shape[0]
    rgba = np.ones((n, n, 4), dtype=np.float32)
    if pixels.ndim == 2:
        rgba[:, :, :3] = pixels[:, :, None]
    else:
        rgba[:, :, :3] = pixels
    im = bpy.data.images.new(name, width=n, height=n, alpha=False)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(rgba.ravel())
    im.file_format = 'PNG'
    im.filepath_raw = str(WORK / 'textures' / f'{name}.png')
    Path(im.filepath_raw).parent.mkdir(parents=True, exist_ok=True)
    im.save()
    im.pack()
    return im


def pbr(name, color, metal=0, rough=0.6, texture=None, dust=0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    m.metallic, m.roughness = metal, rough
    if texture:
        # Deterministic CPU UV baking: sample a height field, differentiate it for the tangent
        # normal, and write colour/roughness maps. These maps work in glTF without Blender nodes.
        n = 1024
        u, v = np.meshgrid(np.linspace(0, 1, n), np.linspace(0, 1, n))
        noise = np.random.default_rng(7301).normal(0, 1, (n, n))
        wrinkle = np.sin(55*u + 9*np.sin(17*v)) * np.sin(41*v + 4*np.sin(23*u))
        fold = np.abs(np.sin(29*u + 6*np.sin(12*v))) ** 7
        if texture == 'foil':
            h = 0.013*wrinkle + 0.018*fold + 0.0007*noise
            shade = np.clip(0.86 + 0.12*wrinkle - 0.1*fold + 0.018*noise, 0.55, 1.15)
        elif texture == 'fabric':
            h = 0.004*(np.sin(u*TAU*145) + np.sin(v*TAU*145)) + 0.01*wrinkle
            shade = 0.9 + 0.06*wrinkle + 0.025*noise
        elif texture == 'solar':
            cell = (np.mod(u*12, 1) > 0.045) & (np.mod(v*8, 1) > 0.045)
            bus = np.mod(u*48, 1) < 0.024
            h = cell*0.012
            shade = np.where(cell, 0.85+0.1*np.sin(u*25), 2.9)
            shade = np.where(bus, 2.2, shade)
        else:
            h = 0.0015*noise + 0.003*wrinkle
            shade = 0.92 + 0.035*noise + 0.06*wrinkle
        rgb = np.clip(np.asarray(color)[None, None, :]*shade[:, :, None], 0, 1)
        if dust:
            deposit = dust*(.65+.35*np.sin(u*17+np.sin(v*21))*np.sin(v*13))
            rgb = rgb*(1-deposit[:, :, None])+np.asarray([.58, .49, .40])*deposit[:, :, None]
        dx, dy = np.gradient(h)
        strength = 32 if texture in {'foil', 'fabric'} else 10
        norm = np.stack((-dy*strength, -dx*strength, np.ones_like(h)), axis=-1)
        norm /= np.linalg.norm(norm, axis=-1, keepdims=True)
        normal = norm*0.5+0.5
        roughness = np.clip(rough + 0.07*wrinkle + noise*0.012 + dust*.4, 0.05, 0.98)
        maps = [('Base Color', image(name+'-base', rgb)), ('Roughness', image(name+'-rough', roughness, True))]
        for socket, im in maps:
            node = m.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = im
            m.node_tree.links.new(node.outputs['Color'], bs.inputs[socket])
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image(name+'-normal', normal, True)
        normalmap = m.node_tree.nodes.new('ShaderNodeNormalMap')
        normalmap.inputs['Strength'].default_value = 0.65
        m.node_tree.links.new(tex.outputs['Color'], normalmap.inputs['Color'])
        m.node_tree.links.new(normalmap.outputs['Normal'], bs.inputs['Normal'])
    MATS[name] = m
    return m


def finishes(polar=False):
    dust = .045 if polar else 0
    return {
        'metal': pbr('Satin titanium', (.49, .55, .62) if polar else (.54, .57, .60), .82, .45 if polar else .4),
        'white': pbr('Polar thermal white' if polar else 'Thermal white', (.68, .74, .80) if polar else (.76, .78, .77), .24, .66 if polar else .62, 'paint', dust),
        'dark': pbr('Graphite hardware', (.065, .075, .085), .65, .49),
        'gold': pbr('Wrinkled gold MLI', (.77, .48, .115), .84, .38, 'foil'),
        'silver': pbr('Polar silver MLI' if polar else 'Silver MLI', (.58, .65, .73) if polar else (.65, .68, .7), .83, .44 if polar else .41, 'foil', dust),
        'solar': pbr('Polar silicon cells' if polar else 'Dusty silicon cells', (.07, .11, .18) if polar else (.065, .095, .16), .46, .47 if polar else .43, 'solar', dust),
        'fabric': pbr('Airbag Vectran weave', (.64, .57, .45), 0, .92, 'fabric'),
        'seam': pbr('Airbag stitched seams', (.39, .34, .27), 0, .94),
        'lens': pbr('Optical glass', (.018, .035, .052), .32, .13),
        'copper': pbr('Copper cable braid', (.55, .27, .09), .78, .42),
    }


def mesh(name, verts, faces, mat, parent=None, uv=True, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata([B(p) for p in verts], [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    if uv:
        layer = data.uv_layers.new(name='UVMap')
        vs = np.asarray(verts)
        ext = np.ptp(vs, axis=0)
        a, b = sorted(range(3), key=lambda i: ext[i], reverse=True)[:2]
        for poly in data.polygons:
            for li in poly.loop_indices:
                p = vs[data.loops[li].vertex_index]
                layer.data[li].uv = ((p[a]-vs[:, a].min())/max(ext[a], .001), (p[b]-vs[:, b].min())/max(ext[b], .001))
            poly.use_smooth = smooth
    put(o, name, mat, parent)
    return o


def box(name, at, dims, mat, parent=None, bevel=.005):
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(at))
    o = bpy.context.object
    o.scale = (dims[0], dims[2], dims[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Machined edge radii', 'BEVEL')
        mod.width = min(bevel, min(dims)/4)
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return put(o, name, mat, parent)


def rod(name, a, b, r, mat, parent=None, segments=16, r2=None):
    va, vb = B(a), B(b)
    d = vb-va
    bpy.ops.mesh.primitive_cone_add(vertices=segments, radius1=r, radius2=r if r2 is None else r2, depth=d.length, location=(va+vb)/2)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return put(o, name, mat, parent)


def cable(name, points, r, mat, parent=None):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = r
    data.bevel_resolution = 2
    sp = data.splines.new('POLY')
    sp.points.add(len(points)-1)
    for dest, p in zip(sp.points, points):
        dest.co = (*B(p), 1)
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    put(o, name, mat, parent)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def batch(parent, prefix):
    """Join a static branch by finish; never join across an articulated node."""
    bpy.context.view_layer.update()
    children = [o for o in parent.children if o.type == 'MESH']
    bins = {}
    for o in children:
        key = tuple(m.name for m in o.data.materials)
        bins.setdefault(key, []).append(o)
    for idx, parts in enumerate(bins.values()):
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:
            o.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = f'{prefix}-{idx:02d}'


def bounds(objects):
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objects:
        if o.type != 'MESH':
            continue
        evaluated = o.evaluated_get(deps)
        data = evaluated.to_mesh()
        pts.extend(G(evaluated.matrix_world @ v.co) for v in data.vertices)
        evaluated.to_mesh_clear()
    return {'min': [min(p[i] for p in pts) for i in range(3)], 'max': [max(p[i] for p in pts) for i in range(3)]}


def finish(label, root, anchors):
    bpy.context.view_layer.update()
    descendants = [root, *root.children_recursive]
    # A rotated cable's local AABB can extend 17 cm below its real vertices. Three.js uses that
    # conservative box for normalization. Bake STATIC mesh transforms, keeping articulated
    # empty-node transforms untouched, so bounds and contact anchors agree in the web runtime.
    for o in descendants:
        if o.type == 'MESH':
            local = o.matrix_local.copy()
            if o.data.users > 1:
                o.data = o.data.copy()
            o.data.transform(local)
            o.matrix_parent_inverse = Matrix.Identity(4)
            o.matrix_basis = Matrix.Identity(4)
            o.data.update()
    bpy.context.view_layer.update()
    records = {'bounds': bounds(descendants), 'anchors': anchors, 'nodes': {}}
    for o in descendants:
        if o.type == 'EMPTY' or 'wheel' in o.name or 'mast' in o.name:
            records['nodes'][o.name] = {'position': G(o.matrix_world.translation), 'bounds': bounds([o]) if o.type == 'MESH' else None}
    records['vertices'] = sum(len(o.data.vertices) for o in descendants if o.type == 'MESH')
    records['triangles'] = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in descendants if o.type == 'MESH')
    records['drawMeshes'] = sum(o.type == 'MESH' for o in descendants)
    for im in bpy.data.images:
        if im.size[0] and not im.packed_file:
            im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK / f'{label}.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for o in descendants:
        o.hide_set(False)
        o.hide_render = False
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(WORK / f'{label}-raw.glb'), export_format='GLB',
        use_selection=True, export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False, export_animations=False,
        export_image_format='AUTO', export_keep_originals=False, export_tangents=True)
    (WORK / f'{label}-geometry.json').write_text(json.dumps(records, indent=2))
    print('ASSET_READY', label, json.dumps(records['bounds']), records['triangles'], 'triangles', flush=True)


def mer():
    bpy.ops.wm.open_mainfile(filepath=str(WORK / 'mer-official.blend'), load_ui=False)
    MATS.clear()
    f = finishes()
    originals = [o for o in bpy.context.scene.objects if o.type == 'MESH' and len(o.data.materials)]
    worlds = {o: o.matrix_world.copy() for o in originals}
    # The original uses -Y forward and Z up. Keep NASA's geometry handedness, and label the
    # geometric right side after conversion (+Z front, -X right), independent of old part labels.
    wheel_objs = [o for o in originals if 'wheel' in o.name]
    ymin = min((worlds[o] @ Vector(p)).y for o in wheel_objs for p in o.bound_box)
    ymax = max((worlds[o] @ Vector(p)).y for o in wheel_objs for p in o.bound_box)
    center_y = (ymin+ymax)/2
    bottom = min((worlds[o] @ Vector(p)).z for o in wheel_objs for p in o.bound_box)
    for o in originals:
        world = worlds[o]
        o.parent = None
        o.matrix_world = world
        o.animation_data_clear()
        o.data = o.data.copy()
        o.data.transform(world)
        o.matrix_world = Matrix.Identity(4)
        for v in o.data.vertices:
            v.co.y -= center_y
            v.co.z -= bottom
        o.data.update()
        o.hide_set(False)
        o.hide_render = False
        if 'wheel' in o.name:
            bb = bounds([o])
            dz = bb['min'][1]
            for v in o.data.vertices:
                v.co.z -= dz
            o.data.update()
            cx = (bb['min'][0]+bb['max'][0])/2
            cz = (bb['min'][2]+bb['max'][2])/2
            o['NASA_source_part'] = o.name
            o.name = 'wheel-' + ('right' if cx < 0 else 'left') + '-' + ('front' if cz > .3 else 'rear' if cz < -.3 else 'middle')
            print('NASA wheel mapping', o.name, cx, cz, flush=True)
    for o in list(bpy.context.scene.objects):
        if o not in originals:
            bpy.data.objects.remove(o, do_unlink=True)
    # The 2014 file's converted legacy nodes have normal maps but no diffuse links. Restore the
    # actual packed NASA colour images, retaining the matching normal maps and UVs.
    for m in list(bpy.data.materials):
        if not m.name.startswith('tex_'):
            continue
        stem = m.name.removesuffix('_n')
        diffuse = next((i for i in bpy.data.images if i.name in {stem+'.psd', stem+'.png'}), None)
        normal = bpy.data.images.get(stem+'_n.png')
        nodes, links = m.node_tree.nodes, m.node_tree.links
        nodes.clear()
        bs = nodes.new('ShaderNodeBsdfPrincipled')
        out = nodes.new('ShaderNodeOutputMaterial')
        links.new(bs.outputs['BSDF'], out.inputs['Surface'])
        bs.inputs['Metallic'].default_value = .48 if 'panel' in stem else .62 if 'suspension' in stem else .3
        bs.inputs['Roughness'].default_value = .5 if 'panel' in stem else .46
        if diffuse:
            diffuse.colorspace_settings.name = 'sRGB'
            if 'panel' in stem:
                # NASA's packed panel maps encode the cell layout in pale greys. Bake a silicon
                # tint into a copy, keeping the original grid, UVs and matching normal map.
                pixels = np.empty(len(diffuse.pixels), dtype=np.float32)
                diffuse.pixels.foreach_get(pixels)
                pixels = pixels.reshape(diffuse.size[1], diffuse.size[0], 4)
                rgb = np.clip(pixels[:, :, :3] * np.asarray([.10, .16, .25]), 0, 1)
                diffuse = image(stem+'-silicon', rgb)
            node = nodes.new('ShaderNodeTexImage')
            node.image = diffuse
            links.new(node.outputs['Color'], bs.inputs['Base Color'])
        if normal:
            normal.colorspace_settings.name = 'Non-Color'
            node = nodes.new('ShaderNodeTexImage')
            node.image = normal
            n = nodes.new('ShaderNodeNormalMap')
            n.inputs['Strength'].default_value = .5
            links.new(node.outputs['Color'], n.inputs['Color'])
            links.new(n.outputs['Normal'], bs.inputs['Normal'])
    for o in originals:
        for i, m in enumerate(o.data.materials):
            if m.name in {'Silver', 'foil_silver'}:
                o.data.materials[i] = f['silver'] if 'foil' in m.name else f['metal']
    scale = 1.5 / bounds(originals)['max'][1]
    for o in originals:
        for v in o.data.vertices:
            v.co *= scale
        o.data.update()
    root = group('mer')
    root['source'] = 'NASA Mars Exploration Rover - Spirit and Opportunity.blend'
    root['front'] = '+Z'
    for o in originals:
        put(o, o.name, parent=root)
    contact = bounds([bpy.data.objects['wheel-right-front']])
    at = [(contact['min'][0]+contact['max'][0])/2, 0, (contact['min'][2]+contact['max'][2])/2]
    marker = group('mer-right-front-contact', at, root)
    marker['contact'] = 'jammed wheel; geometric right=-X, front=+Z'
    finish('mer', root, {'rightFrontFoot': at, 'front': '+Z', 'groundY': 0})


def triangle_plate(name, tri, y, mat, parent):
    vs = [(x, y, z) for x, z in tri] + [(x, y-.025, z) for x, z in tri]
    return mesh(name, vs, [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], mat, parent)


def airbag(name, at, radii, phase, f, parent):
    verts, faces = [], []
    for j in range(25):
        lat = -PI/2 + j*PI/24
        for i in range(65):
            a = i*TAU/64
            wrinkle = 1 + .085*math.sin(a*19+lat*9+phase) + .04*math.sin(a*31-lat*13)
            verts.append((at[0]+radii[0]*math.cos(lat)*math.cos(a)*wrinkle,
                          max(0, at[1]+radii[1]*(1+math.sin(lat))*(1+.14*math.sin(a*13+lat*7))),
                          at[2]+radii[2]*math.cos(lat)*math.sin(a)*wrinkle))
    for j in range(24):
        for i in range(64):
            a = j*65+i
            faces.append((a, a+65, a+66, a+1))
    mesh(name, verts, faces, f['fabric'], parent, smooth=True)
    for a in [0, PI/2, PI, PI*1.5]:
        points = []
        for j in range(25):
            lat = -PI/2+j*PI/24
            w = 1+.085*math.sin(a*19+lat*9+phase)+.04*math.sin(a*31-lat*13)
            points.append((at[0]+radii[0]*math.cos(lat)*math.cos(a)*w,
                           max(.002, at[1]+radii[1]*(1+math.sin(lat))*(1+.14*math.sin(a*13+lat*7)))+.002,
                           at[2]+radii[2]*math.cos(lat)*math.sin(a)*w))
        cable(name+'-seam', points, .003, f['seam'], parent)


def rover_wheel(x, z, f, parent):
    y, r = .067, .067
    rod('Sojourner aluminium wheel', (x, y, z-.037), (x, y, z+.037), r, f['metal'], parent, 32)
    outer = z + math.copysign(.039, z)
    rod('Wheel hub', (x, y, outer), (x, y, outer+math.copysign(.005, z)), .029, f['dark'], parent, 20)
    for i in range(22):
        a = TAU*i/22
        # Narrow metal grousers, keeping the bottom exactly at ground level.
        p = (x+(r+.001)*math.sin(a), y+(r+.001)*math.cos(a), z)
        o = box('Wheel grouser', p, (.008, .004, .078), f['dark'], parent, .001)
        o.rotation_euler.y = -a
    for i in range(6):
        a = TAU*i/6
        rod('Hub fastener', (x+.018*math.sin(a), y+.018*math.cos(a), outer),
            (x+.018*math.sin(a), y+.018*math.cos(a), outer+math.copysign(.006, z)), .003, f['metal'], parent, 6)


def sojourner(f, root):
    # The existing path animates local +X forward, with the APXS on local -X.
    rover = group('sojourner')
    rover['forward'] = '+X (signature path convention)'
    box('Sojourner electronics box', (0, .2, 0), (.43, .16, .32), f['gold'], rover, .013)
    box('Sojourner chassis', (0, .12, 0), (.46, .035, .36), f['metal'], rover)
    box('Sojourner solar substrate', (0, .293, 0), (.61, .02, .465), f['white'], rover)
    box('Sojourner photovoltaic cells', (0, .305, 0), (.586, .005, .44), f['solar'], rover, .002)
    for side in [-1, 1]:
        z = side*.23
        for x in [-.255, 0, .255]:
            rover_wheel(x, z, f, rover)
        # Rocker-bogie with a differential pivot, two rocker links and the rear bogie.
        for a, b in [((.08, .22, side*.17), (.255, .09, z)),
                     ((.08, .22, side*.17), (-.12, .16, z)),
                     ((-.12, .16, z), (-.255, .075, z)),
                     ((-.12, .16, z), (0, .075, z))]:
            rod('Sojourner rocker bogie', a, b, .012, f['metal'], rover, 12)
        rod('Differential pivot', (.08, .21, side*.16), (.08, .21, side*.2), .025, f['dark'], rover)
        for x in [-.17, .17]:
            box('Rover mounting cleat', (x, .205, side*.17), (.03, .045, .025), f['white'], rover)
    for z in [-.105, .105]:
        box('Front stereo camera housing', (.229, .215, z), (.038, .048, .055), f['white'], rover)
        rod('Front camera lens', (.248, .215, z), (.257, .215, z), .016, f['lens'], rover, 24)
    rod('Sojourner antenna', (.15, .31, -.14), (.15, .535, -.14), .003, f['metal'], rover, 10)
    rod('APXS deployment bracket', (-.22, .19, 0), (-.33, .075, 0), .018, f['metal'], rover)
    rod('APXS spectrometer', (-.30, .075, 0), (-.365, .075, 0), .043, f['dark'], rover, 32)
    rod('APXS contact ring', (-.365, .075, 0), (-.38, .075, 0), .048, f['metal'], rover, 32)
    cable('Sojourner harness', [(-.22, .19, -.1), (-.12, .27, -.18), (.1, .27, -.18), (.22, .2, -.1)], .004, f['copper'], rover)
    batch(rover, 'sojourner-finish')
    tip = group('sojourner-apxs-tip', (-.38, .075, 0), rover)
    tip['contact'] = 'Barnacle Bill'
    # Ground the actual tread geometry before putting the rover in its parked pose.
    lo = bounds(rover.children_recursive)['min'][1]
    for o in rover.children:
        o.location.z -= lo
    rover.location = B((-2.6, 0, .5))
    rover.rotation_euler.z = 1.1
    rover.parent = root
    return rover


def pathfinder():
    fresh()
    f = finishes()
    root = group('pathfinder')
    base = [(math.cos(a)*.61, math.sin(a)*.61) for a in [-PI/2, PI/6, 5*PI/6]]
    triangle_plate('Central tetrahedron base', base, .32, f['gold'], root)
    triangle_plate('Central equipment deck', [(x*.92, z*.92) for x, z in base], .354, f['white'], root)
    for i in range(3):
        a, b = np.asarray(base[i]), np.asarray(base[(i+1)%3])
        mid = (a+b)/2
        tip = mid/np.linalg.norm(mid)*1.5
        tri = [a, b, tip]
        triangle_plate('Unfolded tetrahedron petal', tri, .135, f['metal'], root)
        center = sum(tri)/3
        inset = [tuple(center+(p-center)*.94) for p in tri]
        triangle_plate('Triangular solar laminate', inset, .14, f['solar'], root)
        for j in range(3):
            aa, bb = tri[j], tri[(j+1)%3]
            delta = bb-aa
            t = float(np.clip(np.dot(np.asarray([.39, .629])-aa, delta)/np.dot(delta, delta), 0, 1))
            distance = np.linalg.norm(aa+delta*t-np.asarray([.39, .629]))
            intervals = [(0, 1)]
            if distance < .31:
                half = math.sqrt(.31**2-distance**2)/np.linalg.norm(delta)
                intervals = [(0, max(0, t-half)), (min(1, t+half), 1)]
            for start, end in intervals:
                if end-start < .001:
                    continue
                p, q = aa+delta*start, aa+delta*end
                rod('Petal perimeter extrusion', (p[0], .153, p[1]), (q[0], .153, q[1]), .009, f['white'], root, 10)
        for j in range(7):
            t = (j+.5)/7
            p = a+(b-a)*t
            d = (b-a)/np.linalg.norm(b-a)*.028
            rod('Petal hinge barrel', (p[0]-d[0], .18, p[1]-d[1]), (p[0]+d[0], .18, p[1]+d[1]), .022, f['metal'], root)
        # Folded Vectran bags drape beyond the panel edges. Keep the rear ramp corridor clear.
        for j, side in enumerate([-1, 1]):
            edge = (tri[j]+tip)/2
            tangent = (tip-tri[j])/np.linalg.norm(tip-tri[j])
            outward = np.asarray([-tangent[1], tangent[0]])*side
            p = edge+outward*.23
            if p[0] > .15 and p[1] > .3:
                p += np.asarray([-.4, .23])
            airbag(f'Deflated airbag {i}-{j}', (p[0], 0, p[1]), (.39, .105, .29), i+j*.7, f, root)
            airbag(f'Airbag fold {i}-{j}', (p[0]+.18, 0, p[1]-.16), (.27, .075, .25), i+j+1, f, root)
    # IMP stereo mast, camera pan head, weather sensors, and antenna hardware.
    rod('IMP mast foot', (0, .35, 0), (0, .49, 0), .065, f['metal'], root, 24)
    rod('IMP camera mast', (0, .47, 0), (0, 1.13, 0), .024, f['white'], root, 24)
    for y in [.56, .77, .98]:
        rod('Mast collar', (0, y-.009, 0), (0, y+.009, 0), .032, f['metal'], root, 24)
    box('IMP stereo head', (0, 1.18, 0), (.24, .11, .13), f['white'], root, .012)
    for x in [-.079, .079]:
        rod('IMP lens bezel', (x, 1.18, .06), (x, 1.18, .084), .032, f['metal'], root, 32)
        rod('IMP optical element', (x, 1.18, .083), (x, 1.18, .086), .025, f['lens'], root, 32)
    rod('High gain mount', (.3, .35, -.2), (.3, .65, -.2), .018, f['metal'], root)
    rod('High gain antenna', (.3, .65, -.2), (.3, .675, -.2), .145, f['white'], root, 48, .12)
    rod('Weather mast', (-.3, .35, -.23), (-.3, .94, -.23), .008, f['metal'], root, 12)
    for y in [.63, .79, .91]:
        rod('Wind sensor outrigger', (-.3, y, -.23), (-.42, y, -.23), .004, f['white'], root, 8)
    for x, z in [(-.22, -.18), (.17, -.18), (.12, .19)]:
        box('Lander instrument enclosure', (x, .414, z), (.14, .12, .14), f['gold'], root)
        for dx in [-.045, .045]:
            rod('Deck instrument fastener', (x+dx, .471, z), (x+dx, .48, z), .006, f['metal'], root, 6)
    cable('IMP power harness', [(0, .35, .03), (.04, .5, .03), (.04, .89, .03), (0, 1.1, .03)], .006, f['dark'], root)
    # These are the signature's exact centreline endpoints, in the same metre frame.
    top = np.asarray([.39, .135, .629])
    foot = np.asarray([1.256, .045, 1.121])
    side = np.asarray([.5, 0, -.866])*.30
    verts = [top-side, top+side, foot+side, foot-side]
    ramp = mesh('Rear egress ramp', verts, [(0, 3, 2, 1)], f['metal'], root)
    mod = ramp.modifiers.new('Ramp metal thickness', 'SOLIDIFY')
    mod.thickness = .012
    for s in [-1, 1]:
        a, b = top+side*s, foot+side*s
        rod('Ramp edge rail', a, b, .009, f['white'], root, 12)
    for j in range(20):
        p = top+(foot-top)*(j/19)
        rod('Ramp traction rung', p-side*.94+np.asarray([0, .006, 0]), p+side*.94+np.asarray([0, .006, 0]), .005, f['dark'], root, 8)
    batch(root, 'pathfinder-finish')
    sojourner(f, root)
    finish('pathfinder', root, {'rampTop': list(top), 'rampFoot': list(foot), 'rampDir': [.866, 0, .5],
        'camera': [0, 1.18, .086], 'airbag': [-1.05, .2, .4], 'petal': [0, .14, 1.2]})


def phoenix():
    fresh()
    bpy.ops.import_scene.gltf(filepath=str(WORK / 'insight-decoded.glb'))
    f = finishes(polar=True)
    root = group('phoenix')
    root['source'] = 'Adapted from the existing public/models/insight.glb, NASA/Brian E. Kumanchik'
    original = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bb = bounds(original)
    scale = 5.5/(bb['max'][0]-bb['min'][0])
    bottom = bb['min'][1]
    removed = []
    for o in original:
        if o.name in {'SEIS', 'arm_01', 'cable_02'}:
            removed.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        world = o.matrix_world.copy()
        o.parent = None
        o.data = o.data.copy()
        o.data.transform(world)
        o.matrix_world = Matrix.Identity(4)
        for v in o.data.vertices:
            v.co = B((v.co.x*scale, (v.co.z-bottom)*scale, -v.co.y*scale))
        # The optimized source joins small InSight-only deck hardware into the platform. Remove
        # that hardware above the deck, keeping the shared deck, legs, array hubs and arrays.
        bm = bmesh.new()
        bm.from_mesh(o.data)
        delete = [v for v in bm.verts if abs(v.co.x) < .94 and v.co.z > 1.105]
        bmesh.ops.delete(bm, geom=delete, context='VERTS')
        bm.to_mesh(o.data)
        bm.free()
        o.data.materials.clear()
        for material in [f['white'], f['silver'], f['metal'], f['solar'], f['dark']]:
            o.data.materials.append(material)
        for p in o.data.polygons:
            x, y, z = G(p.center)
            # Recompute polygon centres after baking the source's world matrices.
            c = sum((o.data.vertices[i].co for i in p.vertices), Vector())/len(p.vertices)
            x, y, z = G(c)
            p.material_index = 3 if abs(x) > 1.08 and y > .77 else 2 if y < .78 else 1 if y < .96 else 0
        o.name = 'phoenix-shared-platform-' + o.name
        put(o, o.name, parent=root)
    for o in list(bpy.context.scene.objects):
        if o is not root and o.type == 'EMPTY' and not o.children:
            bpy.data.objects.remove(o, do_unlink=True)
    # Phoenix's deck instruments: eight TEGA ovens, MECA wet chemistry cells, lidar and SSI.
    box('TEGA thermal evolved gas analyser', (.17, 1.17, -.16), (.39, .2, .34), f['gold'], root, .016)
    for i in range(8):
        x = .01+(i%4)*.105
        z = -.245+(i//4)*.17
        box('TEGA oven lid', (x, 1.276, z), (.085, .012, .12), f['metal'], root, .004)
        rod('TEGA lid hinge', (x-.035, 1.287, z-.055), (x+.035, 1.287, z-.055), .006, f['dark'], root, 10)
    box('MECA wet chemistry laboratory', (-.31, 1.17, -.2), (.29, .19, .29), f['silver'], root, .01)
    for x in [-.39, -.23]:
        for z in [-.28, -.12]:
            rod('MECA sample port', (x, 1.268, z), (x, 1.285, z), .04, f['dark'], root, 20)
    rod('SSI camera mast', (.35, 1.06, .3), (.35, 1.96, .3), .025, f['white'], root, 24)
    for y in [1.12, 1.48, 1.82]:
        rod('SSI mast collar', (.35, y, .3), (.35, y+.025, .3), .033, f['metal'], root, 24)
    box('Phoenix stereo camera head', (.35, 2.025, .3), (.24, .14, .16), f['white'], root, .014)
    for x in [.27, .43]:
        rod('SSI optical barrel', (x, 2.025, .37), (x, 2.025, .405), .031, f['dark'], root, 24)
        rod('SSI glass', (x, 2.025, .403), (x, 2.025, .407), .025, f['lens'], root, 24)
    rod('Meteorological mast', (.55, 1.06, -.4), (.55, 2.25, -.4), .013, f['white'], root, 20)
    for y in [1.3, 1.65, 1.99]:
        rod('Temperature sensor boom', (.55, y, -.4), (.73, y, -.4), .005, f['metal'], root, 10)
        box('Temperature sensor', (.74, y, -.4), (.035, .025, .025), f['dark'], root, .002)
    cable('Telltale suspension', [(.55, 2.25, -.4), (.67, 2.28, -.4), (.67, 2.18, -.4)], .003, f['metal'], root)
    box('Wind telltale', (.67, 2.16, -.4), (.026, .035, .035), f['gold'], root, .001)
    rod('Lidar barrel', (0, 1.06, -.4), (0, 1.3, -.4), .075, f['white'], root, 32)
    rod('Lidar optical aperture', (0, 1.3, -.4), (0, 1.315, -.4), .052, f['lens'], root, 32)
    rod('Phoenix UHF antenna', (-.49, 1.05, -.42), (-.49, 1.51, -.42), .009, f['metal'], root, 12)
    batch(root, 'phoenix-static')
    # An identity-rotation node whose translation is exactly PHOENIX_SHOULDER.
    shoulder = np.asarray([-.3, 1.06, .6])
    arm = group('phoenix-arm')
    elbow = np.asarray([-.4, 1.5, 1.3])
    wrist = np.asarray([-.5, .16, 1.87])
    for a, b, width in [(shoulder, elbow, .043), (elbow, wrist, .036)]:
        rod('Robotic arm hollow link', a, b, width, f['white'], arm, 12)
        d = b-a
        for t in [.05, .92]:
            p = a+d*t
            rod('Arm link reinforcement', p, p+d*.04, width*1.22, f['metal'], arm, 12)
    for p, r in [(shoulder, .092), (elbow, .073), (wrist, .045)]:
        rod('Arm joint motor', p+np.asarray([-.06, 0, 0]), p+np.asarray([.06, 0, 0]), r, f['metal'], arm, 32)
        rod('Joint cover', p+np.asarray([-.062, 0, 0]), p+np.asarray([-.066, 0, 0]), r*.7, f['dark'], arm, 24)
    cable('Arm power harness', [shoulder+(.025, 0, .02), elbow+(.04, -.03, 0), wrist+(.03, .025, 0)], .008, f['dark'], arm)
    box('Scoop floor', (-.5, .078, 1.9), (.14, .018, .13), f['metal'], arm, .003)
    for x in [-.568, -.432]:
        box('Scoop side wall', (x, .111, 1.9), (.012, .065, .13), f['metal'], arm, .003)
    box('Scoop back', (-.5, .111, 1.84), (.14, .065, .012), f['metal'], arm, .003)
    for x in [-.55, -.5, -.45]:
        mesh('Scoop cutting tooth', [(x-.012, .085, 1.93), (x+.012, .085, 1.93), (x, .06, 1.95)], [(0, 2, 1)], f['dark'], arm)
    batch(arm, 'phoenix-arm-finish')
    # Bake each child's translation into shoulder-local coordinates without changing the pose.
    for o in arm.children:
        o.location -= B(shoulder)
    arm.location = B(shoulder)
    arm.parent = root
    tip = group('phoenix-scoop', (-.2, -1, 1.35), arm)
    tip['contact'] = 'TIP in phoenix.tsx, before the dig rotation'
    finish('phoenix', root, {'shoulder': list(shoulder), 'tipRelative': [-.2, -1, 1.35],
        'tip': [-.5, .06, 1.95], 'removedSourceNodes': removed, 'platformSpan': 5.5,
        'tega': [.17, 1.276, -.16], 'camera': [.35, 2.025, .407], 'lidar': [0, 1.315, -.4]})


def backshell():
    fresh()
    f = finishes()
    ceramic = pbr('Weathered backshell thermal coating', (.7, .68, .61), .08, .83, 'paint')
    char = pbr('Fractured heat protection substrate', (.055, .047, .038), .05, .95)
    composite = pbr('Exposed composite laminate', (.29, .21, .12), .16, .87, 'fabric')
    root = group('backshell')
    n, rings = 128, 28
    verts, faces = [], []
    def surface(j, i):
        t, a = j/rings, i*TAU/n
        dent = .22*math.exp(-((math.atan2(math.sin(a-.58), math.cos(a-.58))/.24)**2)-((t-.3)/.32)**2)
        radius = 2.25*(1-t)+.79*t-dent
        radius += .016*math.sin(a*13+t*17)*(1-t)
        y = .13+1.35*t-.09*math.exp(-((a-3.3)/.3)**2)*(1-t)
        return (radius*math.cos(a), y, radius*math.sin(a))
    for j in range(rings+1):
        for i in range(n+1):
            verts.append(surface(j, i))
    for j in range(rings):
        for i in range(n):
            # A branching, jagged impact tear; the interior is modeled rather than black paint.
            crack = abs(i-(13+int(3*math.sin(j*1.4)))) < (2 if j < 8 else 1)
            if crack and j < 19:
                continue
            a = j*(n+1)+i
            faces.append((a, a+n+1, a+n+2, a+1))
    shell = mesh('Impact-deformed cone shell', verts, faces, ceramic, root, smooth=True)
    shell.data.materials.append(composite)
    mod = shell.modifiers.new('Composite shell wall', 'SOLIDIFY')
    mod.thickness = .028
    mod.material_offset = 1
    mod.material_offset_rim = 1
    # Charred thermal-panel joints, internal ribs and an exposed rim flange.
    for i in range(16):
        angle = i*TAU/16
        points = [surface(j, i*8) for j in range(rings+1)]
        cable('Thermal panel joint', points, .004, char, root)
        inner = [(x*.982, y-.008, z*.982) for x, y, z in points]
        cable('Internal radial stiffener', inner, .015, f['metal'], root)
    for j in [0, 10, 20, 28]:
        cable('Circumferential shell joint', [surface(j, i) for i in range(n+1)], .006 if j else .023, char if j else f['metal'], root)
    for side in [-1, 1]:
        pts = [surface(j, 13+int(3*math.sin(j*1.4))+side*(2 if j < 8 else 1)) for j in range(20)]
        cable('Torn laminate edge', pts, .012, composite, root)
    rod('Upper attachment ring', (0, 1.46, 0), (0, 1.56, 0), .79, f['white'], root, 96)
    rod('Parachute mortar support', (0, 1.56, 0), (0, 1.73, 0), .44, f['metal'], root, 64, .39)
    rod('Mortar cover', (0, 1.73, 0), (0, 1.76, 0), .39, char, root, 64)
    for i in range(8):
        a = i*TAU/8
        x, z = .74*math.cos(a), .74*math.sin(a)
        o = box('Top retention latch', (x, 1.57, z), (.12, .065, .09), f['metal'], root, .007)
        o.rotation_euler.z = -a
        rod('Retention bolt', (x, 1.59, z), (x, 1.63, z), .018, char, root, 8)
    # Back-shell support bracing is visible when the visitor orbits behind the fracture.
    for i in range(8):
        a = TAU*i/8
        rod('Interior support tube', (.72*math.cos(a), 1.4, .72*math.sin(a)), (1.95*math.cos(a), .18, 1.95*math.sin(a)), .018, f['metal'], root)
    rng = np.random.default_rng(2021)
    for i in range(15):
        angle = float(rng.uniform(-.6, PI*1.8))
        dist = float(rng.uniform(2.5, 4.3))
        x, z = dist*math.cos(angle), dist*math.sin(angle)
        w, d = float(rng.uniform(.12, .52)), float(rng.uniform(.12, .38))
        frag = mesh('Scattered fractured panel', [(x-w, .025, z-d), (x+w, .034, z-d*.7),
            (x+w*.6, .06, z+d), (x-w*.5, .09, z+d*.4), (x, .045, z)],
            [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], ceramic if i%3 else char, root)
        mod = frag.modifiers.new('Fragment thickness', 'SOLIDIFY')
        mod.thickness = .018
    batch(root, 'backshell-finish')
    # A baked mild impact lean. Ground afterwards, so runtime normalization is an identity.
    # Tilt only the cone assembly, leaving fragments on the ground. The body has been batched
    # with debris, so apply a lean proportional to height instead of rotating debris upwards.
    for o in root.children:
        if o.type != 'MESH':
            continue
        world = o.matrix_world.copy()
        o.data.transform(world)
        o.matrix_world = Matrix.Identity(4)
        for v in o.data.vertices:
            v.co.x -= .12*v.co.z
            v.co.y += .08*v.co.z
    finish('backshell', root, {'top': [-.21, 1.76, -.14], 'impactDent': [1.72, .55, 1.12],
        'parachute': 'Kept byte-for-byte as procedural RingGeometry in models.ts; not in this GLB'})


which = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['all']
for name, build in [('mer', mer), ('pathfinder', pathfinder), ('phoenix', phoenix), ('backshell', backshell)]:
    if 'all' in which or name in which:
        build()
