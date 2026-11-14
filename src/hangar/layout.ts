// The AR hangar's arithmetic: how big a machine stands on a real table, and how the row of all
// nine is laid out. Pure numbers (no three.js objects), so it is unit-tested directly.
//
// Every model is measured at its real size in metres. A layout is one uniform scale for the whole
// arrangement plus an offset per model, so the row always keeps the machines' true relative sizes.

import { MACHINE_IDS, type MachineId } from '../types';

export type V3 = [number, number, number];

/** What the hangar shows: one machine, or all nine in a row. */
export type HangarPick = MachineId | 'row';
/** The nine machines in route order, then the row: ten choices. */
export const HANGAR_PICKS: readonly HangarPick[] = [...MACHINE_IDS, 'row'];

/** Table scale (a figure on a desk) or 1:1 (real size). */
export type HangarScale = 'table' | 'real';

/** A single machine at table scale: its longest side, m. */
export const TABLE_SINGLE_M = 0.28;
/** The row of nine at table scale, end to end, m. */
export const TABLE_ROW_M = 1.1;
/** Real space between neighbours in the row, m (scaled with the row). */
export const ROW_GAP_M = 1.0;

/** An axis-aligned box in a model's own frame, real metres. */
export interface Extent {
  min: V3;
  max: V3;
}

/** Width (x), height (y) and depth (z) of a box. */
export function extentSize(e: Extent): V3 {
  return [e.max[0] - e.min[0], e.max[1] - e.min[1], e.max[2] - e.min[2]];
}

export interface Layout {
  /** One uniform scale for the whole arrangement (1 = real size). */
  scale: number;
  /** Per model: the translation of its own frame, real metres, applied before `scale`. */
  offsets: V3[];
  /** The arrangement as shown, m: width (x), height (y), depth (z). */
  size: V3;
  /** The same at real size, m. */
  realSize: V3;
}

/** The ids a pick shows, in order. */
export function pickIds(pick: HangarPick): MachineId[] {
  return pick === 'row' ? [...MACHINE_IDS] : [pick];
}

/** One machine: its footprint centred on the origin, its lowest point on y = 0. */
export function singleLayout(e: Extent, mode: HangarScale): Layout {
  const real = extentSize(e);
  const longest = Math.max(...real);
  const scale = mode === 'real' || !(longest > 0) ? 1 : TABLE_SINGLE_M / longest;
  return {
    scale,
    offsets: [[-(e.min[0] + e.max[0]) / 2, -e.min[1], -(e.min[2] + e.max[2]) / 2]],
    size: [real[0] * scale, real[1] * scale, real[2] * scale],
    realSize: real,
  };
}

/**
 * The row: side by side along +x in the given order, ROW_GAP_M apart, their fronts (+z, the side
 * that faces the visitor) on one straight line, every base on y = 0, the whole row centred. One
 * scale for all, so a 1.2 m helicopter stays a twentieth of a 16 m parachute.
 */
export function rowLayout(extents: Extent[], mode: HangarScale, gap = ROW_GAP_M): Layout {
  const sizes = extents.map(extentSize);
  const width = sizes.reduce((sum, s) => sum + s[0], 0) + gap * Math.max(0, extents.length - 1);
  const height = Math.max(0, ...sizes.map(s => s[1]));
  const depth = Math.max(0, ...sizes.map(s => s[2]));
  const scale = mode === 'real' || !(width > 0) ? 1 : TABLE_ROW_M / width;
  let x = -width / 2;
  const offsets = extents.map((e, i): V3 => {
    const o: V3 = [x - e.min[0], -e.min[1], depth / 2 - e.max[2]];
    x += sizes[i][0] + gap;
    return o;
  });
  return { scale, offsets, size: [width * scale, height * scale, depth * scale], realSize: [width, height, depth] };
}

export function layoutFor(extents: Extent[], mode: HangarScale): Layout {
  return extents.length === 1 ? singleLayout(extents[0], mode) : rowLayout(extents, mode);
}

/** "1:13" for a scale of 1/13 (rounded to a readable step), "1:1" at real size. */
export function scaleLabel(scale: number): string {
  if (!(scale > 0) || Math.abs(scale - 1) < 1e-6) return '1:1';
  const n = 1 / scale;
  const step = n < 20 ? 1 : n < 100 ? 5 : 10;
  return `1:${Math.round(n / step) * step}`;
}

/** A length for a caption: "28 cm" under a metre, "3.7 m" above. */
export function formatLength(m: number): string {
  if (m < 1) return `${Math.max(1, Math.round(m * 100))} cm`;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)} m`;
}

/**
 * Where the panels leave the 3D in view, as a shift of the picture's centre in pixels (right, up)
 * how much further back the camera stands, and the share of the width a long row may span. On a
 * desktop the AR panel takes the right and the caption the bottom left; on a phone the caption,
 * picks and AR button stack up from the bottom.
 */
export function freeArea(width: number, height: number): { shiftX: number; shiftY: number; zoomOut: number; widthShare: number } {
  if (width >= 900) {
    const shift = Math.min(170, width * 0.12);
    return { shiftX: -shift, shiftY: Math.min(80, height * 0.09), zoomOut: 1, widthShare: Math.max(0.5, (width - 2 * shift - 48) / width) };
  }
  if (height > width) return { shiftX: 0, shiftY: height * 0.2, zoomOut: 1.2, widthShare: 1 };
  return { shiftX: 0, shiftY: height * 0.12, zoomOut: 1.1, widthShare: 1 };
}

export interface View {
  target: V3;
  position: V3;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
}

/**
 * The sandbox camera for an arrangement of `size`: the whole thing in frame, seen from the front
 * right and a little above, aimed a third of the way up. A long, low row is framed from further
 * in front so it reads as a line-up.
 */
export function viewFor(size: V3, fovDeg = 40, aspect = 16 / 9): View {
  const [w, h, d] = size.map(v => Math.max(v, 1e-3));
  const radius = Math.hypot(w, h, d) / 2;
  const vHalf = (fovDeg * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.5, aspect));
  const wide = w > 2.5 * Math.max(h, d);
  // A long low row: fit its length across the screen (a bounding sphere would leave it a thin
  // line far away). Anything else: fit its bounding sphere.
  const across = (w / 2) / Math.tan(hHalf) + d / 2;
  const fit = wide ? Math.max(across, (Math.max(h, d) / 2) / Math.tan(vHalf) + d / 2) : Math.max(radius / Math.sin(vHalf), across);
  const dist = fit * 1.08;
  const az = wide ? 0.18 : 0.62;
  const el = wide ? 0.32 : 0.36;
  const target: V3 = [0, h * 0.32, 0];
  const position: V3 = [
    target[0] + dist * Math.cos(el) * Math.sin(az),
    target[1] + dist * Math.sin(el),
    target[2] + dist * Math.cos(el) * Math.cos(az),
  ];
  return { target, position, near: dist / 200, far: dist * 40, minDistance: radius * 0.6, maxDistance: dist * 4 };
}
