"""Inspect the actual NASA source parts in Blender, without changing the sources."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'assets-raw/model-upgrade'


def inspect(label):
    records = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
        records.append({
            'name': obj.name,
            'vertices': len(obj.data.vertices),
            'polygons': len(obj.data.polygons),
            'min': [min(p[i] for p in points) for i in range(3)],
            'max': [max(p[i] for p in points) for i in range(3)],
            'materials': [s.material.name if s.material else None for s in obj.material_slots],
            'visible': not obj.hide_render,
        })
    data = {
        'blender': bpy.app.version_string,
        'objects': records,
        'materials': [{
            'name': m.name,
            'diffuse': list(m.diffuse_color),
            'metallic': m.metallic,
            'roughness': m.roughness,
            'nodes': [n.type for n in m.node_tree.nodes] if m.use_nodes else [],
        } for m in bpy.data.materials],
        'images': [{'name': i.name, 'path': i.filepath, 'packed': bool(i.packed_file),
                    'size': list(i.size)} for i in bpy.data.images],
    }
    (WORK / f'{label}-inspection.json').write_text(json.dumps(data, indent=2))
    print(label, 'meshes', len(records), 'vertices', sum(r['vertices'] for r in records))


bpy.ops.wm.open_mainfile(filepath=str(WORK / 'mer-official.blend'), load_ui=False)
inspect('mer')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(WORK / 'insight-decoded.glb'))
inspect('insight')
