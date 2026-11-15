// Which AR path this device has, and the small pure checks behind tabletop placement. Kept free
// of three.js and the DOM (both are passed in) so the decisions are unit-tested. The deep link
// into the hangar (HANGAR_HASH) lets a QR code open it straight on a phone.

import { HANGAR_HASH } from '../store';
import type { V3 } from './layout';

export { HANGAR_HASH };

/**
 * 'webxr': Android Chrome and other browsers with WebXR immersive-ar (hit-test placement).
 * 'quicklook': iPhone and iPad Safari (USDZ in Apple's AR Quick Look).
 * 'none': desktop, or a phone that blocks both (for one, a plain-HTTP address).
 */
export type ArMode = 'webxr' | 'quicklook' | 'none';

export interface ArProbe {
  /** navigator.xr, if the browser exposes it (only in secure contexts). */
  xr: { isSessionSupported(mode: 'immersive-ar'): Promise<boolean> } | null;
  /** <a rel="ar"> is supported (Safari on iOS and iPadOS). */
  quickLook: boolean;
}

/** `?hangar-ar=webxr|quicklook|none` forces a path, for testing on a desktop. */
export const AR_OVERRIDE_PARAM = 'hangar-ar';

export function arOverride(search: string): ArMode | null {
  const v = new URLSearchParams(search).get(AR_OVERRIDE_PARAM);
  return v === 'webxr' || v === 'quicklook' || v === 'none' ? v : null;
}

export function browserProbe(): ArProbe {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { xr: null, quickLook: false };
  const a = document.createElement('a');
  const xr = (navigator as Navigator & { xr?: ArProbe['xr'] }).xr ?? null;
  return { xr, quickLook: !!a.relList?.supports?.('ar') };
}

/** WebXR first (Android), then Quick Look (Apple), else none. */
export async function detectArMode(probe: ArProbe, override: ArMode | null = null): Promise<ArMode> {
  if (override) return override;
  if (probe.xr) {
    try {
      if (await probe.xr.isSessionSupported('immersive-ar')) return 'webxr';
    } catch {
      // A browser that refuses the question has no AR for us.
    }
  }
  return probe.quickLook ? 'quicklook' : 'none';
}

/**
 * A hit pose lies on a horizontal, upward-facing surface (a table top or the floor, not a wall
 * or a ceiling). `m` is the pose's column-major 4×4 matrix; its y axis is the surface normal.
 */
export function isHorizontalHit(m: ArrayLike<number>, maxTiltDeg = 12): boolean {
  const ux = m[4], uy = m[5], uz = m[6];
  const len = Math.hypot(ux, uy, uz);
  if (!(len > 0)) return false;
  return uy / len >= Math.cos((maxTiltDeg * Math.PI) / 180);
}

/** A hit counts as a surface to stand on only this far below the phone (not a shelf at eye level). */
export const BELOW_EYES_M = 0.12;
/** Feature-point hits are noisier: only when the phone looks down at least this much (not at a wall ahead). */
export const POINT_MIN_DOWN_DEG = 15;
/** How far the reticle may slide off the patch the phone has actually detected, on the same level. */
export const EXTEND_RADIUS_M = 0.6;
/** The reticle may extend a detected level along the view ray only within this distance. */
export const EXTEND_MAX_RAY_M = 4;
/** No surface for this long while scanning: time to show the visitor some tips. */
export const SLOW_SCAN_MS = 8000;
/** A lost hit keeps the reticle where it was this long, so it does not flicker between frames. */
export const HIT_HOLD_MS = 350;

/** Where a ray from `origin` along unit `dir` crosses the level `y`, if it goes down to it within `maxDist`. */
export function rayToLevel(origin: V3, dir: V3, y: number, maxDist = EXTEND_MAX_RAY_M): V3 | null {
  if (!(dir[1] < -1e-3)) return null;
  const t = (y - origin[1]) / dir[1];
  if (!(t > 0) || t > maxDist) return null;
  return [origin[0] + dir[0] * t, y, origin[2] + dir[2] * t];
}

/** 'plane': ARCore's own surface. 'extended': the same level, past the small patch found so far. 'point': a feature point. */
export type SurfaceKind = 'plane' | 'extended' | 'point';

/**
 * Where the reticle goes this frame. A detected plane wins. Planes start as small patches and the
 * browser only hits inside them, so next the view ray is carried on to the last plane's level
 * near where it was seen (the ring slides across the whole table instead of blinking out). Last,
 * while nothing is detected yet, a feature point under a downward look gives a first footing.
 */
export function pickSurface(
  plane: V3 | null,
  point: V3 | null,
  lastPlane: V3 | null,
  origin: V3,
  dir: V3,
): { at: V3; kind: SurfaceKind } | null {
  if (plane) return { at: plane, kind: 'plane' };
  if (lastPlane) {
    const p = rayToLevel(origin, dir, lastPlane[1]);
    if (p && Math.hypot(p[0] - lastPlane[0], p[2] - lastPlane[2]) <= EXTEND_RADIUS_M) return { at: p, kind: 'extended' };
  }
  if (point && dir[1] <= -Math.sin((POINT_MIN_DOWN_DEG * Math.PI) / 180)) return { at: point, kind: 'point' };
  return null;
}

/** Yaw (about +Y) that turns a model's front (+Z) at `at` toward a viewer standing at `viewer`. */
export function facingYaw(at: V3, viewer: V3): number {
  const dx = viewer[0] - at[0];
  const dz = viewer[2] - at[2];
  if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return 0;
  return Math.atan2(dx, dz);
}

export type LinkKind = 'https' | 'localhost' | 'http';

export interface PageLink {
  url: string;
  kind: LinkKind;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** This page's hangar link, and whether a phone could use it for AR. */
export function pageLink(loc: Pick<Location, 'protocol' | 'hostname' | 'origin' | 'pathname'>): PageLink {
  const url = `${loc.origin}${loc.pathname}${HANGAR_HASH}`;
  if (LOCAL_HOSTS.has(loc.hostname) || loc.hostname.endsWith('.localhost')) return { url, kind: 'localhost' };
  return { url, kind: loc.protocol === 'https:' ? 'https' : 'http' };
}

/** One sentence under the QR code for each kind of address. */
export function linkHint(kind: LinkKind): string {
  switch (kind) {
    case 'https':
      return 'Scan with a phone camera. Android Chrome places the models with WebXR; iPhone and iPad Safari open AR Quick Look.';
    case 'localhost':
      return 'This is localhost, which a phone cannot reach. Open the site’s HTTPS address (for example the GitHub Pages build) and scan from there.';
    case 'http':
      return 'This is a plain-HTTP address. A phone can open it, but blocks the camera and WebXR there. Serve the site over HTTPS and scan again.';
  }
}
