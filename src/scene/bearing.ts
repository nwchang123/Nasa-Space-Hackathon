// Pure maths for the HUD's 360° bearing bar at a site (src/ui/hud/BearingBar.tsx). Unit-tested.
//
// Compass headings, degrees: 0 = north = diorama −Z, 90 = east = +X (as horizonDir and
// live.camHeadingDeg). The site orbit's az is radians about the site's up, positive
// counter-clockwise seen from above, so turning the camera by +az lowers its heading by az.

const DEG = Math.PI / 180;

/** Degrees into 0..360. */
export const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

/** Signed shortest turn from heading `a` to heading `b`, degrees in (−180, 180]. */
export function headingDelta(a: number, b: number): number {
  const d = wrap360(b - a);
  return d > 180 ? d - 360 : d;
}

/**
 * The orbit goal az (radians) that brings the camera from `heading` (where it faces now, with the
 * orbit at `az`) round to face `target`.
 */
export function goalAzForHeading(az: number, heading: number, target: number): number {
  return az - headingDelta(heading, target) * DEG;
}

/**
 * The heading to face a part from outside the machine: the camera stands on the part's side
 * (its compass bearing from the machine's centre) and looks back across it. Diorama-local metres.
 * Null for a part too close to the centre to have a side.
 */
export function headingToFace(part: { x: number; z: number }, centre: { x: number; z: number }, minRadius = 0.45): number | null {
  const dx = part.x - centre.x;
  const dz = part.z - centre.z;
  if (Math.hypot(dx, dz) < minRadius) return null;
  const outward = Math.atan2(dx, -dz) / DEG;
  return wrap360(outward + 180);
}

/** A part counts as on the side or back when facing it turns the camera this far from the composed shot. */
export const BACK_SIDE_DEG = 60;

/** Compass point for a heading: N, NE, E, … */
export function compassPoint(deg: number): string {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(wrap360(deg) / 45) % 8];
}
