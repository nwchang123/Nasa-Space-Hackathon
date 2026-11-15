// Procedural Perseverance EDL parachute: 3D wind-collapsed canopy geometry on the shared decode
// ring topology, stitched Kevlar-gore PBR maps (albedo + AO/dust, normal, roughness), and
// catenary suspension cords leading from the backshell bridle swivel to the near skirt.

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  RingGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { PARACHUTE_AT, registerCanopyContacts } from './grounding';

export const CHUTE_INNER_R = 0.5;
export const CHUTE_OUTER_R = 8;
export const CHUTE_THETA_SEGMENTS = 96;
export const CHUTE_PHI_SEGMENTS = 22;
export const CHUTE_YAW = 0.12;
export const CHUTE_SQUASH = 0.74;

const DUST = new Color('#a97b56');
const MIN_LOCAL_Y = 0.0305; // keeps world clearance at PARACHUTE_AT[1] = -0.026 cleanly in [0.0039, 0.006)
const NEAR_ANGLE = 1.48; // direction in canopy-local space facing the backshell at (0, 0, 0)
const SWIVEL_AT = new Vector3(-0.19, 1.62, -0.13);
const BRIDLE_SPLIT = new Vector3(-0.32, 1.42, -1.05);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

interface FoldSample {
  nx: number;
  rawY: number;
  nz: number;
  crest: number;
  lowness: number;
}

/**
 * Evaluate the collapsed 3D shape for a flat RingGeometry point (x, z).
 * Strictly 2*PI periodic in atan2(z, x) so the -X seam closes seamlessly without steps or normal cracks.
 */
function sampleFold(x: number, z: number): FoldSample {
  const rad = Math.hypot(x, z);
  const th = Math.atan2(z, x);
  const t = clamp01((rad - CHUTE_INNER_R) / (CHUTE_OUTER_R - CHUTE_INNER_R));
  const collarSmooth = clamp01(t / 0.14);
  const nearPull = Math.pow(Math.max(0, Math.cos(th - NEAR_ANGLE)), 2.4);

  const lobe =
    (0.055 * Math.sin(th * 3 + 0.65) +
      0.038 * Math.sin(th * 5 - 1.1) +
      0.022 * Math.sin(th * 7 + 2.1)) *
    (0.2 + 0.8 * collarSmooth);
  const pleatPhase = th * 11 + 0.72 * Math.sin(th * 3 - 0.45) + rad * 0.16;
  const pleatWave = 0.5 + 0.5 * Math.cos(pleatPhase);
  const crest = Math.pow(pleatWave, 1.35);

  // Pull tucked valleys inward radially and gather the skirt edge slightly toward the backshell risers.
  const pinch = -0.048 * (1 - pleatWave) * (0.25 + 0.75 * t);
  const gather = -0.045 * nearPull * (0.2 + 0.8 * t);
  const rim = rad * (1 + lobe + pinch + gather);
  const scale = rim / Math.max(rad, 1e-6);
  const nx = scale * x;
  const nz = scale * z * CHUTE_SQUASH;

  // Macro billowing fabric pillows, raised central vent collar, and near-edge riser lift.
  const pillowWest = 0.48 * Math.exp(-(((x + 2.1) ** 2) / 9.5 + ((z - 0.5) ** 2) / 6.0));
  const pillowEast = 0.36 * Math.exp(-(((x - 2.3) ** 2) / 8.0 + ((z + 0.6) ** 2) / 5.2));
  const ventCollar = 0.3 * Math.exp(-((t / 0.24) ** 2));
  const skirtLift = 0.18 * nearPull * Math.exp(-(((t - 0.82) / 0.22) ** 2));

  // Asymmetric radial drapes + finer secondary crinkles + ring-band pillowing between hoop tapes.
  const fineRipple = 0.5 + 0.5 * Math.cos(th * 23 - rad * 0.34 + 1.1);
  const midBell = collarSmooth * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.9));
  const pleatH = (0.26 * crest + 0.055 * fineRipple) * midBell;
  const bandT = (rad % 2.1) / 2.1;
  const bandCushion = 0.052 * Math.sin(Math.PI * bandT) * (1 - 0.35 * t);

  const rawY = pillowWest + pillowEast + ventCollar + skirtLift + pleatH + bandCushion;
  const lowness = clamp01((1 - crest) * 0.65 + (1 - clamp01(rawY / 0.45)) * 0.35);
  return { nx, rawY, nz, crest, lowness };
}

