import { describe, expect, it } from 'vitest';
import { markerStatus, markersInteractive, markerVisual, PALETTE, type MarkerInput } from '../src/scene/markerState';
import { cameraGoal, titleSunOffsetDeg } from '../src/scene/layout';
import { paintMars } from '../src/scene/proceduralMaps';
import type { FlightState } from '../src/store';

const base: MarkerInput = { status: 'upcoming', hovered: false, interactive: true, t: 0, reduced: true };
const flight = (stage: FlightState['stage'], leg: number): FlightState => ({ leg, stage, from: 'ingenuity', stageStartedAt: 0, flyMs: 4000 });

describe('marker status on Flight 73', () => {
  it('on the title screen every stop is ahead, and Ingenuity marks the start', () => {
    expect(markerStatus('viking-1', 'title', flight('prologue', -1), {})).toBe('upcoming');
    expect(markerStatus('ingenuity', 'title', flight('prologue', -1), {})).toBe('destination');
  });
  it('the stop being flown to, or stood at, is the destination', () => {
    expect(markerStatus('viking-2', 'flight', flight('flying', 1), { 'viking-1': true })).toBe('destination');
    expect(markerStatus('viking-2', 'flight', flight('site', 1), { 'viking-1': true, 'viking-2': true })).toBe('destination');
  });
  it('visited stops stay visited, the rest are upcoming', () => {
    expect(markerStatus('viking-1', 'flight', flight('flying', 1), { 'viking-1': true })).toBe('visited');
    expect(markerStatus('spirit', 'flight', flight('flying', 1), { 'viking-1': true })).toBe('upcoming');
    expect(markerStatus('spirit', 'report', flight('epilogue', 9), { spirit: true })).toBe('visited');
  });
  it('hover labels work in every phase, the title screen included', () => {
    expect(markersInteractive('title')).toBe(true);
    expect(markersInteractive('flight')).toBe(true);
    expect(markersInteractive('report')).toBe(true);
  });
});

describe('marker looks', () => {
  it('upcoming is a dim ghost blue', () => {
    const v = markerVisual(base);
    expect(v.color).toBe(PALETTE.ghost);
    expect(v.intensity).toBeLessThan(0.7);
  });
  it('the destination is amber with a pulse ring', () => {
    const v = markerVisual({ ...base, status: 'destination' });
    expect(v.color).toBe(PALETTE.amber);
    expect(v.ring).toBe('pulse');
  });
  it('visited is bone and dim', () => {
    const v = markerVisual({ ...base, status: 'visited' });
    expect(v.color).toBe(PALETTE.bone);
    expect(v.intensity).toBeLessThan(markerVisual({ ...base, status: 'destination' }).intensity);
  });
  it('hover brightens only when hover is allowed', () => {
    expect(markerVisual({ ...base, hovered: true }).intensity).toBeGreaterThan(markerVisual(base).intensity);
    expect(markerVisual({ ...base, hovered: true, interactive: false }).intensity).toBe(markerVisual(base).intensity);
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
  it('anchorX 0.7 puts the title globe on the right', () => {
    const g = cameraGoal({ center: [0, 0, 0], dir: [0, 0, 1], radius: 1, aspect: 1.8, fovDeg: 40, anchorX: 0.7 });
    expect(g.target[0]).toBeLessThan(0);
  });
});

describe('the painted fallback map puts features where they really are', () => {
  const W = 720;
  const H = 360;
  const at = (px: Uint8ClampedArray, lat: number, lon: number) => {
    const j = Math.floor(((90 - lat) / 180) * H);
    const i = Math.floor(((lon + 180) / 360) * W);
    const k = (j * W + i) * 4;
    return (px[k] + px[k + 1] + px[k + 2]) / 3;
  };
  it('Hellas is brighter than Syrtis Major; the north cap is white', () => {
    const mars = paintMars(W, H);
    expect(mars.length).toBe(W * H * 4);
    expect(at(mars, -42.4, 70.5)).toBeGreaterThan(at(mars, 8.4, 69.5) + 30);
    expect(at(mars, 88, 0)).toBeGreaterThan(200);
  });
});

describe('title view turns toward the start of Flight 73', () => {
  const sun: [number, number, number] = [0, 0, 1];
  const at = (deg: number): [number, number, number] => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];
  it('keeps the Sun 50° to the left when the start is already in view', () => {
    expect(titleSunOffsetDeg(sun, at(60))).toBe(-50);
    expect(titleSunOffsetDeg(sun, at(20))).toBe(-50);
  });
  it('turns up to 75° from the Sun, either side, to show it', () => {
    expect(titleSunOffsetDeg(sun, at(-135))).toBe(75);
    expect(titleSunOffsetDeg(sun, at(-60))).toBeCloseTo(60, 6);
    expect(titleSunOffsetDeg(sun, at(130))).toBe(-75);
  });
  it('stays on the day side when the start is near its midnight', () => {
    expect(titleSunOffsetDeg(sun, at(180))).toBe(-50);
  });
});
