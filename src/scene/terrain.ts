// Procedural ground for a site diorama: gentle relief, sand ripples, patterned ground, distant
// hills, and a scatter of rocks (one instanced draw call). Seeded, so each site always looks the
// same. Illustrative: no real elevation data.

import {
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Euler,
  Float32BufferAttribute,
  Vector3,
} from 'three';
import { horizonDir, smoothstep } from './layout';
import type { SiteLayout, SitePreset } from './sites';

/** Side of the square of ground, m. The fog hides its edges. */
export const GROUND_SIZE = 180;
const GROUND_SEGMENTS = 96;

function hash(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 144269) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x, z, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    z *= 2.03;
  }
  return sum / norm;
}

/** Distance to the nearest polygon edge (cells about `size` m across), 0 on an edge. */
function polygonEdge(x: number, z: number, size: number, seed: number): number {
  const gx = x / size, gz = z / size;
  const cx = Math.floor(gx), cz = Math.floor(gz);
  let d1 = 9, d2 = 9;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const px = cx + i + hash(cx + i, cz + j, seed);
      const pz = cz + j + hash(cx + i, cz + j, seed + 1);
      const d = Math.hypot(gx - px, gz - pz);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
  }
  return (d2 - d1) * size;
}

export interface Ground {
  ground: Mesh;
  rocks: InstancedMesh;
  /** The two materials that fade in with the dive. */
  materials: MeshStandardMaterial[];
  /** Ground height at a diorama-local point, m. */
  heightAt(x: number, z: number): number;
  dispose(): void;
}

export function buildGround(p: SitePreset, lay: SiteLayout): Ground {
  const flatSpots = [
    { x: 0, z: 0, r: p.clear },
    { x: lay.ingenuity[0], z: lay.ingenuity[2], r: 1.1 },
  ];
  const across = horizonDir(p.rippleAzDeg + 90, 0);
  const hills = p.hills.map(h => {
    const d = horizonDir(h.azDeg, 0);
    return { x: d[0] * h.dist, z: d[2] * h.dist, r2: h.radius * h.radius, h: h.height };
  });

  const flatness = (x: number, z: number) => {
    let f = 1;
    for (const s of flatSpots) f = Math.min(f, smoothstep(s.r, s.r + 4, Math.hypot(x - s.x, z - s.z)));
    return f;
  };

  const heightAt = (x: number, z: number) => {
    const f = flatness(x, z);
    let h = p.relief * 2 * (fbm(x / 12, z / 12, p.seed) - 0.5);
    h += p.relief * 0.7 * (fbm(x / 3, z / 3, p.seed + 7) - 0.5);
    if (p.ripples > 0) {
      const u = x * across[0] + z * across[2];
      h += p.ripples * Math.sin(u * ((2 * Math.PI) / 1.7) + 4 * fbm(x / 7, z / 7, p.seed + 3)) * (0.5 + 0.5 * fbm(x / 9, z / 9, p.seed + 5));
    }
    if (p.polygons > 0) h -= 0.06 * (1 - smoothstep(0.05, 0.4, polygonEdge(x, z, p.polygons, p.seed)));
    // Flatten after adding the hills: a big hill's foot reaches the clearing (Jezero's rim added
    // ~0.2 m there) and would bury anything lying flat on the ground, like the parachute.
    for (const hill of hills) h += hill.h * Math.exp(-((x - hill.x) ** 2 + (z - hill.z) ** 2) / hill.r2);
    return h * f;
  };

  // ---- the ground
  const geom = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS).rotateX(-Math.PI / 2);
  const pos = geom.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const base = new Color(p.ground);
  const dark = new Color(p.groundDark);
  const light = new Color(p.ground).lerp(new Color('#e3c7a4'), 0.25);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    c.copy(base).lerp(dark, smoothstep(0.38, 0.78, fbm(x / 9, z / 9, p.seed + 11)));
    if (p.polygons > 0) c.lerp(dark, 0.55 * (1 - smoothstep(0.05, 0.45, polygonEdge(x, z, p.polygons, p.seed))));
    if (p.ripples > 0) {
      const u = x * across[0] + z * across[2];
      c.lerp(light, 0.3 * Math.max(0, Math.sin(u * ((2 * Math.PI) / 1.7) + 4 * fbm(x / 7, z / 7, p.seed + 3))));
    }
    c.multiplyScalar(0.94 + 0.12 * hash(i, 3, p.seed));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  // Transparent so the ground can fade in as the camera dives toward the site.
  const ground = new Mesh(geom, new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, transparent: true }));
  ground.receiveShadow = true;
  ground.name = 'ground';

  // ---- rocks, densest near the machine, thinning out toward the haze
  const rockGeom = new IcosahedronGeometry(1, 0);
  const rockMat = new MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: true, transparent: true });
  const rocks = new InstancedMesh(rockGeom, rockMat, Math.max(1, p.rocks));
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.name = 'rocks';
  const rockDark = new Color(p.groundDark).lerp(new Color('#3a2a22'), 0.4);
  const rockLight = new Color(p.ground).lerp(new Color('#b89a82'), 0.2);
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const s = new Vector3();
  const t = new Vector3();
  let seed = p.seed * 977;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  let placed = 0;
  for (let tries = 0; placed < p.rocks && tries < p.rocks * 6; tries++) {
    const dist = p.clear + 0.5 + Math.min(55, -Math.log(1 - rnd() * 0.999) * 9);
    const a = rnd() * Math.PI * 2;
    const x = dist * Math.sin(a);
    const z = dist * Math.cos(a);
    if (Math.hypot(x - lay.ingenuity[0], z - lay.ingenuity[2]) < 1.5) continue;
    const k = rnd();
    const size = p.rockSize * (0.12 + 0.88 * k * k * k);
    s.set(size * (0.8 + 0.5 * rnd()), size * (0.45 + 0.3 * rnd()), size * (0.8 + 0.5 * rnd()));
    t.set(x, heightAt(x, z) + s.y * 0.25, z);
    q.setFromEuler(e.set(rnd() * 0.6, rnd() * Math.PI * 2, rnd() * 0.6));
    rocks.setMatrixAt(placed, m.compose(t, q, s));
    rocks.setColorAt(placed, c.copy(rockDark).lerp(rockLight, rnd()));
    placed++;
  }
  rocks.count = placed;
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;

  return {
    ground,
    rocks,
    materials: [ground.material as MeshStandardMaterial, rockMat],
    heightAt,
    dispose() {
      geom.dispose();
      (ground.material as MeshStandardMaterial).dispose();
      rockGeom.dispose();
      rockMat.dispose();
      rocks.dispose();
    },
  };
}
