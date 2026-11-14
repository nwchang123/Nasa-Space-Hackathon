// Astronomy API. The scene and the console import only from here.
// STUB: placeholder maths so the app compiles while the astro module is written.
// The signatures are the contract; keep them when replacing the bodies.

import type { MachineId, SignalPath, SiteSky, World } from '../types';
import { DEG, wrap180 } from '../geo';

export const C_KM_S = 299_792.458;
export const AU_KM = 149_597_870.7;

/** A point in body-fixed coordinates: planetocentric latitude, east longitude (−180..180), degrees. */
export interface SubPoint {
  lat: number;
  lon: number;
}

/** Point on the Moon where the Sun is overhead now (selenographic). */
export function moonSubSolar(date: Date): SubPoint {
  const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000;
  const phase = ((days / 29.530588) % 1 + 1) % 1; // 0 new, 0.5 full
  return { lat: 0, lon: wrap180(180 - phase * 360) };
}

/** Point on the Moon where Earth is overhead now (about 0°, 0° with libration). */
export function moonSubEarth(_date: Date): SubPoint {
  return { lat: 0, lon: 0 };
}

/** Point on Mars where the Sun is overhead now (Mars24 algorithm). */
export function marsSubSolar(date: Date): SubPoint {
  const hours = marsLocalSolarTime(date, 0);
  return { lat: 0, lon: wrap180(180 - hours * 15) };
}

/** Mars local true solar time at an east longitude, hours 0–24. */
export function marsLocalSolarTime(date: Date, lonEast: number): number {
  const jdtt = date.getTime() / 86_400_000 + 2440587.5 + 69.184 / 86400;
  const mst = (24 * ((jdtt - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626)) % 24;
  return (((mst + lonEast / 15) % 24) + 24) % 24;
}

/** Sun elevation above the local horizon, degrees, for a site given the sub-solar point. */
export function sunElevation(sub: SubPoint, lat: number, lon: number): number {
  const s =
    Math.sin(lat * DEG) * Math.sin(sub.lat * DEG) +
    Math.cos(lat * DEG) * Math.cos(sub.lat * DEG) * Math.cos((lon - sub.lon) * DEG);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

/** Sky right now at a site on the Moon or Mars. */
export function siteSky(world: 'moon' | 'mars', lat: number, lon: number, date: Date): SiteSky {
  const sub = world === 'moon' ? moonSubSolar(date) : marsSubSolar(date);
  const elevationDeg = sunElevation(sub, lat, lon);
  return {
    elevationDeg,
    isDay: elevationDeg > 0,
    localSolarHours: world === 'mars' ? marsLocalSolarTime(date, lon) : undefined,
  };
}

/** Heliocentric ecliptic (J2000) position in AU, or null when no trustworthy model is available. */
export function heliocentricAU(body: 'earth' | 'mars' | 'ceres' | 'eros', date: Date): [number, number, number] | null {
  const t = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (86_400_000 * 365.25);
  if (body === 'earth') return [Math.cos(2 * Math.PI * t + 1.75), Math.sin(2 * Math.PI * t + 1.75), 0];
  if (body === 'mars') return [1.52 * Math.cos(2 * Math.PI * t / 1.88 - 0.08), 1.52 * Math.sin(2 * Math.PI * t / 1.88 - 0.08), 0];
  return null;
}

export function earthMoonDistanceKm(_date: Date): number {
  return 384_400;
}

export function earthMarsDistanceKm(date: Date): number {
  const e = heliocentricAU('earth', date)!;
  const m = heliocentricAU('mars', date)!;
  return Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]) * AU_KM;
}

/** Kepler space telescope: angle it trails Earth along Earth's orbit, degrees (rough model). */
export function keplerTrailAngleDeg(_date: Date): number {
  return 90;
}

/** Live distance and round-trip light time for a call to a machine. */
export function signalPath(_id: MachineId, world: World, date: Date): SignalPath {
  if (world === 'moon') {
    const d = earthMoonDistanceKm(date);
    return { distanceKm: d, roundTripS: (2 * d) / C_KM_S, estimate: false, note: 'Earth–Moon distance (stub)' };
  }
  if (world === 'mars') {
    const d = earthMarsDistanceKm(date);
    return { distanceKm: d, roundTripS: (2 * d) / C_KM_S, estimate: false, note: 'Earth–Mars distance (stub)' };
  }
  return { distanceKm: null, roundTripS: null, estimate: true, note: 'No estimate (stub)' };
}
