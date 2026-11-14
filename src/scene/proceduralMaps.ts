// ILLUSTRATIVE surface map of Mars, painted procedurally (no network, no image files).
// The dark albedo regions, basins, volcanoes and canyons sit at their real latitude / longitude,
// so the globe is recognisable and every landing site lands on the right terrain, but the pixels
// are not measurements. Drop a NASA mosaic into src/scene/maps/ (see README there) to replace it.
//
// Equirectangular, centred on 0° longitude, north up: column 0 = 180°W, row 0 = 90°N.
// Pure functions over typed arrays, so they run (and are timed) in Node too.

import { DEG, wrap180 } from '../geo';

// ---------------------------------------------------------------- noise

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Fractal value-noise field (0..1) for a W×H equirectangular map. Each octave's lattice is
 * hashed once, then interpolated; the lattice wraps in x so the map is seamless across ±180°.
 */
function fbmField(W: number, H: number, baseCells: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(W * H);
  // Per-column interpolation weights are shared by every row of an octave.
  const colX0 = new Int32Array(W);
  const colX1 = new Int32Array(W);
  const colU = new Float32Array(W);
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells << o;
    const scale = cells / W;
    const rows = Math.floor((H - 1) * scale) + 2;
    const lattice = new Float32Array(cells * rows);
    const s = seed + o * 101;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cells; x++) lattice[y * cells + x] = hash2(x, y, s);
    for (let i = 0; i < W; i++) {
      const x = i * scale;
      const ix = Math.floor(x);
      const fx = x - ix;
      colX0[i] = ix % cells;
      colX1[i] = (ix + 1) % cells;
      colU[i] = fx * fx * (3 - 2 * fx);
    }
    for (let j = 0; j < H; j++) {
      const y = j * scale;
      const iy = Math.floor(y);
      const fy = y - iy;
      const uy = fy * fy * (3 - 2 * fy);
      const r0 = iy * cells;
      const r1 = r0 + cells;
      const row = j * W;
      for (let i = 0; i < W; i++) {
        const x0 = colX0[i];
        const x1 = colX1[i];
        const a = lattice[r0 + x0];
        const b = lattice[r0 + x1];
        const c = lattice[r1 + x0];
        const d = lattice[r1 + x1];
        const ux = colU[i];
        const top = a + (b - a) * ux;
        const bottom = c + (d - c) * ux;
        out[row + i] += amp * (top + (bottom - top) * uy);
      }
    }
    norm += amp;
    amp *= 0.5;
  }
  for (let k = 0; k < out.length; k++) out[k] /= norm;
  return out;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- features

/** An elliptical patch: centre, half-extents in great-circle degrees (north–south, east–west). */
interface Patch {
  lat: number;
  lon: number;
  rLat: number;
  rLon: number;
  /** Strength 0..1 (how far toward the feature colour). */
  w: number;
  /** Edge raggedness from the noise field. */
  rag?: number;
}

/** Visit every pixel within ~1.4× of a patch, with its normalised elliptical distance (unwrapped). */
function forPatch(W: number, H: number, p: Patch, visit: (idx: number, d: number) => void, reach = 1.45) {
  const latMin = Math.max(-90, p.lat - p.rLat * reach);
  const latMax = Math.min(90, p.lat + p.rLat * reach);
  const j0 = Math.max(0, Math.floor(((90 - latMax) / 180) * H));
  const j1 = Math.min(H - 1, Math.ceil(((90 - latMin) / 180) * H));
  const cosEdge = Math.max(0.12, Math.min(Math.cos(latMin * DEG), Math.cos(latMax * DEG)));
  const lonReach = Math.min(180, (p.rLon * reach) / cosEdge);
  const i0 = Math.floor(((p.lon - lonReach + 180) / 360) * W);
  const i1 = Math.ceil(((p.lon + lonReach + 180) / 360) * W);
  for (let j = j0; j <= j1; j++) {
    const lat = 90 - ((j + 0.5) / H) * 180;
    const c = Math.cos(((lat + p.lat) / 2) * DEG);
    const dLat = (lat - p.lat) / p.rLat;
    for (let ii = i0; ii <= i1; ii++) {
      const i = ((ii % W) + W) % W;
      const lon = ((i + 0.5) / W) * 360 - 180;
      const dLon = (wrap180(lon - p.lon) * c) / p.rLon;
      visit(j * W + i, Math.sqrt(dLat * dLat + dLon * dLon));
    }
  }
}

