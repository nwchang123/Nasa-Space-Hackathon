import { describe, expect, it } from 'vitest';
import { CLOSE_UP_ELEV, CLOSE_UP_MAX_M, CLOSE_UP_MIN_M, closeUpDistance, closeUpPose, PAIR_FAR_M, PAIR_NEAR_M, pairView, pairWeight, pickTarget, wideCloseUp } from '../src/scene/siteFocus';

const dist3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('site close-up camera', () => {
  it('keeps the close-up distance between 1.5 and 3 m', () => {
    expect(closeUpDistance(0)).toBe(CLOSE_UP_MIN_M);
    expect(closeUpDistance(50)).toBe(CLOSE_UP_MAX_M);
    const mid = closeUpDistance(2);
    expect(mid).toBeGreaterThan(CLOSE_UP_MIN_M);
    expect(mid).toBeLessThan(CLOSE_UP_MAX_M);
  });

  it('looks at the part from the given distance, above it', () => {
    const part: [number, number, number] = [1, 0.5, 0];
    const p = closeUpPose(part, [0, 0.5, 0], [6, 2, 3], 2, 0.3);
    expect(p.target).toEqual(part);
    expect(dist3(p.position, part)).toBeCloseTo(2, 5);
    expect(p.position[1]).toBeGreaterThan(part[1]);
  });

  it('stands outside the machine, on the camera’s side', () => {
    const part: [number, number, number] = [1, 0.5, 0];
    const from: [number, number, number] = [5, 2, 4];
    const p = closeUpPose(part, [0, 0.5, 0], from, 2, 0);
    // Further from the centre than the part, and toward the current camera.
    expect(Math.hypot(p.position[0], p.position[2])).toBeGreaterThan(1);
    const toCam = [from[0] - part[0], from[2] - part[2]];
    const toPose = [p.position[0] - part[0], p.position[2] - part[2]];
    expect(toCam[0] * toPose[0] + toCam[1] * toPose[1]).toBeGreaterThan(0);
  });

  it('never goes below the floor it is given', () => {
    const p = closeUpPose([0, -1, 0], [0, 0, 0], [3, 0, 0], 1.5, 0.35);
    expect(p.position[1]).toBe(0.35);
  });

  it('copes with a part at the centre seen from straight above', () => {
    const p = closeUpPose([0, 0, 0], [0, 0, 0], [0, 5, 0], 2, 0);
    expect(p.position.every(Number.isFinite)).toBe(true);
    expect(dist3(p.position, [0, 0, 0])).toBeCloseTo(2, 5);
  });

  it('frames a part and Ingenuity beside it side by side, not one behind the other', () => {
    // Part on the machine's +X edge, Ingenuity further out along +X, camera out along +X too
    // (the bad case: looking down their line, Ingenuity would fill the frame).
    const part: [number, number, number] = [2.6, 0.4, 0];
    const flyer: [number, number, number] = [3.9, 0.9, 0];
    const side = pairView(part, flyer, [0, 0, 0], [8, 2, 1]);
    expect(Math.hypot(...side)).toBeCloseTo(1, 6);
    const axis = [1, 0];
    // Nearly square to the line between them (a little outward lean allowed)...
    expect(Math.abs(side[0] * axis[0] + side[1] * axis[1])).toBeLessThan(0.3);
    // ...and on the camera's side (+Z).
    expect(side[1]).toBeGreaterThan(0.9);
    const p = closeUpPose(part, [0, 0, 0], [8, 2, 1], 2.5, 0, side);
    expect(p.position[2]).toBeGreaterThan(2);
  });

  it('looks from outside the machine when the camera is off to one end of the pair', () => {
    // Pair along a tangent of the machine (+Z is outward); the camera nearly in line with them.
    const side = pairView([0, 0.4, 2], [1.2, 0.9, 2], [0, 0, 0], [8, 2, 2.3]);
    expect(side[1]).toBeGreaterThan(0.9);
  });

  it('stays on the camera’s side rather than swinging round through the machine', () => {
    const side = pairView([0, 0.4, 2], [1.2, 0.9, 2], [0, 0, 0], [0.6, 2, -6]);
    expect(side[1]).toBeLessThan(0);
  });
});

describe('scout camera target', () => {
  it('picks the point in the viewfinder nearest its centre', () => {
    const id = pickTarget(
      [
        { id: 'a', x: 0.3, y: 0.1, z: 0.5 },
        { id: 'b', x: -0.1, y: 0.05, z: 0.5 },
        { id: 'c', x: 0.02, y: 0.9, z: 0.5 },
      ],
      0.4,
      0.45,
      1.6,
    );
    expect(id).toBe('b');
  });

  it('ignores points outside the frame or behind the camera', () => {
    expect(pickTarget([{ id: 'a', x: 0.6, y: 0, z: 0.5 }], 0.4, 0.45, 1)).toBeNull();
    expect(pickTarget([{ id: 'a', x: 0, y: 0, z: 1.2 }], 0.4, 0.45, 1)).toBeNull();
    expect(pickTarget([], 0.4, 0.45, 1)).toBeNull();
  });

  it('weighs distance in screen proportions', () => {
    // On a wide screen a horizontal offset counts for more than the same vertical one.
    expect(
      pickTarget(
        [
          { id: 'side', x: 0.2, y: 0, z: 0 },
          { id: 'up', x: 0, y: 0.25, z: 0 },
        ],
        0.4,
        0.45,
        2,
      ),
    ).toBe('up');
  });

  it('brings Ingenuity into the close-up only as it arrives', () => {
    expect(pairWeight(PAIR_FAR_M + 2)).toBe(0);
    expect(pairWeight(PAIR_NEAR_M)).toBe(1);
    expect(pairWeight(1.2)).toBe(1);
    const mid = pairWeight((PAIR_FAR_M + PAIR_NEAR_M) / 2);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });
});

describe('wide close-ups (the parachute)', () => {
  it('stands well back from the parachute, for its hotspot and for the decode action', () => {
    for (const key of ['hs:1', 'sig:decode']) {
      const w = wideCloseUp('mars2020-edl', key);
      expect(w).not.toBeNull();
      expect(w!.dist).toBeGreaterThan(CLOSE_UP_MAX_M * 3);
      expect(w!.elev).toBeGreaterThan(CLOSE_UP_ELEV);
      expect(w!.toward).toBeGreaterThan(0);
      expect(w!.toward).toBeLessThan(1);
    }
  });

  it('leaves every other close-up as it was', () => {
    expect(wideCloseUp('mars2020-edl', 'hs:0')).toBeNull();
    expect(wideCloseUp('spirit', 'hs:1')).toBeNull();
  });

  it('raises the camera by the elevation it is given', () => {
    const steep = closeUpPose([0, 0, 0], [0, 0, 5], [0, 0, -10], 10, 0, null, 0.8);
    const usual = closeUpPose([0, 0, 0], [0, 0, 5], [0, 0, -10], 10, 0);
    expect(steep.position[1]).toBeCloseTo(10 * Math.sin(0.8), 6);
    expect(usual.position[1]).toBeCloseTo(10 * Math.sin(CLOSE_UP_ELEV), 6);
    expect(dist3(steep.position, steep.target)).toBeCloseTo(10, 6);
  });
});
