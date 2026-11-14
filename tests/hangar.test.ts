// AR hangar: the table-scale arithmetic, the store hooks that open and close it without touching
// Flight 73, the AR decisions (which path a device takes, what counts as a table, which way the
// models face) and the local QR encoder.

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Vector3 } from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  arOverride,
  detectArMode,
  facingYaw,
  isHorizontalHit,
  linkHint,
  pageLink,
  type ArProbe,
} from '../src/hangar/arSupport';
import { useHangar } from '../src/hangar/hangarStore';
import {
  formatLength,
  freeArea,
  HANGAR_PICKS,
  pickIds,
  rowLayout,
  scaleLabel,
  singleLayout,
  TABLE_ROW_M,
  TABLE_SINGLE_M,
  viewFor,
  type Extent,
} from '../src/hangar/layout';
import { QrCode } from '../src/hangar/QrCode';
import { alignmentPositions, dataCodewords, encodeQr, formatBits, qrPath, rawDataModules, rsDivisor, rsRemainder, versionBits } from '../src/hangar/qr';
import { arSessionInit } from '../src/hangar/xr';
import { HANGAR_HASH, useApp } from '../src/store';
import { MACHINE_IDS } from '../src/types';

const box = (min: [number, number, number], max: [number, number, number]): Extent => ({ min, max });

