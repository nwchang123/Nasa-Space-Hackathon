// Rough distance models for spacecraft we can no longer track.
// Pioneer 10 / 11: heliocentric distances sampled from JPL Horizons predicted trajectories
// (sources "pioneer_10_merged", "pioneer_11_merged"; queried 2026-11-14), interpolated linearly and
// extrapolated with the 2026→2030 slope. Directions are the Horizons ecliptic longitude/latitude for
// 2026-11-14; they drift by well under a degree a year, which changes Earth range by < 0.1 AU.
// Kepler: drifts behind Earth on a slightly longer heliocentric orbit (Earth-trailing).

import { DEG } from '../geo';
import type { Vec3 } from './orbits';

/** [UTC ms, heliocentric distance AU] from JPL Horizons. */
type Sample = readonly [number, number];

const PIONEER_10: readonly Sample[] = [
  [Date.UTC(2010, 0, 1), 99.81819721829],
  [Date.UTC(2018, 9, 30), 122.0852993623],
  [Date.UTC(2020, 0, 1), 125.0271531554],
  [Date.UTC(2026, 10, 14, 7), 142.2256107578],
  [Date.UTC(2030, 0, 1), 150.0247091358],
];

const PIONEER_11: readonly Sample[] = [
  [Date.UTC(2010, 0, 1), 78.52555393756],
  [Date.UTC(2018, 9, 30), 99.41148332505],
  [Date.UTC(2020, 0, 1), 102.1663380289],
  [Date.UTC(2026, 10, 14, 7), 118.230179063],
  [Date.UTC(2030, 0, 1), 125.5273686708],
];

/** Approximate ecliptic direction (lon, lat in degrees) of each probe as seen from the Sun. */
export const PIONEER_DIRECTION = {
  'pioneer-10': { lon: 80.81, lat: 3.01 },
  'pioneer-11': { lon: 284.71, lat: 13.77 },
} as const;

function interpolate(samples: readonly Sample[], ms: number): number {
  if (ms <= samples[0][0]) {
    const [[t0, r0], [t1, r1]] = samples;
    return r0 + ((r1 - r0) * (ms - t0)) / (t1 - t0);
  }
  for (let k = 1; k < samples.length; k++) {
    const [t0, r0] = samples[k - 1];
    const [t1, r1] = samples[k];
    if (ms <= t1) return r0 + ((r1 - r0) * (ms - t0)) / (t1 - t0);
  }
  const [t0, r0] = samples[samples.length - 2];
  const [t1, r1] = samples[samples.length - 1];
  return r1 + ((r1 - r0) * (ms - t1)) / (t1 - t0);
}

/** Heliocentric J2000 ecliptic position of a Pioneer probe, AU (predicted, not tracked). */
export function pioneerHelio(id: 'pioneer-10' | 'pioneer-11', date: Date): Vec3 {
  const r = interpolate(id === 'pioneer-10' ? PIONEER_10 : PIONEER_11, date.getTime());
  const { lon, lat } = PIONEER_DIRECTION[id];
  return [r * Math.cos(lat * DEG) * Math.cos(lon * DEG), r * Math.cos(lat * DEG) * Math.sin(lon * DEG), r * Math.sin(lat * DEG)];
}

const KEPLER_LAUNCH_MS = Date.UTC(2009, 2, 7, 3, 49);
// Effective orbital period fitted to the JPL Horizons trajectory "KEPLER_FINAL_56_traj":
// it reproduces Horizons' Earth range within 0.02 AU in 2018, 2020, 2026 and 2030.
// (NASA quotes a 372.5-day period; 372.68 d also absorbs the orbit's eccentricity.)
const KEPLER_PERIOD_D = 372.68;
const EARTH_YEAR_D = 365.256363;

/** Angle by which Kepler trails Earth along Earth's orbit, degrees (rough model, 0 before launch). */
export function keplerTrail(date: Date): number {
  const days = Math.max(0, (date.getTime() - KEPLER_LAUNCH_MS) / 86_400_000);
  return days * 360 * (1 / EARTH_YEAR_D - 1 / KEPLER_PERIOD_D);
}

/** Earth–Kepler distance as a chord of a 1 AU circle, AU. */
export function keplerEarthDistanceAU(date: Date): number {
  return 2 * Math.abs(Math.sin((keplerTrail(date) * DEG) / 2));
}
