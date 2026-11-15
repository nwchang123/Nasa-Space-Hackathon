import { describe, expect, it } from 'vitest';
import {
  TITLE_DIR,
  TITLE_EL,
  TITLE_EL_MAX,
  TITLE_SUN_DEG,
  cameraGoal,
  litYaw,
  slerpDir,
  titleCamSun,
  titleDirAt,
  titleDragGoalCamSun,
  titleWorldSun,
  worldSunFromYaw,
  type Vec3,
} from '../src/scene/layout';

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('title globe pitch', () => {
  it('the default elevation gives exactly the title direction', () => {
    expect(TITLE_EL).toBeCloseTo(Math.atan2(0.22, 1), 10);
    const d = titleDirAt(TITLE_EL);
    for (let i = 0; i < 3; i++) expect(d[i]).toBeCloseTo(TITLE_DIR[i], 10);
  });

  it('pitches toward either pole, unit length, and stops at the limit', () => {
    for (const el of [-2, -TITLE_EL_MAX, -0.6, 0, 0.6, TITLE_EL_MAX, 2]) {
      const d = titleDirAt(el);
      expect(Math.hypot(...d)).toBeCloseTo(1, 10);
      expect(d[0]).toBeCloseTo(0, 10);
      expect(Math.abs(Math.asin(d[1]))).toBeLessThanOrEqual(TITLE_EL_MAX + 1e-9);
      expect(Math.sign(d[1])).toBe(Math.sign(el));
    }
    expect(titleDirAt(5)).toEqual(titleDirAt(TITLE_EL_MAX));
  });

  it('keeps Mars in the right-hand column at any pitch', () => {
    // The title framing (CameraRig): Mars centred 77.5 % from the left, the camera the same distance away.
    const frame = (el: number) =>
      cameraGoal({ center: [0, 0, 0], dir: titleDirAt(el), radius: 1, aspect: 16 / 9, fovDeg: 40, anchorX: 0.775, anchorY: 0.5, fillWidth: 0.56 });
    const base = frame(TITLE_EL);
    for (const el of [-TITLE_EL_MAX, 0, TITLE_EL_MAX]) {
      const g = frame(el);
      expect(g.distance).toBeCloseTo(base.distance, 10);
      // Mars's centre seen from the camera: same offset to the right of the view axis.
      const view = [g.target[0] - g.position[0], g.target[1] - g.position[1], g.target[2] - g.position[2]];
      const toMars = [-g.position[0], -g.position[1], -g.position[2]];
      const cos = (view[0] * toMars[0] + view[1] * toMars[1] + view[2] * toMars[2]) / (Math.hypot(...view) * Math.hypot(...toMars));
      const vb = [base.target[0] - base.position[0], base.target[1] - base.position[1], base.target[2] - base.position[2]];
      const mb = [-base.position[0], -base.position[1], -base.position[2]];
      const cosBase = (vb[0] * mb[0] + vb[1] * mb[1] + vb[2] * mb[2]) / (Math.hypot(...vb) * Math.hypot(...mb));
      expect(cos).toBeCloseTo(cosBase, 8);
    }
  });
});

describe('camera-side title sun while dragging Mars', () => {
  it('round-trips world ↔ title camera coordinates and keeps the Sun fixed in the camera frame at any pitch', () => {
    const world0: Vec3 = [-0.68, 0.28, 0.68];
    const camSun = titleCamSun(world0, TITLE_EL);
    const back = titleWorldSun(camSun, TITLE_EL);
    const norm0 = Math.hypot(...world0);
    for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(world0[i] / norm0, 10);

    const basePhase = dot3(titleWorldSun(camSun, TITLE_EL), titleDirAt(TITLE_EL));
    for (const el of [-TITLE_EL_MAX, -0.5, 0, TITLE_EL, 0.6, TITLE_EL_MAX]) {
      const w = titleWorldSun(camSun, el);
      expect(Math.hypot(...w)).toBeCloseTo(1, 10);
      expect(w[0]).toBeCloseTo(camSun[0], 10);
      expect(dot3(w, titleDirAt(el))).toBeCloseTo(basePhase, 10);
    }
  });

  it('keeps both poles sunlit when pitched to them across Mars seasons, and stays on the initial side at ±50°', () => {
    const deg = Math.PI / 180;
    for (const latDeg of [-25.2, 0, 25.2]) {
      const sunBody: Vec3 = [Math.cos(latDeg * deg), Math.sin(latDeg * deg), 0];
      for (const sideDeg of [-75, -50, 50, 75]) {
        const w0 = worldSunFromYaw(sunBody, litYaw(sunBody, TITLE_DIR, sideDeg));
        const goalCam = titleDragGoalCamSun(sunBody, titleCamSun(w0, TITLE_EL));
        const goalAtTitle = titleWorldSun(goalCam, TITLE_EL);
        const az = Math.atan2(goalAtTitle[0], goalAtTitle[2]) / deg;
        expect(Math.sign(az)).toBe(Math.sign(sideDeg));
        expect(Math.abs(az)).toBeCloseTo(Math.abs(TITLE_SUN_DEG), 8);

        // North pole view (+TITLE_EL_MAX) lights the north pole; south pole view (-TITLE_EL_MAX) lights the south pole.
        expect(titleWorldSun(goalCam, TITLE_EL_MAX)[1]).toBeGreaterThan(0.2);
        expect(titleWorldSun(goalCam, -TITLE_EL_MAX)[1]).toBeLessThan(-0.2);
      }
    }
  });

  it('slerpDir interpolates smoothly on the sphere, including opposite directions', () => {
    const a: Vec3 = [1, 0, 0];
    const b: Vec3 = [0, 1, 0];
    const mid = slerpDir(a, b, 0.5);
    expect(mid[0]).toBeCloseTo(Math.SQRT1_2, 10);
    expect(mid[1]).toBeCloseTo(Math.SQRT1_2, 10);
    expect(mid[2]).toBeCloseTo(0, 10);

    const opp = slerpDir([1, 0, 0], [-1, 0, 0], 0.5);
    expect(Math.hypot(...opp)).toBeCloseTo(1, 10);
    expect(dot3(opp, [1, 0, 0])).toBeCloseTo(0, 10);
  });
});