describe('hangar layout: table scale and the row', () => {
  it('offers the nine machines in route order, then the row', () => {
    expect(HANGAR_PICKS).toHaveLength(10);
    expect(HANGAR_PICKS.slice(0, 9)).toEqual([...MACHINE_IDS]);
    expect(HANGAR_PICKS[9]).toBe('row');
    expect(pickIds('row')).toEqual([...MACHINE_IDS]);
    expect(pickIds('phoenix')).toEqual(['phoenix']);
  });

  it('scales one machine so its longest side is 0.28 m, base on y = 0, footprint centred', () => {
    const e = box([-1.33, 0.2, -1.58], [2.4, 2.2, 1.22]); // 3.73 × 2.0 × 2.8 m, floating 0.2 m up
    const l = singleLayout(e, 'table');
    expect(Math.max(...l.size)).toBeCloseTo(TABLE_SINGLE_M, 9);
    expect(l.scale).toBeCloseTo(0.28 / 3.73, 9);
    const [ox, oy, oz] = l.offsets[0];
    expect(e.min[1] + oy).toBeCloseTo(0, 12);
    expect((e.min[0] + e.max[0]) / 2 + ox).toBeCloseTo(0, 12);
    expect((e.min[2] + e.max[2]) / 2 + oz).toBeCloseTo(0, 12);
    // A tall thin machine: its height is the longest side.
    expect(Math.max(...singleLayout(box([-0.1, 0, -0.1], [0.1, 2, 0.1]), 'table').size)).toBeCloseTo(0.28, 9);
  });

  it('keeps real size at 1:1', () => {
    const e = box([-3, 0, -1.6], [3, 2.1, 1.6]);
    const l = singleLayout(e, 'real');
    expect(l.scale).toBe(1);
    expect(l.size).toEqual(l.realSize);
  });

  const nine: Extent[] = [
    box([-1.33, 0, -1.58], [2.4, 2, 1.22]),
    box([-1.33, 0, -1.58], [2.4, 2, 1.22]),
    box([-2.99, 0, -1.34], [1.57, 1.23, 1.55]),
    box([-1.05, 0, -0.84], [1.06, 1.5, 0.68]),
    box([-1.05, 0, -0.84], [1.06, 1.5, 0.68]),
    box([-2.75, 0, -1.45], [2.75, 2.28, 1.97]),
    box([-3, 0, -1.58], [3, 2.12, 1.68]),
    box([-9.45, 0, -14.18], [7.3, 1.74, 4.0]),
    box([-0.6, 0.02, -0.6], [0.6, 0.68, 0.65]),
  ];

  it('lays the row out 1.1 m wide at one scale, in order, fronts on one line, bases on the table', () => {
    const l = rowLayout(nine, 'table');
    expect(l.size[0]).toBeCloseTo(TABLE_ROW_M, 9);
    const realWidth = nine.reduce((s, e) => s + e.max[0] - e.min[0], 0) + 8 * 1.0;
    expect(l.scale).toBeCloseTo(TABLE_ROW_M / realWidth, 12);
    // In order along +x, never overlapping.
    let lastRight = -Infinity;
    nine.forEach((e, i) => {
      const left = e.min[0] + l.offsets[i][0];
      const right = e.max[0] + l.offsets[i][0];
      expect(left).toBeGreaterThan(lastRight);
      lastRight = right;
      expect(e.min[1] + l.offsets[i][1]).toBeCloseTo(0, 12);
      expect(e.max[2] + l.offsets[i][2]).toBeCloseTo(l.realSize[2] / 2, 12);
    });
    // Centred: the first left edge and last right edge are symmetric.
    expect(nine[0].min[0] + l.offsets[0][0]).toBeCloseTo(-(nine[8].max[0] + l.offsets[8][0]), 9);
    // True relative sizes: the parachute stays ~14× Ingenuity's span.
    const span = (i: number) => (nine[i].max[0] - nine[i].min[0]) * l.scale;
    expect(span(7) / span(8)).toBeCloseTo(16.75 / 1.2, 9);
  });

  it('lays the row out at real size end to end at 1:1', () => {
    const l = rowLayout(nine, 'real');
    expect(l.scale).toBe(1);
    expect(l.size[0]).toBeCloseTo(nine.reduce((s, e) => s + e.max[0] - e.min[0], 0) + 8, 9);
  });

  it('labels scales and lengths for the caption', () => {
    expect(scaleLabel(1)).toBe('1:1');
    expect(scaleLabel(0.28 / 3.73)).toBe('1:13');
    expect(scaleLabel(1 / 48.7)).toBe('1:50');
    expect(scaleLabel(1 / 66)).toBe('1:65');
    expect(formatLength(0.28)).toBe('28 cm');
    expect(formatLength(3.73)).toBe('3.7 m');
    expect(formatLength(53.7)).toBe('54 m');
  });

  it('frames the whole arrangement in the sandbox camera', () => {
    for (const size of [[0.28, 0.15, 0.2], [1.1, 0.05, 0.4], [53.7, 2.3, 18.2]] as [number, number, number][]) {
      const v = viewFor(size, 40, 16 / 9);
      const d = Math.hypot(v.position[0] - v.target[0], v.position[1] - v.target[1], v.position[2] - v.target[2]);
      expect(d).toBeGreaterThan(Math.hypot(...size) / 2);
      expect(v.position[1]).toBeGreaterThan(0);
      expect(v.near).toBeLessThan(d);
      expect(v.far).toBeGreaterThan(d + Math.hypot(...size));
      expect(v.minDistance).toBeLessThan(d);
      expect(v.maxDistance).toBeGreaterThan(d);
    }
  });

  it('keeps the model clear of the panels', () => {
    // Desktop: AR panel on the right, caption bottom left, so the picture moves left and up and a
    // long row fits the narrower free width (the camera stands further back for it).
    const desk = freeArea(1440, 900);
    expect(desk.shiftX).toBeLessThan(0);
    expect(desk.shiftY).toBeGreaterThan(0);
    expect(desk.widthShare).toBeGreaterThan(0.5);
    expect(desk.widthShare).toBeLessThan(1);
    const dist = (aspect: number) => {
      const v = viewFor([1.1, 0.05, 0.4], 40, aspect);
      return Math.hypot(v.position[0] - v.target[0], v.position[1] - v.target[1], v.position[2] - v.target[2]);
    };
    expect(dist((1440 / 900) * desk.widthShare)).toBeGreaterThan(dist(1440 / 900));
    // Phone: panels stack up from the bottom, so the picture moves up only, and stands back.
    const phone = freeArea(390, 844);
    expect(phone.shiftX).toBe(0);
    expect(phone.shiftY).toBeGreaterThan(0);
    expect(phone.zoomOut).toBeGreaterThan(1);
    expect(phone.widthShare).toBe(1);
  });
});

