// ILLUSTRATIVE surface maps, painted procedurally (no network, no image files).
// The dark maria, basins, volcanoes and canyons sit at their real latitude / longitude, so the
// globes are recognisable and every landing site lands on the right terrain, but the pixels are
// not measurements. Drop a NASA mosaic into src/scene/maps/ (see README there) to replace them.
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

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

/** Great-circle distance (deg) and initial bearing (rad) from a point to every pixel in a band. */
function forRays(
  W: number,
  H: number,
  lat0: number,
  lon0: number,
  maxDeg: number,
  visit: (idx: number, dist: number, bearing: number) => void,
) {
  const latMin = Math.max(-90, lat0 - maxDeg);
  const latMax = Math.min(90, lat0 + maxDeg);
  const j0 = Math.max(0, Math.floor(((90 - latMax) / 180) * H));
  const j1 = Math.min(H - 1, Math.ceil(((90 - latMin) / 180) * H));
  const s0 = Math.sin(lat0 * DEG);
  const c0 = Math.cos(lat0 * DEG);
  const cosMax = Math.cos(maxDeg * DEG);
  for (let j = j0; j <= j1; j++) {
    const lat = 90 - ((j + 0.5) / H) * 180;
    const s1 = Math.sin(lat * DEG);
    const c1 = Math.cos(lat * DEG);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * 360 - 180;
      const dl = (lon - lon0) * DEG;
      const cosd = s0 * s1 + c0 * c1 * Math.cos(dl);
      if (cosd < cosMax) continue;
      const dist = Math.acos(Math.min(1, cosd)) / DEG;
      const bearing = Math.atan2(Math.sin(dl) * c1, c0 * s1 - s0 * c1 * Math.cos(dl));
      visit(j * W + i, dist, bearing);
    }
  }
}

interface Crater {
  lat: number;
  lon: number;
  /** Radius, great-circle degrees. */
  r: number;
  /** Floor brightness shift (negative = dark floor). */
  floor?: number;
  /** Extra brightness for young, bright craters. */
  bright?: number;
}

function paintCraters(W: number, H: number, alb: Float32Array, craters: Crater[]) {
  for (const c of craters) {
    const p: Patch = { lat: c.lat, lon: c.lon, rLat: c.r, rLon: c.r, w: 1 };
    const floor = c.floor ?? -0.035;
    const bright = c.bright ?? 0;
    forPatch(
      W,
      H,
      p,
      (idx, d) => {
        if (d < 0.82) alb[idx] += floor + bright * (1 - d);
        else if (d < 1.06) alb[idx] += (0.085 + bright * 0.5) * (1 - Math.abs(d - 0.94) / 0.12);
        else alb[idx] += (0.025 + bright * 0.3) * (1 - (d - 1.06) / 0.34);
      },
      1.4,
    );
  }
}

// ---------------------------------------------------------------- Moon

