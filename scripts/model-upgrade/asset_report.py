"""Inspect final embedded WebP images and write a reproducible delivery manifest.

Run with system Python (Pillow required): python scripts/model-upgrade/asset_report.py
"""
import hashlib
import io
import json
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
report = {'pipeline': {'blender': '5.3.0', 'gltfTransform': '4.5.1',
    'geometry': 'EXT_meshopt_compression', 'textures': 'image/webp', 'maxTextureSize': 1024,
    'flatten': False, 'join': False, 'instance': False, 'simplify': False}, 'assets': {}}
for name in ['mer', 'pathfinder', 'phoenix', 'backshell']:
    path = ROOT / 'public/models' / f'{name}.glb'
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+length])
    binary = data[28+length:]
    images = []
    assert 'EXT_meshopt_compression' in doc['extensionsRequired']
    assert 'KHR_draco_mesh_compression' not in doc['extensionsUsed']
    for image in doc.get('images', []):
        assert image['mimeType'] == 'image/webp' and 'uri' not in image
        view = doc['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        dimensions = Image.open(io.BytesIO(binary[offset:offset+view['byteLength']])).size
        assert max(dimensions) <= 1024
        images.append({'name': image.get('name'), 'mime': image['mimeType'], 'size': list(dimensions)})
    assert len(data) < 3_000_000
    names = [n.get('name') for n in doc['nodes']]
    expected = {'mer': ['mer-right-front-contact', 'wheel-right-front'],
                'pathfinder': ['sojourner', 'sojourner-apxs-tip'],
                'phoenix': ['phoenix-arm', 'phoenix-scoop'], 'backshell': ['backshell']}[name]
    assert all(n in names for n in expected)
    if name == 'backshell':
        assert 'parachute' not in names
    report['assets'][name] = {
        'file': f'public/models/{name}.glb', 'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(), 'nodes': len(names),
        'triangles': sum(doc['accessors'][p['indices']]['count']//3
                         for m in doc['meshes'] for p in m['primitives']),
        'drawPrimitives': sum(len(m['primitives']) for m in doc['meshes']),
        'textures': images, 'requiredNodes': expected,
    }
    print(name, len(data), 'bytes;', len(images), 'embedded WebP images; max', max(max(i['size']) for i in images))
target = ROOT / 'docs/model-assets.json'
target.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print('Manifest:', target)
