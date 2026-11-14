import { describe, expect, it } from 'vitest';
import {
  FLY_SPEED_MS,
  HOVER_ALT_M,
  LAND_AFTER_S,
  OVER_CLEAR_M,
  clampToSite,
  flyerAt,
  headingTo,
  moveFromKeys,
  overFootprint,
  standoffBeside,
  stepFlyer,
  turnDelta,
  type FlyWorld,
  type FlyerState,
  type FlyInput,
} from '../src/scene/freeFlight';

const open: FlyWorld = { centre: [0, 0], radius: 25, machine: null };
const withMachine: FlyWorld = {
  centre: [0, 0],
  radius: 25,
  machine: { yaw: 0.4, minX: -1, maxX: 1, minZ: -1, maxZ: 1, top: 1.5 },
};

function run(s: FlyerState, input: FlyInput, seconds: number, world = open, dt = 1 / 60): FlyerState {
  let st = s;
  for (let t = 0; t < seconds; t += dt) st = stepFlyer(st, input, dt, world);
  return st;
}

describe('site free flight', () => {
  it('keys turn with the camera: W goes where the camera looks, D to its right', () => {
    // Camera looking along −Z: right is +X.
    expect(moveFromKeys({ f: true, b: false, l: false, r: false }, [0, -1])).toEqual([0, -1]);
    const d = moveFromKeys({ f: false, b: false, l: false, r: true }, [0, -1]);
    expect(d?.[0]).toBeCloseTo(1);
    expect(d?.[1]).toBeCloseTo(0);
    expect(moveFromKeys({ f: true, b: true, l: false, r: false }, [0, -1])).toBeNull();
    const diag = moveFromKeys({ f: true, b: false, l: true, r: false }, [1, 0]);
    expect(Math.hypot(diag![0], diag![1])).toBeCloseTo(1);
  });

  it('spins up before lifting, then climbs to the hover height', () => {
    const s0 = flyerAt(5, 5);
    const early = run(s0, { move: [1, 0] }, 0.2);
    expect(early.alt).toBe(0);
    expect(early.rotor).toBeGreaterThan(0);
    const later = run(s0, { move: [1, 0] }, 4);
    expect(later.alt).toBeCloseTo(HOVER_ALT_M, 2);
    expect(later.rotor).toBe(1);
  });

  it('moves no faster than the cruise speed and only once airborne', () => {
    let s = flyerAt(0, 0);
    let maxSpeed = 0;
    let movedOnGround = false;
    for (let i = 0; i < 600; i++) {
      const before = s;
      s = stepFlyer(s, { move: [0, 1] }, 1 / 60, open);
      maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vz));
      if (before.alt === 0 && (s.x !== before.x || s.z !== before.z)) movedOnGround = true;
    }
    expect(maxSpeed).toBeLessThanOrEqual(FLY_SPEED_MS + 1e-9);
    expect(maxSpeed).toBeGreaterThan(FLY_SPEED_MS * 0.9);
    expect(movedOnGround).toBe(false);
  });

  it('flies to a clicked spot, stops there, and lands after a while', () => {
    const s0 = { ...flyerAt(0, 0), target: [6, -3] as [number, number] };
    const there = run(s0, { move: null }, 8);
    expect(there.target).toBeNull();
    expect(Math.hypot(there.x - 6, there.z + 3)).toBeLessThan(0.2);
    expect(there.alt).toBeGreaterThan(1);
    const landed = run(there, { move: null }, LAND_AFTER_S + 4);
    expect(landed.alt).toBe(0);
    expect(landed.rotor).toBe(0);
  });

  it('flying home with landOnArrival lands at once', () => {
    const s0 = { ...flyerAt(0, 0), alt: HOVER_ALT_M, rotor: 1, idle: 0, target: [3, 0] as [number, number], landOnArrival: true };
    const s = run(s0, { move: null }, 6);
    expect(s.alt).toBe(0);
    expect(Math.abs(s.x - 3)).toBeLessThan(0.2);
  });

  it('holding keeps it hovering', () => {
    const s0 = { ...flyerAt(0, 0), alt: HOVER_ALT_M, rotor: 1, idle: 0 };
    const s = run(s0, { move: null, hold: true }, LAND_AFTER_S + 5);
    expect(s.alt).toBeCloseTo(HOVER_ALT_M, 3);
  });

  it('stays inside the site', () => {
    const s = run(flyerAt(20, 0), { move: [1, 0] }, 12);
    expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(25 + 1e-9);
    expect(clampToSite(open, 100, 0)[0]).toBeCloseTo(24.5);
  });

  it('never passes through the machine below its top: it climbs over it', () => {
    let s = flyerAt(-6, 0);
    let worst = Infinity;
    for (let i = 0; i < 60 * 10; i++) {
      s = stepFlyer(s, { move: [1, 0] }, 1 / 60, withMachine);
      if (overFootprint(withMachine.machine!, s.x, s.z, 0)) worst = Math.min(worst, s.alt);
    }
    expect(s.x).toBeGreaterThan(3);
    expect(worst).toBeGreaterThanOrEqual(1.5 + OVER_CLEAR_M - 0.06);
  });

  it('turns toward a heading the short way round, only with the rotor turning', () => {
    expect(turnDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(headingTo(1, 0)).toBeCloseTo(Math.PI / 2);
    const still = run({ ...flyerAt(0, 0), face: 1 }, { move: null }, 1);
    expect(still.yaw).toBe(0);
    const hovering = run({ ...flyerAt(0, 0), alt: HOVER_ALT_M, rotor: 1, idle: 0, face: 1 }, { move: null, hold: true }, 2);
    expect(hovering.yaw).toBeCloseTo(1);
  });

  it('parks beside a part, off the line from the camera, on the side it is already on', () => {
    // Camera looking along +Z at a part on the machine's +X side.
    const part: [number, number] = [2, 0];
    const p = standoffBeside(part, [2, -5], [0, 0], [6, 0]);
    expect(Math.hypot(p[0] - part[0], p[1] - part[1])).toBeCloseTo(1.2);
    expect(p[0]).toBeGreaterThan(part[0] + 0.5); // off the camera's line, on Ingenuity's side
    const q = standoffBeside(part, [2, -5], [0, 0], [-6, 0]);
    expect(q[0]).toBeLessThan(part[0]);
  });

  it('parks outside the machine, going further out if it must', () => {
    const fp = { yaw: 0, minX: -3, maxX: 1.5, minZ: -1.2, maxZ: 1.4, top: 1.1 };
    // A part inside the footprint, near its −X edge (like Sojourner by the lander).
    const part: [number, number] = [-2.6, 0.5];
    const p = standoffBeside(part, [-2.6, -6], [-0.7, 0.1], [0, -3], 1.2, fp);
    expect(overFootprint(fp, p[0], p[1])).toBe(false);
    const deep = standoffBeside([0, 0], [0, -6], [0, 0], [3, -3], 1.2, fp);
    expect(overFootprint(fp, deep[0], deep[1])).toBe(false);
  });

  it('hovers at the autopilot height when holding, but still clears the machine', () => {
    const s0 = { ...flyerAt(5, 0), alt: HOVER_ALT_M, rotor: 1, idle: 0 };
    const low = run(s0, { move: null, hold: true, holdAlt: 0.9 }, 4, withMachine);
    expect(low.alt).toBeCloseTo(0.9, 2);
    const over = run({ ...flyerAt(0, 0), alt: 0.9, rotor: 1, idle: 0 }, { move: null, hold: true, holdAlt: 0.9 }, 4, withMachine);
    expect(over.alt).toBeCloseTo(1.5 + OVER_CLEAR_M, 2);
  });
});