describe('the hangar phase leaves Flight 73 untouched', () => {
  const app = () => useApp.getState();
  beforeEach(() => app().reset());

  it('opens from the title and goes back to it', () => {
    expect(app().phase).toBe('title');
    app().openHangar();
    expect(app().phase).toBe('hangar');
    expect(app().hangarFrom).toBe('title');
    app().closeHangar();
    expect(app().phase).toBe('title');
  });

  it('opens from a stop on the route and returns to the very same flight state', () => {
    app().startFlight();
    app().flyTo(2, 1000);
    app().arrive();
    app().setStory(2);
    const before = app();
    app().openHangar();
    app().openHangar(); // twice: still returns to the flight
    expect(app().hangarFrom).toBe('flight');
    expect(app().flight).toBe(before.flight);
    expect(app().visited).toBe(before.visited);
    expect(app().story).toBe(2);
    app().closeHangar();
    expect(app().phase).toBe('flight');
    expect(app().flight).toBe(before.flight);
    expect(app().flownKm).toBe(before.flownKm);
  });

  it('closing when not open changes nothing', () => {
    app().closeHangar();
    expect(app().phase).toBe('title');
  });

  it('has a deep link the QR code can carry', () => {
    expect(HANGAR_HASH).toBe('#hangar');
  });
});

describe('hangar store: picking, the row, placing', () => {
  const h = () => useHangar.getState();
  beforeEach(() => useHangar.setState({ pick: 'ingenuity', lastSingle: 'ingenuity', xr: 'off', xrNote: null }));

  it('steps through all ten choices and wraps round', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(h().pick);
      h().step(1);
    }
    expect(seen.size).toBe(10);
    expect(h().pick).toBe('ingenuity');
    h().step(1);
    expect(h().pick).toBe('row');
    h().step(1);
    expect(h().pick).toBe('viking-1');
    h().step(-1);
    h().step(-1);
    expect(h().pick).toBe('ingenuity');
  });

  it('toggles the row and comes back to the last single machine', () => {
    h().setPick('phoenix');
    h().toggleRow();
    expect(h().pick).toBe('row');
    h().toggleRow();
    expect(h().pick).toBe('phoenix');
  });

  it('re-places only once placed', () => {
    h().replace();
    expect(h().xr).toBe('off');
    h().setXr('placed');
    h().replace();
    expect(h().xr).toBe('scanning');
    h().setXr('off', 'Camera denied');
    expect(h().xrNote).toBe('Camera denied');
    h().setXr('starting');
    expect(h().xrNote).toBe('Camera denied');
  });
});

