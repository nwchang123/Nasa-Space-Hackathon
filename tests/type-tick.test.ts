// The guide's typing ticks sit under Ingenuity's voice: quieter than the original click on their
// own, and far quieter while the voice is heard.

import { describe, expect, it } from 'vitest';
import { typeTickLevel } from '../src/ui/sound';

describe('typing tick level', () => {
  it('is quieter than the original click on its own', () => {
    expect(typeTickLevel(false)).toBeGreaterThan(0);
    expect(typeTickLevel(false)).toBeLessThanOrEqual(0.5);
  });

  it('steps well back under the voice (at least 12 dB lower)', () => {
    expect(typeTickLevel(true)).toBeGreaterThan(0);
    expect(typeTickLevel(true)).toBeLessThanOrEqual(typeTickLevel(false) / 4);
  });
});
