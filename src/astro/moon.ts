// Moon and Sun positions, lunar libration and the selenographic sub-solar point.
// Sources: J. Meeus, Astronomical Algorithms, 2nd ed. (1998):
//   ch. 25 (Sun, low accuracy), ch. 47 (Moon, main ELP-2000/82 terms), ch. 53 (physical ephemeris of the Moon).
// Accuracy against JPL Horizons: ~0.05° for the sub-solar / sub-Earth points, ~50 km in distance.

import { DEG } from '../geo';
import { centuriesTT } from './time';
import { AU_KM_CONST } from './constants';

const sind = (x: number) => Math.sin(x * DEG);
const cosd = (x: number) => Math.cos(x * DEG);
const mod360 = (x: number) => ((x % 360) + 360) % 360;
const wrap180 = (x: number) => {
  const y = mod360(x + 180) - 180;
  return y === -180 ? 180 : y;
};

/** Inclination of the mean lunar equator to the ecliptic (Meeus ch. 53). */
const I_MOON = 1.54242;

/** Fundamental arguments of the lunar theory, degrees (Meeus 47.1–47.7, 22 for Ω). */
export function lunarArguments(T: number) {
  const T2 = T * T,
    T3 = T2 * T,
    T4 = T3 * T;
  return {
    Lp: mod360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000),
    D: mod360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000),
    M: mod360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000),
    Mp: mod360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000),
    F: mod360(93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000),
    Om: mod360(125.0445479 - 1934.1362891 * T + 0.0020754 * T2 + T3 / 467441 - T4 / 60616000),
  };
}

// Meeus table 47.A: multiples of D, M, M', F; Σl coefficient (1e-6 deg); Σr coefficient (1e-3 km).
// The largest 36 periodic terms (everything above ~0.0015° / ~4 km).
const TERMS_LR: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
];

// Meeus table 47.B: multiples of D, M, M', F; Σb coefficient (1e-6 deg). Largest 30 terms.
const TERMS_B: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
];

export interface MoonPosition {
  /** Geocentric ecliptic longitude, mean equinox of date, deg. */
  lon: number;
  /** Geocentric ecliptic latitude, deg. */
  lat: number;
  /** Centre-to-centre distance, km. */
  distanceKm: number;
}

/** Geocentric Moon position (Meeus ch. 47, main terms). jde = Julian Ephemeris Date. */
export function moonPosition(jde: number): MoonPosition {
  const T = centuriesTT(jde);
  const { Lp, D, M, Mp, F } = lunarArguments(T);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sl = 0,
    sr = 0,
    sb = 0;
  for (const [d, m, mp, f, cl, cr] of TERMS_LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sl += cl * e * sind(arg);
    sr += cr * e * cosd(arg);
  }
  for (const [d, m, mp, f, cb] of TERMS_B) {
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sb += cb * e * sind(d * D + m * M + mp * Mp + f * F);
  }
  // Additive terms: Venus (A1), Jupiter (A2) and Earth's flattening (L').
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  const A3 = 313.45 + 481266.484 * T;
  sl += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  sb += -2235 * sind(Lp) + 382 * sind(A3) + 175 * sind(A1 - F) + 175 * sind(A1 + F) + 127 * sind(Lp - Mp) - 115 * sind(Lp + Mp);
  return { lon: mod360(Lp + sl / 1e6), lat: sb / 1e6, distanceKm: 385000.56 + sr / 1000 };
}

export interface SunPosition {
  /** Geocentric ecliptic longitude corrected for aberration, mean equinox of date, deg. */
  lon: number;
  /** Earth–Sun distance, km. */
  distanceKm: number;
}

/** Low-accuracy Sun (Meeus ch. 25), ~0.01°. Nutation is left out to match moonPosition. */
export function sunPosition(jde: number): SunPosition {
  const T = centuriesTT(jde);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M) + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
  const trueLon = L0 + C;
  const v = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cosd(v));
  return { lon: mod360(trueLon - 0.00569), distanceKm: R * AU_KM_CONST };
}

/**
 * Optical libration (Meeus 53.1): selenographic longitude/latitude of the point where a body
 * with geocentric-style ecliptic coordinates (lon, lat) is overhead.
 */
function selenographic(lon: number, lat: number, T: number): { lon: number; lat: number } {
  const { F, Om } = lunarArguments(T);
  const W = lon - Om;
  const A =
    Math.atan2(sind(W) * cosd(lat) * cosd(I_MOON) - sind(lat) * sind(I_MOON), cosd(W) * cosd(lat)) / DEG;
  const b = Math.asin(-sind(W) * cosd(lat) * sind(I_MOON) - sind(lat) * cosd(I_MOON)) / DEG;
  return { lon: wrap180(A - F), lat: b };
}

/** Sub-Earth point on the Moon (optical libration), deg; physical libration (≤0.04°) omitted. */
export function moonSubEarthJde(jde: number): { lat: number; lon: number } {
  const T = centuriesTT(jde);
  const moon = moonPosition(jde);
  return selenographic(moon.lon, moon.lat, T);
}

/** Selenographic sub-solar point (Meeus ch. 53, "selenographic position of the Sun"), deg. */
export function moonSubSolarJde(jde: number): { lat: number; lon: number } {
  const T = centuriesTT(jde);
  const moon = moonPosition(jde);
  const sun = sunPosition(jde);
  const ratio = moon.distanceKm / sun.distanceKm;
  // Heliocentric direction of the Moon, i.e. the Sun as seen from the Moon reversed.
  const lonH = sun.lon + 180 + (ratio / DEG) * cosd(moon.lat) * sind(sun.lon - moon.lon);
  const latH = ratio * moon.lat;
  return selenographic(lonH, latH, T);
}
