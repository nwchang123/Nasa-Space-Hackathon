// Load the shipped binary geometry, including meshopt and quantized accessors, without a DOM.
// Textures are inspected in the browser and by glTF-Transform; these fixtures test the rigs.
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const components: Record<number, [number, string]> = {
  5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'],
  5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'],
};

export async function loadGlb(file: string) {
  const bytes = readFileSync(new URL(`../public/models/${file}`, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  await MeshoptDecoder.ready;
  const views = json.bufferViews.map((v: any) => {
    const ext = v.extensions?.EXT_meshopt_compression;
    if (!ext) return binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const out = new Uint8Array(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride,
      binary.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), ext.mode, ext.filter);
    return out;
  });
  function accessor(index: number): BufferAttribute {
    const a = json.accessors[index];
    const size = a.type === 'VEC3' ? 3 : a.type === 'VEC2' ? 2 : a.type === 'VEC4' ? 4 : 1;
    const view = views[a.bufferView];
    const dv = new DataView(view.buffer, view.byteOffset, view.byteLength);
    const [width, getter] = components[a.componentType];
    const stride = json.bufferViews[a.bufferView].byteStride ?? width * size;
    const arr = new Float32Array(a.count * size);
    const normalized = (x: number) => {
      if (!a.normalized) return x;
      const max = a.componentType === 5120 ? 127 : a.componentType === 5121 ? 255 : a.componentType === 5122 ? 32767 : 65535;
      return Math.max(-1, x / max);
    };
    for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) {
      arr[i * size + j] = normalized((dv as any)[getter]((a.byteOffset ?? 0) + i * stride + j * width, true));
    }
    if (a.sparse) {
      const s = a.sparse;
      const iv = views[s.indices.bufferView], vv = views[s.values.bufferView];
      const idv = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
      const vdv = new DataView(vv.buffer, vv.byteOffset, vv.byteLength);
      const [iw, ig] = components[s.indices.componentType];
      for (let i = 0; i < s.count; i++) {
        const index = (idv as any)[ig]((s.indices.byteOffset ?? 0) + i * iw, true);
        for (let j = 0; j < size; j++) arr[index * size + j] = normalized((vdv as any)[getter]((s.values.byteOffset ?? 0) + (i * size + j) * width, true));
      }
    }
    return new BufferAttribute(arr, size);
  }
  const nodes = json.nodes.map((n: any) => {
    const o = new Group();
    o.name = n.name ?? '';
    if (n.matrix) o.applyMatrix4(new Matrix4().fromArray(n.matrix));
    else {
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
    }
    if (n.mesh !== undefined) json.meshes[n.mesh].primitives.forEach((p: any) => {
      const g = new BufferGeometry();
      g.setAttribute('position', accessor(p.attributes.POSITION));
      if (p.indices !== undefined) g.setIndex(Array.from(accessor(p.indices).array));
      g.computeVertexNormals();
      const material = new MeshBasicMaterial({ side: DoubleSide });
      material.name = json.materials?.[p.material]?.name ?? '';
      o.add(new Mesh(g, material));
    });
    return o;
  });
  json.nodes.forEach((n: any, i: number) => n.children?.forEach((j: number) => nodes[i].add(nodes[j])));
  const scene = new Group();
  json.scenes[json.scene ?? 0].nodes.forEach((i: number) => scene.add(nodes[i]));
  scene.updateMatrixWorld(true);
  return { scene, json, bytes };
}
