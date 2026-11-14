// The site dioramas: how each resting place is dressed (ground, rocks, hills, where Ingenuity
// lands, how the camera frames it) and the Martian sky for a given Sun elevation.
// Pure data and maths, unit-tested.

import { DEG } from '../geo';
import type { MachineId } from '../types';
import { horizonDir, smoothstep, type Vec3 } from './layout';

// ---------------------------------------------------------------- site presets

/** A low hill on the horizon (crater rim, mesa, dune), placed by compass bearing and distance, m. */
export interface Hill {
  azDeg: number;
  dist: number;
  radius: number;
  height: number;
}

/**
 * How a site diorama is dressed. Units are metres; diorama axes are x = east, y = up, z = south.
 * Everything is illustrative: real sites, real machines at roughly real size, invented pebbles.
 */
export interface SitePreset {
  /** Ground colours (sRGB hex): base and the darker patches. */
  ground: string;
  groundDark: string;
  seed: number;
  /** Gentle relief amplitude, m. */
  relief: number;
  /** Sand ripple amplitude, m (0 = none), and the compass bearing the crests run along. */
  ripples: number;
  rippleAzDeg: number;
  /** Patterned-ground polygon size, m (0 = none). Phoenix's arctic plain. */
  polygons: number;
  rocks: number;
  /** Largest rock, m. */
  rockSize: number;
  hills: Hill[];
  /** Radius kept flat and clear of rocks around the machine, m. */
  clear: number;
  /** Compass bearing from the subject to the camera, deg (180 = camera to the south, looking north). */
  cameraAz: number;
  /** Camera elevation above the horizon, deg. */
  cameraElev: number;
  /** The machine faces this many degrees clockwise from straight at the camera: a three-quarter view. */
  yawOffset: number;
  /** Where Ingenuity lands, relative to the camera: metres to the right of the machine, and toward the camera. */
  ingenuity: { right: number; toward: number };
  /** Framed box: extent along the camera's right axis from the machine (left < 0), and height, m. */
  frame: { left: number; right: number; height: number };
  /** The machine's radio antenna in the model's own coordinates (front = +Z), for the call rings. */
  antenna: Vec3;
}

const BASE = {
  ground: '#9a6242',
  groundDark: '#6c4029',
  relief: 0.3,
  ripples: 0,
  rippleAzDeg: 20,
  polygons: 0,
  rocks: 120,
  rockSize: 0.32,
  hills: [] as Hill[],
  clear: 2.2,
  cameraAz: 190,
  cameraElev: 14,
  yawOffset: -35,
};

