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
