// Mars solar time and sub-solar point.
// Algorithm: Allison & McEwen (2000), Planet. Space Sci. 48, 215; as published for NASA GISS Mars24
// (https://www.giss.nasa.gov/tools/mars24/help/algorithm.html). Accuracy ~0.01° in Ls, a few seconds in time.

import { DEG } from '../geo';
import { jdTT } from './time';

// Perturbers (step B-3): amplitude A (deg), period τ (Julian years), phase φ (deg).
const PBS_A = [0.0071, 0.0057, 0.0039, 0.0037, 0.0021, 0.002, 0.0018];
const PBS_TAU = [2.2353, 2.7543, 1.1177, 15.7866, 2.1354, 2.4694, 32.8493];
const PBS_PHI = [49.409, 168.173, 191.837, 21.736, 15.704, 95.528, 49.095];

export interface Mars24 {
  /** Days of TT since J2000 (step A-6). */
  dtJ2000: number;
  /** Mars mean anomaly, deg (B-1). */
  meanAnomaly: number;
  /** Angle of the fictitious mean sun, deg (B-2). */
  alphaFMS: number;
  /** Perturbers, deg (B-3). */
  pbs: number;
  /** Equation of centre ν − M, deg (B-4). */
  nuMinusM: number;
  /** Areocentric solar longitude Ls, deg 0–360 (B-5). */
  ls: number;
  /** Equation of time, deg (C-1). */
  eot: number;
  /** Mean solar time at the prime meridian (Airy-0), hours 0–24 (C-2). */
  mst: number;
  /** Sub-solar WEST longitude, deg 0–360 (C-5). */
  subsolarWest: number;
  /** Planetographic solar declination = sub-solar latitude, deg (D-1). */
  declination: number;
  /** Heliocentric distance, AU (D-2). */
  helioDistAU: number;
}

const mod = (x: number, m: number) => ((x % m) + m) % m;
const sind = (x: number) => Math.sin(x * DEG);
const cosd = (x: number) => Math.cos(x * DEG);

/** Full Mars24 computation from a Julian Ephemeris Date (TT). */
export function mars24FromJde(jde: number): Mars24 {
  const dt = jde - 2451545.0; // A-6
  const M = 19.3871 + 0.52402073 * dt; // B-1
  const alphaFMS = 270.3871 + 0.524038496 * dt; // B-2
  let pbs = 0; // B-3
  for (let i = 0; i < 7; i++) pbs += PBS_A[i] * cosd((0.985626 * dt) / PBS_TAU[i] + PBS_PHI[i]);
  const nuMinusM = // B-4
    (10.691 + 3.0e-7 * dt) * sind(M) +
    0.623 * sind(2 * M) +
    0.05 * sind(3 * M) +
    0.005 * sind(4 * M) +
    0.0005 * sind(5 * M) +
    pbs;
  const ls = mod(alphaFMS + nuMinusM, 360); // B-5
  const eot = 2.861 * sind(2 * ls) - 0.071 * sind(4 * ls) + 0.002 * sind(6 * ls) - nuMinusM; // C-1
  const mst = mod(24 * ((jde - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626), 24); // C-2
  const subsolarWest = mod(mst * 15 + eot + 180, 360); // C-5
  const declination = Math.asin(0.42565 * sind(ls)) / DEG + 0.25 * sind(ls); // D-1
  const helioDistAU = // D-2
    1.5236 * (1.00436 - 0.09309 * cosd(M) - 0.004336 * cosd(2 * M) - 0.00031 * cosd(3 * M) - 0.00003 * cosd(4 * M));
  return { dtJ2000: dt, meanAnomaly: mod(M, 360), alphaFMS: mod(alphaFMS, 360), pbs, nuMinusM, ls, eot, mst, subsolarWest, declination, helioDistAU };
}

export function mars24(date: Date): Mars24 {
  return mars24FromJde(jdTT(date));
}

/** Local true solar time (C-3, C-4) at an EAST longitude, hours 0–24. */
export function marsLTST(m: Mars24, lonEast: number): number {
  return mod(m.mst + lonEast / 15 + m.eot / 15, 24);
}