describe('AR decisions', () => {
  const probe = (xr: ArProbe['xr'], quickLook: boolean): ArProbe => ({ xr, quickLook });
  const supports = (ok: boolean) => ({ isSessionSupported: async () => ok });

  it('takes WebXR on Android, Quick Look on iPhone, else the sandbox and a QR code', async () => {
    expect(await detectArMode(probe(supports(true), false))).toBe('webxr');
    expect(await detectArMode(probe(supports(false), true))).toBe('quicklook');
    expect(await detectArMode(probe(null, true))).toBe('quicklook');
    expect(await detectArMode(probe(null, false))).toBe('none');
    expect(await detectArMode(probe(supports(false), false))).toBe('none');
    const refuses = { isSessionSupported: async () => Promise.reject(new Error('SecurityError')) };
    expect(await detectArMode(probe(refuses, false))).toBe('none');
    expect(await detectArMode(probe(null, false), 'quicklook')).toBe('quicklook');
  });

  it('reads the testing override from the address', () => {
    expect(arOverride('?hangar-ar=webxr')).toBe('webxr');
    expect(arOverride('?fps&hangar-ar=quicklook')).toBe('quicklook');
    expect(arOverride('?hangar-ar=bogus')).toBeNull();
    expect(arOverride('')).toBeNull();
  });

  it('asks WebXR for hit-test, and for the DOM overlay and light estimation if offered', () => {
    const root = {} as Element;
    const init = arSessionInit(root);
    expect(init.requiredFeatures).toEqual(['hit-test']);
    expect(init.optionalFeatures).toEqual(['dom-overlay', 'light-estimation']);
    expect(init.domOverlay?.root).toBe(root);
    expect(arSessionInit(null).domOverlay).toBeUndefined();
  });

  // Column-major 4×4 with the given y axis (the surface normal).
  const pose = (up: [number, number, number]) => [1, 0, 0, 0, up[0], up[1], up[2], 0, 0, 0, 1, 0, 0, 0.7, -1, 1];
  const tilt = (deg: number): [number, number, number] => [0, Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

  it('accepts a level table top and rejects walls and ceilings', () => {
    expect(isHorizontalHit(pose([0, 1, 0]))).toBe(true);
    expect(isHorizontalHit(pose(tilt(8)))).toBe(true);
    expect(isHorizontalHit(pose(tilt(20)))).toBe(false);
    expect(isHorizontalHit(pose([1, 0, 0]))).toBe(false);
    expect(isHorizontalHit(pose([0, -1, 0]))).toBe(false);
    expect(isHorizontalHit(pose([0, 0, 0]))).toBe(false);
  });

  it('turns the models to face the visitor when placed', () => {
    const at: [number, number, number] = [0.4, 0.75, -1.2];
    for (const viewer of [[0.4, 1.5, 0], [2, 1.5, -1.2], [-1, 1.4, -3], [0.4, 1.6, -2.5]] as [number, number, number][]) {
      const yaw = facingYaw(at, viewer);
      const front = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), yaw);
      const toViewer = new Vector3(viewer[0] - at[0], 0, viewer[2] - at[2]).normalize();
      expect(front.dot(toViewer)).toBeCloseTo(1, 9);
    }
    expect(facingYaw(at, at)).toBe(0);
  });

  it('links the QR code to the hangar and says when a phone could not use it', () => {
    const https = pageLink({ protocol: 'https:', hostname: 'nasa.example.io', origin: 'https://nasa.example.io', pathname: '/still-here/' });
    expect(https).toEqual({ url: 'https://nasa.example.io/still-here/#hangar', kind: 'https' });
    expect(pageLink({ protocol: 'http:', hostname: '192.168.1.23', origin: 'http://192.168.1.23:5190', pathname: '/' }).kind).toBe('http');
    expect(pageLink({ protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:5190', pathname: '/' }).kind).toBe('localhost');
    expect(linkHint('http')).toMatch(/plain-HTTP.*blocks the camera and WebXR/);
    expect(linkHint('localhost')).toMatch(/HTTPS/);
  });
});

describe('local QR encoder', () => {
  it('computes Reed–Solomon codewords (the standard’s HELLO WORLD 1-M example)', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, rsDivisor(10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it('writes the published format and version bits', () => {
    const L = ['111011111000100', '111001011110011', '111110110101010', '111100010011101', '110011000101111', '110001100011000', '110110001000001', '110100101110110'];
    const M = ['101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
    for (let mask = 0; mask < 8; mask++) {
      expect(formatBits('L', mask).toString(2).padStart(15, '0')).toBe(L[mask]);
      expect(formatBits('M', mask).toString(2).padStart(15, '0')).toBe(M[mask]);
    }
    expect(versionBits(7)).toBe(0x07c94);
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
  });

  it('knows each version’s capacity', () => {
    expect(Math.floor(rawDataModules(40) / 8)).toBe(3706);
    expect([1, 2, 3, 4, 5, 10].map(v => dataCodewords(v, 'M'))).toEqual([16, 28, 44, 64, 86, 216]);
    expect(dataCodewords(1, 'L')).toBe(19);
    expect(dataCodewords(40, 'L')).toBe(2956);
    expect(dataCodewords(40, 'H')).toBe(1276);
  });

  /** Reads a single-block symbol back: unmask, walk the zigzag, check the data and its error correction. */
  function readBack(text: string, ecc: 'L' | 'M') {
    const code = encodeQr(text, ecc);
    const n = code.size;
    const align = alignmentPositions(code.version);
    const isFunction = (x: number, y: number) => {
      if ((x < 9 && y < 9) || (x >= n - 8 && y < 9) || (x < 9 && y >= n - 8) || x === 6 || y === 6) return true;
      for (const cx of align) for (const cy of align) {
        const corner = (cx === 6 && cy === 6) || (cx === 6 && cy === n - 7) || (cx === n - 7 && cy === 6);
        if (!corner && Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) return true;
      }
      return false;
    };
    const masks = [
      (x: number, y: number) => (x + y) % 2 === 0,
      (_x: number, y: number) => y % 2 === 0,
      (x: number) => x % 3 === 0,
      (x: number, y: number) => (x + y) % 3 === 0,
      (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const bits: number[] = [];
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
          if (isFunction(x, y)) continue;
          bits.push(code.modules[y][x] !== masks[code.mask](x, y) ? 1 : 0);
        }
      }
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    const total = Math.floor(rawDataModules(code.version) / 8);
    const k = dataCodewords(code.version, ecc);
    const data = bytes.slice(0, k);
    expect(bytes.slice(k, total)).toEqual(rsRemainder(data, rsDivisor(total - k)));
    expect(data[0] >> 4).toBe(0b0100); // byte mode
    const count = ((data[0] & 15) << 4) | (data[1] >> 4);
    const out: number[] = [];
    for (let i = 0; i < count; i++) out.push(((data[1 + i] & 15) << 4) | (data[2 + i] >> 4));
    return { code, decoded: new TextDecoder().decode(new Uint8Array(out)) };
  }

  it('round-trips links through the symbol (smallest version, the format bits in both copies)', () => {
    for (const [text, ecc, version] of [
      ['https://example.github.io/still-here/#hangar', 'L', 3],
      ['http://192.168.1.23:5190/#hangar', 'M', 3],
      ['HELLO', 'M', 1],
    ] as const) {
      const { code, decoded } = readBack(text, ecc);
      expect(decoded).toBe(text);
      expect(code.version).toBe(version);
      expect(code.size).toBe(version * 4 + 17);
      const n = code.size;
      const bits = formatBits(ecc, code.mask);
      const at = (x: number, y: number) => (code.modules[y][x] ? 1 : 0);
      const first = [0, 1, 2, 3, 4, 5].map(i => at(8, i)).concat([at(8, 7), at(8, 8), at(7, 8)], [9, 10, 11, 12, 13, 14].map(i => at(14 - i, 8)));
      const second = [0, 1, 2, 3, 4, 5, 6, 7].map(i => at(n - 1 - i, 8)).concat([8, 9, 10, 11, 12, 13, 14].map(i => at(8, n - 15 + i)));
      const want = Array.from({ length: 15 }, (_, i) => (bits >>> i) & 1);
      expect(first).toEqual(want);
      expect(second).toEqual(want);
      expect(code.modules[n - 8][8]).toBe(true); // the dark module
      for (let i = 8; i < n - 8; i++) expect(code.modules[6][i]).toBe(i % 2 === 0); // timing
    }
  });

  it('grows the version with the text and refuses what no QR code holds', () => {
    expect(encodeQr('x'.repeat(100), 'M').version).toBe(6);
    expect(encodeQr('x'.repeat(122), 'M').version).toBe(7); // version information drawn
    expect(encodeQr('x'.repeat(2331), 'M').version).toBe(40);
    expect(() => encodeQr('x'.repeat(3000), 'M')).toThrow(RangeError);
  });

  it('draws as one SVG path with a quiet zone', () => {
    const code = encodeQr('https://example.github.io/still-here/#hangar', 'M');
    const dark = code.modules.flat().filter(Boolean).length;
    const path = qrPath(code, 4);
    const area = [...path.matchAll(/h(\d+)v1/g)].reduce((s, m) => s + Number(m[1]), 0);
    expect(area).toBe(dark);
    expect(path.startsWith('M4 4h7v1h-7z')).toBe(true); // the top-left finder's first row
    const svg = renderToStaticMarkup(createElement(QrCode, { text: 'https://example.github.io/still-here/#hangar', size: 168 }));
    expect(svg).toContain(`viewBox="0 0 ${code.size + 8} ${code.size + 8}"`);
    expect(svg).toContain('aria-label="QR code for https://example.github.io/still-here/#hangar"');
    expect(svg).toContain(`d="${path}"`);
  });
});
