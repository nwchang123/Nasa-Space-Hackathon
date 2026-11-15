"""Shared non-destructive finish/batching and bounded static LOD pass for Blender exports."""
import bpy
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'assets-raw/global-refine'


def triangles(o):
    return sum(len(p.vertices)-2 for p in o.data.polygons) if o.type == 'MESH' else 0


def image(name, rgb, data=True):
    h, w = rgb.shape[:2]
    rgba = np.ones((h, w, 4), np.float32)
    rgba[:, :, :3] = np.clip(rgb, 0, 1)
    im = bpy.data.images.new(name, width=w, height=h, alpha=False)
    if data:
        im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = str(WORK / 'textures' / (name.replace('/', '-')+'.png'))
    Path(im.filepath_raw).parent.mkdir(parents=True, exist_ok=True)
    im.file_format = 'PNG'
    im.save(); im.pack()
    return im


def data_maps(name, metal, rough, family='metal', size=256):
    u, v = np.meshgrid(np.linspace(0, 1, size), np.linspace(0, 1, size))
    noise = np.random.default_rng(7315).normal(0, 1, (size, size))
    wave = np.sin(u*math.tau*67+.3*np.sin(v*13))
    crease = np.sin(u*45+7*np.sin(v*17))*np.sin(v*39+3*np.sin(u*19))
    h = (.008*crease if family == 'foil' else .0008*wave)+.00016*noise
    dv, du = np.gradient(h)
    n = np.stack((-du*14, -dv*14, np.ones_like(h)), axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    mr = np.stack((np.ones_like(h), np.clip(rough+.035*wave+.025*crease, .12, .96), np.full_like(h, metal)), axis=-1)
    return image(name+'-micro-normal', n*.5+.5), image(name+'-surface-MR', mr)


def wire_maps(mat, normal, mr, replace=False):
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bs:
        return
    if replace or not bs.inputs['Normal'].is_linked:
        tex = nodes.new('ShaderNodeTexImage'); tex.image = normal
        nm = nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = .45
        links.new(tex.outputs['Color'], nm.inputs['Color']); links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    if replace or not bs.inputs['Roughness'].is_linked:
        tex = nodes.new('ShaderNodeTexImage'); tex.image = mr
        separate = nodes.new('ShaderNodeSeparateColor'); separate.mode = 'RGB'
        links.new(tex.outputs['Color'], separate.inputs['Color'])
        links.new(separate.outputs['Green'], bs.inputs['Roughness'])
        links.new(separate.outputs['Blue'], bs.inputs['Metallic'])


def ensure_maps(label, objects):
    mats = {m for o in objects if o.type == 'MESH' for m in o.data.materials if m}
    for m in mats:
        if not m.use_nodes:
            m.use_nodes = True
        bs = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bs:
            continue
        if not bs.inputs['Normal'].is_linked or not bs.inputs['Roughness'].is_linked:
            normal, mr = data_maps(label+'-'+m.name, float(bs.inputs['Metallic'].default_value),
                                   float(bs.inputs['Roughness'].default_value), 'foil' if 'foil' in m.name.lower() else 'metal')
            wire_maps(m, normal, mr)
        lower = m.name.lower()
        thin = any(s in lower for s in ['foil', 'mli', 'fabric', 'vectran', 'stitched', 'tex_panel'])
        if label == 'backshell' and any(s in lower for s in ['weathered', 'laminate']):
            thin = True
        m.use_backface_culling = not thin


def ensure_uv(o):
    if o.data.uv_layers:
        return
    uv = o.data.uv_layers.new(name='Surface UV')
    points = np.asarray([v.co[:] for v in o.data.vertices])
    lo, span = points.min(0), np.maximum(np.ptp(points, axis=0), 1e-6)
    axes = np.argsort(span)[-2:]
    for face in o.data.polygons:
        for li in face.loop_indices:
            p = points[o.data.loops[li].vertex_index]
            uv.data[li].uv = ((p[axes[0]]-lo[axes[0]])/span[axes[0]], (p[axes[1]]-lo[axes[1]])/span[axes[1]])


def decimate_envelope(o, ratio):
    """Collapse only eligible static meshes, then retain their exact local bounding envelope."""
    before = triangles(o)
    coords = np.asarray([v.co[:] for v in o.data.vertices])
    lo, hi = coords.min(0), coords.max(0)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('Static silhouette LOD', 'DECIMATE')
    mod.ratio = max(.05, min(1, ratio)); mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    points = np.asarray([v.co[:] for v in o.data.vertices])
    low, high = points.min(0), points.max(0)
    factors = np.divide(hi-lo, high-low, out=np.ones(3), where=(high-low)>1e-8)
    adjusted = (points-low)*factors+lo
    for v, p in zip(o.data.vertices, adjusted): v.co = p
    o.data.update()
    print('STATIC_LOD', o.name, before, '->', triangles(o), flush=True)


def merge_mer(root):
    static = [o for o in root.children_recursive if o.type == 'MESH' and
              not any(s in o.name.lower() for s in ['wheel-', 'arm', 'mast'])]
    if not static:
        return
    pieces = []
    for o in static:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
        pieces.extend([x for x in bpy.context.selected_objects if x.type == 'MESH'])
    bins = {}
    for o in set(pieces):
        used = {p.material_index for p in o.data.polygons}
        mat = o.data.materials[next(iter(used))]
        bins.setdefault(mat.name, []).append(o)
    for i, (name, parts) in enumerate(sorted(bins.items())):
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts: o.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts)>1: bpy.ops.object.join()
        o = bpy.context.object
        # Unused slots would export as redundant draw primitives in some Blender versions.
        mat = bpy.data.materials[name]
        o.data.materials.clear(); o.data.materials.append(mat)
        for p in o.data.polygons: p.material_index = 0
        o.name = f'mer-static-{i:02d}-{name}'; o.parent = root
    print('MER_STATIC_MATERIAL_BATCHES', len(bins), flush=True)


