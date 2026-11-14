// Shared geometry helpers. Frozen contract: the scene places markers with latLonToVec3,
// and the globe shader receives sun directions built with the same function.

export const DEG = Math.PI / 180;

/**
 * Body-fixed unit vector for a planetocentric latitude / east longitude (degrees).
 * Matches three.js SphereGeometry UVs for an equirectangular map centred on 0° longitude:
 * lon 0 → +X, lon +90 (east) → −Z, lon −90 → +Z, north pole → +Y.
 */
export function latLonToVec3(lat: number, lon: number, r = 1): [number, number, number] {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

/** Wrap an angle in degrees to −180..180. */
export function wrap180(deg: number): number {
  const x = ((((deg + 180) % 360) + 360) % 360) - 180;
  return x === -180 ? 180 : x;
}

/** Wrap an angle in degrees to 0..360. */
export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** '2004-01-25' → 2004.066 (fractional year, UTC). */
export function yearFraction(iso: string): number {
  const t = Date.parse(iso + 'T00:00:00Z');
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (t - start) / (end - start);
}

/** Fractional year for a Date. */
export function dateToYear(date: Date): number {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (end - start);
}
