// The first stop's day sweep on the solar-time scale (src/ui/hud/introSweep.ts): it starts and ends
// on the live hour, passes through the whole day from morning to night, and never jumps.

import { describe, expect, it } from 'vitest';
import { planSweep, SWEEP_FROM, SWEEP_TO, sweepHour } from '../src/ui/hud/introSweep';

const total = (p: ReturnType<typeof planSweep>) => p.lead + p.main + p.back;

describe('intro day sweep', () => {
  for (const live of [0.5, 6, 13.2, 19.1, 23.8]) {
    it(`from live ${live} h: starts and ends there, through ${SWEEP_FROM}–${SWEEP_TO} h, without a jump`, () => {
      const p = planSweep(live, 14528);
      expect(sweepHour(p, 0)).toBeCloseTo(live, 9);
      expect(sweepHour(p, p.lead)).toBeCloseTo(SWEEP_FROM, 9);
      expect(sweepHour(p, p.lead + p.main)).toBeCloseTo(SWEEP_TO, 9);
      expect(sweepHour(p, total(p) - 1e-6)).toBeCloseTo(live, 3);
      expect(sweepHour(p, total(p) + 1)).toBeNull();
      let prev = sweepHour(p, 0)!;
      for (let t = 10; t < total(p); t += 10) {
        const h = sweepHour(p, t)!;
        expect(Math.abs(h - prev)).toBeLessThan(0.25);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(24);
        prev = h;
      }
    });
  }
  it('fills about the length of the intro, and the day itself runs forward only', () => {
    const p = planSweep(19.1, 14528);
    expect(total(p)).toBeCloseTo(14528, 6);
    for (let t = p.lead; t + 25 <= p.lead + p.main; t += 25) expect(sweepHour(p, t + 25)!).toBeGreaterThanOrEqual(sweepHour(p, t)! - 1e-9);
  });
  it('keeps a readable day even when the intro is short', () => {
    expect(planSweep(12, 2000).main).toBeGreaterThanOrEqual(4000);
  });
});
