// Scene layout constants and pure maths: camera framing, Flight 73's arcs over the globe, the
// chase camera, and directions inside a site diorama. No three.js objects, so it is unit-tested.

import { MACHINE_BY_ID } from '../data/machines';
import { HOME, interpolate, type Leg } from '../flight/route';
import { DEG, latLonToVec3 } from '../geo';

export type Vec3 = [number, number, number];

/** Mars is the only globe: radius 1, at the origin. */
export const GLOBE_R = 1;

/**
 * Globe yaw so a chosen longitude faces the camera (+Z).
 * latLonToVec3 puts lon L at (cos L, 0, −sin L); after a Y rotation θ it lands on +Z when θ = −π/2 − L.
 */
export function yawFacing(lonDeg: number): number {
  return -Math.PI / 2 - lonDeg * DEG;
}
/** Start with Jezero, Ingenuity's home, toward the camera. */
export const HOME_YAW = yawFacing(MACHINE_BY_ID[HOME].lon);

/** Marker altitude above the surface, as a fraction of the radius. */
export const MARKER_LIFT = 1.008;
/** Route arcs start and end just above the surface, under the markers. */
export const ROUTE_BASE = 1.004;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (k: number) => {
  const t = clamp01(k);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
};

// ---------------------------------------------------------------- route arcs

/**
 * Peak height of a leg's arc above the surface, as a fraction of the radius: 0.06 for a 300 km
 * hop, rising to 0.22 for a flight half-way round the planet. Shorter hops barely lift.
 */
export function arcPeak(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  if (distanceKm < 300) return 0.06 * Math.sqrt(distanceKm / 300);
  return 0.06 + 0.16 * Math.min(1, (distanceKm - 300) / 8700);
}

/** Height above the surface at fraction t of a leg (fraction of the radius): zero at both ends. */
export function arcAltitude(t: number, distanceKm: number): number {
  return arcPeak(distanceKm) * Math.sin(Math.PI * clamp01(t));
}

export type LegLike = Pick<Leg, 'from' | 'to' | 'distanceKm'>;

/** Point a fraction t along a leg's lifted arc, in the globe's local coordinates. */
export function legPoint(leg: LegLike, t: number): Vec3 {
  const p = interpolate(MACHINE_BY_ID[leg.from], MACHINE_BY_ID[leg.to], clamp01(t));
  return latLonToVec3(p.lat, p.lon, GLOBE_R * (ROUTE_BASE + arcAltitude(t, leg.distanceKm)));
}

/** Polyline for a leg's arc: segments + 1 points, flattened xyz. */
export function legPolyline(leg: LegLike, segments: number): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const [x, y, z] = legPoint(leg, i / segments);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

/** Enough segments that long arcs stay smooth; short hops need few. */
export function legSegments(distanceKm: number): number {
  return Math.round(Math.min(160, Math.max(12, distanceKm / 60)));
}

/**
 * Fraction of the leg flown `elapsedMs` into a flight of `flyMs`: the same clock
 * (flight.stageStartedAt) and the same ease-in-out as the console's odometer, so the 3D flyer and
 * the odometer finish at the same instant.
 */
export function flightProgress(elapsedMs: number, flyMs: number): number {
  if (flyMs <= 0) return 1;
  return easeInOut(elapsedMs / flyMs);
}

/** The climb out of the previous site at the start of a leg, ms. */
export function climbMs(flyMs: number): number {
  return Math.min(1600, Math.max(900, flyMs * 0.2));
}
/** The dive into the next site at the end of a leg (about the last 15 %), ms. */
export function descentMs(flyMs: number): number {
  return Math.min(1400, Math.max(900, flyMs * 0.15));
}

// ---------------------------------------------------------------- sites on the globe

/**
 * Site dioramas sit on the globe at their stop, built in metres and scaled by this many globe
 * units per metre (radius 1 = 4 km: the ground patch is exaggerated about 850×, so the camera
 * can dive from orbit to a machine in one continuous move).
 */
export const SITE_SCALE = 1 / 4000;

