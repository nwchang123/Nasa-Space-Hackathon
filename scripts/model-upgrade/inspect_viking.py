"""Inspect the NASA Viking source in a separate background Blender process."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'assets-raw/viking-material-upgrade'
WORK.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets-raw/viking-lander.glb'), merge_vertices=False)
bpy.context.view_layer.update()
records = []
for obj in bpy.context.scene.objects:
    record = {'name': obj.name, 'parent': obj.parent.name if obj.parent else None,
              'matrix': [list(row) for row in obj.matrix_local], 'type': obj.type}
    if obj.type == 'MESH':
        record['vertices'] = len(obj.data.vertices)
        record['triangles'] = len(obj.data.polygons)
        record['materials'] = []
        for i, slot in enumerate(obj.material_slots):
            polys = [p for p in obj.data.polygons if p.material_index == i]
            points = [obj.matrix_world @ obj.data.vertices[v].co for p in polys for v in p.vertices]
            record['materials'].append({'name': slot.material.name, 'triangles': len(polys),
                'min': [min(p[j] for p in points) for j in range(3)],
                'max': [max(p[j] for p in points) for j in range(3)]})
    records.append(record)
(WORK / 'source-inspection.json').write_text(json.dumps({'blender': bpy.app.version_string, 'objects': records}, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'viking-source.blend'))
bpy.ops.export_scene.gltf(filepath=str(WORK / 'viking-roundtrip.glb'), export_format='GLB',
    export_yup=True, export_animations=False, export_apply=False, export_extras=True)
print('VIKING_INSPECTION_COMPLETE', json.dumps(records))
