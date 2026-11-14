import { describe, expect, it } from 'vitest';
import { ORBIT_EL_MAX, ORBIT_EL_MIN, ORBIT_ZOOM_MAX, ORBIT_ZOOM_MIN, orbitAfterDrag, orbitAfterWheel } from '../src/scene/siteOrbit';

const start = { az: 0, el: 0, zoom: 1 };

describe('site orbit input', () => {
  it('dragging right turns the camera clockwise (az falls); dragging down raises it', () => {
    const o = orbitAfterDrag(start, 100, 50);
    expect(o.az).toBeLessThan(0);
    expect(o.el).toBeGreaterThan(0);
    expect(o.zoom).toBe(1);
  });
  it('keeps the elevation within its limits', () => {
    expect(orbitAfterDrag(start, 0, 10_000).el).toBe(ORBIT_EL_MAX);
    expect(orbitAfterDrag(start, 0, -10_000).el).toBe(ORBIT_EL_MIN);
  });
  it('wheel down moves out, up moves in, within limits', () => {
    expect(orbitAfterWheel(start, 100).zoom).toBeGreaterThan(1);
    expect(orbitAfterWheel(start, -100).zoom).toBeLessThan(1);
    expect(orbitAfterWheel(start, 1e6).zoom).toBe(ORBIT_ZOOM_MAX);
    expect(orbitAfterWheel(start, -1e6).zoom).toBe(ORBIT_ZOOM_MIN);
  });
});
