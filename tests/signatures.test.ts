// The pure rules behind the signature actions (src/scene/signatures/logic.ts, fx.ts) and the
// definitions the HUD renders (src/data/signatures.ts).

import { describe, expect, it } from 'vitest';
import { SIGNATURES, SIG_PRESETS, sigOrPreset } from '../src/data/signatures';
import { skyLook } from '../src/scene/sites';
import { applySiteFx } from '../src/scene/signatures/fx';
import {
  buttonProgress,
  decodeReadout,
  directSunlight,
  formatPercent,
  holdCharge,
  holdRunMs,
  LAST_SIGNAL_TAU,
  PARACHUTE_RINGS,
  ringsDecoded,
  ROVER_PATH,
  SCOOP,
  scoopReadout,
  scoopState,
  sojournerPath,
  stormLook,
  stormReadout,
  WAKE_PHOTO_STEP,
  WAKE_STEPS,
  wakeReadout,
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

describe('hold controls', () => {
  it('charge from 0 to 1 over chargeMs, rising fast then slowing, and clamp', () => {
    expect(holdCharge(1000, 1000, 2000)).toBe(0);
    expect(holdCharge(1000, 500, 2000)).toBe(0);
    expect(holdCharge(1000, 2000, 2000)).toBeCloseTo(0.75, 12);
    expect(holdCharge(1000, 3000, 2000)).toBe(1);
    expect(holdCharge(1000, 9000, 2000)).toBe(1);
    for (let t = 1000; t < 3000; t += 50) expect(holdCharge(1000, t + 50, 2000)).toBeGreaterThanOrEqual(holdCharge(1000, t, 2000));
  });
  it('run longer the stronger the charge, within 60–100 % of the duration', () => {
    expect(holdRunMs(5000, 0)).toBe(3000);
    expect(holdRunMs(5000, 1)).toBe(5000);
    expect(holdRunMs(5000, 2)).toBe(5000);
    expect(holdRunMs(5000, 0.5)).toBeGreaterThan(holdRunMs(5000, 0.2));
  });
});

describe('Phoenix trench slider', () => {
  it('opens the trench while digging, shows ice, then vaporises it over four sols', () => {
    expect(scoopState(0)).toMatchObject({ trench: 0, ice: 0, sol: 0 });
    expect(scoopState(SCOOP.lower).trench).toBe(0);
    const dug = scoopState(SCOOP.dug);
    expect(dug.trench).toBe(1);
    expect(dug.ice).toBe(1);
    expect(dug.sol).toBe(0);
    expect(scoopState(SCOOP.raised + 0.01).sol).toBe(1);
    expect(scoopState(SCOOP.gone - 0.001).sol).toBe(4);
    const end = scoopState(1);
    expect(end.sol).toBe(5);
    expect(end.ice).toBe(0);
    expect(end.trench).toBe(1);
  });
  it('moves forward only: trench never closes, sols never go back, ice only fades after digging', () => {
    for (let p = 0; p < 1; p += 0.005) {
      const a = scoopState(p);
      const b = scoopState(p + 0.005);
      expect(b.trench).toBeGreaterThanOrEqual(a.trench);
      expect(b.sol).toBeGreaterThanOrEqual(a.sol);
      expect(b.shrink).toBeLessThanOrEqual(a.shrink);
      if (p >= SCOOP.raised) expect(b.ice).toBeLessThanOrEqual(a.ice + 1e-12);
    }
  });
  it('reads out what the visitor sees', () => {
    expect(scoopReadout(undefined)).toBeNull();
    expect(scoopReadout(SCOOP.dug)).toContain('water ice');
    expect(scoopReadout(1)).toContain('Four sols later');
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
  it('reads out the words decoded so far', () => {
    expect(decodeReadout(undefined)).toBeNull();
    expect(decodeReadout(0.3)).toBe('DARE');
    expect(decodeReadout(1)).toBe('DARE MIGHTY THINGS · JPL’s coordinates');
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
  it('the photo is the fourth step, and the readout names the step just done', () => {
    expect(WAKE_STEPS[WAKE_PHOTO_STEP - 1]).toMatch(/photo/);
    expect(wakeReadout(undefined)).toBeNull();
    expect(wakeReadout(0)).toBe('Asleep');
    expect(wakeReadout(1)).toBe(`5/5 · ${WAKE_STEPS[4]}`);
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
  it('backs up to the authored APXS contact stop (the mesh contact is checked in model-assets)', () => {
    const along = sojournerPath(1).s - ROVER_PATH.rockS;
    expect(along).toBeGreaterThan(0.4);
    expect(along).toBeLessThan(0.5);
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
        if (d.kind === 'hold') {
          expect(d.chargeMs, d.key).toBeGreaterThan(0);
          expect(d.durationMs, d.key).toBeGreaterThan(0);
        }
      }
    }
  });
  it('every action is driven by hand: no click-and-watch buttons are left', () => {
    for (const id of MACHINE_IDS) for (const d of SIGNATURES[id]!) expect(d.kind, `${id}:${d.key}`).not.toBe('button');
  });
  it('the converted actions keep their keys (the scene and the guide match on them)', () => {
    const kinds = Object.fromEntries(MACHINE_IDS.flatMap(id => SIGNATURES[id]!.map(d => [d.key, d.kind])));
    expect(kinds).toMatchObject({ scan: 'slider', drag: 'slider', scoop: 'slider', decode: 'slider', wake: 'slider', quake: 'hold', frost: 'toggle', larri: 'toggle', roll: 'slider', storm: 'slider' });
  });
  it('presets and tour runs are in range, and a preset is shown, never stored', () => {
    const all = MACHINE_IDS.flatMap(id => SIGNATURES[id]!);
    for (const d of all) {
      if (d.preset !== undefined) {
        expect(['toggle', 'slider'], d.key).toContain(d.kind);
        if (d.kind === 'toggle') expect([0, 1], d.key).toContain(d.preset);
        else {
          expect(d.preset, d.key).toBeGreaterThanOrEqual(d.min!);
          expect(d.preset, d.key).toBeLessThanOrEqual(d.max!);
        }
        expect(SIG_PRESETS[d.key], d.key).toBe(d.preset);
      }
      if (d.playsDuring !== undefined) {
        expect(['toggle', 'slider', 'hold'], d.key).toContain(d.kind);
        expect([0, 1, 2, 3], d.key).toContain(d.playsDuring);
        // Nothing to run if it opens already done.
        expect(d.preset, d.key).toBeUndefined();
      }
    }
    // Viking 2's frost opens on; the visitor's own value wins.
    expect(sigOrPreset('frost', undefined)).toBe(1);
    expect(sigOrPreset('frost', 0)).toBe(0);
    expect(sigOrPreset('drag', undefined)).toBeUndefined();
    expect(sigOrPreset('drag', 0.3)).toBe(0.3);
  });
  it('every action but the frost is run by the tour in the section that tells it', () => {
    const when = Object.fromEntries(MACHINE_IDS.flatMap(id => SIGNATURES[id]!.map(d => [d.key, d.playsDuring ?? null])));
    expect(when).toEqual({ scan: 0, frost: null, roll: 1, drag: 1, storm: 2, scoop: 1, quake: 1, larri: 3, decode: 1, wake: 3 });
    // At most one per section at a stop (the tour runs one at a time).
    for (const id of MACHINE_IDS) {
      const secs = SIGNATURES[id]!.map(d => d.playsDuring).filter(v => v !== undefined);
      expect(new Set(secs).size, id).toBe(secs.length);
    }
  });
  it('the storm readout is wired to the model', () => {
    const storm = SIGNATURES.opportunity!.find(d => d.key === 'storm')!;
    expect(storm.readout?.(LAST_SIGNAL_TAU, 0)).toBe(stormReadout(LAST_SIGNAL_TAU));
  });
});
