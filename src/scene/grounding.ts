// Site-only ground contact: metre-space feet, a small Viking 2 soil bank, and exact height
// queries on the rendered terrain triangles. GLB geometry and animated node frames stay intact.
import { Box3, Euler, Matrix4, Quaternion, Vector3, type Object3D, type Mesh } from 'three';
import { smoothstep, type Vec3 } from './layout';
import type { SitePreset } from './sites';

export const SITE_SINK_M = 0.012;
export const INGENUITY_SINK_M = 0.013;
export const CONTACT_OFFSET_M = 0.003;
export const PARACHUTE_AT: Vec3 = [-1.5, -0.026, -8.2];
export const SHADOW_LIGHT_M = 80;
export const SHADOW_BIAS = -0.00005;
export const SHADOW_NORMAL_BIAS_M = 0.003;

/** Fit the caster set, not the whole terrain. Depth stays centred on the site's light target. */
export function siteShadowFrustum(p: Pick<SitePreset, 'clear' | 'frame' | 'ingenuity'>) {
  const radius = Math.max(p.clear + 0.6, -p.frame.left, p.frame.right, p.frame.height * 1.2,
    Math.hypot(p.ingenuity.right, p.ingenuity.toward) + 0.8) + 0.4;
  const depth = Math.max(8, radius + 3);
  return { radius, near: SHADOW_LIGHT_M - depth, far: SHADOW_LIGHT_M + depth };
}

export interface LandingBank {
  sink: number;
  tilt: Vec3;
  feet: Vec3[];
}

// Measured from the untouched NASA Viking footpads, in normalizeModel's metre frame.
export const VIKING_2_LANDING: LandingBank = {
  sink: -0.18, tilt: [0.06, 0, 0.136],
  feet: [[1.2403, 0, 0.7336], [-1.1379, 0, 0.7451], [0.0076, 0, -1.3982]],
};

export interface SoilSupport {
  x: number; y: number; z: number; slopeX: number; slopeZ: number; inner: number; outer: number;
}

/** A continuous shallow soil bank, planar under all three pads and soft around the perimeter. */
export function landingSupports(bank: LandingBank | undefined, yaw: number): SoilSupport[] {
  if (!bank) return [];
  const tilt = new Euler(...bank.tilt), up = new Vector3(0, 1, 0).applyEuler(tilt).applyAxisAngle(new Vector3(0, 1, 0), yaw);
  const inner = Math.max(...bank.feet.map(foot => Math.hypot(foot[0], foot[2]))) + 0.25;
  return [{ x: 0, y: -bank.sink + 0.018, z: 0, slopeX: -up.x / up.y, slopeZ: -up.z / up.y,
    inner, outer: inner + 1.4 }];
}

export function supportHeight(supports: readonly SoilSupport[], x: number, z: number): number {
  let h = 0;
  for (const s of supports) {
    const dx = x - s.x, dz = z - s.z;
    const w = 1 - smoothstep(s.inner, s.outer, Math.hypot(dx, dz));
    if (w > 0) h = Math.max(h, (s.y + s.slopeX * dx + s.slopeZ * dz) * w);
  }
  return h;
}

/** Heights on PlaneGeometry's actual a-b-d / b-c-d triangles, including nonuniform grids. */
export function gridHeight(xs: readonly number[], zs: readonly number[], heights: Float32Array, x: number, z: number): number {
  const cell = (axis: readonly number[], v: number) => {
    let lo = 0, hi = axis.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (axis[m] <= v) lo = m; else hi = m; }
    return Math.min(axis.length - 2, lo);
  };
  const ix = cell(xs, x), iz = cell(zs, z), n = xs.length;
  const u = Math.max(0, Math.min(1, (x - xs[ix]) / (xs[ix + 1] - xs[ix])));
  const v = Math.max(0, Math.min(1, (z - zs[iz]) / (zs[iz + 1] - zs[iz])));
  const a = heights[iz * n + ix], b = heights[(iz + 1) * n + ix];
  const d = heights[iz * n + ix + 1], c = heights[(iz + 1) * n + ix + 1];
  return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

export interface GroundContact {
  object: Object3D;
  point: Vector3;
  radiusX: number;
  radiusZ: number;
}

// Object references belong in a WeakMap, never userData (which Three clones as JSON).
const contacts = new WeakMap<Object3D, GroundContact[]>();
const landingUp = new Vector3(), landingPoint = new Vector3(), landingYaw = new Quaternion();
const UP = new Vector3(0, 1, 0);

/** A landing stance on sloping/triangulated soil. Align the whole rig, then lower it until
 * even the highest toe is embedded; the rotor and broken-tip child frames stay untouched. */
