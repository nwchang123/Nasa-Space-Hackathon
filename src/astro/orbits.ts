// Heliocentric positions from Keplerian elements (J2000 ecliptic and equinox, AU).
//  - Earth–Moon barycentre and Mars: E. M. Standish, "Keplerian Elements for Approximate Positions of
//    the Major Planets", JPL SSD, table 1 (valid 1800–2050; Mars error ≲ 1′, i.e. ≲ 0.001 AU in range).
//    https://ssd.jpl.nasa.gov/planets/approx_pos.html
//  - Ceres and Eros: JPL Small-Body Database osculating elements, epoch JD 2461200.5 TDB (2026-Jun),
//    solution JPL#48 (Ceres) and JPL#659 (Eros), propagated two-body. Good to ~0.01 AU for a few years
//    either side of the epoch; not for historical dates decades away.

import { DEG } from '../geo';

export type Vec3 = [number, number, number];

/** Element value and rate per Julian century: [value, rate]. Angles in degrees. */
interface PlanetElements {
  a: readonly [number, number];
  e: readonly [number, number];
  I: readonly [number, number];
  L: readonly [number, number];
  varpi: readonly [number, number];
  Om: readonly [number, number];
}

const EM_BARY: PlanetElements = {
  a: [1.00000261, 0.00000562],
  e: [0.01671123, -0.00004392],
  I: [-0.00001531, -0.01294668],
  L: [100.46457166, 35999.37244981],
  varpi: [102.93768193, 0.32327364],
  Om: [0.0, 0.0],
};

const MARS: PlanetElements = {
  a: [1.52371034, 0.00001847],
  e: [0.0933941, 0.00007882],
  I: [1.84969142, -0.00813131],
  L: [-4.55343205, 19140.30268499],
  varpi: [-23.94362959, 0.44441088],
  Om: [49.55953891, -0.29257343],
};

interface SmallBodyElements {
  epochJd: number;
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  ma: number;
  /** Mean motion, deg/day. */
  n: number;
}

const SMALL_BODIES: Record<'ceres' | 'eros', SmallBodyElements> = {
  ceres: {
    epochJd: 2461200.5,
    a: 2.765552595034094,
    e: 0.07969229514816586,
    i: 10.58802780183462,
    om: 80.24862682043221,
    w: 73.29421453021587,
    ma: 274.4193463761342,
    n: 0.21430445064843,
  },
  eros: {
    epochJd: 2461200.5,
    a: 1.458243716760167,
    e: 0.2228779627700761,
    i: 10.82854410314273,
    om: 304.2679713350896,
    w: 178.9181319135911,
    ma: 62.51145501986792,
    n: 0.5597046347038453,
  },
};

/** Solve Kepler's equation E − e·sin E = M (radians) by Newton iteration. */
export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

/** Ecliptic position from a, e, inclination, node, argument of perihelion, mean anomaly (deg). */
export function orbitalPosition(a: number, e: number, i: number, om: number, w: number, ma: number): Vec3 {
  const M = (((ma % 360) + 540) % 360 - 180) * DEG;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w * DEG),
    sw = Math.sin(w * DEG),
    cO = Math.cos(om * DEG),
    sO = Math.sin(om * DEG),
    ci = Math.cos(i * DEG),
    si = Math.sin(i * DEG);
  return [
    (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

function planetPosition(el: PlanetElements, jde: number): Vec3 {
  const T = (jde - 2451545.0) / 36525;
  const v = (p: readonly [number, number]) => p[0] + p[1] * T;
  const varpi = v(el.varpi);
  const Om = v(el.Om);
  return orbitalPosition(v(el.a), v(el.e), v(el.I), Om, varpi - Om, v(el.L) - varpi);
}

/** Heliocentric J2000 ecliptic position of the Earth–Moon barycentre or Mars, AU. */
export function planetHelio(body: 'earth' | 'mars', jde: number): Vec3 {
  return planetPosition(body === 'earth' ? EM_BARY : MARS, jde);
}

/** Heliocentric J2000 ecliptic position of Ceres or Eros, AU (two-body from the SBDB epoch). */
export function smallBodyHelio(body: 'ceres' | 'eros', jde: number): Vec3 {
  const el = SMALL_BODIES[body];
  return orbitalPosition(el.a, el.e, el.i, el.om, el.w, el.ma + el.n * (jde - el.epochJd));
}

/** Epoch of the small-body elements (JD), for honesty checks on how far we extrapolate. */
export function smallBodyEpoch(body: 'ceres' | 'eros'): number {
  return SMALL_BODIES[body].epochJd;
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
