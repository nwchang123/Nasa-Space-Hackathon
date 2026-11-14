"""Render an isolated source/export with a neutral studio rig (not included in GLB)."""
import bpy
import sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, output = [Path(p).resolve() for p in args[:2]]
if source.suffix == '.blend':
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.hide_render and o.data.materials]
pts = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
lo = Vector([min(p[i] for p in pts) for i in range(3)])
hi = Vector([max(p[i] for p in pts) for i in range(3)])
center = (lo + hi) / 2
span = max(hi - lo)
for o in list(bpy.context.scene.objects):
    if o.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(o, do_unlink=True)
qa = bpy.data.collections.new('QA studio (not exported)')
bpy.context.scene.collection.children.link(qa)

def link(o):
    qa.objects.link(o)
    return o

cam = link(bpy.data.objects.new('QA camera', bpy.data.cameras.new('QA camera')))
direction = Vector((0.85, -1.35, 1.1)) if 'top' not in args else Vector((0.1, -0.25, 1.9))
cam.location = center + direction * span
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = span * 1.3
bpy.context.scene.camera = cam
for name, offset, power, size in [
    ('key', (1, -1.5, 2.5), 650, 2),
    ('fill', (-1.5, -0.4, 1.2), 400, 2),
    ('rim', (0.3, 1.8, 2), 900, 1.5),
]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power * span * span / 4
    light.shape = 'DISK'
    light.size = size * span / 2
    obj = link(bpy.data.objects.new(name, light))
    obj.location = center + Vector(offset) * span / 2
    obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
scene = bpy.context.scene
scene.world = bpy.data.worlds.new('QA world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.2, 0.23, 0.28, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.5
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 960
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.render.filepath = str(output)
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -1.0
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.render.render(write_still=True)
