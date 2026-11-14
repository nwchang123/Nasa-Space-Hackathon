import { describe, expect, it } from 'vitest';
import { MACHINE_BY_ID } from '../src/data/machines';
import { HOME, LEGS, TOTAL_KM, compass, compassShort, flyDurationMs, greatCircleKm, initialBearing, interpolate } from '../src/flight/route';
import { MACHINE_IDS } from '../src/types';

const at = (id: keyof typeof MACHINE_BY_ID) => MACHINE_BY_ID[id];

describe('great circles on Mars', () => {
  it('measures the real distances between stops', () => {
    // Spirit and Opportunity landed on nearly opposite sides of the planet.
    expect(greatCircleKm(at('spirit'), at('opportunity'))).toBeCloseTo(9647, -1);
    expect(greatCircleKm(at('viking-1'), at('pathfinder-sojourner'))).toBeCloseTo(836, -1);
    // A quarter of the way round Mars along the equator.
    expect(greatCircleKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo((Math.PI * 3389.5) / 2, 3);
  });

  it('gives initial headings and compass words', () => {
    expect(initialBearing({ lat: 0, lon: 0 }, { lat: 10, lon: 0 })).toBeCloseTo(0, 6);
    expect(initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 })).toBeCloseTo(90, 6);
    expect(initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: -10 })).toBeCloseTo(270, 6);
    expect(compass(305)).toBe('north-west');
    expect(compass(358)).toBe('north');
    expect(compassShort(177)).toBe('S');
  });

  it('interpolates along the great circle', () => {
    const a = at('spirit');
    const b = at('opportunity');
    const start = interpolate(a, b, 0);
    const end = interpolate(a, b, 1);
    expect(start.lat).toBeCloseTo(a.lat, 6);
    expect(end.lon).toBeCloseTo(b.lon, 6);
    const mid = interpolate(a, b, 0.5);
    expect(greatCircleKm(a, mid)).toBeCloseTo(greatCircleKm(mid, b), 3);
    const same = interpolate(a, a, 0.4);
    expect(same.lat).toBeCloseTo(a.lat, 9);
  });
});

describe('Flight 73 route', () => {
  it('starts at home, visits every stop in order and ends at home', () => {
    expect(LEGS).toHaveLength(MACHINE_IDS.length);
    expect(LEGS[0].from).toBe(HOME);
    expect(LEGS.map(l => l.to)).toEqual([...MACHINE_IDS]);
    expect(LEGS[LEGS.length - 1].to).toBe(HOME);
    for (let i = 1; i < LEGS.length; i++) expect(LEGS[i].from).toBe(LEGS[i - 1].to);
  });

  it('adds up to roughly 53,000 km, against 17 km for all 72 real flights', () => {
    expect(TOTAL_KM).toBeGreaterThan(52_500);
    expect(TOTAL_KM).toBeLessThan(54_500);
    expect(LEGS[0].distanceKm).toBeCloseTo(6676, -1); // Jezero to Viking 1
  });

  it('times longer legs longer, within limits', () => {
    expect(flyDurationMs(0)).toBe(2500);
    expect(flyDurationMs(5)).toBeLessThan(2600);
    expect(flyDurationMs(9647)).toBe(9000);
    expect(flyDurationMs(3000)).toBeGreaterThan(flyDurationMs(1000));
  });
});