// Compute the exact minimum rawY across the canonical canopy grid so canopySurfacePoint stays exact.
let cachedMinRawY: number | null = null;
function minGridRawY(): number {
  if (cachedMinRawY !== null) return cachedMinRawY;
  let min = Infinity;
  for (let j = 0; j <= CHUTE_PHI_SEGMENTS; j++) {
    const r = CHUTE_INNER_R + (j / CHUTE_PHI_SEGMENTS) * (CHUTE_OUTER_R - CHUTE_INNER_R);
    for (let k = 0; k <= CHUTE_THETA_SEGMENTS; k++) {
      const a = (k / CHUTE_THETA_SEGMENTS) * Math.PI * 2;
      min = Math.min(min, sampleFold(r * Math.cos(a), r * Math.sin(a)).rawY);
    }
  }
  cachedMinRawY = min;
  return min;
}

/** Canopy-local surface point at undeformed polar coordinates (rad, th), including the 3D fold height. */
export function canopySurfaceLocal(rad: number, th: number): Vector3 {
  const f = sampleFold(rad * Math.cos(th), rad * Math.sin(th));
  return new Vector3(f.nx, MIN_LOCAL_Y + (f.rawY - minGridRawY()), f.nz);
}

interface GoreTextures {
  map: CanvasTexture;
  normalMap: CanvasTexture;
  roughnessMap: CanvasTexture;
}

let cachedTextures: GoreTextures | null = null;

