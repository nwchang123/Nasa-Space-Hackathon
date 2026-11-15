import { describe, expect, it } from 'vitest';
import {
  ORBIT_EL_MAX,
  ORBIT_EL_MIN,
  ORBIT_ZOOM_MAX,
  ORBIT_ZOOM_MIN,
  TURN_PACE,
  TURN_PERIOD_S,
  TURN_RAMP_S,
  coastSpeed,
  makeTurn,
  orbitAfterDrag,
  orbitAfterWheel,
  turnAngle,
  turnSpeed,
  wholeTurns,
} from '../src/scene/siteOrbit';

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

describe('the turn while a voice speaks', () => {
  const TURN = 2 * Math.PI;
  const DEG = Math.PI / 180;

  it('every line turns at one fixed slow pace, the same way as a drag to the right, never a full turn', () => {
    expect(TURN_PACE).toBeCloseTo(-TURN / TURN_PERIOD_S, 12);
    expect(Math.abs(TURN_PACE)).toBeLessThanOrEqual(6 * DEG + 1e-12);
    for (const seconds of [5.5, 10, 14.5, 18.5, 21.7, 30]) {
      const plan = makeTurn(100, 100 + seconds, TURN_PACE);
      expect(turnAngle(plan, 100)).toBeCloseTo(0, 12);
      // The same cruising speed whatever the line's length.
      if (seconds > 2 * TURN_RAMP_S) expect(turnSpeed(plan, 100 + seconds / 2)).toBeCloseTo(TURN_PACE, 12);
      const total = turnAngle(plan, 100 + seconds);
      expect(total).toBeLessThan(0);
      expect(Math.abs(total)).toBeLessThan(TURN / 2);
      expect(turnAngle(plan, 100 + seconds + 5)).toBeCloseTo(total, 12);
    }
  });
  it('a short line turns only a little', () => {
    const plan = makeTurn(0, 5.5, TURN_PACE);
    expect(Math.abs(turnAngle(plan, 5.5))).toBeLessThan(45 * DEG);
  });
  it('starts and finishes at rest, gathering and losing speed evenly, never turning backwards', () => {
    const plan = makeTurn(0, 18.5, TURN_PACE);
    expect(turnSpeed(plan, 0)).toBe(0);
    expect(turnSpeed(plan, 18.5)).toBe(0);
    expect(turnSpeed(plan, TURN_RAMP_S / 2)).toBeCloseTo(TURN_PACE / 2, 12);
    expect(turnSpeed(plan, 9)).toBeCloseTo(TURN_PACE, 12);
    let prev = 0;
    for (let t = 0; t <= 18.5; t += 0.01) {
      const a = turnAngle(plan, t);
      expect(a).toBeLessThanOrEqual(prev + 1e-12);
      // The speed is the angle's rate of change.
      if (t > 0.01 && t < 18.49) expect((turnAngle(plan, t + 1e-4) - turnAngle(plan, t - 1e-4)) / 2e-4).toBeCloseTo(turnSpeed(plan, t), 4);
      prev = a;
    }
  });
  it('picking up part-way through a line keeps the same pace and still ends with it', () => {
    const pace = TURN_PACE;
    const plan = makeTurn(10, 18.5, pace);
    expect(turnSpeed(plan, 14)).toBeCloseTo(pace, 12);
    expect(turnAngle(plan, 18.5)).toBeCloseTo(pace * (8.5 - TURN_RAMP_S), 9);
    // Too little left for two full ramps: the ramps share what is left.
    const late = makeTurn(17, 18.5, pace);
    expect(late.ramp).toBeCloseTo(0.75, 12);
    expect(turnSpeed(late, 18.5)).toBe(0);
  });
  it('a turn cut short coasts gently to a full stop, a little further on, never backwards', () => {
    let s = TURN_PACE;
    let az = 0;
    for (let i = 0; i < 8 * 60; i++) {
      s = coastSpeed(s, 1 / 60);
      az += s / 60;
    }
    expect(s).toBe(0);
    expect(az).toBeLessThan(0);
    expect(Math.abs(az)).toBeLessThan(20 * DEG);
  });
  it('a whole turn comes off the angle only once it is past half a turn', () => {
    expect(wholeTurns(0.5)).toBe(0);
    expect(wholeTurns(-Math.PI)).toBe(0);
    expect(wholeTurns(-3.5)).toBeCloseTo(-TURN, 12);
    expect(Math.abs(13 - wholeTurns(13))).toBeLessThanOrEqual(Math.PI);
  });
});
