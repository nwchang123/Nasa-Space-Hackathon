import { describe, expect, it } from 'vitest';
import { TITLE_DIR, TITLE_EL, TITLE_EL_MAX, cameraGoal, titleDirAt } from '../src/scene/layout';

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