export const SITE_PRESETS: Record<MachineId, SitePreset> = {
  // Chryse Planitia: a rocky, wind-swept plain.
  'viking-1': {
    ...BASE,
    seed: 11,
    rocks: 150,
    hills: [{ azDeg: 330, dist: 70, radius: 26, height: 3.5 }],
    ingenuity: { right: 3.1, toward: 0.9 },
    frame: { left: -1.9, right: 3.8, height: 2.3 },
    antenna: [-0.35, 1.95, 0.25],
  },
  // Utopia Planitia: flat and strewn with boulders. Framed unlike Viking 1 on purpose (the two
  // stops come back to back): from the north-west and higher up, the lander turned the other way
  // and tilted, Ingenuity on its left.
  'viking-2': {
    ...BASE,
    ground: '#93604a',
    groundDark: '#5e3a28',
    seed: 22,
    relief: 0.12,
    rocks: 420,
    rockSize: 0.45,
    clear: 2.0,
    cameraAz: 305,
    cameraElev: 26,
    yawOffset: 40,
    ingenuity: { right: -2.7, toward: 1.5 },
    frame: { left: -3.9, right: 2.0, height: 2.4 },
    antenna: [-0.35, 1.95, 0.25],
  },
  // Ares Vallis, looking south-west toward the Twin Peaks, about a kilometre away.
  'pathfinder-sojourner': {
    ...BASE,
    ground: '#9e6545',
    seed: 33,
    rocks: 170,
    cameraAz: 45,
    hills: [
      { azDeg: 228, dist: 78, radius: 15, height: 7 },
      { azDeg: 246, dist: 82, radius: 13, height: 5.5 },
    ],
    clear: 2.6,
    ingenuity: { right: 2.5, toward: 1.2 },
    frame: { left: -3.3, right: 3.2, height: 1.4 },
    antenna: [0.3, 0.72, -0.2],
  },
  // Troy, beside Home Plate in Gusev crater: Spirit stuck in soft sand, Husband Hill to the north.
  spirit: {
    ...BASE,
    ground: '#9c6a4a',
    groundDark: '#6a4632',
    seed: 44,
    rocks: 80,
    rockSize: 0.26,
    cameraAz: 170,
    hills: [{ azDeg: 355, dist: 75, radius: 24, height: 9 }],
    clear: 1.8,
    ingenuity: { right: 2.3, toward: 0.8 },
    frame: { left: -1.5, right: 2.9, height: 1.6 },
    antenna: [-0.3, 0.98, 0.1],
  },
  // Perseverance Valley, on the inner slope of Endeavour crater's western rim: rim behind, to the west.
  opportunity: {
    ...BASE,
    ground: '#946040',
    seed: 55,
    relief: 0.4,
    rocks: 70,
    cameraAz: 95,
    hills: [
      { azDeg: 270, dist: 55, radius: 30, height: 8 },
      { azDeg: 300, dist: 65, radius: 26, height: 6 },
    ],
    clear: 1.8,
    ingenuity: { right: 2.3, toward: 0.8 },
    frame: { left: -1.5, right: 2.9, height: 1.6 },
    antenna: [-0.3, 0.98, 0.1],
  },
  // Vastitas Borealis: pale, flat arctic plain broken into polygons by ground ice.
  phoenix: {
    ...BASE,
    ground: '#b49478',
    groundDark: '#8d7057',
    seed: 66,
    relief: 0.1,
    polygons: 4.5,
    rocks: 25,
    rockSize: 0.18,
    clear: 3.2,
    ingenuity: { right: 3.7, toward: 1.6 },
    frame: { left: -3, right: 4.3, height: 2.2 },
    antenna: [0, 1.28, -0.4],
  },
  // Homestead hollow, Elysium Planitia: smooth, almost rock-free.
  insight: {
    ...BASE,
    ground: '#99684b',
    groundDark: '#734b34',
    seed: 77,
    relief: 0.1,
    rocks: 14,
    rockSize: 0.16,
    cameraAz: 200,
    clear: 3.4,
    ingenuity: { right: 3.9, toward: 1.7 },
    frame: { left: -3.2, right: 4.5, height: 2.1 },
    antenna: [0.35, 1.22, -0.3],
  },
  // Jezero crater floor: the backshell upright, the parachute spread out behind it. Rim far to the west.
  'mars2020-edl': {
    ...BASE,
    ground: '#94694c',
    groundDark: '#6a4a35',
    seed: 88,
    relief: 0.3,
    ripples: 0.05,
    rocks: 60,
    cameraAz: 160,
    cameraElev: 22,
    yawOffset: 0,
    hills: [{ azDeg: 285, dist: 90, radius: 45, height: 11 }],
    // Wide enough to keep the whole spread-out parachute on flat ground.
    clear: 15,
    ingenuity: { right: 3.6, toward: 1.5 },
    frame: { left: -8.5, right: 4.3, height: 2.6 },
    antenna: [0, 1.4, 0],
  },
  // Valinor Hills: rippled sand among low dunes. Home. No other machine here: Ingenuity is the subject.
  ingenuity: {
    ...BASE,
    ground: '#9b7457',
    groundDark: '#6f5039',
    seed: 99,
    relief: 0.25,
    ripples: 0.07,
    rippleAzDeg: 35,
    rocks: 30,
    rockSize: 0.22,
    cameraAz: 200,
    cameraElev: 11,
    yawOffset: -20,
    hills: [
      { azDeg: 320, dist: 26, radius: 9, height: 1.5 },
      { azDeg: 30, dist: 32, radius: 11, height: 1.9 },
      { azDeg: 250, dist: 40, radius: 14, height: 2.2 },
    ],
    clear: 1.4,
    ingenuity: { right: 0, toward: 0 },
    frame: { left: -0.8, right: 0.8, height: 0.62 },
    antenna: [0, 0.52, 0],
  },
};

export interface SiteLayout {
  /** Ingenuity's landing spot, diorama-local (y = 0). */
  ingenuity: Vec3;
  /** The machine's yaw about +Y, radians (its front, +Z, turned toward the camera). */
  machineYaw: number;
  /** Antenna position, diorama-local. */
  antenna: Vec3;
  /** Framing box centre (diorama-local) and half extents. */
  frameCenter: Vec3;
  halfWidth: number;
  halfHeight: number;
  /** Unit vector from the subject toward the camera, before any drift. */
  cameraDir: Vec3;
}

const layoutCache = new Map<SitePreset, SiteLayout>();

/** Turn a preset's camera-relative description into diorama coordinates (cached). */
export function siteLayout(p: SitePreset): SiteLayout {
  let l = layoutCache.get(p);
  if (!l) {
    l = computeLayout(p);
    layoutCache.set(p, l);
  }
  return l;
}

