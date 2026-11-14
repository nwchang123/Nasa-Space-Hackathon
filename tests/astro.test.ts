// Reference values:
//  - Mars24 worked example for 2000-01-06 00:00 UTC (NASA GISS Mars24 algorithm page; the sub-solar
//    longitude follows from its own LTST: (LTST − 12 h) × 15°).
//  - Meeus, Astronomical Algorithms, examples 47.a and 53.a (1992-04-12 0h TD).
//  - JPL Horizons (DE441), geocentric observer, queried 2026-11-14. Horizons gives Mars longitudes
//    west-positive and as SEEN from Earth, i.e. one light-time earlier; tests shift time accordingly.

import { describe, expect, it } from 'vitest';
import {
  AU_KM,
  C_KM_S,
  earthMarsDistanceKm,
  earthMoonDistanceKm,
  heliocentricAU,
  keplerTrailAngleDeg,
  marsLocalSolarTime,
  marsSubSolar,
  moonSubEarth,
  moonSubSolar,
  signalPath,
  siteSky,
  sunElevation,
} from '../src/astro';
import { mars24, mars24FromJde, marsLTST } from '../src/astro/mars24';
import { moonPosition, moonSubEarthJde, moonSubSolarJde } from '../src/astro/moon';
import { jdTT, ttMinusUtcSeconds } from '../src/astro/time';
import { wrap180 } from '../src/geo';

const utc = (s: string) => new Date(s.endsWith('Z') ? s : s + 'Z');
/** Signed angular difference a − b in degrees, −180..180. */
const dAng = (a: number, b: number) => wrap180(a - b);
const NOW = utc('2026-11-14T07:00:00');

describe('time scales', () => {
  it('uses the right TT − UTC', () => {
    expect(ttMinusUtcSeconds(Date.UTC(2000, 0, 6))).toBeCloseTo(64.184, 6);
    expect(ttMinusUtcSeconds(NOW.getTime())).toBeCloseTo(69.184, 6);
  });
});

describe('Mars24', () => {
  const ex = mars24(utc('2000-01-06T00:00:00'));

  it('reproduces the published worked example (2000-01-06 00:00 UTC)', () => {
    expect(jdTT(utc('2000-01-06T00:00:00'))).toBeCloseTo(2451549.500743, 6);
    expect(ex.meanAnomaly).toBeCloseTo(21.7456, 3);
    expect(ex.pbs).toBeCloseTo(0.00142, 4);
    expect(ex.ls).toBeCloseTo(277.1876, 2);
    expect(ex.eot).toBeCloseTo(-5.1877, 2);
    expect(ex.mst).toBeCloseTo(23.9943, 3);
    expect(marsLTST(ex, 0)).toBeCloseTo(23.6484, 3);
  });

  it('puts the sub-solar point where local true solar time is noon', () => {
    // LTST(0°) = 23.6484 h → noon lies (23.6484 − 12) × 15 = 174.726° west.
    expect(ex.subsolarWest).toBeCloseTo(174.726, 2);
    expect(marsLTST(ex, -ex.subsolarWest)).toBeCloseTo(12, 6);
    expect(ex.declination).toBeCloseTo(-25.228, 2);
  });

  it('matches JPL Horizons once light time is accounted for', () => {
    const cases = [
      // UTC, Horizons sun sub-lon (W), sub-lat, Earth–Mars delta (AU)
      ['2000-01-06T00:00:00', 170.939055, -25.240397, 1.87411042262838],
      ['2023-11-18T00:00:00', 100.429534, 12.371018, 2.52642139077734],
      ['2025-01-12T00:00:00', 355.722355, 12.039051, 0.64231191259244],
      ['2026-11-14T07:00:00', 112.016779, 9.164569, 1.32188290143337],
    ] as const;
    for (const [t, lonW, lat, delta] of cases) {
      const lightTimeMs = ((delta * AU_KM) / C_KM_S) * 1000;
      const emitted = new Date(utc(t).getTime() - lightTimeMs);
      const sub = marsSubSolar(emitted);
      expect(Math.abs(dAng(sub.lon, -lonW))).toBeLessThan(0.05);
      expect(Math.abs(sub.lat - lat)).toBeLessThan(0.05);
    }
  });

  it('gives local solar time that advances 15° per hour of longitude', () => {
    const a = marsLocalSolarTime(NOW, 0);
    const b = marsLocalSolarTime(NOW, 77.45);
    expect(((b - a + 24) % 24)).toBeCloseTo(77.45 / 15, 6);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(24);
  });

  it('keeps a sol of 24.6597 hours', () => {
    const sol = 1.0274912517; // days
    expect(mars24FromJde(2461358.5 + sol).mst).toBeCloseTo(mars24FromJde(2461358.5).mst, 6);
  });
});

