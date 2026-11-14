// Scene layout constants and pure framing maths (no three.js objects, unit-tested).

import { DEG } from '../geo';

export type Vec3 = [number, number, number];

export const MOON_R = 1;
export const MARS_R = 0.9;
export const MOON_POS: Vec3 = [-2.4, 0, 0];
export const MARS_POS: Vec3 = [2.4, 0, 0];
/** The deep-space schematic floats far below the globes so the two never share a frame. */
export const DEEP_POS: Vec3 = [0, -60, 0];

/**
 * Globe yaw so a chosen longitude faces the overview camera (+Z).
 * latLonToVec3 puts lon L at (cos L, 0, −sin L); after a Y rotation θ it lands on +Z when θ = −π/2 − L.
 */
export function yawFacing(lonDeg: number): number {
  return -Math.PI / 2 - lonDeg * DEG;
}
/** Moon: near side (lon 0, the hemisphere that faces Earth) toward the camera. */
export const MOON_YAW = yawFacing(0);
/** Mars: centred on lon 20°E, between Meridiani (Opportunity) and Syrtis/Isidis (Ingenuity side). */
export const MARS_YAW = yawFacing(20);

/** Marker altitude above the surface, as a fraction of the radius. */
export const MARKER_LIFT = 1.008;

/**
 * Deep-space radial compression: r_scene = 2.2 · sqrt(r_AU).
 * Keeps Earth (2.2), Mars (2.7), Eros (≈2.66) and Ceres (≈3.66) readable on one screen.
 */
export function auToScene(au: number): number {
  return 2.2 * Math.sqrt(Math.max(0, au));
}
/** Where the outbound probes' arrows sit (the edge of the schematic), scene units. */
export const DEEP_EDGE = auToScene(11);

/**
 * Ecliptic (x, y in AU, J2000) → schematic XZ plane with radial compression.
 * Ecliptic +y maps to scene −Z, so motion seen from ecliptic north stays counter-clockwise
 * from the deep-view camera above. The schematic is flattened onto the ecliptic.
 */
export function eclipticToScene(x: number, y: number): Vec3 {
  const r = Math.hypot(x, y);
  if (r === 0) return [0, 0, 0];
  const s = auToScene(r) / r;
  return [x * s, 0, -y * s];
}

export function eclipticLonToScene(lonDeg: number, au: number): Vec3 {
  return eclipticToScene(au * Math.cos(lonDeg * DEG), au * Math.sin(lonDeg * DEG));
}

/** Fractional year → Date (UTC). */
export function yearToDate(year: number): Date {
  const y = Math.floor(year);
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return new Date(start + (year - y) * (end - start));
}

/**
 * Time-lapse lighting. Driving the shader with the true date would strobe: 60 years in ~20 s
 * is ~35 lunations and ~1000 Mars sols per second. Instead the light sweeps slowly
 * (6° of sub-solar longitude per simulated year) and lands exactly on the real present lighting.
 */
export function timelapseSunOffsetDeg(timelapseYear: number, nowYear: number): number {
  const remaining = nowYear - timelapseYear;
  return remaining <= 0 ? 0 : remaining * 6;
}

export interface FramingInput {
  /** World-space centre of the subject. */
  center: Vec3;
  /** Unit vector from the centre toward the camera. */
  dir: Vec3;
  /** Subject half-width and half-height (radius for a globe). */
  radius?: number;
  halfWidth?: number;
  halfHeight?: number;
  aspect: number;
  fovDeg: number;
  /** Landscape only: where the subject's centre sits, as a fraction of the width from the left. Default 0.31 (clear of the console). */
  anchorX?: number;
  /** Landscape only: where the subject's centre sits, as a fraction of the height from the top. Default 0.5. */
  anchorY?: number;
  /** Landscape only: share of the screen width the subject may fill. Default 0.62. */
  fillWidth?: number;
}

export interface CameraGoal {
  position: Vec3;
  target: Vec3;
  distance: number;
}

/** Above this aspect the console covers the right ~38 % of the screen; below it, the bottom ~55 %. */
export const LANDSCAPE_ASPECT = 1.1;

/**
 * Camera distance and an off-centre target so the subject sits ~31 % from the left on wide
 * screens (clear of the console on the right) or in the top 45 % on portrait screens.
 */
export function cameraGoal(input: FramingInput): CameraGoal {
  const hx = input.halfWidth ?? input.radius ?? 1;
  const hy = input.halfHeight ?? input.radius ?? 1;
  const t = Math.tan((input.fovDeg * DEG) / 2);
  const aspect = Math.max(0.2, input.aspect);
  const landscape = aspect > LANDSCAPE_ASPECT;

  const anchorX = input.anchorX ?? 0.31;
  const anchorY = input.anchorY ?? 0.5;
  const fillWidth = input.fillWidth ?? 0.62;

  let d: number;
  if (landscape) {
    // Fit in fillWidth of the width (75 % fill) and ~72 % of the height.
    d = Math.max((2 * hx) / (0.75 * fillWidth * 2 * t * aspect), (2 * hy) / (0.72 * 2 * t));
  } else {
    // Fit in 85 % of the width and 85 % of the top 45 % of the height.
    d = Math.max((2 * hx) / (0.85 * 2 * t * aspect), (2 * hy) / (0.85 * 0.45 * 2 * t));
  }
  d = Math.max(d, 3.2 * Math.min(hx, hy));

  const [dx, dy, dz] = input.dir;
  const [cx, cy, cz] = input.center;
  // Camera basis: forward f = −dir, right = f × worldUp, up = right × f.
  const fx = -dx, fy = -dy, fz = -dz;
  let rx = -fz, ry = 0, rz = fx; // f × (0,1,0)
  let rl = Math.hypot(rx, ry, rz);
  if (rl < 1e-6) {
    rx = 1; ry = 0; rz = 0; rl = 1;
  }
  rx /= rl; ry /= rl; rz /= rl;
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  const W = 2 * d * t * aspect;
  const H = 2 * d * t;
  let sx = 0, sy = 0, sz = 0;
  if (landscape) {
    const k = (0.5 - anchorX) * W; // subject anchorX from the left (default 31 %)
    const v = (anchorY - 0.5) * H; // and anchorY from the top (default centred)
    sx = rx * k + ux * v; sy = ry * k + uy * v; sz = rz * k + uz * v;
  } else {
    const k = -0.275 * H; // subject centred in the top 45 %
    sx = ux * k; sy = uy * k; sz = uz * k;
  }
  const target: Vec3 = [cx + sx, cy + sy, cz + sz];
  const position: Vec3 = [cx + dx * d + sx, cy + dy * d + sy, cz + dz * d + sz];
  return { position, target, distance: d };
}

/** Keep the camera off the poles so OrbitControls never flips. */
export function clampPolar(dir: Vec3, maxY = 0.82): Vec3 {
  let [x, y, z] = dir;
  const l = Math.hypot(x, y, z) || 1;
  x /= l; y /= l; z /= l;
  if (Math.abs(y) <= maxY) return [x, y, z];
  const ny = Math.sign(y) * maxY;
  const h = Math.hypot(x, z);
  const s = Math.sqrt(1 - ny * ny);
  if (h < 1e-6) return [0, ny, s];
  return [(x / h) * s, ny, (z / h) * s];
}