function computeLayout(p: SitePreset): SiteLayout {
  // Camera at bearing A looks toward A + 180; its right hand points to A + 270 = A − 90.
  const right = horizonDir(p.cameraAz - 90, 0);
  const toward = horizonDir(p.cameraAz, 0);
  const ingenuity: Vec3 = [
    right[0] * p.ingenuity.right + toward[0] * p.ingenuity.toward,
    0,
    right[2] * p.ingenuity.right + toward[2] * p.ingenuity.toward,
  ];
  // Local +Z (the model's front) maps to (sin θ, 0, cos θ) after a yaw θ; aim it at bearing B.
  const b = (p.cameraAz + p.yawOffset) * DEG;
  const machineYaw = Math.atan2(Math.sin(b), -Math.cos(b));
  const [ax, ay, az] = p.antenna;
  const c = Math.cos(machineYaw);
  const s = Math.sin(machineYaw);
  const antenna: Vec3 = [ax * c + az * s, ay, -ax * s + az * c];
  const mid = (p.frame.left + p.frame.right) / 2;
  return {
    ingenuity,
    machineYaw,
    antenna,
    frameCenter: [right[0] * mid, p.frame.height / 2, right[2] * mid],
    halfWidth: (p.frame.right - p.frame.left) / 2,
    halfHeight: p.frame.height / 2,
    cameraDir: horizonDir(p.cameraAz, p.cameraElev),
  };
}

// ---------------------------------------------------------------- the Martian sky

export type RGB = [number, number, number];

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Sky, light and fog for a Sun elevation. Colours are sRGB 0..1. */
export interface SkyLook {
  zenith: RGB;
  horizon: RGB;
  /** Halo around the Sun: butterscotch-white by day, blue at sunset and sunrise. */
  glow: RGB;
  glowStrength: number;
  /** 1 while the Sun's disc is up. */
  sunUp: number;
  sunColor: RGB;
  /** Directional light intensity (three.js physical units). */
  sunIntensity: number;
  ambientSky: RGB;
  ambientGround: RGB;
  ambientIntensity: number;
  /** 0 by day → 1 at night: weight of a faint cool key light that keeps machines' shape readable. */
  nightKey: number;
  /** How much of the starfield shows through, 0..1. */
  stars: number;
  /** Sky dome opacity: 1 by day, low at night so the stars show. */
  domeOpacity: number;
  fog: RGB;
}

const DAY = { zenith: hex('#a67d5a'), horizon: hex('#d6b089'), glow: hex('#f2dcc0') };
// Dust scatters blue light forward, so the Sun sets in a blue glow on Mars.
const DUSK = { zenith: hex('#2c2a2f'), horizon: hex('#5f4a3f'), glow: hex('#6e9ad0') };
const NIGHT = { zenith: hex('#05070c'), horizon: hex('#161c27'), glow: hex('#000000') };

export function skyLook(elevationDeg: number): SkyLook {
  const day = smoothstep(-1, 12, elevationDeg); // 0 at sunset, 1 once the Sun is well up
  const night = 1 - smoothstep(-16, -4, elevationDeg); // 1 in full night
  const pick = (k: 'zenith' | 'horizon' | 'glow') => mix(mix(DUSK[k], DAY[k], day), NIGHT[k], night);
  const stars = 1 - smoothstep(-14, -3, elevationDeg);
  const horizon = pick('horizon');
  return {
    zenith: pick('zenith'),
    horizon,
    glow: pick('glow'),
    glowStrength: (0.55 + 0.6 * (1 - day)) * (1 - night),
    sunUp: elevationDeg > -0.3 ? 1 : 0,
    sunColor: mix(hex('#f0b47e'), hex('#fff0dc'), smoothstep(0, 20, elevationDeg)),
    sunIntensity: 3.2 * smoothstep(-0.5, 8, elevationDeg),
    ambientSky: mix(mix(hex('#5d6f8c'), hex('#d2aa82'), day), hex('#8094bd'), night),
    ambientGround: mix(mix(hex('#3b2a22'), hex('#6b4631'), day), hex('#2a2a33'), night),
    // Night stays readable: dim, cool light, as if the eye had adapted (an artistic choice; the
    // console states the real Sun elevation).
    ambientIntensity: 0.75 + 0.75 * day + 0.25 * night,
    nightKey: 1 - smoothstep(-3, 5, elevationDeg),
    stars,
    domeOpacity: 1 - 0.82 * stars,
    fog: horizon,
  };
}
