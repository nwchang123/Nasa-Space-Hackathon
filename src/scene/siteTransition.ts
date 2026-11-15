// Shared dive/climb timing and camera depth range. Distances at a site are metres;
// the returned clipping planes are in globe units, like the camera itself.
import { SITE_SCALE, smoothstep, type Vec3 } from './layout';

export const SITE_SKY_RADIUS_M = 140;
/**
 * The dive's layers by shot blend (0 = over the globe, 1 = at the site). The haze and the fog come
 * in a little ahead of the sky dome and the ground, so the moment the globe gives way to the
 * diorama is already behind thin air.
 */
export const SITE_FADE = {
  haze: [0.02, 0.2],
  fog: [0.18, 0.72],
  dome: [0.36, 0.7],
  ground: [0.58, 0.94],
  machine: [0.74, 0.96],
  edge: [0.82, 0.985],
} as const satisfies Record<string, readonly [number, number]>;

const logLerp = (a: number, b: number, k: number) => Math.exp(Math.log(a) * (1 - k) + Math.log(b) * k);

/** Tighten the depth range only once the camera is entering the sky and haze. */
export function siteDepthRange(distance: number, blend: number, localCamera: Vec3 | null, scout: boolean, navClearance: number | null = null) {
  const inSite = localCamera ? smoothstep(0.7, 0.97, blend) : 0;
  const close = localCamera && (localCamera[1] < 1.2 || (scout && distance < 3 * SITE_SCALE));
  const siteNear = (close ? 0.04 : 0.15) * SITE_SCALE;
  const nearFloor = localCamera ? logLerp(0.005, siteNear, smoothstep(0.3, 0.8, blend)) : 0.005;
  let near = Math.min(0.05, Math.max(nearFloor, distance * 0.02));
  if (navClearance !== null) near = Math.min(near, Math.max(1e-5, navClearance * 0.3));
  // Include the whole dome even when the visitor flies away from the machine.
  const siteFar = Math.max(220, (localCamera ? Math.hypot(...localCamera) : 0) + SITE_SKY_RADIUS_M + 20) * SITE_SCALE;
  return { near, far: logLerp(80, siteFar, inSite) };
}