function paintPatches(W: number, H: number, mask: Float32Array, noise: Float32Array, patches: Patch[]) {
  for (const p of patches) {
    const rag = p.rag ?? 0.35;
    forPatch(W, H, p, (idx, d) => {
      const dd = d + (noise[idx] - 0.5) * rag;
      const m = (1 - smooth(0.78, 1.05, dd)) * p.w;
      if (m > mask[idx]) mask[idx] = m;
    });
  }
}

// ---------------------------------------------------------------- Mars

const MARS_DARK: Patch[] = [
  { lat: 8.4, lon: 69.5, rLat: 17, rLon: 9, w: 1, rag: 0.5 }, // Syrtis Major
  { lat: 46.7, lon: -22.0, rLat: 12, rLon: 18, w: 0.85, rag: 0.55 }, // Acidalia
  { lat: -25.0, lon: -40.0, rLat: 11, rLon: 24, w: 0.85, rag: 0.55 }, // Mare Erythraeum
  { lat: -2.0, lon: 0.0, rLat: 5, rLon: 11, w: 0.9, rag: 0.45 }, // Sinus Meridiani
  { lat: -8.0, lon: 22.0, rLat: 5, rLon: 18, w: 0.85, rag: 0.5 }, // Sinus Sabaeus
  { lat: -20.0, lon: 105.0, rLat: 10, rLon: 20, w: 0.8, rag: 0.55 }, // Mare Tyrrhenum
  { lat: -25.0, lon: 145.0, rLat: 9, rLon: 24, w: 0.8, rag: 0.55 }, // Mare Cimmerium
  { lat: -32.0, lon: -150.0, rLat: 8, rLon: 22, w: 0.75, rag: 0.55 }, // Mare Sirenum
  { lat: 47.0, lon: 117.0, rLat: 10, rLon: 20, w: 0.45, rag: 0.6 }, // Utopia (mid-tone)
  { lat: -26.0, lon: -85.0, rLat: 5, rLon: 6, w: 0.75, rag: 0.4 }, // Solis Lacus
  { lat: -15.0, lon: -50.0, rLat: 6, rLon: 8, w: 0.7, rag: 0.45 }, // Aurorae Sinus
  { lat: -60.0, lon: 30.0, rLat: 7, rLon: 40, w: 0.55, rag: 0.6 }, // Mare Australe
  { lat: 30.0, lon: -30.0, rLat: 5, rLon: 6, w: 0.55, rag: 0.5 }, // Niliacus Lacus
];

const MARS_BRIGHT: Patch[] = [
  { lat: -42.4, lon: 70.5, rLat: 13, rLon: 17, w: 0.9, rag: 0.25 }, // Hellas
  { lat: -49.7, lon: -43.4, rLat: 7, rLon: 8, w: 0.75, rag: 0.25 }, // Argyre
  { lat: 20.0, lon: 20.0, rLat: 16, rLon: 22, w: 0.5, rag: 0.5 }, // Arabia Terra
  { lat: 25.0, lon: 147.0, rLat: 9, rLon: 11, w: 0.55, rag: 0.4 }, // Elysium rise
  { lat: 0.0, lon: -110.0, rLat: 22, rLon: 26, w: 0.55, rag: 0.5 }, // Tharsis
  { lat: 15.0, lon: -160.0, rLat: 14, rLon: 20, w: 0.5, rag: 0.5 }, // Amazonis
];

const MARS_VOLCANOES: { lat: number; lon: number; r: number }[] = [
  { lat: 18.65, lon: -133.8, r: 5.2 }, // Olympus Mons
  { lat: 11.8, lon: -104.5, r: 2.6 }, // Ascraeus Mons
  { lat: 1.5, lon: -113.0, r: 2.3 }, // Pavonis Mons
  { lat: -8.4, lon: -120.5, r: 2.7 }, // Arsia Mons
  { lat: 25.0, lon: 147.2, r: 1.6 }, // Elysium Mons
];

/** Valles Marineris centre line, west → east (lat, lon). */
const VALLES: [number, number][] = [
  [-6.5, -101],
  [-8.5, -92],
  [-10.5, -80],
  [-12.5, -70],
  [-13.5, -60],
  [-11.5, -51],
  [-8.5, -43],
];

