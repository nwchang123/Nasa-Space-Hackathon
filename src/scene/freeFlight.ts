// Pure maths for flying Ingenuity around a site (see SiteFlight.tsx): diorama-local metres, y up.
// One step per frame: spin the rotor up, lift to a hover, move where the keys or a clicked spot
// say, climb over the machine instead of flying into it, stay inside the site, and after a while
// with nothing to do, settle back onto the ground and spin down. No three.js. Unit-tested.

/** Cruise speed, m/s. */
export const FLY_SPEED_MS = 2.5;
/** Hover height above the ground, m. */
export const HOVER_ALT_M = 1.8;
/** Fastest climb or descent, m/s. */
export const CLIMB_MS = 1.4;
/** With nothing to do for this long, Ingenuity lands, s. */
export const LAND_AFTER_S = 6;
/** How far from the site's centre it may fly, m. */
export const SITE_RADIUS_M = 25;
/** Clearance over the top of the machine, m, and around its footprint, m. */
export const OVER_CLEAR_M = 0.6;
export const FOOT_MARGIN_M = 0.8;
/** A clicked spot counts as reached within this, m. */
export const ARRIVE_M = 0.15;
/** How quickly the velocity follows the controls, 1/s. */
const ACCEL = 3.5;
/** Rotor spin-up and spin-down times, s. */
const ROTOR_UP_S = 0.6;
const ROTOR_DOWN_S = 1.8;
/** The rotor must be this fast before it lifts. */
const LIFT_ROTOR = 0.7;
/** Fastest turn toward a heading, rad/s. */
const TURN_RATE = 2.2;

export interface FlyerState {
  x: number;
  z: number;
  /** Height above the ground, m. */
  alt: number;
  vx: number;
  vz: number;
  /** Rotor speed 0..1. */
  rotor: number;
  /** Seconds with no command. */
  idle: number;
  /** A spot to fly to (clicked, or the autopilot's), or null. */
  target: [number, number] | null;
  /** Land as soon as the target is reached (flying back to the landing spot). */
  landOnArrival: boolean;
  /** Heading about +Y, radians (the body's +Z turned by it); and the heading to turn to, or null. */
  yaw: number;
  face: number | null;
}

/**
 * The machine's footprint: its bounding box in its own frame (x and z extents, `top` = height of
 * its top above the ground), turned by `yaw` about +Y into the diorama (a machine-local point
 * (mx, mz) sits at (cos·mx + sin·mz, −sin·mx + cos·mz)).
 */
export interface Footprint {
  yaw: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number;
}

export interface FlyWorld {
  /** The site's centre (x, z) and how far from it Ingenuity may go, m. */
  centre: [number, number];
  radius: number;
  /** The machine to keep out of, or null (at home there is none). */
  machine: Footprint | null;
}

export interface FlyInput {
  /** Direction to move in (x, z), length ≤ 1, or null when no key is held. */
  move: [number, number] | null;
  /** Keep hovering where it is (the autopilot holding beside a part). */
  hold?: boolean;
  /** Hover at this height instead of HOVER_ALT_M (the autopilot: level with the part), m. */
  holdAlt?: number;
}

export function flyerAt(x: number, z: number, yaw = 0): FlyerState {
  return { x, z, alt: 0, vx: 0, vz: 0, rotor: 0, idle: LAND_AFTER_S, target: null, landOnArrival: false, yaw, face: null };
}

/** Heading that turns the body's +Z toward (dx, dz). */
export const headingTo = (dx: number, dz: number) => Math.atan2(dx, dz);

