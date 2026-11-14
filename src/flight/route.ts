// Flight 73's route over Mars: great-circle legs between the stops, with real distances and
// headings. Pure maths, shared by the scene (path and animation) and the console (flight log).

import { MACHINE_BY_ID } from '../data/machines';
import { DEG } from '../geo';
import { MACHINE_IDS, type MachineId } from '../types';

/** Mean radius of Mars, km (IAU). */
export const MARS_RADIUS_KM = 3389.5;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Flight 73 starts and ends at Ingenuity's resting place. */
export const HOME: MachineId = 'ingenuity';

/** Great-circle distance over the surface of Mars, km (haversine, stable for short legs). */
export function greatCircleKm(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial heading from a toward b, degrees clockwise from north. */
export function initialBearing(a: LatLon, b: LatLon): number {
  const dLon = (b.lon - a.lon) * DEG;
  const y = Math.sin(dLon) * Math.cos(b.lat * DEG);
  const x = Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) - Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos(dLon);
  return ((Math.atan2(y, x) / DEG) % 360 + 360) % 360;
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** 305 → 'north-west'. */
export function compass(deg: number): string {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** 305 → 'NW'. */
export function compassShort(deg: number): string {
  return SHORT[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function toVec(p: LatLon): [number, number, number] {
  const la = p.lat * DEG;
  const lo = p.lon * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/** Point a fraction t (0..1) of the way along the great circle from a to b. */
export function interpolate(a: LatLon, b: LatLon, t: number): LatLon {
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  let v: [number, number, number];
  if (omega < 1e-9) v = va;
  else {
    const s = Math.sin(omega);
    const ka = Math.sin((1 - t) * omega) / s;
    const kb = Math.sin(t * omega) / s;
    v = [va[0] * ka + vb[0] * kb, va[1] * ka + vb[1] * kb, va[2] * ka + vb[2] * kb];
  }
  const lat = Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG;
  const lon = Math.atan2(v[1], v[0]) / DEG;
  return { lat, lon };
}

export interface Leg {
  /** 0-based leg number; leg i flies to MACHINE_IDS[i]. */
  index: number;
  from: MachineId;
  to: MachineId;
  distanceKm: number;
  bearingDeg: number;
  /** Distance flown once this leg is complete, km. */
  cumulativeKm: number;
}

export function buildLegs(): Leg[] {
  const legs: Leg[] = [];
  let from: MachineId = HOME;
  let total = 0;
  MACHINE_IDS.forEach((to, index) => {
    const a = MACHINE_BY_ID[from];
    const b = MACHINE_BY_ID[to];
    const distanceKm = greatCircleKm(a, b);
    total += distanceKm;
    legs.push({ index, from, to, distanceKm, bearingDeg: initialBearing(a, b), cumulativeKm: total });
    from = to;
  });
  return legs;
}

export const LEGS: Leg[] = buildLegs();
export const TOTAL_KM = LEGS[LEGS.length - 1].cumulativeKm;

/** One flight from a place to a stop: a planned leg, or a direct hop picked from the route strip. */
export interface Hop {
  from: MachineId;
  to: MachineId;
  distanceKm: number;
  bearingDeg: number;
  /** True when this is the planned leg, so its scripted en-route lines (which name its geometry) apply. */
  onRoute: boolean;
}

/** The flight to stop `legIndex` starting from `from`. */
export function hop(from: MachineId, legIndex: number): Hop {
  const leg = LEGS[legIndex];
  if (leg.from === from) return { from, to: leg.to, distanceKm: leg.distanceKm, bearingDeg: leg.bearingDeg, onRoute: true };
  const a = MACHINE_BY_ID[from];
  const b = MACHINE_BY_ID[leg.to];
  return { from, to: leg.to, distanceKm: greatCircleKm(a, b), bearingDeg: initialBearing(a, b), onRoute: false };
}

/** How long the flight animation for a leg lasts, ms: longer legs take a little longer. */
export function flyDurationMs(distanceKm: number): number {
  return Math.round(Math.min(9000, Math.max(2500, 2500 + distanceKm * 0.65)));
}
