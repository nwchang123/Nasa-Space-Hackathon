// A lighter copy of a mesh for the AR Quick Look file. USDZ geometry is plain text (about 110
// bytes a vertex) and may not be compressed, so the site's full-detail models would make a row of
// nine about 100 MB. Detail far below a millimetre on the table is invisible, so the surface is
// clustered on a grid (classic vertex clustering): a triangle survives if its corners fall in three
// different cells, and every cell has one shared position, so no holes open and the two sides of
// a UV seam stay welded. The other attributes (normals, texture coordinates, colours) are averaged
// per UV chart (triangles joined by shared vertices, which is where a texture is continuous), so
// seams do not smear.

import { BufferAttribute, BufferGeometry } from 'three';

function find(parent: Int32Array, i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

/**
 * Cluster `geometry`'s vertices on a grid of `cell` (in the geometry's own units). Returns a new
 * indexed geometry with the same attributes, or the original when that would not save at least
 * 10 % of the vertices. Never changes `geometry`.
 */
export function decimateForExport(geometry: BufferGeometry, cell: number): BufferGeometry {
  const pos = geometry.getAttribute('position');
  if (!pos || !(cell > 0) || geometry.morphAttributes.position) return geometry;
  const n = pos.count;
  const index = geometry.index;
  const triCount = Math.floor((index ? index.count : n) / 3);
  const corner = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);

  // UV charts: vertices joined by a triangle belong to one chart.
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  for (let t = 0; t < triCount; t++) {
    const a = find(parent, corner(t, 0));
    const b = find(parent, corner(t, 1));
    if (a !== b) parent[b] = a;
    const c = find(parent, corner(t, 2));
    const r = find(parent, a);
    if (r !== c) parent[c] = r;
  }

  // Cells: one shared position each. Clusters: one per (chart, cell).
  const cellOf = new Map<string, number>();
  const cellSum: number[] = [];
  const clusterOf = new Map<string, number>();
  const clusterCell: number[] = [];
  const vertexCluster = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ck = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    let c = cellOf.get(ck);
    if (c === undefined) {
      c = cellSum.length / 4;
      cellOf.set(ck, c);
      cellSum.push(0, 0, 0, 0);
    }
    cellSum[c * 4] += x;
    cellSum[c * 4 + 1] += y;
    cellSum[c * 4 + 2] += z;
    cellSum[c * 4 + 3] += 1;
    const key = `${find(parent, i)}|${c}`;
    let k = clusterOf.get(key);
    if (k === undefined) {
      k = clusterCell.length;
      clusterOf.set(key, k);
      clusterCell.push(c);
    }
    vertexCluster[i] = k;
  }

  // Triangles whose corners fell into fewer than three cells vanish; duplicates go too.
  const tris: number[] = [];
  const seen = new Set<string>();
  for (let t = 0; t < triCount; t++) {
    const i0 = corner(t, 0), i1 = corner(t, 1), i2 = corner(t, 2);
    const k0 = vertexCluster[i0], k1 = vertexCluster[i1], k2 = vertexCluster[i2];
    const c0 = clusterCell[k0], c1 = clusterCell[k1], c2 = clusterCell[k2];
    if (c0 === c1 || c1 === c2 || c0 === c2) continue;
    const key = [k0, k1, k2].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    tris.push(k0, k1, k2);
  }

  // Keep only the clusters a surviving triangle uses, numbered afresh.
  const remap = new Int32Array(clusterCell.length).fill(-1);
  let m = 0;
  for (let j = 0; j < tris.length; j++) {
    const k = tris[j];
    if (remap[k] < 0) remap[k] = m++;
    tris[j] = remap[k];
  }
  if (m > n * 0.9) return geometry;

  const out = new BufferGeometry();
  const outPos = new Float32Array(m * 3);
  for (let old = 0; old < clusterCell.length; old++) {
    const k = remap[old];
    if (k < 0) continue;
    const c = clusterCell[old];
    const w = cellSum[c * 4 + 3];
    outPos[k * 3] = cellSum[c * 4] / w;
    outPos[k * 3 + 1] = cellSum[c * 4 + 1] / w;
    outPos[k * 3 + 2] = cellSum[c * 4 + 2] / w;
  }
  out.setAttribute('position', new BufferAttribute(outPos, 3));

  // Every other attribute: the mean over the cluster (directions renormalised).
  const count = new Float32Array(m);
  for (let i = 0; i < n; i++) {
    const k = remap[vertexCluster[i]];
    if (k >= 0) count[k] += 1;
  }
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    if (name === 'position' || name === 'skinIndex' || name === 'skinWeight') continue;
    const size = attr.itemSize;
    const sum = new Float32Array(m * size);
    for (let i = 0; i < n; i++) {
      const k = remap[vertexCluster[i]];
      if (k < 0) continue;
      for (let j = 0; j < size; j++) sum[k * size + j] += attr.getComponent(i, j);
    }
    const unit = name === 'normal' || name === 'tangent';
    for (let k = 0; k < m; k++) {
      if (unit) {
        const len = Math.hypot(sum[k * size], sum[k * size + 1], sum[k * size + 2]) || 1;
        for (let j = 0; j < 3; j++) sum[k * size + j] /= len;
        for (let j = 3; j < size; j++) sum[k * size + j] = Math.sign(sum[k * size + j]) || 1;
      } else {
        for (let j = 0; j < size; j++) sum[k * size + j] /= count[k];
      }
    }
    out.setAttribute(name, new BufferAttribute(sum, size));
  }
  out.setIndex(tris);
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  return out;
}