const MOON_MARIA: Patch[] = [
  { lat: 32.8, lon: -15.6, rLat: 17, rLon: 17, w: 1 }, // Imbrium
  { lat: 28.0, lon: 17.5, rLat: 10, rLon: 10.5, w: 1 }, // Serenitatis
  { lat: 8.5, lon: 31.4, rLat: 10, rLon: 13.5, w: 1 }, // Tranquillitatis
  { lat: 3.0, lon: 24.0, rLat: 6.5, rLon: 7, w: 0.95 }, // Tranquillitatis SW lobe (Tranquility Base)
  { lat: 17.0, lon: 59.1, rLat: 8, rLon: 9.5, w: 1, rag: 0.15 }, // Crisium
  { lat: -7.8, lon: 51.3, rLat: 12, rLon: 9, w: 0.95 }, // Fecunditatis
  { lat: -15.2, lon: 35.5, rLat: 5.5, rLon: 5.5, w: 0.95, rag: 0.15 }, // Nectaris
  { lat: -21.3, lon: -16.6, rLat: 10, rLon: 11, w: 0.9 }, // Nubium
  { lat: 30.0, lon: -52.0, rLat: 20, rLon: 15, w: 0.95, rag: 0.55 }, // Procellarum (north)
  { lat: 8.0, lon: -48.0, rLat: 14, rLon: 15, w: 0.95, rag: 0.55 }, // Procellarum (centre)
  { lat: -3.0, lon: -38.0, rLat: 9, rLon: 10, w: 0.9, rag: 0.5 }, // Procellarum (south)
  { lat: 42.0, lon: -42.0, rLat: 9, rLon: 10, w: 0.9, rag: 0.5 }, // Sinus Roris
  { lat: 7.5, lon: -30.9, rLat: 7.5, rLon: 8.5, w: 0.9 }, // Insularum
  { lat: -10.0, lon: -23.0, rLat: 6, rLon: 6, w: 0.9 }, // Cognitum
  { lat: -24.4, lon: -38.6, rLat: 6.2, rLon: 6.2, w: 0.95, rag: 0.15 }, // Humorum
  { lat: 13.3, lon: 3.6, rLat: 4, rLon: 4.5, w: 0.9 }, // Vaporum
  { lat: 2.4, lon: 1.7, rLat: 3, rLon: 4.5, w: 0.75 }, // Sinus Medii
  { lat: 56.0, lon: 2.0, rLat: 4.5, rLon: 24, w: 0.9, rag: 0.5 }, // Frigoris (east)
  { lat: 57.0, lon: -30.0, rLat: 4, rLon: 13, w: 0.85, rag: 0.5 }, // Frigoris (west)
  { lat: 13.3, lon: 86.5, rLat: 4, rLon: 4, w: 0.7 }, // Marginis
  { lat: -1.3, lon: 87.0, rLat: 5, rLon: 5, w: 0.75 }, // Smythii
  { lat: -38.9, lon: 93.0, rLat: 6, rLon: 7, w: 0.55, rag: 0.6 }, // Australe
  { lat: 27.3, lon: 147.9, rLat: 4.5, rLon: 4.5, w: 0.85, rag: 0.2 }, // Moscoviense (far side)
  { lat: -33.7, lon: 163.5, rLat: 3.5, rLon: 4, w: 0.6 }, // Ingenii (far side)
  { lat: -19.4, lon: -92.8, rLat: 3.5, rLon: 3.5, w: 0.8, rag: 0.15 }, // Orientale centre
  { lat: -53.0, lon: -169.0, rLat: 30, rLon: 30, w: 0.22, rag: 0.6 }, // South Pole–Aitken (subtle)
];

const MOON_NAMED_CRATERS: Crater[] = [
  { lat: 9.6, lon: -20.1, r: 1.6, bright: 0.1 }, // Copernicus
  { lat: -43.3, lon: -11.2, r: 1.45, bright: 0.14 }, // Tycho
  { lat: 8.1, lon: -38.0, r: 0.55, bright: 0.1 }, // Kepler
  { lat: 23.7, lon: -47.4, r: 0.7, bright: 0.22 }, // Aristarchus
  { lat: 51.6, lon: -9.4, r: 1.7, floor: -0.16 }, // Plato (dark floor)
  { lat: -58.4, lon: -14.4, r: 3.8 }, // Clavius
  { lat: -5.2, lon: -68.6, r: 2.8, floor: -0.16 }, // Grimaldi (dark floor)
  { lat: -11.4, lon: 26.4, r: 1.65, bright: 0.04 }, // Theophilus
  { lat: -8.9, lon: 61.0, r: 2.2, bright: 0.04 }, // Langrenus
  { lat: -25.1, lon: 60.4, r: 2.9 }, // Petavius
  { lat: -9.3, lon: -1.9, r: 2.5, floor: -0.05 }, // Ptolemaeus
  { lat: -19.4, lon: -92.8, r: 9.5, floor: 0 }, // Orientale outer ring
];

