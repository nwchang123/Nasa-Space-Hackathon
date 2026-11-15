"""Refine the existing editable sources; independent background Blender process, no UI scene."""
import bpy
import json
import hashlib
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from global_finishes import refine_scene, refine_insight, triangles, data_maps, WORK

ROOT=Path(__file__).resolve().parents[2]
report_path=WORK/'blender-report.json'
report=json.loads(report_path.read_text()) if report_path.exists() else {}
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['mer','pathfinder','phoenix','backshell','insight']
for label in names:
    if label == 'insight':
        expected=json.loads((ROOT/'scripts/model-upgrade/global-baseline.json').read_text())['_inputs']['insightSourceSha256']
        if hashlib.sha256((WORK/'insight-source.glb').read_bytes()).hexdigest()!=expected:
            raise RuntimeError('Pinned InSight source changed; do not simplify the already-refined delivery again')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(WORK/'insight-source.glb'))
        objects=refine_insight()
    else:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-raw/model-upgrade'/f'{label}.blend'),load_ui=False)
        root=bpy.data.objects[label]
        refine_scene(label,root)
        objects=[root,*root.children_recursive]
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.hide_set(False);o.hide_render=False;o.select_set(True)
    for im in bpy.data.images:
        if im.size[0] and not im.packed_file:im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/f'{label}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(WORK/f'{label}-raw.glb'),export_format='GLB',
        use_selection=True,export_apply=True,export_yup=True,export_extras=True,
        export_cameras=False,export_lights=False,export_animations=False,export_tangents=True,export_image_format='AUTO')
    report[label]={'triangles':sum(triangles(o) for o in objects),'meshes':{o.name:triangles(o) for o in objects if o.type=='MESH'}}
    print('REFINED_ASSET',label,report[label]['triangles'],flush=True)
# Shared tiny data maps for the terminal Ingenuity GLB (geometry/rotor nodes stay untouched).
data_maps('ingenuity-hardware',.45,.58,'metal')
report_path.write_text(json.dumps(report,indent=2))
