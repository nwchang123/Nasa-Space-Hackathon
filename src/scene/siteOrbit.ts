// Pure maths for the site orbit (see SiteOrbitInput.tsx for the conventions). Unit-tested.

export const ORBIT_EL_MIN = -0.25;
export const ORBIT_EL_MAX = 0.6;
/** Close enough to read a machine's details (the camera stops at 35 % of the composed distance). */
export const ORBIT_ZOOM_MIN = 0.35;
export const ORBIT_ZOOM_MAX = 1.8;
/** Radians per pixel dragged. */
const AZ_PER_PX = 0.006;
const EL_PER_PX = 0.004;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** The same angle as `to`, unwrapped to lie within ±π of `from` (so easing takes the short way). */
export function nearestAngle(from: number, to: number): number {
  const d = (((to - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return from + d;
}

/** Orbit target after a drag of (dx, dy) pixels. Pure, unit-tested. */
export function orbitAfterDrag(o: { az: number; el: number; zoom: number }, dx: number, dy: number) {
  return { az: o.az - dx * AZ_PER_PX, el: clamp(o.el + dy * EL_PER_PX, ORBIT_EL_MIN, ORBIT_EL_MAX), zoom: o.zoom };
}

/** Orbit target after a wheel step (deltaY > 0 moves out). Pure, unit-tested. */
export function orbitAfterWheel(o: { az: number; el: number; zoom: number }, deltaY: number) {
  return { ...o, zoom: clamp(o.zoom * Math.exp(deltaY * 0.0012), ORBIT_ZOOM_MIN, ORBIT_ZOOM_MAX) };
}

// ---------------------------------------------------------------- the turn while a voice speaks

/**
 * Every spoken line turns the camera at one fixed, slow pace: a full 360° would take this long, s
 * (6°/s). Even the longest line goes only part of the way round; nothing hurries to finish a turn.
 */
export const TURN_PERIOD_S = 60;
/** That pace, rad/s. Negative: clockwise seen from above, as a slow drag to the right would turn it. */
export const TURN_PACE = -(2 * Math.PI) / TURN_PERIOD_S;
/** The turn gathers speed over this long at its start and loses it over this long before the end, s. */
export const TURN_RAMP_S = 2;
/** After the visitor moves the view (drag, wheel, bearing bar, reset), the turn waits this long, ms. */
export const AUTO_ORBIT_IDLE_MS = 4000;
/** How quickly a turn cut short (the voice stopped, a close-up) coasts to a stop, 1/s. */
const COAST_RATE = 1.2;

/** A turn from `from` to `to` (s, any clock) cruising at `speed` (rad/s), easing in and out over `ramp` s at each end. */
export interface Turn {
  from: number;
  to: number;
  speed: number;
  ramp: number;
}

export function makeTurn(from: number, to: number, speed: number): Turn {
  return { from, to, speed, ramp: Math.max(0, Math.min(TURN_RAMP_S, (to - from) / 2)) };
}

/** Angle turned by time `t` (rad): speed rising evenly over the first ramp, steady, then falling evenly to rest at `to`. */
export function turnAngle(turn: Turn, t: number): number {
  const { speed: v, ramp: r } = turn;
  const T = turn.to - turn.from;
  const x = Math.min(T, Math.max(0, t - turn.from));
  if (r <= 0) return v * x;
  if (x < r) return (v * x * x) / (2 * r);
  if (x <= T - r) return v * (x - r / 2);
  const y = T - x;
  return v * (T - r) - (v * y * y) / (2 * r);
}

/** The turn's speed at time `t` (rad/s): what a turn cut short at `t` coasts on from. */
export function turnSpeed(turn: Turn, t: number): number {
  const { speed: v, ramp: r } = turn;
  const T = turn.to - turn.from;
  const x = t - turn.from;
  if (x <= 0 || x >= T) return 0;
  if (r <= 0) return v;
  if (x < r) return (v * x) / r;
  if (x > T - r) return (v * (T - x)) / r;
  return v;
}

/** A cut-short turn's speed after coasting `dt` s more (rad/s), settling to exactly 0. Pure, unit-tested. */
export function coastSpeed(speed: number, dt: number): number {
  const next = speed * Math.exp(-Math.max(0, dt) * COAST_RATE);
  return Math.abs(next) < 1e-4 ? 0 : next;
}

// ---------------------------------------------------------------- a close-up takes the view back

/** When a close-up begins, the orbit eases back to the composed angle over at least this long, s, */
const SETTLE_MIN_S = 0.9;
/** plus this long for each radian it had turned, */
const SETTLE_PER_RAD_S = 0.5;
/** and never longer than this, s. */
const SETTLE_MAX_S = 2.4;

/** How long the orbit takes to ease back from angle `az` when a close-up begins, s. Pure, unit-tested. */
export function settleSeconds(az: number): number {
  return Math.min(SETTLE_MAX_S, SETTLE_MIN_S + SETTLE_PER_RAD_S * Math.abs(az));
}

/**
 * The orbit `k` of the way (0..1) back from `from` to the composed shot (no turn, no tilt, no
 * zoom), starting and finishing gently. Pure, unit-tested.
 */
export function settledOrbit(from: { az: number; el: number; zoom: number }, k: number) {
  const x = clamp(k, 0, 1);
  const left = 1 - x * x * (3 - 2 * x);
  return { az: from.az * left, el: from.el * left, zoom: 1 + (from.zoom - 1) * left };
}

/**
 * The whole turns to take off an orbit angle so it stays within ±π (0 when it already does). The
 * slow turn keeps adding to the angle; shifting the goal and the eased orbit by the same whole turn
 * keeps the view where it is, and the way back to the composed shot never unwinds several turns.
 */
export function wholeTurns(az: number): number {
  return Math.abs(az) <= Math.PI ? 0 : Math.round(az / (2 * Math.PI)) * 2 * Math.PI;
}
