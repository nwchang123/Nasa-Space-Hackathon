// Procedural ground for a site diorama: gentle relief, sand ripples, patterned ground, distant
// hills, and a scatter of rocks (one instanced draw call). Seeded, so each site always looks the
// same. Illustrative: no real elevation data.

import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  PlaneGeometry,
  Quaternion,
  Euler,
  Float32BufferAttribute,
  RepeatWrapping,
  Vector2,
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

// ---------------------------------------------------------------- close-up detail

/** Detail texture size, px. One tile is a few metres, so a pixel is about a centimetre. */
const DETAIL_PX = 512;
/** Sand ripples per tile (the ground's ripple wavelength is 1.7 m on average); four per tile, so the
 *  pattern repeats only every 6.8 m. */
const RIPPLES_PER_TILE = 4;
const RIPPLE_WAVELENGTH_M = 1.7;
/** Small ripples riding on the big ones (Mars has both scales), cycles per tile across and along. */
const SMALL_RIPPLES: readonly [number, number] = [46, 5];

/** Value noise on a lattice that wraps every `period` cells, so the tile repeats seamlessly. */
function tileNoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = (i: number) => ((i % period) + period) % period;
  const a = hash(w(ix), w(iy), seed), b = hash(w(ix + 1), w(iy), seed);
  const c = hash(w(ix), w(iy + 1), seed), d = hash(w(ix + 1), w(iy + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function tileFbm(x: number, y: number, period: number, seed: number, octaves: number): number {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(x, y, period, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
    period *= 2;
  }
  return sum / norm;
}

interface Detail {
  map: CanvasTexture;
  normalMap: CanvasTexture;
  /** Tile size, m. */
  tileM: number;
}

const detailCache = new Map<string, Detail>();

/**
 * Close-up texture for a site's ground, generated once per site and kept: sand grain, pebbles
 * and (where the site has them) sand ripples, as a grey colour multiplier and a normal map.
 * Illustrative, like the rest of the diorama.
 */
function groundDetail(p: SitePreset): Detail {
  const key = `${p.seed}|${p.ripples}|${p.rippleAzDeg}|${p.rocks}`;
  const hit = detailCache.get(key);
  if (hit) return hit;

  const N = DETAIL_PX;
  const rippled = p.ripples > 0;
  const tileM = rippled ? RIPPLES_PER_TILE * RIPPLE_WAVELENGTH_M : 4;
  const px = tileM / N; // metres per pixel
  const H = new Float32Array(N * N); // height, m
  const A = new Float32Array(N * N); // albedo multiplier, 0..1
  const at = (r: number, c: number) => ((r + N) % N) * N + ((c + N) % N);

  // Ripples (crests along the tile's u axis), fine grain and low mottling. Real ripple fields are
  // regular but not ruled: crests wander, their spacing varies by about a fifth, a crest fades
  // out and the next one takes over, and smaller ripples ride on the big ones.
  const rippleAmp = Math.min(0.1, Math.max(0.03, p.ripples));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const s = c / N, t = r / N;
      let h = 0.0025 * (tileFbm(s * 96, t * 96, 96, p.seed + 5, 2) - 0.5);
      let a = 0.9 + 0.08 * tileFbm(s * 6, t * 6, 6, p.seed + 9, 3) + 0.05 * (tileNoise(s * 220, t * 220, 220, p.seed + 13) - 0.5);
      if (rippled) {
        const warp = 1.1 * (tileFbm(s * 3, t * 3, 3, p.seed + 3, 3) - 0.5) + 0.22 * (tileFbm(s * 8, t * 8, 8, p.seed + 4, 2) - 0.5);
        const phase = 2 * Math.PI * (RIPPLES_PER_TILE * t + warp);
        // Asymmetric profile (a gentle windward side, a steeper lee); coarser, lighter grains
        // collect on the crests. Crest height comes and goes along the crest.
        const wave = Math.sin(phase) + 0.22 * Math.sin(2 * phase);
        const crest = 0.3 + 0.7 * smoothstep(0.3, 0.65, tileFbm(s * 4, t * 4, 4, p.seed + 6, 2));
        h += rippleAmp * crest * wave;
        a += 0.05 * crest * Math.max(0, wave);
        const small = 2 * Math.PI * (SMALL_RIPPLES[0] * t + SMALL_RIPPLES[1] * s + 0.6 * tileFbm(s * 6, t * 6, 6, p.seed + 8, 2));
        h += 0.004 * Math.sin(small);
      }
      H[r * N + c] = h;
      A[r * N + c] = a;
    }
  }

  // Pebbles: small rounded stones, darker or lighter than the sand. Wrapped, so they tile.
  let seed = p.seed * 7919 + 1;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const pebbles = Math.round((rippled ? 90 : 170) + Math.min(260, p.rocks * 0.6));
  for (let i = 0; i < pebbles; i++) {
    const cr = rnd() * N, cc = rnd() * N;
    const k = rnd();
    const radM = 0.008 + 0.03 * k * k;
    const rad = radM / px;
    const tall = radM * (0.5 + 0.4 * rnd());
    const tone = rnd() < 0.7 ? 0.55 + 0.2 * rnd() : 1.0;
    const reach = Math.ceil(rad * 1.6);
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const d2 = (dr * dr + dc * dc) / (rad * rad);
        if (d2 > 2.56) continue;
        const idx = at(Math.round(cr) + dr, Math.round(cc) + dc);
        const bump = Math.exp(-d2 * 1.6);
        H[idx] = Math.max(H[idx], H[idx] * (1 - bump) + tall * bump);
        if (d2 < 1) A[idx] = A[idx] * (1 - bump) + tone * bump;
      }
    }
  }

  // Encode: albedo as grey; normals in tangent space (+u right, +v up the texture).
  const albedo = document.createElement('canvas');
  const normal = document.createElement('canvas');
  albedo.width = albedo.height = normal.width = normal.height = N;
  const actx = albedo.getContext('2d');
  const nctx = normal.getContext('2d');
  if (!actx || !nctx) throw new Error('2D canvas unavailable');
  const aimg = actx.createImageData(N, N);
  const nimg = nctx.createImageData(N, N);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const dHdu = (H[at(r, c + 1)] - H[at(r, c - 1)]) / (2 * px);
      const dHdv = (H[at(r - 1, c)] - H[at(r + 1, c)]) / (2 * px); // row 0 is the top (v = 1)
      const len = Math.hypot(dHdu, dHdv, 1);
      nimg.data[i * 4] = Math.round((-dHdu / len) * 127.5 + 127.5);
      nimg.data[i * 4 + 1] = Math.round((-dHdv / len) * 127.5 + 127.5);
      nimg.data[i * 4 + 2] = Math.round((1 / len) * 127.5 + 127.5);
      nimg.data[i * 4 + 3] = 255;
      const g = Math.round(255 * Math.min(1, Math.max(0, A[i])));
      aimg.data[i * 4] = aimg.data[i * 4 + 1] = aimg.data[i * 4 + 2] = g;
      aimg.data[i * 4 + 3] = 255;
    }
  }
  actx.putImageData(aimg, 0, 0);
  nctx.putImageData(nimg, 0, 0);

  const repeat = GROUND_SIZE / tileM;
  // Crests run along the site's ripple bearing (the tile's u axis is east by default).
  const rotation = rippled ? ((90 - p.rippleAzDeg) * Math.PI) / 180 : 0;
  const make = (canvas: HTMLCanvasElement) => {
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = NoColorSpace; // a multiplier and a normal map: data, not colour
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.center.set(0.5, 0.5);
    tex.rotation = rotation;
    tex.anisotropy = 8;
    return tex;
  };
  const detail = { map: make(albedo), normalMap: make(normal), tileM };
  detailCache.set(key, detail);
  return detail;
}

