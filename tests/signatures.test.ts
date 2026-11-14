// The pure rules behind the signature actions (src/scene/signatures/logic.ts, fx.ts) and the
// definitions the HUD renders (src/data/signatures.ts).

import { describe, expect, it } from 'vitest';
import { SIGNATURES } from '../src/data/signatures';
import { skyLook } from '../src/scene/sites';
import { applySiteFx } from '../src/scene/signatures/fx';
import {
  buttonProgress,
  directSunlight,
  formatPercent,
  LAST_SIGNAL_TAU,
  PARACHUTE_RINGS,
  ringsDecoded,
  ROVER_PATH,
  sojournerPath,
  stormLook,
  stormReadout,
  WAKE_STEPS,
  wakeStepsDone,
} from '../src/scene/signatures/logic';
import { MACHINE_IDS } from '../src/types';

describe('buttonProgress', () => {
  it('is null before the first press', () => {
    expect(buttonProgress(undefined, 1000, 5000, false)).toBeNull();
  });
  it('runs 0..1 over the duration and clamps', () => {
    expect(buttonProgress(1000, 2000, 1000, false)).toBe(0);
    expect(buttonProgress(1000, 2000, 2000, false)).toBe(0.5);
    expect(buttonProgress(1000, 2000, 9000, false)).toBe(1);
    expect(buttonProgress(1000, 2000, 500, false)).toBe(0);
  });
  it('jumps to the end state with reduced motion', () => {
    expect(buttonProgress(1000, 2000, 1000, true)).toBe(1);
  });
});

describe('Opportunity storm model', () => {
  it('direct sunlight is 1 at tau 1 and e^-(tau-1) above', () => {
    expect(directSunlight(1)).toBe(1);
    expect(directSunlight(0.4)).toBe(1);
    expect(directSunlight(3)).toBeCloseTo(Math.exp(-2), 12);
    expect(directSunlight(10.8)).toBeCloseTo(Math.exp(-9.8), 12);
  });
  it('formats percentages for the readout', () => {
    expect(formatPercent(1)).toBe('100 %');
    expect(formatPercent(0.042)).toBe('4.2 %');
    expect(formatPercent(0.0006)).toBe('0.06 %');
    expect(formatPercent(0.00001)).toBe('< 0.01 %');
  });
  it('says it is a simple model, and names 10 June 2018 only at the last-signal tau', () => {
    expect(stormReadout(undefined)).toBe('Tau 1.0 · direct sunlight ≈ 100 % of a tau-1 day (simple model)');
    expect(stormReadout(5)).toContain('simple model');
    expect(stormReadout(5)).not.toContain('2018');
    expect(stormReadout(LAST_SIGNAL_TAU)).toContain('10 June 2018');
    expect(stormReadout(11)).toContain('Tau 11.0');
  });
  it('leaves the look untouched at tau ≤ 1 and never mutates it', () => {
    const look = skyLook(30);
    const copy = JSON.parse(JSON.stringify(look));
    expect(stormLook(look, undefined)).toBe(look);
    expect(stormLook(look, 1)).toBe(look);
    stormLook(look, 9);
    expect(look).toEqual(copy);
  });
  it('dims the Sun, darkens the light and pulls the haze in as tau grows', () => {
    const look = skyLook(30);
    const mid = stormLook(look, 4);
    const peak = stormLook(look, LAST_SIGNAL_TAU);
    expect(mid.sunIntensity).toBeLessThan(look.sunIntensity);
    expect(peak.sunIntensity).toBeLessThan(mid.sunIntensity);
    expect(peak.sunUp).toBe(0);
    expect(peak.ambientIntensity).toBeLessThan(mid.ambientIntensity);
    expect(peak.fogFarM!).toBeLessThan(mid.fogFarM!);
    expect(peak.fogNearM!).toBeLessThan(peak.fogFarM!);
    expect(peak.domeOpacity).toBeGreaterThanOrEqual(look.domeOpacity);
    expect(peak.stars).toBeLessThanOrEqual(look.stars);
    const lum = (c: number[]) => c[0] + c[1] + c[2];
    expect(lum(peak.zenith)).toBeLessThan(lum(look.zenith) + 1e-9);
  });
});

