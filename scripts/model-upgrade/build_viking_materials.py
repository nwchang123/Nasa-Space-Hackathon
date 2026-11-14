"""UV-bake illustrative PBR wear onto the unchanged NASA Viking geometry.

blender -b --disable-autoexec --python-exit-code 1 --python scripts/model-upgrade/build_viking_materials.py
Uses the deterministic NumPy -> packed image pipeline from build_assets.py. No remeshing,
modifiers, joining, object transforms, node renaming, or geometry simplification.
"""
import bpy
import bmesh
import hashlib
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'assets-raw/viking-material-upgrade'
WORK.mkdir(parents=True, exist_ok=True)
SIZE = 1024
FINISHES = {
    'blinn4SG': ('ivory thermal paint', 'paint', (.74, .73, .68), .05, .71),
    'blinn11SG': ('aged thermal paint', 'paint', (.70, .72, .69), .08, .68),
    'blinn8SG': ('brushed aluminium legs and pads', 'metal', (.51, .55, .58), .84, .44),
    'initialShadingGr': ('satin titanium structure', 'metal', (.43, .47, .50), .88, .49),
    'blinn6SG': ('carbon instrument shroud', 'dark', (.035, .043, .049), .14, .81),
    'blinn9SG': ('charcoal instrument covers', 'dark', (.065, .074, .081), .25, .73),
    'blinn2SG': ('aged copper-gold insulation', 'foil', (.65, .43, .18), .78, .49),
    'blinn10SG': ('brass-gold harness details', 'foil', (.62, .39, .13), .80, .46),
    'blinn12SG': ('oxidised copper cable braid', 'copper', (.43, .235, .105), .72, .55),
}


def geometry_state(meshes):
    state = {}
    for o in meshes:
        coords = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
        o.data.vertices.foreach_get('co', coords)
        indices = np.empty(len(o.data.loops), dtype=np.int32)
        o.data.loops.foreach_get('vertex_index', indices)
        state[o.name] = {'parent': o.parent.name if o.parent else None,
                        'matrix': [list(row) for row in o.matrix_local],
                        'vertices': len(coords)//3, 'triangles': len(o.data.polygons),
                        'positionHash': hashlib.sha256(coords.tobytes()).hexdigest(),
                        'indexHash': hashlib.sha256(indices.tobytes()).hexdigest()}
    return state


