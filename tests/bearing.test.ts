import { describe, expect, it } from 'vitest';
import { compassPoint, goalAzForHeading, headingDelta, headingToFace, wrap360 } from '../src/scene/bearing';

describe('bearing bar maths', () => {
  it('wraps headings into 0..360', () => {
    expect(wrap360(-10)).toBe(350);
    expect(wrap360(370)).toBe(10);
    expect(wrap360(360)).toBe(0);
  });

  it('takes the short way round', () => {
    expect(headingDelta(350, 10)).toBe(20);
    expect(headingDelta(10, 350)).toBe(-20);
    expect(headingDelta(0, 180)).toBe(180);
  });

  it('turns the orbit the right way: +az (counter-clockwise from above) lowers the heading', () => {
    // From heading 100 to 130 the camera must swing clockwise: az falls by 30°.
    expect(goalAzForHeading(0, 100, 130)).toBeCloseTo((-30 * Math.PI) / 180, 9);
    expect(goalAzForHeading(1, 100, 70)).toBeCloseTo(1 + (30 * Math.PI) / 180, 9);
  });

  it('faces a part from its own side', () => {
    // A part east of the centre (+X) is seen from the east, looking west.
    expect(headingToFace({ x: 1, z: 0 }, { x: 0, z: 0 })).toBeCloseTo(270, 9);
    // North of the centre (−Z): seen from the north, looking south.
    expect(headingToFace({ x: 0, z: -2 }, { x: 0, z: 0 })).toBeCloseTo(180, 9);
    // Too close to the centre to have a side.
    expect(headingToFace({ x: 0.1, z: 0.1 }, { x: 0, z: 0 })).toBeNull();
  });

  it('names compass points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(44)).toBe('NE');
    expect(compassPoint(200)).toBe('S');
    expect(compassPoint(338)).toBe('N');
  });
});
