// AR Quick Look (iPhone, iPad): the arrangement exported to USDZ with three's own exporter,
// anchored to a horizontal plane, then held as a Blob URL ready BEFORE the visitor taps. Safari
// only opens Quick Look from a tap's own navigation; exporting at tap time would lose it.

import { BufferAttribute, BufferGeometry, DoubleSide, FrontSide, Group, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { USDZExporter, type USDZExporterOptions } from 'three/examples/jsm/exporters/USDZExporter.js';
import { decimateForExport } from './decimate';
import type { HangarScale } from './layout';

export const USDZ_MIME = 'model/vnd.usdz+zip';

export const USDZ_OPTIONS = {
  ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } },
  includeAnchoringProperties: true,
  quickLookCompatible: true,
  onlyVisible: true,
  maxTextureSize: 1024,
} satisfies USDZExporterOptions;

/**
 * How much detail the USDZ keeps. USDZ is uncompressed text and PNG, so the site's full models
 * would make a 100 MB row. `cell` is the finest detail kept, in metres as shown (on the table, or
 * at real size at 1:1); textures are scaled down to `maxTextureSize`.
 */
export interface ExportPlan {
  cell: number;
  maxTextureSize: number;
}

export function exportPlan(manyModels: boolean, scale: HangarScale): ExportPlan {
  if (scale === 'table') return manyModels ? { cell: 0.0014, maxTextureSize: 256 } : { cell: 0.00075, maxTextureSize: 512 };
  return manyModels ? { cell: 0.06, maxTextureSize: 256 } : { cell: 0.008, maxTextureSize: 1024 };
}

/** A flat part (a solar array, a rotor blade): its thinnest side under 4 % of its longest. */
function isThin(g: BufferGeometry): boolean {
  if (!g.boundingBox) g.computeBoundingBox();
  const s = g.boundingBox!.getSize(new Vector3()).toArray().sort((a, b) => a - b);
  return s[2] > 0 && s[0] < s[2] * 0.04;
}

/**
 * The same surface seen from both sides: every triangle again, reversed, with flipped normals.
 * AR Quick Look draws one side only, and the site's materials are double-sided.
 */
export function withBackFaces(g: BufferGeometry): BufferGeometry {
  const src = g.index ? g : g.clone().setIndex([...Array(g.getAttribute('position').count).keys()]);
  const n = src.getAttribute('position').count;
  const out = new BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const size = attr.itemSize;
    const data = new Float32Array(n * 2 * size);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < size; j++) {
        const v = attr.getComponent(i, j);
        data[i * size + j] = v;
        data[(n + i) * size + j] = (name === 'normal' || name === 'tangent') && j < 3 ? -v : v;
      }
    }
    out.setAttribute(name, new BufferAttribute(data, size));
  }
  const index = src.index!;
  const tris: number[] = [];
  for (let t = 0; t < index.count; t += 3) tris.push(index.getX(t), index.getX(t + 1), index.getX(t + 2));
  for (let t = 0; t < index.count; t += 3) tris.push(n + index.getX(t), n + index.getX(t + 2), n + index.getX(t + 1));
  out.setIndex(tris);
  if (src !== g) src.dispose();
  return out;
}

/**
 * A copy of `root` to export: its meshes clustered to the plan's detail (shared geometry once),
 * thin double-sided parts given real back faces, materials marked one-sided (which is all USDZ
 * carries; the exporter would only warn). The shown object is not touched. The exporter writes
 * only the children of what it is given, so the copy sits in a wrapper that keeps the root's
 * scale. The EDL canopy is copied exactly as it is (its vertex order is the decode overlay's
 * contract, and it lies face up on the table).
 */
export function exportCopy(root: Object3D, plan: ExportPlan): { scene: Group; dispose(): void } {
  const scene = new Group();
  scene.add(root.clone(true));
  scene.updateMatrixWorld(true);
  const made = new Map<string, BufferGeometry>();
  const shown = new Set<BufferGeometry>();
  const materials = new Map<Material, Material>();
  scene.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const mat = mesh.material;
    if (mat.side === DoubleSide) {
      let one = materials.get(mat);
      if (!one) {
        one = mat.clone();
        one.side = FrontSide;
        materials.set(mat, one);
      }
      mesh.material = one;
    }
    if (mesh.name === 'parachute' || mesh.name === 'parachute-lines') return;
    shown.add(mesh.geometry);
    const cellLocal = plan.cell / mesh.matrixWorld.getMaxScaleOnAxis();
    const twoSided = mat.side === DoubleSide && isThin(mesh.geometry);
    const key = `${mesh.geometry.uuid}:${cellLocal.toPrecision(3)}:${twoSided}`;
    let g = made.get(key);
    if (!g) {
      g = decimateForExport(mesh.geometry, cellLocal);
      if (twoSided) {
        const both = withBackFaces(g);
        if (g !== mesh.geometry) g.dispose();
        g = both;
      }
      made.set(key, g);
    }
    mesh.geometry = g;
  });
  return {
    scene,
    dispose() {
      for (const g of made.values()) if (!shown.has(g)) g.dispose();
      for (const m of materials.values()) m.dispose();
    },
  };
}

export async function exportUsdz(root: Object3D, plan: ExportPlan = { cell: 0, maxTextureSize: USDZ_OPTIONS.maxTextureSize }): Promise<Uint8Array> {
  const copy = exportCopy(root, plan);
  try {
    return await new USDZExporter().parseAsync(copy.scene, { ...USDZ_OPTIONS, maxTextureSize: plan.maxTextureSize });
  } finally {
    copy.dispose();
  }
}

/**
 * The Quick Look link. At 1:1 the visitor should not pinch it smaller by accident, so content
 * scaling is switched off (Apple's URL fragment parameter); at table scale they may resize it.
 */
export function quickLookHref(url: string, scale: HangarScale): string {
  return scale === 'real' ? `${url}#allowsContentScaling=0` : url;
}

export interface UsdzEntry {
  key: string;
  url: string;
  bytes: number;
}

export interface ObjectUrls {
  create(blob: Blob): string;
  revoke(url: string): void;
}

const browserUrls: ObjectUrls = {
  create: blob => URL.createObjectURL(blob),
  revoke: url => URL.revokeObjectURL(url),
};

/**
 * Holds one ready USDZ Blob URL, for the arrangement shown now. `prepare` exports in the
 * background; an export overtaken by a newer arrangement is dropped, and a replaced URL revoked.
 * `ready(key)` is synchronous, so the link's href is set long before the tap.
 */
export class UsdzCache {
  private entry: UsdzEntry | null = null;
  private wanted = '';

  constructor(private readonly urls: ObjectUrls = browserUrls) {}

  ready(key: string): UsdzEntry | null {
    return this.entry && this.entry.key === key ? this.entry : null;
  }

  async prepare(key: string, make: () => Promise<Uint8Array>): Promise<UsdzEntry | null> {
    const have = this.ready(key);
    if (have) return have;
    this.wanted = key;
    const data = await make();
    if (this.wanted !== key) return null;
    const url = this.urls.create(new Blob([data as Uint8Array<ArrayBuffer>], { type: USDZ_MIME }));
    if (this.entry) this.urls.revoke(this.entry.url);
    this.entry = { key, url, bytes: data.byteLength };
    return this.entry;
  }

  dispose() {
    if (this.entry) this.urls.revoke(this.entry.url);
    this.entry = null;
    this.wanted = '';
  }
}
