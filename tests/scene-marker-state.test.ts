import { describe, expect, it } from 'vitest';
import { markerVisual, PALETTE, type MarkerInput } from '../src/scene/markerState';
import { cameraGoal, timelapseSunOffsetDeg } from '../src/scene/layout';
import { paintMars, paintMoon } from '../src/scene/proceduralMaps';

const base: MarkerInput = {
  phase: 'rollcall',
  timelapseYear: null,
  arrivedYear: 2004.07,
  lastContactYear: 2018.44,
  selected: false,
  hovered: false,
  t: 0,
  reduced: true,
};

describe('marker states during the time-lapse', () => {
  it('is hidden before arrival', () => {
    expect(markerVisual({ ...base, phase: 'timelapse', timelapseYear: 2000 }).visible).toBe(false);
  });
  it('flares amber on arrival, then holds steady amber', () => {
    const flare = markerVisual({ ...base, phase: 'timelapse', timelapseYear: 2004.1 });
    const steady = markerVisual({ ...base, phase: 'timelapse', timelapseYear: 2010 });
    expect(flare.color).toBe(PALETTE.amber);
    expect(flare.intensity).toBeGreaterThan(steady.intensity);
    expect(steady.color).toBe(PALETTE.amber);
  });
  it('fades to ghost blue after the last signal', () => {
    const v = markerVisual({ ...base, phase: 'timelapse', timelapseYear: 2025 });
    expect(v.color).toBe(PALETTE.ghost);
    expect(v.interactive).toBe(false);
  });
  it('handles a two-week mission (arrival flare still visible after silence)', () => {
    const v = markerVisual({ ...base, phase: 'timelapse', arrivedYear: 1967.3, lastContactYear: 1967.34, timelapseYear: 1967.4 });
    expect(v.visible).toBe(true);
    expect(v.intensity).toBeGreaterThan(1);
  });
});

describe('marker states during the roll call', () => {
  it('idles ghost blue', () => {
    expect(markerVisual(base).color).toBe(PALETTE.ghost);
  });
  it('selected is amber with a pulse ring', () => {
    const v = markerVisual({ ...base, selected: true });
    expect(v.color).toBe(PALETTE.amber);
    expect(v.ring).toBe('pulse');
  });
  it('silent call is bone with a check ring', () => {
    const v = markerVisual({ ...base, called: 'silent' });
    expect(v.color).toBe(PALETTE.bone);
    expect(v.ring).toBe('check');
  });
  it('echo is signal green and stays green when selected', () => {
    expect(markerVisual({ ...base, called: 'echo' }).color).toBe(PALETTE.signal);
    expect(markerVisual({ ...base, called: 'echo', selected: true }).color).toBe(PALETTE.signal);
  });
  it('is not interactive on the title screen', () => {
    expect(markerVisual({ ...base, phase: 'title' }).interactive).toBe(false);
  });
});

describe('camera framing', () => {
  it('pushes the subject left on wide screens and up on portrait screens', () => {
    const wide = cameraGoal({ center: [0, 0, 0], dir: [0, 0, 1], radius: 1, aspect: 1.8, fovDeg: 40 });
    expect(wide.target[0]).toBeGreaterThan(0); // target right of subject → subject appears left
    const tall = cameraGoal({ center: [0, 0, 0], dir: [0, 0, 1], radius: 1, aspect: 0.46, fovDeg: 40 });
    expect(tall.target[1]).toBeLessThan(0); // target below subject → subject appears high
    expect(Math.hypot(...tall.position)).toBeGreaterThan(Math.hypot(...wide.position));
  });
});

describe('time-lapse lighting sweep', () => {
  it('lands exactly on the real lighting at the present', () => {
    expect(timelapseSunOffsetDeg(2026.87, 2026.87)).toBe(0);
    expect(Math.abs(timelapseSunOffsetDeg(1966, 2026.87))).toBeGreaterThan(0);
  });
});

describe('illustrative maps put features where they really are', () => {
  const W = 720;
  const H = 360;
  const at = (px: Uint8ClampedArray, lat: number, lon: number) => {
    const j = Math.floor(((90 - lat) / 180) * H);
    const i = Math.floor(((lon + 180) / 360) * W);
    const k = (j * W + i) * 4;
    return (px[k] + px[k + 1] + px[k + 2]) / 3;
  };
  it('Moon: Mare Tranquillitatis is darker than the southern highlands', () => {
    const moon = paintMoon(W, H);
    expect(moon.length).toBe(W * H * 4);
    expect(at(moon, 8.5, 31.4)).toBeLessThan(at(moon, -30, 20) - 30);
    expect(at(moon, 32.8, -15.6)).toBeLessThan(at(moon, -30, 20) - 30); // Imbrium
  });
  it('Mars: Hellas is brighter than Syrtis Major; the north cap is white', () => {
    const mars = paintMars(W, H);
    expect(at(mars, -42.4, 70.5)).toBeGreaterThan(at(mars, 8.4, 69.5) + 30);
    expect(at(mars, 88, 0)).toBeGreaterThan(200);
  });
});