def refine_scene(label, root):
    objects = list(root.children_recursive)
    for o in objects:
        if o.type == 'MESH': ensure_uv(o)
    if label == 'mer' and not root.get('global_refined'):
        merge_mer(root)
    objects = list(root.children_recursive)
    if label == 'phoenix':
        protected = set(bpy.data.objects['phoenix-arm'].children_recursive)
        heavy = [o for o in objects if o.type == 'MESH' and o not in protected and triangles(o)>5000]
        total = sum(triangles(o) for o in objects)
        mass = sum(triangles(o) for o in heavy)
        if total>65000 and mass:
            ratio = (60000-(total-mass))/mass
            for o in heavy: decimate_envelope(o, ratio)
    ensure_maps(label, objects)
    root['global_refined'] = True


def refine_insight():
    from build_viking_materials import surface_fields, smooth
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    total = sum(triangles(o) for o in meshes)
    deck = next(o for o in meshes if o.name == 'deck')
    decimate_envelope(deck, (61000-(total-triangles(deck)))/triangles(deck))
    default = bpy.data.materials.get('InSIGHT_tex_01')
    for o in meshes:
        ensure_uv(o)
        if not o.data.materials: o.data.materials.append(default)
        for i, m in enumerate(o.data.materials):
            if m is None or not m.name.startswith('InSIGHT_'): o.data.materials[i] = default
    points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    bottom = min(v.z for v in points)
    scale = 6/max(max(p[i] for p in points)-min(p[i] for p in points) for i in [0,1])
    mats = sorted({m for o in meshes for m in o.data.materials if m}, key=lambda m:m.name)
    for i, m in enumerate(mats):
        tex = next((n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
        bs = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bs:
            bs=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
            out=next(n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL')
            m.node_tree.links.new(bs.outputs['BSDF'],out.inputs['Surface'])
            bs.inputs['Base Color'].default_value=m.diffuse_color
        fields, _ = surface_fields(meshes, m.name, bottom, scale)
        up = smooth(.0, .7, fields[:, :, 1])
        outer = smooth(1., 1.6, fields[:, :, 2])
        dust = .10+up*(.23+.17*outer)
        u,v=np.meshgrid(np.linspace(0,1,1024),np.linspace(0,1,1024))
        dust *= .88+.12*np.sin(u*29+np.sin(v*23))*np.sin(v*37)
        if tex:
            im=tex.image; w,h=im.size[:]
            rgba=np.empty(w*h*4,np.float32);im.pixels.foreach_get(rgba);rgba=rgba.reshape(h,w,4)
            if (w,h)!=(1024,1024):
                # Existing image UVs are retained; sample the dust field at the source resolution.
                ys=np.minimum(1023,(np.arange(h)*1024/h).astype(int));xs=np.minimum(1023,(np.arange(w)*1024/w).astype(int))
                d=dust[ys[:,None],xs[None,:]]
            else: d=dust
            rgb=rgba[:,:,:3]*(1-d[:,:,None])+np.asarray([.39,.225,.11])*d[:,:,None]
            im=image('insight-dust-'+m.name,rgb,False)
            node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
            m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
        foil='foil' in m.name.lower()
        metal=.86 if foil else .42 if 'AO_08' in m.name else .28
        normal,mr=data_maps('insight-'+m.name,metal,.48 if foil else .68,'foil' if foil else 'metal')
        wire_maps(m,normal,mr,True)
        m.use_backface_culling = not foil
        print('INSIGHT_PBR_DUST',m.name,flush=True)
    return meshes