describe('applySiteFx', () => {
  const look = skyLook(20);
  it('only Opportunity changes the sky, and only through its storm value', () => {
    expect(applySiteFx(look, 'spirit', { storm: 9 })).toBe(look);
    expect(applySiteFx(look, 'opportunity', {})).toBe(look);
    expect(applySiteFx(look, 'opportunity', { storm: 9 }).sunIntensity).toBeLessThan(look.sunIntensity);
  });
});

describe('parachute decode', () => {
  it('reads the four rings in order, the last before the end', () => {
    expect(PARACHUTE_RINGS).toEqual(['DARE', 'MIGHTY', 'THINGS', '34°11′58″N 118°10′31″W']);
    expect(ringsDecoded(0)).toBe(0);
    expect(ringsDecoded(0.22)).toBe(1);
    expect(ringsDecoded(0.86)).toBe(4);
    expect(ringsDecoded(1)).toBe(4);
    for (let p = 0; p < 1; p += 0.01) expect(ringsDecoded(p + 0.01)).toBeGreaterThanOrEqual(ringsDecoded(p));
  });
});

describe('Ingenuity wake routine', () => {
  it('ticks the five steps in order and finishes before the end', () => {
    expect(WAKE_STEPS).toHaveLength(5);
    expect(wakeStepsDone(0)).toBe(0);
    expect(wakeStepsDone(0.01)).toBe(1);
    expect(wakeStepsDone(0.9)).toBe(5);
    expect(wakeStepsDone(1)).toBe(5);
    for (let p = 0; p < 1; p += 0.01) expect(wakeStepsDone(p + 0.01)).toBeGreaterThanOrEqual(wakeStepsDone(p));
  });
});

describe('Sojourner path', () => {
  it('starts on the ramp, drives past the rock, and backs up to stop short of it', () => {
    expect(sojournerPath(0)).toMatchObject({ leg: 'ramp', ramp: 0 });
    expect(sojournerPath(0.5).leg).toBe('drive');
    const end = sojournerPath(1);
    expect(end.leg).toBe('back');
    expect(end.s).toBeCloseTo(ROVER_PATH.stopAt, 9);
    expect(end.lat).toBe(ROVER_PATH.rockSide);
  });
  it('is continuous where the legs meet', () => {
    const a = sojournerPath(0.7599);
    const b = sojournerPath(0.7601);
    expect(Math.abs(a.s - b.s)).toBeLessThan(1e-6);
    expect(Math.abs(a.lat - b.lat)).toBeLessThan(1e-6);
  });
  it('passes the rock with room to spare (rock ~0.24 m radius, rover ~0.23 m half-width)', () => {
    // Side by side (within half a rover length + the rock's radius), they must be a rover
    // half-width + the rock's radius apart.
    for (let p = 0.25; p < 0.76; p += 0.005) {
      const at = sojournerPath(p);
      if (Math.abs(at.s - ROVER_PATH.rockS) < 0.31 + 0.24) expect(ROVER_PATH.rockSide - at.lat).toBeGreaterThan(0.23 + 0.24);
    }
  });
  it('stops with its rear (~0.31 m behind its centre) just short of the rock', () => {
    const gap = sojournerPath(1).s - 0.31 - (ROVER_PATH.rockS + 0.24);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(0.1);
  });
});

describe('signature definitions', () => {
  it('every stop has at least one action, with unique keys and sane controls', () => {
    for (const id of MACHINE_IDS) {
      const defs = SIGNATURES[id];
      expect(defs?.length, id).toBeGreaterThan(0);
      const keys = defs!.map(d => d.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const d of defs!) {
        expect(d.caption, d.key).toBeTruthy();
        if (d.kind === 'button') expect(d.durationMs, d.key).toBeGreaterThan(0);
        if (d.kind === 'slider') expect(d.max!, d.key).toBeGreaterThan(d.min!);
      }
    }
  });
  it('the storm readout is wired to the model', () => {
    const storm = SIGNATURES.opportunity!.find(d => d.key === 'storm')!;
    expect(storm.readout?.(LAST_SIGNAL_TAU, 0)).toBe(stormReadout(LAST_SIGNAL_TAU));
  });
});