function toCanvasTexture(canvas: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Shared 1024 px procedural textile maps: crisp 80-gore binary stripes, radial & circumferential Kevlar
 * reinforcement tapes, crevice AO + settled Martian dust, tangent normal relief, and roughness variation.
 */
function goreMaps(orange: Color, white: Color): GoreTextures | null {
  if (cachedTextures) return cachedTextures;
  if (typeof document === 'undefined') return null;

  const N = 1024;
  const albedoCanvas = document.createElement('canvas');
  const normalCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  albedoCanvas.width = albedoCanvas.height = N;
  normalCanvas.width = normalCanvas.height = N;
  roughCanvas.width = roughCanvas.height = N;

  const aCtx = albedoCanvas.getContext('2d');
  const nCtx = normalCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  if (!aCtx || !nCtx || !rCtx) return null;

  const aImg = aCtx.createImageData(N, N);
  const nImg = nCtx.createImageData(N, N);
  const rImg = rCtx.createImageData(N, N);
  const height = new Float32Array(N * N);

  const rgb = (c: Color): [number, number, number] => [
    (c.getHex() >> 16) & 255,
    (c.getHex() >> 8) & 255,
    c.getHex() & 255,
  ];
  const [or, og, ob] = rgb(orange);
  const [wr, wg, wb] = rgb(white);
  const [dr, dg, db] = rgb(DUST);
  // Warm khaki webbing colour for radial gore tapes and concentric Disk-Gap-Band reinforcement straps.
  const [tr, tg, tb] = [212, 198, 174];

  const bandRings = [0.58, 2.1, 4.2, 6.3, 7.91];
  for (let r = 0; r < N; r++) {
    const yRing = (2 * (1 - (r + 0.5) / N) - 1) * CHUTE_OUTER_R;
    for (let c = 0; c < N; c++) {
      const x = (2 * ((c + 0.5) / N) - 1) * CHUTE_OUTER_R;
      const z = -yRing;
      const rad = Math.hypot(x, z);
      const idx = r * N + c;
      const p4 = idx * 4;

      if (rad < CHUTE_INNER_R * 0.9 || rad > CHUTE_OUTER_R * 1.04) {
        height[idx] = 0;
        aImg.data[p4] = wr;
        aImg.data[p4 + 1] = wg;
        aImg.data[p4 + 2] = wb;
        aImg.data[p4 + 3] = 255;
        rImg.data[p4] = rImg.data[p4 + 1] = rImg.data[p4 + 2] = 224;
        rImg.data[p4 + 3] = 255;
        continue;
      }

      const th = Math.atan2(z, x);
      const goreF = ((th + Math.PI) / (Math.PI * 2)) * 80;
      const gore = Math.floor(goreF) % 80;
      const band = Math.min(3, Math.floor(rad / 2.1));
      const isOrange = (gore * 7 + band * 3) % 5 < 2;

      let cr = isOrange ? or : wr;
      let cg = isOrange ? og : wg;
      let cb = isOrange ? ob : wb;

      // Radial load-tape seams along gore boundaries (~2.8 cm world width) & circumferential hoop bands.
      const seamDistArc = Math.min(goreF - Math.floor(goreF), 1 - (goreF - Math.floor(goreF))) * ((Math.PI * 2 * Math.max(rad, 0.5)) / 80);
      const radialTape = Math.max(0, 1 - seamDistArc / 0.022);
      let ringTape = 0;
      for (const br of bandRings) {
        const d = Math.abs(rad - br);
        if (d < 0.048) ringTape = Math.max(ringTape, 1 - d / 0.048);
      }
      const tape = Math.max(radialTape * 0.72, ringTape * 0.85);

      // Meso fabric wrinkles & fine ripstop nylon weave.
      const fold = sampleFold(x, z);
      const crinkle =
        0.5 +
        0.28 * Math.sin(th * 80 * 1.5 + rad * 3.8) +
        0.22 * Math.cos(th * 43 - rad * 5.2 + 0.7);
      const weave = Math.sin(x * 78) * Math.sin(z * 78);

      height[idx] = tape * 0.65 + (crinkle - 0.5) * 0.45 + weave * 0.08;

      // Crevice AO + windblown dust near fold valleys and outer dusty skirt edge.
      const t = clamp01((rad - CHUTE_INNER_R) / (CHUTE_OUTER_R - CHUTE_INNER_R));
      const edgeDust = Math.pow(t, 3.2) * 0.28;
      const valleyDust = clamp01(fold.lowness * 0.24 + edgeDust);
      const ao = 1 - fold.lowness * 0.24 - radialTape * 0.14 * (1 - radialTape) - weave * 0.022;

      cr = cr * (1 - tape * 0.58) + tr * (tape * 0.58);
      cg = cg * (1 - tape * 0.58) + tg * (tape * 0.58);
      cb = cb * (1 - tape * 0.58) + tb * (tape * 0.58);

      cr = (cr * (1 - valleyDust) + dr * valleyDust) * ao;
      cg = (cg * (1 - valleyDust) + dg * valleyDust) * ao;
      cb = (cb * (1 - valleyDust) + db * valleyDust) * ao;

      aImg.data[p4] = Math.max(0, Math.min(255, Math.round(cr)));
      aImg.data[p4 + 1] = Math.max(0, Math.min(255, Math.round(cg)));
      aImg.data[p4 + 2] = Math.max(0, Math.min(255, Math.round(cb)));
      aImg.data[p4 + 3] = 255;

      // Clean puffed nylon (~0.68) vs matte Kevlar tape (~0.85) vs dusty fold crevices (~0.95).
      const rough = clamp01(0.68 + tape * 0.16 + fold.lowness * 0.18 + edgeDust * 0.35 + weave * 0.02);
      const rByte = Math.round(rough * 255);
      rImg.data[p4] = rImg.data[p4 + 1] = rImg.data[p4 + 2] = rByte;
      rImg.data[p4 + 3] = 255;
    }
  }

  // Second pass: central differences on the cloth height map for crisp tangent-space normals.
  const slope = 2.4;
  for (let r = 0; r < N; r++) {
    const rm = r > 0 ? r - 1 : r;
    const rp = r < N - 1 ? r + 1 : r;
    for (let c = 0; c < N; c++) {
      const cm = c > 0 ? c - 1 : c;
      const cp = c < N - 1 ? c + 1 : c;
      const dHdu = (height[r * N + cp] - height[r * N + cm]) * slope;
      const dHdv = (height[rm * N + c] - height[rp * N + c]) * slope;
      let nx = -dHdu;
      let ny = -dHdv;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const p4 = (r * N + c) * 4;
      nImg.data[p4] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[p4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[p4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nImg.data[p4 + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  cachedTextures = {
    map: toCanvasTexture(albedoCanvas, true),
    normalMap: toCanvasTexture(normalCanvas, false),
    roughnessMap: toCanvasTexture(roughCanvas, false),
  };
  return cachedTextures;
}

/**
 * Single merged 3D tubular mesh for the Kevlar risers & suspension cords leading from the backshell
 * swivel to the actual lifted near skirt vertices of the folded canopy.
 */
function buildSuspensionLines(chute: Mesh): Mesh {
  chute.updateMatrix();
  const posAttr = chute.geometry.getAttribute('position');
  const outerRingOffset = CHUTE_PHI_SEGMENTS * (CHUTE_THETA_SEGMENTS + 1);
  const worldToCanopyDir = new Vector3(-PARACHUTE_AT[0], 0, -PARACHUTE_AT[2]).normalize();
  const candidates: { idx: number; dot: number; angle: number; worldPt: Vector3 }[] = [];
  const p = new Vector3();

  for (let k = 0; k < CHUTE_THETA_SEGMENTS; k++) {
    const idx = outerRingOffset + k;
    p.fromBufferAttribute(posAttr, idx).applyMatrix4(chute.matrix);
    const toPt = new Vector3(p.x - PARACHUTE_AT[0], 0, p.z - PARACHUTE_AT[2]).normalize();
    const dot = toPt.dot(worldToCanopyDir);
    if (dot > 0.62) {
      candidates.push({ idx, dot, angle: Math.atan2(toPt.z, toPt.x), worldPt: p.clone() });
    }
  }
  candidates.sort((a, b) => a.angle - b.angle);

  const lineCount = 16;
  const targets: Vector3[] = [];
  for (let i = 0; i < lineCount; i++) {
    const pick = Math.round((i / (lineCount - 1)) * (candidates.length - 1));
    targets.push(candidates[pick].worldPt);
  }

  const segs = 6;
  const sides = 4; // diamond cross-section stays lightweight in USDZ while casting clean 3D shadows
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const tangent = new Vector3();
  const sideA = new Vector3();
  const sideB = new Vector3();
  const up = new Vector3(0, 1, 0);
  const altUp = new Vector3(1, 0, 0);

  for (let li = 0; li < targets.length; li++) {
    const end = targets[li];
    const spread = li / (targets.length - 1) - 0.5;
    const midStart = BRIDLE_SPLIT.clone().add(new Vector3(spread * 0.14, 0, Math.abs(spread) * 0.06));

    // Clear the backshell top rim first, then drape cleanly toward the sand before rising to the skirt.
    const curvePts: Vector3[] = [];
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const pt = new Vector3();
      if (u <= 0.22) {
        const k = u / 0.22;
        pt.lerpVectors(SWIVEL_AT, midStart, k);
      } else {
        const k = (u - 0.22) / 0.78;
        pt.lerpVectors(midStart, end, k);
        // Smooth sag onto the ground partway between backshell and canopy edge.
        const sag = Math.sin(k * Math.PI) * 0.52;
        pt.y = Math.max(0.018, pt.y - sag);
      }
      curvePts.push(pt);
    }

    const baseVert = positions.length / 3;
    for (let s = 0; s <= segs; s++) {
      const prev = curvePts[Math.max(0, s - 1)];
      const next = curvePts[Math.min(segs, s + 1)];
      tangent.subVectors(next, prev).normalize();
      sideA.crossVectors(tangent, Math.abs(tangent.y) > 0.92 ? altUp : up).normalize();
      sideB.crossVectors(tangent, sideA).normalize();
      const radius = s <= 1 ? 0.014 : 0.0095;

      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const nx = sideA.x * ca + sideB.x * sa;
        const ny = sideA.y * ca + sideB.y * sa;
        const nz = sideA.z * ca + sideB.z * sa;
        positions.push(curvePts[s].x + nx * radius, curvePts[s].y + ny * radius, curvePts[s].z + nz * radius);
        normals.push(nx, ny, nz);
      }
    }

    for (let s = 0; s < segs; s++) {
      const row0 = baseVert + s * sides;
      const row1 = row0 + sides;
      for (let k = 0; k < sides; k++) {
        const kNext = (k + 1) % sides;
        indices.push(row0 + k, row1 + k, row1 + kNext);
        indices.push(row0 + k, row1 + kNext, row0 + kNext);
      }
    }
  }

  const lg = new BufferGeometry();
  lg.setAttribute('position', new Float32BufferAttribute(positions, 3));
  lg.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  lg.setIndex(indices);

  const linesMesh = new Mesh(
    lg,
    new MeshStandardMaterial({ color: '#cbc0aa', roughness: 0.85, metalness: 0.04 }),
  );
  linesMesh.name = 'parachute-lines';
  linesMesh.castShadow = true;
  linesMesh.receiveShadow = true;
  return linesMesh;
}

/**
 * Stable canopy and suspension cords, mounted outside the GLB's Suspense boundary so decode never
 * loses its shared vertex buffers when the detailed backshell replaces the loading silhouette.
 */
export function buildParachute(): Group {
  const g = new Group();
  g.name = 'parachute-rig';

  const geom = new RingGeometry(CHUTE_INNER_R, CHUTE_OUTER_R, CHUTE_THETA_SEGMENTS, CHUTE_PHI_SEGMENTS).rotateX(-Math.PI / 2);
  const p = geom.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const orange = new Color('#c9562d').lerp(DUST, 0.3);
  const white = new Color('#e6dfd2').lerp(DUST, 0.3);
  const folds: FoldSample[] = new Array(p.count);
  let minRawY = Infinity;

  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const f = sampleFold(x, z);
    folds[i] = f;
    if (f.rawY < minRawY) minRawY = f.rawY;

    const rad = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    const gore = Math.floor(((th + Math.PI) / (Math.PI * 2)) * 80);
    const band = Math.min(3, Math.floor(rad / 2.1));
    const c = (gore * 7 + band * 3) % 5 < 2 ? orange : white;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  for (let i = 0; i < p.count; i++) {
    const f = folds[i];
    p.setXYZ(i, f.nx, MIN_LOCAL_Y + (f.rawY - minRawY), f.nz);
  }
  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  const textures = goreMaps(orange, white);
  const chute = new Mesh(
    geom,
    new MeshStandardMaterial({
      map: textures?.map ?? null,
      normalMap: textures?.normalMap ?? null,
      normalScale: new Vector2(0.85, 0.85),
      roughnessMap: textures?.roughnessMap ?? null,
      roughness: textures ? 1.0 : 0.9,
      metalness: 0,
      vertexColors: textures === null,
      side: DoubleSide,
    }),
  );
  chute.name = 'parachute';
  chute.position.set(...PARACHUTE_AT);
  chute.rotation.y = CHUTE_YAW;
  chute.receiveShadow = true;
  chute.castShadow = true;
  registerCanopyContacts(chute);
  g.add(chute);
  g.add(buildSuspensionLines(chute));

  return g;
}