export interface SiteFrame {
  /** Surface point, globe-local. */
  origin: Vec3;
  /** Diorama axes in globe-local space: x = east, y = up, z = south. */
  east: Vec3;
  up: Vec3;
  south: Vec3;
}

/** The local frame on the surface at a latitude / longitude (globe-local, radius GLOBE_R). */
export function siteFrame(latDeg: number, lonDeg: number): SiteFrame {
  const up = latLonToVec3(latDeg, lonDeg);
  const lo = lonDeg * DEG;
  // d/dlon of latLonToVec3 is along (−sin lon, 0, −cos lon): east.
  const east: Vec3 = [-Math.sin(lo), 0, -Math.cos(lo)];
  const north = cross(up, east);
  return { origin: scale(up, GLOBE_R), east, up, south: scale(north, -1) };
}

// ---------------------------------------------------------------- real-size models

/** A machine's real size, m: the widest horizontal extent and / or the height. */
export interface RealSize {
  span?: number;
  height?: number;
}

/** Uniform scale that brings a model's bounding box to a real size (the mean of the given ratios). */
export function realSizeScale(box: { x: number; y: number; z: number }, size: RealSize): number {
  const ratios: number[] = [];
  const span = Math.max(box.x, box.z);
  if (size.span && span > 0) ratios.push(size.span / span);
  if (size.height && box.y > 0) ratios.push(size.height / box.y);
  return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
}

// ---------------------------------------------------------------- small vector helpers

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l < 1e-12 ? [0, 1, 0] : [a[0] / l, a[1] / l, a[2] / l];
}

