// Astronomy API. The scene and the console import only from here.
// Formulas and their sources live in the sibling files:
//   mars24.ts  – Mars solar time and sub-solar point (Allison & McEwen 2000, NASA GISS Mars24)
//   moon.ts    – Moon/Sun positions, libration, selenographic sub-solar point (Meeus 1998)
//   orbits.ts  – heliocentric positions (JPL approximate planetary elements; JPL SBDB for Ceres/Eros)
//   deep.ts    – rough models for Pioneer 10/11 and Kepler, fitted to JPL Horizons

import type { SignalPath, SiteSky } from '../types';

/** Where a signal is headed. The library still knows the Moon and deep space; the app uses 'mars'. */
export type World = 'moon' | 'mars' | 'deep';
import { DEG, wrap180 } from '../geo';
import { AU_KM_CONST, C_KM_S_CONST } from './constants';
import { jdTT } from './time';
import { mars24, marsLTST } from './mars24';
import { moonPosition, moonSubEarthJde, moonSubSolarJde } from './moon';
import { distance, planetHelio, smallBodyEpoch, smallBodyHelio } from './orbits';
import { keplerEarthDistanceAU, keplerTrail, pioneerHelio } from './deep';

export const C_KM_S = C_KM_S_CONST;
export const AU_KM = AU_KM_CONST;

/** A point in body-fixed coordinates: planetocentric latitude, east longitude (−180..180), degrees. */
export interface SubPoint {
  lat: number;
  lon: number;
}

/** Point on the Moon where the Sun is overhead now (selenographic; Meeus ch. 53, ~0.05°). */
export function moonSubSolar(date: Date): SubPoint {
  return moonSubSolarJde(jdTT(date));
}

/** Point on the Moon where Earth is overhead now: optical libration, |lon| ≲ 8°, |lat| ≲ 7°. */
export function moonSubEarth(date: Date): SubPoint {
  return moonSubEarthJde(jdTT(date));
}

/** Point on Mars where the Sun is overhead now (Mars24 algorithm, ~0.01°). */
export function marsSubSolar(date: Date): SubPoint {
  const m = mars24(date);
  return { lat: m.declination, lon: wrap180(-m.subsolarWest) };
}

/** Mars local true solar time at an east longitude, hours 0–24 (Mars24). */
export function marsLocalSolarTime(date: Date, lonEast: number): number {
  return marsLTST(mars24(date), lonEast);
}

/** Sun elevation above the local horizon, degrees, for a site given the sub-solar point. */
export function sunElevation(sub: SubPoint, lat: number, lon: number): number {
  const s =
    Math.sin(lat * DEG) * Math.sin(sub.lat * DEG) +
    Math.cos(lat * DEG) * Math.cos(sub.lat * DEG) * Math.cos((lon - sub.lon) * DEG);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

/** Sun azimuth seen from a site, degrees clockwise from north: the initial great-circle bearing toward the sub-solar point. */
export function sunAzimuth(sub: SubPoint, lat: number, lon: number): number {
  const dl = (sub.lon - lon) * DEG;
  const y = Math.sin(dl) * Math.cos(sub.lat * DEG);
  const x = Math.cos(lat * DEG) * Math.sin(sub.lat * DEG) - Math.sin(lat * DEG) * Math.cos(sub.lat * DEG) * Math.cos(dl);
  return ((Math.atan2(y, x) / DEG) % 360 + 360) % 360;
}

/** Sky right now at a site on the Moon or Mars (centre of the Sun's disc, no refraction). */
export function siteSky(world: 'moon' | 'mars', lat: number, lon: number, date: Date): SiteSky {
  const sub = world === 'moon' ? moonSubSolar(date) : marsSubSolar(date);
  const elevationDeg = sunElevation(sub, lat, lon);
  return {
    elevationDeg,
    azimuthDeg: sunAzimuth(sub, lat, lon),
    isDay: elevationDeg > 0,
    localSolarHours: world === 'mars' ? marsLocalSolarTime(date, lon) : undefined,
  };
}

/** Heliocentric ecliptic (J2000) position in AU, or null when no trustworthy model is available. */
export function heliocentricAU(body: 'earth' | 'mars' | 'ceres' | 'eros', date: Date): [number, number, number] | null {
  const jde = jdTT(date);
  if (body === 'earth' || body === 'mars') return planetHelio(body, jde);
  return smallBodyHelio(body, jde);
}

/** Earth–Moon centre distance now, km (Meeus ch. 47 main terms, ~50 km). */
export function earthMoonDistanceKm(date: Date): number {
  return moonPosition(jdTT(date)).distanceKm;
}

/** Earth–Mars distance now, km (JPL approximate elements, ~0.001 AU). */
export function earthMarsDistanceKm(date: Date): number {
  const jde = jdTT(date);
  return distance(planetHelio('mars', jde), planetHelio('earth', jde)) * AU_KM;
}

/** Kepler space telescope: angle it trails Earth along Earth's orbit, degrees (rough model). */
export function keplerTrailAngleDeg(date: Date): number {
  return keplerTrail(date);
}

const YEAR_D = 365.25;

function path(distanceAU: number, estimate: boolean, note: string): SignalPath {
  const distanceKm = distanceAU * AU_KM;
  return { distanceKm, roundTripS: (2 * distanceKm) / C_KM_S, estimate, note };
}

function smallBodyPath(body: 'ceres' | 'eros', date: Date, note: string): SignalPath {
  const jde = jdTT(date);
  const d = distance(smallBodyHelio(body, jde), planetHelio('earth', jde));
  // Two-body elements drift with Jupiter's pull: call it an estimate far from the element epoch.
  const far = Math.abs(jde - smallBodyEpoch(body)) > 4 * YEAR_D;
  return path(d, far, far ? note + ' (rough: far from the orbit epoch)' : note);
}

/** Live distance and round-trip light time for a call to a machine. */
export function signalPath(id: string, world: World, date: Date): SignalPath {
  if (world === 'moon') {
    const d = earthMoonDistanceKm(date);
    return { distanceKm: d, roundTripS: (2 * d) / C_KM_S, estimate: false, note: 'Earth–Moon distance right now (Meeus lunar theory)' };
  }
  if (world === 'mars') {
    const d = earthMarsDistanceKm(date);
    return { distanceKm: d, roundTripS: (2 * d) / C_KM_S, estimate: false, note: 'Earth–Mars distance right now (JPL planetary elements)' };
  }
  const earth = planetHelio('earth', jdTT(date));
  switch (id) {
    case 'pioneer-10':
      return path(distance(pioneerHelio(id, date), earth), true, "Estimate from JPL's predicted path; no signal since 2003");
    case 'pioneer-11':
      return path(distance(pioneerHelio(id, date), earth), true, "Estimate from JPL's predicted path; no signal since 1995");
    case 'kepler':
      return path(keplerEarthDistanceAU(date), true, 'Rough estimate: Kepler slips about 7° further behind Earth each year');
    case 'dawn':
      return smallBodyPath('ceres', date, 'Earth–Ceres distance right now (JPL orbit of Ceres)');
    case 'near-shoemaker':
      return smallBodyPath('eros', date, 'Earth–Eros distance right now (JPL orbit of Eros)');
    default:
      return { distanceKm: null, roundTripS: null, estimate: true, note: 'No distance estimate available' };
  }
}