describe('Moon', () => {
  it('reproduces Meeus example 47.a (1992-04-12 0h TD)', () => {
    const p = moonPosition(2448724.5);
    expect(p.lon).toBeCloseTo(133.162655, 1);
    expect(p.lat).toBeCloseTo(-3.229126, 1);
    expect(Math.abs(p.distanceKm - 368409.7)).toBeLessThan(60);
  });

  it('reproduces Meeus example 53.a libration and Sun position', () => {
    const e = moonSubEarthJde(2448724.5);
    expect(e.lon).toBeCloseTo(-1.206, 1);
    expect(e.lat).toBeCloseTo(4.194, 1);
    const s = moonSubSolarJde(2448724.5);
    expect(s.lon).toBeCloseTo(67.89, 1);
    expect(s.lat).toBeCloseTo(1.46, 1);
  });

  it('matches JPL Horizons sub-solar and sub-Earth points', () => {
    const cases = [
      // UTC, sub-Earth lon (E), lat, sub-solar lon (E), lat, delta (AU)
      ['1992-04-12T00:00:00', 358.767779, 4.175197, 67.885314, 1.453634, 0.0024628607811],
      ['2024-01-18T03:53:00', 5.347837, -0.923507, 95.222871, -1.51439, 0.00250476060676],
      ['2024-01-25T17:54:00', 3.182541, -6.315066, 3.151785, -1.526207, 0.0026804815252],
      ['2024-04-08T18:21:00', 1.977399, -0.463852, 181.979833, 0.113459, 0.0024051675603],
      ['2026-11-14T07:00:00', 358.371116, 4.101152, 123.062788, -1.557314, 0.00271053863662],
    ] as const;
    for (const [t, eLon, eLat, sLon, sLat, delta] of cases) {
      const d = utc(t);
      const earth = moonSubEarth(d);
      const sun = moonSubSolar(d);
      expect(Math.abs(dAng(earth.lon, eLon))).toBeLessThan(0.1);
      expect(Math.abs(earth.lat - eLat)).toBeLessThan(0.1);
      expect(Math.abs(dAng(sun.lon, sLon))).toBeLessThan(0.1);
      expect(Math.abs(sun.lat - sLat)).toBeLessThan(0.05);
      expect(Math.abs(earthMoonDistanceKm(d) - delta * AU_KM)).toBeLessThan(100);
    }
  });

  it('lights the near side at full moon and the far side at new moon', () => {
    expect(Math.abs(dAng(moonSubSolar(utc('2024-01-25T17:54:00')).lon, 0))).toBeLessThan(9);
    expect(Math.abs(dAng(moonSubSolar(utc('2024-04-08T18:21:00')).lon, 180))).toBeLessThan(9);
    expect(Math.abs(dAng(moonSubSolar(utc('2024-01-18T03:53:00')).lon, 90))).toBeLessThan(9);
  });

  it('keeps libration and distance inside physical bounds over two years', () => {
    for (let k = 0; k < 730; k += 1.7) {
      const d = new Date(Date.UTC(2025, 0, 1) + k * 86_400_000);
      const sub = moonSubSolar(d);
      const earth = moonSubEarth(d);
      expect(Math.abs(sub.lat)).toBeLessThanOrEqual(1.6);
      expect(Math.abs(earth.lon)).toBeLessThanOrEqual(8.5);
      expect(Math.abs(earth.lat)).toBeLessThanOrEqual(7);
      const km = earthMoonDistanceKm(d);
      expect(km).toBeGreaterThan(356_000);
      expect(km).toBeLessThan(407_000);
    }
  });
});

describe('planets and small bodies', () => {
  it('matches Horizons Earth–Mars distances', () => {
    expect(earthMarsDistanceKm(utc('2025-01-12T00:00:00')) / AU_KM).toBeCloseTo(0.6423, 2);
    expect(Math.abs(earthMarsDistanceKm(utc('2025-01-12T00:00:00')) / AU_KM - 0.642312)).toBeLessThan(0.003);
    expect(Math.abs(earthMarsDistanceKm(utc('2023-11-18T00:00:00')) / AU_KM - 2.526421)).toBeLessThan(0.003);
    expect(Math.abs(earthMarsDistanceKm(NOW) / AU_KM - 1.321883)).toBeLessThan(0.003);
  });

  it('keeps Earth near 1 AU and Mars between perihelion and aphelion', () => {
    for (let y = 1966; y <= 2030; y += 0.37) {
      const d = new Date(Date.UTC(Math.floor(y), 0, 1) + (y % 1) * 365.25 * 86_400_000);
      const e = heliocentricAU('earth', d)!;
      const m = heliocentricAU('mars', d)!;
      expect(Math.hypot(...e)).toBeGreaterThan(0.98);
      expect(Math.hypot(...e)).toBeLessThan(1.02);
      expect(Math.hypot(...m)).toBeGreaterThan(1.38);
      expect(Math.hypot(...m)).toBeLessThan(1.67);
    }
  });

  it('matches Horizons Earth–Ceres and Earth–Eros distances now', () => {
    expect(Math.abs(signalPath('dawn', 'deep', NOW).distanceKm! / AU_KM - 2.02541574888131)).toBeLessThan(0.01);
    expect(Math.abs(signalPath('near-shoemaker', 'deep', NOW).distanceKm! / AU_KM - 2.48016401071361)).toBeLessThan(0.01);
    expect(signalPath('dawn', 'deep', NOW).estimate).toBe(false);
    expect(signalPath('dawn', 'deep', utc('2015-03-06T00:00:00')).estimate).toBe(true);
  });
});

