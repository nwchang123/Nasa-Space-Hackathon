import { describe, expect, it } from 'vitest';
import {
  TITLE_DIR,
  TITLE_EL,
  TITLE_EL_MAX,
  TITLE_MARS_X,
  TITLE_MARS_X_MAX,
  TITLE_SUN_DEG,
  cameraGoal,
  litYaw,
  slerpDir,
  titleCamSun,
  titleDirAt,
  titleColumns,
  titleDragGoalCamSun,
  titleFacing,
  titleMarsRadius,
  titleWorldSun,
  worldSunFromYaw,
  type Vec3,
} from '../src/scene/layout';
import { latLonToVec3 } from '../src/geo';

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
    // The title framing (CameraRig): Mars centred 70 % from the left, the camera the same distance away.
    const frame = (el: number) =>
      cameraGoal({ center: [0, 0, 0], dir: titleDirAt(el), radius: 1, aspect: 16 / 9, fovDeg: 40, anchorX: TITLE_MARS_X, anchorY: 0.5, fillWidth: 0.56 });
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

describe('title columns: text, stops, Mars', () => {
  const STOPS_W = 160;

  it('puts Mars at 70 % where the text leaves room, the stops clear of both', () => {
    for (const [w, h, text] of [
      [1527, 661, 445],
      [1920, 950, 640],
      [1366, 650, 470],
    ]) {
      const { anchorX, stopsX } = titleColumns(w, h, text, STOPS_W);
      expect(anchorX).toBeCloseTo(TITLE_MARS_X, 10);
      const marsLeft = anchorX * w - titleMarsRadius(w, h);
      expect(stopsX - STOPS_W / 2).toBeGreaterThan(text + 20);
      expect(stopsX + STOPS_W / 2).toBeLessThan(marsLeft - 20);
    }
  });

  it('moves Mars right only as far as the text needs, and never past 77.5 %', () => {
    // A squarer window (16:10) with a wide title: Mars makes room.
    const tight = titleColumns(1440, 900, 560, STOPS_W);
    expect(tight.anchorX).toBeGreaterThan(TITLE_MARS_X);
    expect(tight.anchorX).toBeLessThanOrEqual(TITLE_MARS_X_MAX);
    const marsLeft = tight.anchorX * 1440 - titleMarsRadius(1440, 900);
    expect(tight.stopsX - STOPS_W / 2).toBeGreaterThanOrEqual(560 + 24 - 1e-9);
    expect(tight.stopsX + STOPS_W / 2).toBeLessThanOrEqual(marsLeft - 24 + 1e-9);
    // Hopelessly crowded: capped.
    expect(titleColumns(1200, 900, 900, STOPS_W).anchorX).toBe(TITLE_MARS_X_MAX);
    // No stops (hidden on narrow windows): Mars only keeps clear of the text.
    expect(titleColumns(1440, 900, 560, 0).anchorX).toBeLessThan(tight.anchorX);
  });
});

describe('turning Mars to a stop picked on the title', () => {
  it('puts the place on the line from Mars to the camera, so it sits mid-disc', () => {
    for (const [lat, lon] of [
      [22.27, -48.0],
      [-14.57, 175.47],
      [68.22, -125.75],
      [18.44, 77.45],
    ]) {
      for (const aspect of [1527 / 661, 16 / 9, 1.6]) {
        const { yaw, el } = titleFacing(lat, lon, aspect, 40, TITLE_MARS_X);
        const place = latLonToVec3(lat, lon);
        // The globe turns by yaw about +Y (three.js: x' = x cos + z sin, z' = −x sin + z cos).
        const world: Vec3 = [place[0] * Math.cos(yaw) + place[2] * Math.sin(yaw), place[1], -place[0] * Math.sin(yaw) + place[2] * Math.cos(yaw)];
        const cam = cameraGoal({ center: [0, 0, 0], dir: titleDirAt(el), radius: 1, aspect, fovDeg: 40, anchorX: TITLE_MARS_X, anchorY: 0.5, fillWidth: 0.56 }).position;
        const l = Math.hypot(...cam);
        // Exactly, unless the view stops at its pole limit (Phoenix, 68°N): then within a few degrees.
        const tol = Math.abs(el) >= TITLE_EL_MAX - 1e-9 ? 6 : 0.2;
        expect(dot3(world, [cam[0] / l, cam[1] / l, cam[2] / l])).toBeGreaterThan(Math.cos(tol * (Math.PI / 180)));
      }
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