/** Shortest signed turn from angle a to angle b, radians. */
export function turnDelta(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Where the autopilot parks Ingenuity to look at a part: `offset` m from it, beside the line from
 * the camera to the part (so it never blocks the close-up) and outside the machine's footprint `fp`
 * (so it can hover level with the part instead of over the machine). Tried in order: to the side
 * Ingenuity is already on and outward, that side, straight outward, then the other side; failing
 * all of those, further out until clear of the footprint.
 */
export function standoffBeside(
  part: [number, number],
  camera: [number, number],
  centre: [number, number],
  flyer: [number, number],
  offset = 1.2,
  fp: Footprint | null = null,
): [number, number] {
  const unit = (x: number, z: number): [number, number] => {
    const l = Math.hypot(x, z);
    return l > 1e-6 ? [x / l, z / l] : [0, 0];
  };
  const [vx, vz] = unit(part[0] - camera[0], part[1] - camera[1]);
  const side = -vz * (flyer[0] - part[0]) + vx * (flyer[1] - part[1]) >= 0 ? 1 : -1;
  const s1: [number, number] = [-vz * side, vx * side];
  const s2: [number, number] = [-s1[0], -s1[1]];
  let o = unit(part[0] - centre[0], part[1] - centre[1]);
  if (o[0] === 0 && o[1] === 0) o = [-vx, -vz];
  const tries: [number, number][] = [unit(s1[0] + o[0], s1[1] + o[1]), s1, o, unit(s2[0] + o[0], s2[1] + o[1]), s2];
  for (const d of tries) {
    if (d[0] === 0 && d[1] === 0) continue;
    const p: [number, number] = [part[0] + d[0] * offset, part[1] + d[1] * offset];
    if (!fp || !overFootprint(fp, p[0], p[1])) return p;
  }
  for (let k = offset; k < offset + 8; k += 0.25) {
    const p: [number, number] = [part[0] + o[0] * k, part[1] + o[1] * k];
    if (!fp || !overFootprint(fp!, p[0], p[1])) return p;
  }
  return [part[0] + tries[0][0] * offset, part[1] + tries[0][1] * offset];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function toMachine(fp: Footprint, x: number, z: number): [number, number] {
  const c = Math.cos(fp.yaw);
  const s = Math.sin(fp.yaw);
  return [c * x - s * z, s * x + c * z];
}

function fromMachine(fp: Footprint, mx: number, mz: number): [number, number] {
  const c = Math.cos(fp.yaw);
  const s = Math.sin(fp.yaw);
  return [c * mx + s * mz, -s * mx + c * mz];
}

/** Is (x, z) over the machine's footprint, widened by `margin`? */
export function overFootprint(fp: Footprint, x: number, z: number, margin = FOOT_MARGIN_M): boolean {
  const [mx, mz] = toMachine(fp, x, z);
  return mx > fp.minX - margin && mx < fp.maxX + margin && mz > fp.minZ - margin && mz < fp.maxZ + margin;
}

/** The nearest point to (x, z) just outside the widened footprint. */
export function outOfFootprint(fp: Footprint, x: number, z: number, margin = FOOT_MARGIN_M): [number, number] {
  const [mx, mz] = toMachine(fp, x, z);
  const exits = [
    { d: mx - (fp.minX - margin), p: [fp.minX - margin, mz] },
    { d: fp.maxX + margin - mx, p: [fp.maxX + margin, mz] },
    { d: mz - (fp.minZ - margin), p: [mx, fp.minZ - margin] },
    { d: fp.maxZ + margin - mz, p: [mx, fp.maxZ + margin] },
  ];
  exits.sort((a, b) => a.d - b.d);
  return fromMachine(fp, exits[0].p[0], exits[0].p[1]);
}

/** The hover height wanted at (x, z): `base`, but over the machine high enough to clear its top. */
export function cruiseAlt(world: FlyWorld, x: number, z: number, base = HOVER_ALT_M): number {
  const fp = world.machine;
  return fp && overFootprint(fp, x, z) ? Math.max(base, fp.top + OVER_CLEAR_M) : base;
}

/** Keep a clicked spot inside the site. */
export function clampToSite(world: FlyWorld, x: number, z: number): [number, number] {
  const dx = x - world.centre[0];
  const dz = z - world.centre[1];
  const r = Math.hypot(dx, dz);
  const max = world.radius - 0.5;
  if (r <= max) return [x, z];
  return [world.centre[0] + (dx / r) * max, world.centre[1] + (dz / r) * max];
}

/**
 * The move direction for held keys, relative to the camera: `forward` is the camera's view
 * direction flattened onto the ground (x, z). Null when nothing (or opposite keys) is held.
 */
export function moveFromKeys(keys: { f: boolean; b: boolean; l: boolean; r: boolean }, forward: [number, number]): [number, number] | null {
  const fl = Math.hypot(forward[0], forward[1]);
  if (fl < 1e-6) return null;
  const fx = forward[0] / fl;
  const fz = forward[1] / fl;
  // Right of the view, with y up: forward × up.
  const rx = -fz;
  const rz = fx;
  const a = (keys.f ? 1 : 0) - (keys.b ? 1 : 0);
  const b = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  const x = fx * a + rx * b;
  const z = fz * a + rz * b;
  const l = Math.hypot(x, z);
  return l < 1e-6 ? null : [x / l, z / l];
}

/** One frame of flight, `dt` seconds. */
export function stepFlyer(s: FlyerState, input: FlyInput, dt: number, world: FlyWorld): FlyerState {
  const d = clamp(dt, 0, 0.1);
  let { x, z, alt, vx, vz, rotor, idle, target, landOnArrival, yaw, face } = s;
  if (input.move) {
    target = null;
    landOnArrival = false;
  }
  const commanded = input.move !== null || target !== null || !!input.hold;
  idle = commanded ? 0 : idle + d;

  // Height: hover while busy (higher over the machine, looking a little ahead), land when idle.
  const fp = world.machine;
  const aheadX = x + vx * 0.6;
  const aheadZ = z + vz * 0.6;
  const base = input.hold && input.holdAlt !== undefined ? input.holdAlt : HOVER_ALT_M;
  let cruise = Math.max(cruiseAlt(world, x, z, base), cruiseAlt(world, aheadX, aheadZ, base));
  if (target) cruise = Math.max(cruise, cruiseAlt(world, x + (target[0] - x) * 0.25, z + (target[1] - z) * 0.25, base));
  const overMachine = !!fp && overFootprint(fp, x, z, 0);
  const wantAlt = commanded || idle < LAND_AFTER_S || (overMachine && alt > 0) ? cruise : 0;

  // The rotor spins up before it lifts, and down once it is on the ground.
  const rotorGoal = commanded || alt > 0.01 || wantAlt > 0 ? 1 : 0;
  rotor = rotorGoal === 1 ? Math.min(1, rotor + d / ROTOR_UP_S) : Math.max(0, rotor - d / ROTOR_DOWN_S);

  const dAlt = wantAlt - alt;
  if (dAlt > 0 && rotor < LIFT_ROTOR && alt < 0.01) {
    // Still spinning up.
  } else if (Math.abs(dAlt) > 1e-4) {
    const rate = CLIMB_MS * (0.3 + 0.7 * Math.min(1, Math.abs(dAlt) / 0.6));
    alt += Math.sign(dAlt) * Math.min(Math.abs(dAlt), rate * d);
  } else alt = wantAlt;
  if (alt < 0) alt = 0;

  // Horizontal: no authority until it is off the ground (relative to the height it is going to).
  const liftRef = Math.max(0.6, Math.min(HOVER_ALT_M, cruise));
  const lift = smoothstep(0.3 * liftRef, 0.8 * liftRef, alt);
  let wx = 0;
  let wz = 0;
  if (input.move) {
    wx = input.move[0] * FLY_SPEED_MS * lift;
    wz = input.move[1] * FLY_SPEED_MS * lift;
  } else if (target) {
    const tx = target[0] - x;
    const tz = target[1] - z;
    const dist = Math.hypot(tx, tz);
    if (dist < ARRIVE_M) {
      target = null;
      if (landOnArrival) {
        landOnArrival = false;
        idle = LAND_AFTER_S;
      }
    } else {
      const speed = Math.min(FLY_SPEED_MS, dist * 1.6) * lift;
      wx = (tx / dist) * speed;
      wz = (tz / dist) * speed;
    }
  }
  const k = 1 - Math.exp(-ACCEL * d);
  vx += (wx - vx) * k;
  vz += (wz - vz) * k;
  let nx = x + vx * d;
  let nz = z + vz * d;

  // Not into the machine: until high enough to clear it, slide along its edge. (Only entering is
  // stopped: a landing spot close to the machine must not push Ingenuity off it.)
  if (fp && !overFootprint(fp, x, z) && overFootprint(fp, nx, nz) && alt < fp.top + OVER_CLEAR_M - 0.05) {
    const [ox, oz] = outOfFootprint(fp, nx, nz);
    const px = ox - nx;
    const pz = oz - nz;
    const pl = Math.hypot(px, pz);
    if (pl > 1e-9) {
      const n0 = px / pl;
      const n1 = pz / pl;
      const into = vx * n0 + vz * n1;
      if (into < 0) {
        vx -= into * n0;
        vz -= into * n1;
      }
    }
    nx = ox;
    nz = oz;
  }

  // Inside the site.
  const rx = nx - world.centre[0];
  const rz = nz - world.centre[1];
  const r = Math.hypot(rx, rz);
  if (r > world.radius) {
    const n0 = rx / r;
    const n1 = rz / r;
    nx = world.centre[0] + n0 * world.radius;
    nz = world.centre[1] + n1 * world.radius;
    const out = vx * n0 + vz * n1;
    if (out > 0) {
      vx -= out * n0;
      vz -= out * n1;
    }
  }
  x = nx;
  z = nz;
  if (Math.abs(vx) < 1e-5) vx = 0;
  if (Math.abs(vz) < 1e-5) vz = 0;

  // Turn toward the wanted heading (only while the rotor turns: it cannot pivot on its legs).
  if (face !== null && rotor > 0.3) {
    const dy = turnDelta(yaw, face);
    yaw += Math.sign(dy) * Math.min(Math.abs(dy), TURN_RATE * d);
    if (Math.abs(dy) < 1e-4) yaw = face;
  }
  return { x, z, alt, vx, vz, rotor, idle, target, landOnArrival, yaw, face };
}