export function terrainLandingFrame(root: Object3D | null, heightAt: (x: number, z: number) => number,
  x: number, z: number, yaw: number, out: { height: number; rotation: Quaternion }): void {
  const dx = (heightAt(x + 0.35, z) - heightAt(x - 0.35, z)) / 0.7;
  const dz = (heightAt(x, z + 0.35) - heightAt(x, z - 0.35)) / 0.7;
  out.rotation.setFromUnitVectors(UP, landingUp.set(-dx, 1, -dz).normalize());
  const feet = root ? contacts.get(root) : undefined;
  if (!feet?.length) { out.height = heightAt(x, z); return; }
  landingYaw.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)).premultiply(out.rotation);
  let ceiling = Infinity, low = Infinity, high = -Infinity;
  for (const c of feet) {
    landingPoint.copy(c.point).applyQuaternion(landingYaw);
    ceiling = Math.min(ceiling, heightAt(x + landingPoint.x, z + landingPoint.z) - landingPoint.y);
    low = Math.min(low, c.point.y); high = Math.max(high, c.point.y);
  }
  out.height = ceiling + high - low;
}

/** Bottom islands in a static normalized model; only sampled once after a model loads. */
function bottomIslands(root: Object3D, skip?: Object3D): GroundContact[] {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), matrix = new Matrix4(), v = new Vector3();
  const unit = root.getWorldScale(new Vector3()).x;
  const points: Vector3[] = [];
  const visit = (o: Object3D) => {
    if (o === skip) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.visible) {
      matrix.multiplyMatrices(inverse, mesh.matrixWorld);
      const p = mesh.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) points.push(v.fromBufferAttribute(p, i).applyMatrix4(matrix).multiplyScalar(unit).clone());
    }
    for (const child of o.children) visit(child);
  };
  visit(root);
  if (!points.length) return [];
  let bottom = Infinity;
  for (const p of points) bottom = Math.min(bottom, p.y);
  const cell = 0.075, bins = new Map<string, Vector3[]>();
  for (const p of points) if (p.y < bottom + 0.055) {
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    const bin = bins.get(key);
    if (bin) bin.push(p); else bins.set(key, [p]);
  }
  const result: GroundContact[] = [], seen = new Set<string>();
  for (const key of bins.keys()) {
    if (seen.has(key)) continue;
    seen.add(key);
    const todo = [key], box = new Box3(); let count = 0;
    while (todo.length) {
      const k = todo.pop()!, [x, z] = k.split(',').map(Number);
      for (const p of bins.get(k)!) { box.expandByPoint(p); count++; }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const next = `${x + dx},${z + dz}`;
        if (bins.has(next) && !seen.has(next)) { seen.add(next); todo.push(next); }
      }
    }
    if (count < 3) continue;
    const point = box.getCenter(new Vector3()); point.y = box.min.y;
    result.push({ object: root, point: point.divideScalar(unit),
      radiusX: Math.max(0.07, Math.min(1.3, (box.max.x - box.min.x) * 0.65 + 0.035)) / unit,
      radiusZ: Math.max(0.07, Math.min(1.3, (box.max.z - box.min.z) * 0.65 + 0.035)) / unit });
  }
  return result;
}

export function registerGroundContacts(root: Object3D): void {
  const rover = root.getObjectByName('sojourner');
  const list = bottomIslands(root, rover);
  // Authored rover wheels are batched into two material meshes. Keep six local contact points
  // on the moving rover, rather than joining adjacent wheels into two stationary strips.
  if (rover) for (const x of [-0.255, 0, 0.255]) for (const z of [-0.23, 0.23])
    list.push({ object: rover, point: new Vector3(x, 0, z), radiusX: 0.09, radiusZ: 0.07 });
  contacts.set(root, list);
}

export function collectGroundContacts(root: Object3D, out: GroundContact[]): void {
  const own = contacts.get(root);
  if (own) { out.push(...own); return; }
  for (const child of root.children) collectGroundContacts(child, out);
}

/** Low fold samples; canopy buffers and their decode-ring ordering are never changed. */
export function registerCanopyContacts(chute: Mesh): void {
  const pos = chute.geometry.getAttribute('position'), list: GroundContact[] = [];
  for (const ring of [6, 12, 19, 22]) for (let sector = 0; sector < 96; sector += 8) {
    let best = ring * 97 + sector;
    for (let j = 1; j < 8; j++) if (pos.getY(ring * 97 + sector + j) < pos.getY(best)) best = ring * 97 + sector + j;
    list.push({ object: chute, point: new Vector3().fromBufferAttribute(pos, best), radiusX: 0.7, radiusZ: 0.55 });
  }
  contacts.set(chute, list);
}