describe('deep-space estimates', () => {
  it('tracks the Horizons Pioneer trajectories', () => {
    const cases = [
      ['pioneer-10', '2026-11-14T07:00:00', 141.359549557049],
      ['pioneer-10', '2020-01-01T00:00:00', 124.10507377776],
      ['pioneer-10', '2030-01-01T00:00:00', 149.100872540612],
      ['pioneer-11', '2026-11-14T07:00:00', 118.808622820387],
      ['pioneer-11', '2018-10-30T00:00:00', 99.790398079738],
      ['pioneer-11', '2010-01-01T00:00:00', 79.4782930830767],
    ] as const;
    for (const [id, t, delta] of cases) {
      const p = signalPath(id, 'deep', utc(t));
      expect(p.estimate).toBe(true);
      expect(Math.abs(p.distanceKm! / AU_KM - delta)).toBeLessThan(0.1);
    }
  });

  it('models Kepler drifting behind Earth', () => {
    expect(keplerTrailAngleDeg(utc('2009-01-01T00:00:00'))).toBe(0);
    const rate = keplerTrailAngleDeg(utc('2020-03-07T00:00:00')) - keplerTrailAngleDeg(utc('2019-03-07T00:00:00'));
    expect(rate).toBeGreaterThan(6.5);
    expect(rate).toBeLessThan(7.5);
    // Horizons (KEPLER_FINAL_56_traj) geocentric range.
    expect(Math.abs(signalPath('kepler', 'deep', utc('2018-10-30T00:00:00')).distanceKm! / AU_KM - 1.13605913348624)).toBeLessThan(0.03);
    expect(Math.abs(signalPath('kepler', 'deep', NOW).distanceKm! / AU_KM - 1.7894017848632)).toBeLessThan(0.03);
  });
});

describe('sky and signal paths', () => {
  it('computes sun elevation on a sphere', () => {
    expect(sunElevation({ lat: 10, lon: 20 }, 10, 20)).toBeCloseTo(90, 4);
    expect(sunElevation({ lat: 10, lon: 20 }, -10, -160)).toBeCloseTo(-90, 4);
    expect(sunElevation({ lat: 0, lon: 0 }, 0, 90)).toBeCloseTo(0, 6);
  });

  it('reports day and night consistently with the sub-solar point', () => {
    const sub = moonSubSolar(NOW);
    expect(siteSky('moon', sub.lat, sub.lon, NOW).isDay).toBe(true);
    expect(siteSky('moon', -sub.lat, wrap180(sub.lon + 180), NOW).isDay).toBe(false);
    // Mars: elevation must agree with the hour angle from local true solar time.
    const DEGR = Math.PI / 180;
    for (let k = 0; k < 40; k++) {
      const d = new Date(NOW.getTime() + k * 2.3 * 3_600_000);
      const sky = siteSky('mars', 18.4447, 77.4508, d);
      const decl = marsSubSolar(d).lat;
      const H = (sky.localSolarHours! - 12) * 15;
      const expected =
        Math.asin(Math.sin(18.4447 * DEGR) * Math.sin(decl * DEGR) + Math.cos(18.4447 * DEGR) * Math.cos(decl * DEGR) * Math.cos(H * DEGR)) / DEGR;
      expect(Math.abs(sky.elevationDeg - expected)).toBeLessThan(0.01);
      expect(sky.isDay).toBe(sky.elevationDeg > 0);
    }
    expect(siteSky('moon', 0.674, 23.473, NOW).localSolarHours).toBeUndefined();
  });

  it('gives real round-trip light times', () => {
    const moon = signalPath('apollo-11', 'moon', NOW);
    expect(moon.estimate).toBe(false);
    expect(moon.roundTripS!).toBeGreaterThan(2.37);
    expect(moon.roundTripS!).toBeLessThan(2.72);
    const mars = signalPath('opportunity', 'mars', NOW);
    expect(mars.roundTripS!).toBeCloseTo((2 * mars.distanceKm!) / C_KM_S, 6);
    expect(mars.roundTripS! / 60).toBeGreaterThan(21);
    expect(mars.roundTripS! / 60).toBeLessThan(23);
    const p10 = signalPath('pioneer-10', 'deep', NOW);
    expect(p10.roundTripS! / 3600).toBeGreaterThan(38);
    expect(p10.roundTripS! / 3600).toBeLessThan(40);
    for (const id of ['pioneer-10', 'pioneer-11', 'kepler', 'dawn', 'near-shoemaker'] as const) {
      const p = signalPath(id, 'deep', NOW);
      expect(p.distanceKm).not.toBeNull();
      expect(p.note.length).toBeGreaterThan(10);
    }
  });
});
