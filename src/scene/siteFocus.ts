// Pure maths for the site camera's close-ups and the scout camera (no three.js). Everything is in
// the diorama's own metres: y up, the machine near the origin. Unit-tested.

import type { Vec3 } from './layout';

/** Camera elevation above the part for a close-up, radians. */
export const CLOSE_UP_ELEV = 0.48;
/** Close-up distance range, m. */
export const CLOSE_UP_MIN_M = 1.5;
export const CLOSE_UP_MAX_M = 3;
/** The camera never goes lower than this above the ground, m. */
export const CAMERA_CLEARANCE_M = 0.35;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** How far the close-up camera stands from a part, m: further for a bigger machine. */
export function closeUpDistance(machineRadiusM: number): number {
  return clamp(0.5 * machineRadiusM + 0.9, CLOSE_UP_MIN_M, CLOSE_UP_MAX_M);
}

/** Ingenuity joins the close-up's framing as it comes within PAIR_FAR_M of the part, fully by PAIR_NEAR_M. */
export const PAIR_NEAR_M = 1.8;
export const PAIR_FAR_M = 3.2;

/** How much the close-up frames Ingenuity with the part (0..1, smooth), from the gap between them, m. */
export function pairWeight(gap: number): number {
  const t = clamp((PAIR_FAR_M - gap) / (PAIR_FAR_M - PAIR_NEAR_M), 0, 1);
  return t * t * (3 - 2 * t);
}

const flat = (x: number, z: number): [number, number] => {
  const l = Math.hypot(x, z);
  return l > 1e-6 ? [x / l, z / l] : [0, 0];
};

/**
 * Which way (horizontal unit vector, from the middle of the pair toward the camera) to look at a
 * part and Ingenuity hovering beside it so that both show side by side: square to the line between
 * them, never along it (Ingenuity would hide the part, or fill the frame), on the side the camera
 * is on now (`from`) unless that side faces into the machine (`centre`), leaning a little outward.
 */
export function pairView(part: Vec3, flyer: Vec3, centre: Vec3, from: Vec3): [number, number] {
  const mid: Vec3 = [(part[0] + flyer[0]) / 2, 0, (part[2] + flyer[2]) / 2];
  const axis = flat(flyer[0] - part[0], flyer[2] - part[2]);
  const out = flat(mid[0] - centre[0], mid[2] - centre[2]);
  const toCam = flat(from[0] - mid[0], from[2] - mid[2]);
  if (axis[0] === 0 && axis[1] === 0) return toCam[0] || toCam[1] ? toCam : out[0] || out[1] ? out : [0, 1];
  const n: [number, number] = [-axis[1], axis[0]];
  const score = (s: number) => s * (n[0] * toCam[0] + n[1] * toCam[1]) + 0.8 * s * (n[0] * out[0] + n[1] * out[1]);
  const s = score(1) >= score(-1) ? 1 : -1;
  return flat(s * n[0] + 0.25 * out[0], s * n[1] + 0.25 * out[1]);
}

/**
 * A close-up of `part`: the camera `dist` m away, raised by CLOSE_UP_ELEV, on the outside of the
 * machine (away from `centre`) and leaning toward the side the camera is on now (`from`), so the
 * move in is short and does not swing round through the machine; or from the given `side`
 * (horizontal, toward the camera). Never below `minY`.
 */
export function closeUpPose(
  part: Vec3,
  centre: Vec3,
  from: Vec3,
  dist: number,
  minY: number,
  side: [number, number] | null = null,
): { position: Vec3; target: Vec3 } {
  const out = flat(part[0] - centre[0], part[2] - centre[2]);
  const toCam = flat(from[0] - part[0], from[2] - part[2]);
  let dx = side ? side[0] : 0.6 * out[0] + toCam[0];
  let dz = side ? side[1] : 0.6 * out[1] + toCam[1];
  let l = Math.hypot(dx, dz);
  if (l < 1e-6) {
    // Straight above, or exactly opposite: any side will do.
    dx = toCam[0] || out[0] || 0;
    dz = toCam[1] || out[1] || 1;
    l = Math.hypot(dx, dz) || 1;
  }
  dx /= l;
  dz /= l;
  const h = Math.cos(CLOSE_UP_ELEV) * dist;
  const y = Math.max(part[1] + Math.sin(CLOSE_UP_ELEV) * dist, minY);
  return { position: [part[0] + dx * h, y, part[2] + dz * h], target: [part[0], part[1], part[2]] };
}

/** The scout camera's viewfinder, centred on the screen, as fractions of its width and height. */
export const VIEWFINDER_W = 0.46;
export const VIEWFINDER_H = 0.54;

/** A candidate for the scout camera: an id and its position in normalised device coordinates. */
export interface ScreenPoint {
  id: string;
  /** −1..1 left to right. */
  x: number;
  /** −1..1 bottom to top. */
  y: number;
  /** −1..1 near to far; outside that the point is behind the camera or beyond the far plane. */
  z: number;
}

/**
 * The scout camera's target: the point inside the viewfinder (|x| ≤ halfX, |y| ≤ halfY, in front
 * of the camera) nearest its centre, measured in screen proportions (`aspect` = width / height).
 */
export function pickTarget(points: ScreenPoint[], halfX: number, halfY: number, aspect: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const p of points) {
    if (!(p.z > -1 && p.z < 1)) continue;
    if (Math.abs(p.x) > halfX || Math.abs(p.y) > halfY) continue;
    const d = Math.hypot(p.x * aspect, p.y);
    if (d < bestD) {
      bestD = d;
      best = p.id;
    }
  }
  return best;
}
