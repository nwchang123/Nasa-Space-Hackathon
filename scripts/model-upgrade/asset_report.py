"""Inspect the seven delivered GLBs (Python + Pillow); no intermediate packing counts."""
import hashlib
import io
import json
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
before = json.loads((ROOT / 'scripts/model-upgrade/global-baseline.json').read_text())
expected = {
    'mer': ['mer-right-front-contact', *[f'wheel-{s}-{e}' for s in ['right', 'left']
            for e in ['front', 'middle', 'rear']]],
    'pathfinder': ['sojourner', 'sojourner-apxs-tip'],
    'phoenix': ['phoenix-arm', 'phoenix-scoop'], 'backshell': ['backshell'],
    'insight': [], 'ingenuity': [], 'viking-lander': ['viking_car', 'polySurfa1', 'polySurfa2'],
}
report = {'pipeline': {'blender': '5.3.0', 'gltfTransform': '4.5.1',
    'geometry': 'EXT_meshopt_compression', 'textures': 'image/webp', 'maxTextureSize': 1024,
    'dataTextureMax': 512, 'flatten': False, 'instance': False,
    'staticMerge': 'MER material batches only; excludes wheels, arms and mast',
    'simplify': 'Blender collapse on static InSight deck and Phoenix supports only',
    'vikingPositions': 'lossless FLOAT32; exact directed-triangle SHA-256 contract',
    'thinSurfaces': 'foil, fabric, shell openings and thin solar panels retain doubleSided'}, 'assets': {}}
for name, required in expected.items():
    path = ROOT / 'public/models' / f'{name}.glb'
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    binary = data[28 + length:]
    assert 'EXT_meshopt_compression' in doc['extensionsRequired']
    assert 'KHR_draco_mesh_compression' not in doc['extensionsUsed']
    images = []
    for image in doc.get('images', []):
        assert image['mimeType'] == 'image/webp' and 'uri' not in image
        view = doc['bufferViews'][image['bufferView']]
        offset, size = view.get('byteOffset', 0), view['byteLength']
        dimensions = Image.open(io.BytesIO(binary[offset:offset + size])).size
        assert max(dimensions) <= 1024
        images.append({'name': image.get('name'), 'mime': image['mimeType'],
                       'size': list(dimensions), 'bytes': size})
    assert len(data) < 3_000_000
    names = [n.get('name') for n in doc['nodes']]
    assert all(n in names for n in required)
    if name == 'backshell':
        assert 'parachute' not in names
    materials = []
    for mat in doc['materials']:
        pbr = mat.get('pbrMetallicRoughness', {})
        assert 'normalTexture' in mat and 'metallicRoughnessTexture' in pbr, mat['name']
        materials.append({'name': mat.get('name'), 'normal': True, 'metallicRoughness': True,
                          'doubleSided': mat.get('doubleSided', False)})
    triangles = sum((doc['accessors'][p['indices']]['count'] if 'indices' in p else
                     doc['accessors'][p['attributes']['POSITION']]['count']) // 3
                    for m in doc['meshes'] for p in m['primitives'])
    primitives = sum(len(m['primitives']) for m in doc['meshes'])
    assert len(data) < before[name]['bytes'], f'{name}: size regressed'
    report['assets'][name] = {'file': f'public/models/{name}.glb', 'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(), 'nodes': len(names), 'triangles': triangles,
        'drawPrimitives': primitives, 'textures': images, 'materials': materials,
        'requiredNodes': required, 'before': {k: before[name][k] for k in ['bytes', 'triangles', 'primitives']}}
    print(name, len(data), 'bytes;', triangles, 'triangles;', primitives, 'primitives')
assets = report['assets'].values()
report['totals'] = {'beforeBytes': sum(a['before']['bytes'] for a in assets),
    'bytes': sum(a['bytes'] for a in assets),
    'beforeDrawPrimitives': sum(a['before']['primitives'] for a in assets),
    'drawPrimitives': sum(a['drawPrimitives'] for a in assets)}
report['totals']['savedPercent'] = round(100 * (1 - report['totals']['bytes'] / report['totals']['beforeBytes']), 2)
target = ROOT / 'docs/model-assets.json'
target.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('Manifest:', target, report['totals'])