// ---------------------------------------------------------------- framing

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
  /** Landscape only: share of the screen height the subject may fill. Default 0.72. */
  fillHeight?: number;
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
  const fillHeight = input.fillHeight ?? 0.72;

  let d: number;
  if (landscape) {
    // Fit in fillWidth of the width (75 % fill) and fillHeight of the height.
    d = Math.max((2 * hx) / (0.75 * fillWidth * 2 * t * aspect), (2 * hy) / (fillHeight * 2 * t));
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

/** Camera directions (from the globe's centre) for the title and the flight log. */
export const TITLE_DIR: Vec3 = clampPolar([0, 0.22, 1]);
export const REPORT_DIR: Vec3 = clampPolar([0.12, 0.3, 1]);

/**
 * Globe yaw (rotation about +Y, the spin axis) that puts the real Sun `offsetDeg` to one side of
 * the camera, so a globe shot shows mostly day side with the terminator in view. The lighting
 * stays real (the Sun is fixed to the globe at the true sub-solar point); only the view turns.
 * Negative offsets put the Sun on the camera's left.
 */
export function litYaw(sunBody: Vec3, cameraDir: Vec3, offsetDeg: number): number {
  const bodyAz = Math.atan2(sunBody[0], sunBody[2]);
  const camAz = Math.atan2(cameraDir[0], cameraDir[2]);
  return camAz + offsetDeg * DEG - bodyAz;
}

/** Title view: the Sun's preferred place relative to the camera, degrees (negative = left). */
export const TITLE_SUN_DEG = -50;
/** …and how far from the camera the Sun may go (either side) to bring Flight 73's start into view. */
export const TITLE_SUN_MAX_DEG = 75;

/**
 * Title view: where the Sun sits relative to the camera, degrees (negative = to the left), for
 * litYaw. The preferred view shows the day side with the Sun on the left. If Flight 73's start
 * (Ingenuity's spot, `start`) would then be more than 55° from the centre, the view turns toward it,
 * keeping the Sun 50–75° to either side, so the start shows (by day, or on the night side near the
 * terminator) whenever it can. When it cannot be shown (around its local midnight), the preferred
 * view stays.
 */
export function titleSunOffsetDeg(sunBody: Vec3, start: Vec3): number {
  // Azimuth of the start east of the Sun, degrees; a point at that azimuth sits at offset + h from
  // the camera once litYaw has turned the globe.
  const h = angleDelta(Math.atan2(sunBody[0], sunBody[2]), Math.atan2(start[0], start[2])) / DEG;
  const fromCentre = (off: number) => Math.abs(angleDelta(0, (off + h) * DEG)) / DEG;
  if (fromCentre(TITLE_SUN_DEG) <= 55) return TITLE_SUN_DEG;
  const lo = 50, hi = TITLE_SUN_MAX_DEG;
  const left = -Math.min(hi, Math.max(lo, h));
  const right = Math.min(hi, Math.max(lo, -h));
  const best = fromCentre(left) <= fromCentre(right) ? left : right;
  return fromCentre(best) <= 70 ? best : TITLE_SUN_DEG;
}

/** Shortest signed angle from a to b, radians, in (−π, π]. */
export function angleDelta(a: number, b: number): number {
  const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return d === -Math.PI ? Math.PI : d;
}

// ---------------------------------------------------------------- chase camera

export interface ChaseInput {
  /** Ingenuity's world position. */
  pos: Vec3;
  /** Unit outward normal under Ingenuity (local "up"). */
  up: Vec3;
  /** Unit direction of travel, tangent to the surface. */
  forward: Vec3;
  /** Current height above the surface, fraction of the radius. */
  alt: number;
  aspect: number;
  fovDeg: number;
}

export interface ChaseGoal {
  position: Vec3;
  target: Vec3;
  /** Camera up vector, so the horizon stays level. */
  up: Vec3;
}

/**
 * Full-screen HUD (Version 3): a top bar (~90 px) and a dock along the bottom (~28 % of the
 * height). Subjects sit centred left to right and a little above the middle, in the clear band.
 */
export const HUD_ANCHOR_Y = 0.42;
/** Share of the height a framed subject may fill, so it stays between the top bar and the dock. */
export const HUD_FILL_HEIGHT = 0.58;

/**
 * Chase view: behind and above Ingenuity. Low down it looks almost level, so the limb of Mars
 * crosses the frame; higher up it pulls back and looks down more steeply, keeping the planet in
 * view. Ingenuity sits centred left to right and a little above the middle (HUD_ANCHOR_Y) on
 * wide screens, or in the top 45 % on portrait ones.
 */
export function chaseGoal(i: ChaseInput): ChaseGoal {
  const k = clamp01(i.alt / 0.22);
  const d = 0.26 * (1 + 6 * Math.max(0, i.alt));
  const pitch = (25 + 40 * k) * DEG;
  const position = add(add(i.pos, scale(i.forward, -d * Math.cos(pitch))), scale(i.up, d * Math.sin(pitch)));

  const view = normalize(sub(i.pos, position));
  const camUp = normalize(sub(i.up, scale(view, dot(i.up, view))));
  const t = Math.tan((i.fovDeg * DEG) / 2);
  const aspect = Math.max(0.2, i.aspect);
  const H = 2 * d * t;
  const offset = aspect > LANDSCAPE_ASPECT ? scale(camUp, -(0.5 - HUD_ANCHOR_Y) * H) : scale(camUp, -0.275 * H);
  return { position, target: add(i.pos, offset), up: i.up };
}

// ---------------------------------------------------------------- visitor's orbit at a site

/** Lowest and highest camera elevation above a site's ground while the visitor orbits, degrees. */
export const ORBIT_MIN_ELEV = 4;
export const ORBIT_MAX_ELEV = 65;
export const ORBIT_ZOOM: [number, number] = [0.35, 1.8];

/**
 * A site camera offset (camera − target) turned by the visitor's orbit: `az` radians about `up`,
 * `el` radians added to its elevation (the result clamped to ORBIT_MIN_ELEV..ORBIT_MAX_ELEV), and
 * its length times `zoom` (clamped to ORBIT_ZOOM).
 */
export function orbitOffset(offset: Vec3, up: Vec3, az: number, el: number, zoom: number): Vec3 {
  const len = Math.hypot(offset[0], offset[1], offset[2]);
  if (len < 1e-12) return offset;
  const u = normalize(up);
  const dir = scale(offset, 1 / len);
  const e0 = Math.asin(Math.max(-1, Math.min(1, dot(dir, u))));
  let h = sub(dir, scale(u, dot(dir, u)));
  if (Math.hypot(h[0], h[1], h[2]) < 1e-9) h = normalize(cross(u, Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]));
  else h = normalize(h);
  // Rodrigues' rotation of the horizontal direction about up (u ⟂ h, so the u(u·h) term is zero).
  const c = Math.cos(az);
  const sn = Math.sin(az);
  const hr = add(scale(h, c), scale(cross(u, h), sn));
  const e = Math.min(ORBIT_MAX_ELEV * DEG, Math.max(ORBIT_MIN_ELEV * DEG, e0 + el));
  const z = Math.min(ORBIT_ZOOM[1], Math.max(ORBIT_ZOOM[0], zoom));
  return scale(add(scale(hr, Math.cos(e)), scale(u, Math.sin(e))), len * z);
}