export function paintMars(W: number, H: number): Uint8ClampedArray {
  const n = fbmField(W, H, 8, 5, 31);
  const n2 = fbmField(W, H, 40, 3, 37);
  const dark = new Float32Array(W * H);
  const bright = new Float32Array(W * H);
  paintPatches(W, H, dark, n, MARS_DARK);
  paintPatches(W, H, bright, n, MARS_BRIGHT);

  const r = new Float32Array(W * H);
  const g = new Float32Array(W * H);
  const b = new Float32Array(W * H);
  for (let k = 0; k < r.length; k++) {
    const v = (n[k] - 0.5) * 0.18 + (n2[k] - 0.5) * 0.1;
    // base ochre → bright butterscotch → dark basalt
    let rr = 0.71 + v, gg = 0.41 + v * 0.8, bb = 0.24 + v * 0.5;
    const br = bright[k];
    rr += (0.86 - rr) * br; gg += (0.6 - gg) * br; bb += (0.4 - bb) * br;
    const dk = dark[k] * (0.75 + 0.5 * n2[k]);
    rr += (0.36 - rr) * dk; gg += (0.24 - gg) * dk; bb += (0.17 - bb) * dk;
    r[k] = rr; g[k] = gg; b[k] = bb;
  }

  // Volcano shields: bright apron, scarp ring, dark caldera.
  for (const v of MARS_VOLCANOES) {
    forPatch(W, H, { lat: v.lat, lon: v.lon, rLat: v.r, rLon: v.r, w: 1 }, (idx, d) => {
      let s = 0;
      if (d < 0.12) s = -0.22;
      else if (d < 0.9) s = 0.06 * (1 - d);
      else if (d < 1.05) s = 0.07;
      else s = -0.03 * (1 - (d - 1.05) / 0.4);
      r[idx] += s; g[idx] += s * 0.85; b[idx] += s * 0.7;
    }, 1.45);
  }

  // Valles Marineris: dark canyon line with ragged walls.
  const vLatMin = -20, vLatMax = 0, vLonMin = -106, vLonMax = -36;
  const j0 = Math.floor(((90 - vLatMax) / 180) * H), j1 = Math.ceil(((90 - vLatMin) / 180) * H);
  const i0 = Math.floor(((vLonMin + 180) / 360) * W), i1 = Math.ceil(((vLonMax + 180) / 360) * W);
  for (let j = j0; j <= j1; j++) {
    const lat = 90 - ((j + 0.5) / H) * 180;
    const c = Math.cos(lat * DEG);
    for (let i = i0; i <= i1; i++) {
      const lon = ((i + 0.5) / W) * 360 - 180;
      let best = 1e9;
      for (let s = 0; s < VALLES.length - 1; s++) {
        const [la1, lo1] = VALLES[s];
        const [la2, lo2] = VALLES[s + 1];
        const ax = (lon - lo1) * c, ay = lat - la1;
        const bx = (lo2 - lo1) * c, by = la2 - la1;
        const t = Math.max(0, Math.min(1, (ax * bx + ay * by) / (bx * bx + by * by)));
        const dx = ax - bx * t, dy = ay - by * t;
        best = Math.min(best, Math.hypot(dx, dy));
      }
      const idx = j * W + i;
      const width = 1.1 + 0.9 * n2[idx];
      if (best < width * 1.8) {
        const k = 1 - smooth(width * 0.4, width * 1.8, best);
        r[idx] += (0.3 - r[idx]) * k * 0.85;
        g[idx] += (0.2 - g[idx]) * k * 0.85;
        b[idx] += (0.15 - b[idx]) * k * 0.85;
      }
    }
  }

  // Polar caps (late-summer residual size, ragged).
  for (let j = 0; j < H; j++) {
    const lat = 90 - ((j + 0.5) / H) * 180;
    if (Math.abs(lat) < 70) continue;
    for (let i = 0; i < W; i++) {
      const idx = j * W + i;
      const edge = lat > 0 ? 80.5 + (n[idx] - 0.5) * 9 : -(83 + (n[idx] - 0.5) * 6);
      const inside = lat > 0 ? lat - edge : edge - lat;
      const k = smooth(-0.8, 1.6, inside);
      if (k <= 0) continue;
      r[idx] += (0.93 - r[idx]) * k;
      g[idx] += (0.9 - g[idx]) * k;
      b[idx] += (0.86 - b[idx]) * k;
    }
  }

  const out = new Uint8ClampedArray(W * H * 4);
  for (let k = 0, p = 0; k < r.length; k++, p += 4) {
    out[p] = 255 * r[k];
    out[p + 1] = 255 * g[k];
    out[p + 2] = 255 * b[k];
    out[p + 3] = 255;
  }
  return out;
}