export function paintMoon(W: number, H: number): Uint8ClampedArray {
  const n = fbmField(W, H, 8, 5, 11);
  const n2 = fbmField(W, H, 32, 3, 23);
  const mare = new Float32Array(W * H);
  paintPatches(W, H, mare, n, MOON_MARIA);

  const alb = new Float32Array(W * H);
  for (let k = 0; k < alb.length; k++) {
    const highland = 0.6 + (n[k] - 0.5) * 0.22 + (n2[k] - 0.5) * 0.12;
    const sea = 0.3 + (n[k] - 0.5) * 0.1 + (n2[k] - 0.5) * 0.05;
    alb[k] = highland + (sea - highland) * mare[k];
  }

  // Random craters, sparser on the younger maria; power-law sizes.
  const rnd = mulberry32(1969);
  const craters: Crater[] = [];
  for (let c = 0; c < 2600; c++) {
    const u = rnd();
    const lat = Math.asin(2 * rnd() - 1) / DEG;
    const lon = rnd() * 360 - 180;
    const j = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
    const i = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W));
    if (mare[j * W + i] > 0.5 && rnd() < 0.78) continue;
    const r = Math.min(3.2, 0.22 * Math.pow(1 - u * 0.985, -0.55));
    craters.push({ lat, lon, r, floor: -0.02 - rnd() * 0.03 });
  }
  paintCraters(W, H, alb, craters);
  paintCraters(W, H, alb, MOON_NAMED_CRATERS);

  // Ray systems: Tycho (long), Copernicus and Kepler (short). The angular profile of the rays is
  // tabulated once per crater (bearing bins), so each pixel costs one lookup.
  const rays = (lat0: number, lon0: number, maxDeg: number, count: number, strength: number, seed: number) => {
    const r = mulberry32(seed);
    const dirs = Array.from({ length: count }, () => ({ b: r() * Math.PI * 2 - Math.PI, w: 0.03 + r() * 0.05, len: 0.35 + r() * 0.65 }));
    const BINS = 1440;
    const amp = new Float32Array(BINS);
    const len = new Float32Array(BINS);
    for (let k = 0; k < BINS; k++) {
      const bearing = (k / BINS) * Math.PI * 2 - Math.PI;
      let a = 0;
      let l = 0;
      for (const d of dirs) {
        let db = bearing - d.b;
        if (db > Math.PI) db -= 2 * Math.PI;
        if (db < -Math.PI) db += 2 * Math.PI;
        const e = Math.exp(-((db / d.w) ** 2));
        a += e;
        l += e * d.len;
      }
      amp[k] = Math.min(1, a);
      len[k] = a > 1e-4 ? l / a : 0;
    }
    forRays(W, H, lat0, lon0, maxDeg, (idx, dist, bearing) => {
      if (dist < 1.2) return;
      const k = Math.min(BINS - 1, Math.floor(((bearing + Math.PI) / (Math.PI * 2)) * BINS));
      if (amp[k] < 0.01) return;
      const reach = dist / (maxDeg * len[k]);
      if (reach >= 1) return;
      alb[idx] += amp[k] * (1 - reach) * strength * (0.6 + 0.8 * n2[idx]);
    });
  };
  rays(-43.3, -11.2, 42, 22, 0.13, 7);
  rays(9.6, -20.1, 11, 16, 0.08, 9);
  rays(8.1, -38.0, 6, 12, 0.06, 13);
  rays(23.7, -47.4, 5, 10, 0.06, 17);

  const out = new Uint8ClampedArray(W * H * 4);
  for (let k = 0, p = 0; k < alb.length; k++, p += 4) {
    const a = Math.max(0.06, Math.min(0.95, alb[k]));
    // Maria lean faintly blue-grey (titanium-rich), highlands faintly warm.
    const m = mare[k];
    out[p] = 255 * a * (1.0 - 0.03 * m);
    out[p + 1] = 255 * a * (0.985 - 0.01 * m);
    out[p + 2] = 255 * a * (0.95 + 0.04 * m);
    out[p + 3] = 255;
  }
  return out;
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