// ---------------------------------------------------------------- navigation camera

/**
 * Ingenuity's downward navigation camera while flying: just below the helicopter, looking straight
 * down at the ground, with the direction of travel at the top of the frame.
 */
export function navcamPose(pos: Vec3, up: Vec3, forward: Vec3, below: number): { position: Vec3; target: Vec3; up: Vec3 } {
  const u = normalize(up);
  const position = sub(pos, scale(u, below));
  return { position, target: sub(position, u), up: normalize(forward) };
}

// ---------------------------------------------------------------- diorama directions

/**
 * Direction in a site diorama from a compass azimuth (degrees clockwise from north) and an
 * elevation above the horizon. Diorama axes: north = −Z, east = +X, up = +Y.
 */
export function horizonDir(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
}

/** Unit vector toward the Sun in a diorama, from siteSky()'s azimuth and elevation (north = −Z, east = +X). */
export const dioramaSunDir = horizonDir;

// ---------------------------------------------------------------- camera poses

export interface Pose {
  position: Vec3;
  target: Vec3;
  up: Vec3;
}

/** Blend two offsets from a pivot: direction by slerp, length geometrically (log-space). */
export function blendOffset(a: Vec3, b: Vec3, w: number): Vec3 {
  const la = Math.hypot(a[0], a[1], a[2]);
  const lb = Math.hypot(b[0], b[1], b[2]);
  if (la < 1e-12 || lb < 1e-12) return add(scale(a, 1 - w), scale(b, w));
  const ua = scale(a, 1 / la);
  const ub = scale(b, 1 / lb);
  const cos = Math.max(-1, Math.min(1, dot(ua, ub)));
  const om = Math.acos(cos);
  let u: Vec3;
  if (om < 1e-6) u = ua;
  else if (Math.PI - om < 1e-4) u = normalize(add(scale(ua, 1 - w), scale(ub, w)));
  else {
    const so = Math.sin(om);
    u = add(scale(ua, Math.sin((1 - w) * om) / so), scale(ub, Math.sin(w * om) / so));
  }
  return scale(u, Math.exp(Math.log(la) * (1 - w) + Math.log(lb) * w));
}

/**
 * Blend camera poses about a pivot (usually the site being dived into). Distances to the pivot
 * blend geometrically, so a dive from orbit (≈0.3 globe units) to a machine (≈0.003) moves at an
 * even zoom rate instead of rushing the last metres.
 */
export function blendPose(a: Pose, b: Pose, w: number, pivot: Vec3): Pose {
  const k = Math.min(1, Math.max(0, w));
  if (k <= 0) return a;
  if (k >= 1) return b;
  return {
    position: add(pivot, blendOffset(sub(a.position, pivot), sub(b.position, pivot), k)),
    target: add(pivot, blendOffset(sub(a.target, pivot), sub(b.target, pivot), k)),
    up: normalize(add(scale(a.up, 1 - k), scale(b.up, k))),
  };
}

/** Blend two points about a pivot the same way the camera blends (see blendPose). */
export function blendAbout(a: Vec3, b: Vec3, w: number, pivot: Vec3): Vec3 {
  const k = Math.min(1, Math.max(0, w));
  if (k <= 0) return a;
  if (k >= 1) return b;
  return add(pivot, blendOffset(sub(a, pivot), sub(b, pivot), k));
}