def image(name, rgb, data=False):
    # Same packed-image pipeline as build_assets.py; image channels remain exportable glTF PBR.
    rgba = np.ones((SIZE, SIZE, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(rgb, 0, 1)
    im = bpy.data.images.new(name, width=SIZE, height=SIZE, alpha=False)
    if data:
        im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(rgba.ravel())
    im.file_format = 'PNG'
    im.filepath_raw = str(WORK / 'textures' / f'{name}.png')
    Path(im.filepath_raw).parent.mkdir(parents=True, exist_ok=True)
    im.save()
    im.pack()
    return im


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def surface_fields(meshes, material, bottom, scale):
    """Rasterise UV triangles to physical height/up/radius, without touching mesh positions."""
    fields = np.zeros((SIZE, SIZE, 3), np.float32)
    covered = np.zeros((SIZE, SIZE), bool)
    for obj in meshes:
        mesh = obj.data
        uv = mesh.uv_layers.active.data
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        world = np.asarray([obj.matrix_world @ v.co for v in mesh.vertices], np.float32)
        for face in mesh.polygons:
            if obj.material_slots[face.material_index].material.name != material:
                continue
            loops = list(face.loop_indices)
            assert len(loops) == 3, 'NASA triangles must remain triangles'
            tex = np.asarray([uv[i].uv[:] for i in loops]) * (SIZE-1)
            x0, y0 = np.maximum(0, np.floor(tex.min(axis=0)).astype(int))
            x1, y1 = np.minimum(SIZE-1, np.ceil(tex.max(axis=0)).astype(int))
            a, b, c = tex
            det = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(det) < 1e-9 or x0 > x1 or y0 > y1:
                continue
            yy, xx = np.mgrid[y0:y1+1, x0:x1+1]
            w0 = ((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/det
            w1 = ((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/det
            mask = (w0 >= -1e-5) & (w1 >= -1e-5) & (w0+w1 <= 1+1e-5)
            if not mask.any():
                continue
            weights = np.stack((w0[mask], w1[mask], 1-w0[mask]-w1[mask]), axis=1)
            p = weights @ world[list(face.vertices)]
            normals = np.asarray([normal_matrix @ mesh.corner_normals[i].vector for i in loops])
            ns = weights @ normals
            ns /= np.maximum(np.linalg.norm(ns, axis=1, keepdims=True), 1e-8)
            vals = np.column_stack(((p[:, 2]-bottom)*scale, ns[:, 2],
                                     np.hypot(p[:, 0]-.23, p[:, 1]-.82)*scale))
            fields[yy[mask], xx[mask]] = vals
            covered[yy[mask], xx[mask]] = True
    coverage = float(covered.mean())
    # Eight texels of padding protect UV seams under WebP/mipmapping. Coordinates are never edited.
    for _ in range(8):
        pending = ~covered
        for axis, step in [(0, 1), (0, -1), (1, 1), (1, -1)]:
            valid = np.roll(covered, step, axis=axis) & pending
            if axis == 0:
                valid[0 if step == 1 else -1, :] = False
            else:
                valid[:, 0 if step == 1 else -1] = False
            fields[valid] = np.roll(fields, step, axis=axis)[valid]
            pending[valid] = False
        covered = ~pending
    return fields, coverage


def bake_material(mat, recipe, fields, seed):
    label, family, color, metallic, rough = recipe
    rng = np.random.default_rng(seed)
    u, v = np.meshgrid(np.linspace(0, 1, SIZE), np.linspace(0, 1, SIZE))
    grain = rng.normal(0, 1, (SIZE, SIZE))
    mottle = np.sin(23*u+3*np.sin(11*v))*np.sin(19*v+2*np.sin(13*u))
    fine = np.sin(u*math.tau*173 + .3*np.sin(v*math.tau*11))
    seam_u = np.minimum(np.mod(u*6, 1), 1-np.mod(u*6, 1))
    seam_v = np.minimum(np.mod(v*5, 1), 1-np.mod(v*5, 1))
    seams = np.exp(-(np.minimum(seam_u, seam_v)/.008)**2)
    metal = np.full((SIZE, SIZE), metallic)
    if family == 'paint':
        h = .00045*grain+.0014*mottle-.0035*seams
        shade = .96+.025*mottle+.008*grain-.035*seams
        rough_map = rough+.035*mottle+.012*grain+.07*seams
    elif family == 'metal':
        h = .0014*fine+.00025*grain+.0008*mottle
        shade = .96+.028*fine+.035*mottle+.006*grain
        rough_map = rough+.055*fine+.045*mottle+.008*grain
    elif family == 'foil':
        wrinkle = np.sin(55*u+9*np.sin(17*v))*np.sin(41*v+4*np.sin(23*u))
        fold = np.abs(np.sin(29*u+6*np.sin(12*v)))**7
        h = .008*wrinkle+.011*fold+.00025*grain
        shade = .9+.07*wrinkle-.06*fold+.008*grain
        rough_map = rough+.065*wrinkle+.035*fold+.008*grain
    elif family == 'copper':
        braid = np.sin((u+v)*math.tau*64)*np.sin((u-v)*math.tau*64)
        h = .0022*braid+.0003*grain
        shade = .93+.045*braid+.04*mottle+.006*grain
        rough_map = rough+.055*mottle+.02*braid
    else:
        h = .0007*grain+.0007*mottle
        shade = .95+.035*mottle+.014*grain
        rough_map = rough+.035*mottle+.014*grain
    rgb = np.asarray(color)[None, None, :]*shade[:, :, None]
    height, up, radius = (fields[:, :, i] for i in range(3))
    # Some white source surfaces include the feet/outer supports: retain their shape and bake
    # the metal finish into the same original material instead of splitting or renaming nodes.
    if family == 'paint':
        legs = (1-smooth(.42, .72, height))*smooth(.58, .85, radius)
        rgb = rgb*(1-legs[:, :, None])+np.asarray([.50, .54, .57])*shade[:, :, None]*legs[:, :, None]
        metal = metal*(1-legs)+.84*legs
        rough_map = rough_map*(1-legs)+(.46+.04*mottle)*legs
    dust = (.12*smooth(.08, .82, up)+.13*(1-smooth(.12, .72, height)))
    dust *= .78+.18*mottle+.035*grain
    dust = np.clip(dust, 0, .26)
    rgb = rgb*(1-dust[:, :, None])+np.asarray([.51, .29, .145])*dust[:, :, None]
    metal *= 1-.9*dust
    rough_map = np.clip(rough_map+.20*dust, .18, .95)
    dv, du = np.gradient(h)
    normal = np.stack((-du*24, -dv*24, np.ones_like(h)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    mr = np.stack((np.ones_like(h), rough_map, np.clip(metal, 0, 1)), axis=-1)
    base = image(f'{mat.name}-aged-base', rgb)
    normals = image(f'{mat.name}-micro-normal', normal*.5+.5, True)
    surface = image(f'{mat.name}-roughness-metallic', mr, True)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    bs = nodes.new('ShaderNodeBsdfPrincipled')
    links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    tex = nodes.new('ShaderNodeTexImage'); tex.image = base
    links.new(tex.outputs['Color'], bs.inputs['Base Color'])
    tex = nodes.new('ShaderNodeTexImage'); tex.image = surface
    separate = nodes.new('ShaderNodeSeparateColor'); separate.mode = 'RGB'
    links.new(tex.outputs['Color'], separate.inputs['Color'])
    links.new(separate.outputs['Green'], bs.inputs['Roughness'])
    links.new(separate.outputs['Blue'], bs.inputs['Metallic'])
    tex = nodes.new('ShaderNodeTexImage'); tex.image = normals
    norm = nodes.new('ShaderNodeNormalMap')
    norm.inputs['Strength'].default_value = .8 if family == 'foil' else .55
    links.new(tex.outputs['Color'], norm.inputs['Color'])
    links.new(norm.outputs['Normal'], bs.inputs['Normal'])
    mat.diffuse_color = (*color, 1)
    mat['illustrative_finish'] = label
    mat['dust'] = 'UV-baked from world-space upward normals and normalized height; illustrative'
    return {'sourceMaterial': mat.name, 'finish': label, 'family': family,
            'dustMean': float(dust.mean()), 'dustMax': float(dust.max()),
            'roughnessRange': [float(rough_map.min()), float(rough_map.max())],
            'metallicRange': [float(metal.min()), float(metal.max())]}


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets-raw/viking-lander.glb'), merge_vertices=False)
bpy.context.view_layer.update()
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
before = geometry_state(meshes)
assert set(before) == {'polySurfa1', 'polySurfa2'}
points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
bottom, top = min(v.z for v in points), max(v.z for v in points)
scale = 2/(top-bottom)  # MODEL_REGISTRY Viking height = 2 m; no object is rescaled here.
for o in meshes:
    if not o.data.uv_layers:
        o.data.uv_layers.new(name='Viking surface UV')
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.context.tool_settings.mesh_select_mode = (False, False, True)
bpy.ops.object.mode_set(mode='EDIT')
for name in FINISHES:
    for o in meshes:
        bm = bmesh.from_edit_mesh(o.data)
        for f in bm.faces:
            f.select_set(o.material_slots[f.material_index].material.name == name)
        bmesh.update_edit_mesh(o.data, loop_triangles=False, destructive=False)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.008,
                             area_weight=.1, correct_aspect=True, scale_to_bounds=True)
    print('VIKING_UV', name, flush=True)
bpy.ops.object.mode_set(mode='OBJECT')
assert geometry_state(meshes) == before, 'UV generation must not change NASA geometry or transforms'
records = []
for i, (name, recipe) in enumerate(FINISHES.items()):
    fields, coverage = surface_fields(meshes, name, bottom, scale)
    record = bake_material(bpy.data.materials[name], recipe, fields, 197600+i)
    record['uvCoverage'] = coverage
    records.append(record)
    print('VIKING_BAKED', name, recipe[0], 'UV coverage', round(coverage, 3), flush=True)
assert geometry_state(meshes) == before
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'viking-materials.blend'))
bpy.ops.export_scene.gltf(filepath=str(WORK / 'viking-materials-raw.glb'), export_format='GLB',
    export_yup=True, export_apply=False, export_animations=False, export_extras=True,
    export_cameras=False, export_lights=False, export_tangents=True, export_image_format='AUTO')
(WORK / 'bake-report.json').write_text(json.dumps({'blender': bpy.app.version_string, 'size': SIZE,
    'sourceSha256': hashlib.sha256((ROOT/'assets-raw/viking-lander.glb').read_bytes()).hexdigest(),
    'geometry': before, 'materials': records}, indent=2))
print('VIKING_MATERIALS_COMPLETE', sum(x['triangles'] for x in before.values()), 'NASA triangles retained', flush=True)