export interface Ground {
  ground: Mesh;
  /** A few rock shapes, each one instanced draw call. */
  rocks: Group;
  /** The two materials that fade in with the dive. */
  materials: MeshStandardMaterial[];
  /** Ground height at a diorama-local point, m. */
  heightAt(x: number, z: number): number;
  dispose(): void;
}

// ---------------------------------------------------------------- rocks

/** Shapes per size class. */
const ROCK_SHAPES = 5;
/** Rocks larger than this (× the site's rockSize) use the finely divided shapes. */
const BIG_ROCK = 0.45;

/**
 * One rock: a finely divided sphere cut by many random planes, so little of the sphere is left:
 * flat broken faces like basalt, with edges worn round over about one triangle, slight lumps and
 * pitting, and a flatter base that sits in the sand. Colour: dark grey rock, with dust on the
 * faces that look up and banked against the foot.
 */
function rockGeometry(seed: number, detail: number, bare: Color, dust: Color): BufferGeometry {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const planes = Array.from({ length: 11 + Math.floor(rnd() * 6) }, () => {
    const z = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    return { d: [r * Math.cos(a), z, r * Math.sin(a)] as const, h: 0.42 + 0.33 * rnd() };
  });
  const wave = (f: number, amp: number) => ({ k: [(rnd() * 2 - 1) * f, (rnd() * 2 - 1) * f, (rnd() * 2 - 1) * f] as const, ph: rnd() * 6.28, amp });
  const waves = [wave(3, 0.025), wave(4, 0.02), wave(11, 0.01), wave(15, 0.008), wave(21, 0.006)];

  let g: BufferGeometry = new IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    let r = 1;
    for (const pl of planes) {
      const cosA = nx * pl.d[0] + ny * pl.d[1] + nz * pl.d[2];
      if (cosA > 1e-3) r = Math.min(r, pl.h / cosA);
    }
    for (const w of waves) r *= 1 + w.amp * Math.sin(nx * w.k[0] + ny * w.k[1] + nz * w.k[2] + w.ph);
    let py = ny * r;
    if (py < -0.35) py = -0.35 + (py + 0.35) * 0.35; // a flatter base, resting in the sand
    pos.setXYZ(i, nx * r, py, nz * r);
  }
  g.computeVertexNormals();
  const p2 = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const colors = new Float32Array(p2.count * 3);
  const c = new Color();
  for (let i = 0; i < p2.count; i++) {
    const x = p2.getX(i), y = p2.getY(i), z = p2.getZ(i);
    const up = nrm.getY(i);
    const speck = 0.5 + 0.5 * Math.sin(x * 23.1 + y * 17.3 + z * 29.7) * Math.sin(x * 11.7 - z * 13.1 + y * 5.3);
    let d = 0.06 + 0.8 * smoothstep(0.4, 0.92, up) * (0.45 + 0.55 * speck);
    d = Math.max(d, 0.7 * (1 - smoothstep(-0.34, -0.2, y)));
    c.copy(bare).lerp(dust, d);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

export function buildGround(p: SitePreset, lay: SiteLayout): Ground {
  const flatSpots = [
    { x: 0, z: 0, r: p.clear },
    { x: lay.ingenuity[0], z: lay.ingenuity[2], r: 1.1 },
  ];
  const hills = p.hills.map(h => {
    const d = horizonDir(h.azDeg, 0);
    return { x: d[0] * h.dist, z: d[2] * h.dist, r2: h.radius * h.radius, h: h.height };
  });

  const flatness = (x: number, z: number) => {
    let f = 1;
    for (const s of flatSpots) f = Math.min(f, smoothstep(s.r, s.r + 4, Math.hypot(x - s.x, z - s.z)));
    return f;
  };

  // No ripples in the mesh: its vertices are 1.875 m apart (GROUND_SIZE / GROUND_SEGMENTS), too
  // coarse for 1.7 m ripples, which used to alias into false, ruler-straight stripes about 5 m
  // apart. The ripples live in the detail normal map (groundDetail), which can carry them.
  const heightAt = (x: number, z: number) => {
    const f = flatness(x, z);
    let h = p.relief * 2 * (fbm(x / 12, z / 12, p.seed) - 0.5);
    h += p.relief * 0.7 * (fbm(x / 3, z / 3, p.seed + 7) - 0.5);
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
    // Rippled sand: broad, irregular patches of paler crest sand (the crests themselves are in the
    // detail maps), never stripes the vertex grid cannot draw.
    if (p.ripples > 0) c.lerp(light, 0.22 * smoothstep(0.45, 0.8, fbm(x / 6, z / 6, p.seed + 3)));
    c.multiplyScalar(0.94 + 0.12 * hash(i, 3, p.seed));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  // Transparent so the ground can fade in as the camera dives toward the site. The detail maps add
  // centimetre-scale grain, pebbles and ripples that the 1.9 m vertex grid cannot carry.
  const detail = groundDetail(p);
  const ground = new Mesh(
    geom,
    new MeshStandardMaterial({
      vertexColors: true,
      map: detail.map,
      normalMap: detail.normalMap,
      normalScale: new Vector2(1.8, 1.8),
      roughness: 1,
      metalness: 0,
      transparent: true,
    }),
  );
  ground.receiveShadow = true;
  ground.name = 'ground';

  // ---- rocks, densest near the machine, thinning out toward the haze. A few angular shapes in
  // two sizes (fine ones for big rocks, coarse ones for pebbles), each instanced, so hundreds of
  // rocks cost a handful of draw calls.
  const bare = new Color(p.groundDark).lerp(new Color('#34302d'), 0.72);
  const dust = new Color(p.ground);
  const rockGeoms = [
    ...Array.from({ length: ROCK_SHAPES }, (_, i) => rockGeometry(p.seed * 101 + i * 7 + 1, 10, bare, dust)),
    ...Array.from({ length: ROCK_SHAPES }, (_, i) => rockGeometry(p.seed * 131 + i * 11 + 3, 4, bare, dust)),
  ];
  const rockMat = new MeshStandardMaterial({ roughness: 0.92, metalness: 0, vertexColors: true, transparent: true });
  const perShape = Math.max(1, Math.ceil(p.rocks / ROCK_SHAPES));
  const shapes = rockGeoms.map(g => {
    const im = new InstancedMesh(g, rockMat, perShape);
    im.castShadow = true;
    im.receiveShadow = true;
    im.count = 0;
    return im;
  });
  const rocks = new Group();
  rocks.name = 'rocks';
  shapes.forEach(im => rocks.add(im));
  const tierCount = [0, 0];
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
    s.set(size * (0.8 + 0.5 * rnd()), size * (0.6 + 0.4 * rnd()), size * (0.8 + 0.5 * rnd()));
    // Partly buried: the lower third or so sits below the sand.
    t.set(x, heightAt(x, z) - s.y * (0.15 + 0.25 * rnd()), z);
    q.setFromEuler(e.set(rnd() * 0.5, rnd() * Math.PI * 2, rnd() * 0.5));
    const tier = size > BIG_ROCK * p.rockSize ? 0 : 1;
    const im = shapes[tier * ROCK_SHAPES + (tierCount[tier] % ROCK_SHAPES)];
    if (im.count >= perShape) continue;
    tierCount[tier]++;
    im.setMatrixAt(im.count, m.compose(t, q, s));
    // Each rock a little lighter or darker, warmer or greyer.
    const v = 0.78 + 0.4 * rnd();
    im.setColorAt(im.count, c.setRGB(v, v * (0.96 + 0.05 * rnd()), v * (0.93 + 0.08 * rnd())));
    im.count++;
    placed++;
  }
  for (const im of shapes) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  return {
    ground,
    rocks,
    materials: [ground.material as MeshStandardMaterial, rockMat],
    heightAt,
    dispose() {
      geom.dispose();
      (ground.material as MeshStandardMaterial).dispose();
      rockGeoms.forEach(g => g.dispose());
      rockMat.dispose();
      shapes.forEach(im => im.dispose());
    },
  };
}
