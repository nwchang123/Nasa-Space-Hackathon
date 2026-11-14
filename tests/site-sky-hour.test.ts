import { describe, expect, it } from 'vitest';
import { marsLocalSolarTime, marsSubSolar, siteSky, siteSkyAtHour } from '../src/astro';

const date = new Date('2026-11-14T10:00:00Z');
// Spirit at Troy and Phoenix in the Martian arctic.
const SPIRIT = { lat: -14.6, lon: 175.5 };
const PHOENIX = { lat: 68.22, lon: -125.7 };

describe('sun at a chosen local solar hour', () => {
  it('matches the real sky at the real local solar time', () => {
    for (const site of [SPIRIT, PHOENIX]) {
      const now = siteSky('mars', site.lat, site.lon, date);
      const at = siteSkyAtHour(site.lat, site.lon, marsLocalSolarTime(date, site.lon), date);
      expect(at.elevationDeg).toBeCloseTo(now.elevationDeg, 1);
      const dAz = Math.abs(((at.azimuthDeg - now.azimuthDeg + 540) % 360) - 180);
      expect(dAz).toBeLessThan(0.5);
    }
  });
  it('puts the Sun on the meridian at noon, highest there, and below the horizon at midnight', () => {
    const dec = marsSubSolar(date).lat;
    const noon = siteSkyAtHour(SPIRIT.lat, SPIRIT.lon, 12, date);
    expect(noon.elevationDeg).toBeCloseTo(90 - Math.abs(SPIRIT.lat - dec), 3);
    expect(siteSkyAtHour(SPIRIT.lat, SPIRIT.lon, 11, date).elevationDeg).toBeLessThan(noon.elevationDeg);
    expect(siteSkyAtHour(SPIRIT.lat, SPIRIT.lon, 0, date).elevationDeg).toBeLessThan(0);
    expect(siteSkyAtHour(SPIRIT.lat, SPIRIT.lon, 24, date).elevationDeg).toBeCloseTo(siteSkyAtHour(SPIRIT.lat, SPIRIT.lon, 0, date).elevationDeg, 6);
  });
  it('rises in the east and sets in the west', () => {
    const morning = siteSkyAtHour(SPIRIT.lat, SPIRIT.lon, 7, date);
    const evening = siteSkyAtHour(SPIRIT.lat, SPIRIT.lon, 17, date);
    expect(morning.azimuthDeg).toBeGreaterThan(0);
    expect(morning.azimuthDeg).toBeLessThan(180);
    expect(evening.azimuthDeg).toBeGreaterThan(180);
    expect(morning.localSolarHours).toBe(7);
  });
});
