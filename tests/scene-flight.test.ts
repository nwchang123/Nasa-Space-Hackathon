import { describe, expect, it } from 'vitest';
import { MACHINE_BY_ID } from '../src/data/machines';
import { flyDurationMs, hop, LEGS } from '../src/flight/route';
import { latLonToVec3 } from '../src/geo';
import {
  Choreographer,
  EPILOGUE_HOLD_MS,
  EPILOGUE_RISE_MS,
  OPENING_DESCENT_MS,
  rotorTest,
  SKIP_CRUISE_MS,
  SKIP_DESCENT_MS,
  skipClock,
  SPINUP_MS,
  STALL_SPEED,
  FAULT_SPINDOWN_MS,
  type Shot,
} from '../src/scene/choreo';
import { phantomLook, PHANTOM_RISE_MS } from '../src/scene/phantom';
import {
  arcAltitude,
  arcPeak,
  blendPose,
  chaseGoal,
  descentMs,
  dioramaSunDir,
  easeInOut,
  flightProgress,
  HUD_ANCHOR_Y,
  legPoint,
  navcamPose,
  orbitOffset,
  ORBIT_MAX_ELEV,
  ORBIT_MIN_ELEV,
  realSizeScale,
  ROUTE_BASE,
  siteFrame,
  type Vec3,
} from '../src/scene/layout';
import { SITE_PRESETS, siteLayout, skyLook } from '../src/scene/sites';
import type { FlightState, Phase } from '../src/store';
import { MACHINE_IDS } from '../src/types';

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('route arcs', () => {
  it('lift higher for longer legs, between 0.06 and 0.22 of the radius', () => {
    expect(arcPeak(300)).toBeCloseTo(0.06, 5);
    expect(arcPeak(10_000)).toBeCloseTo(0.22, 5);
    expect(arcPeak(6000)).toBeGreaterThan(arcPeak(1000));
  });
  it('barely lift on the last short hop home', () => {
    const last = LEGS[LEGS.length - 1];
    expect(last.distanceKm).toBeLessThan(50);
    expect(arcPeak(last.distanceKm)).toBeLessThan(0.025);
  });
  it('start and end on the stops, just above the surface', () => {
    for (const leg of LEGS) {
      const a = MACHINE_BY_ID[leg.from];
      const b = MACHINE_BY_ID[leg.to];
      expect(dist(legPoint(leg, 0), latLonToVec3(a.lat, a.lon, ROUTE_BASE))).toBeLessThan(1e-9);
      expect(dist(legPoint(leg, 1), latLonToVec3(b.lat, b.lon, ROUTE_BASE))).toBeLessThan(1e-9);
      expect(len(legPoint(leg, 0.5))).toBeCloseTo(ROUTE_BASE + arcAltitude(0.5, leg.distanceKm), 9);
    }
  });
  it('work for direct hops too', () => {
    const h = hop('ingenuity', 4); // straight to Opportunity
    expect(h.onRoute).toBe(false);
    expect(len(legPoint(h, 0.5))).toBeGreaterThan(ROUTE_BASE + 0.05);
  });
});

describe('the flyer and the odometer share one clock', () => {
  it('uses the same ease-in-out over flyMs and finishes at the same instant', () => {
    const D = 5000;
    for (const t of [0, 800, 2500, 4100, 5000]) {
      const k = t / D;
      const odometer = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // FlightConsole's easing
      expect(flightProgress(t, D)).toBeCloseTo(odometer, 12);
    }
    expect(flightProgress(D, D)).toBe(1);
  });
});

describe('chase camera', () => {
  const base = { pos: [0, 1.1, 0] as Vec3, up: [0, 1, 0] as Vec3, forward: [0, 0, -1] as Vec3, fovDeg: 40 };
  it('sits behind and above Ingenuity, pulling back as it climbs', () => {
    const low = chaseGoal({ ...base, alt: 0.01, aspect: 1.8 });
    const high = chaseGoal({ ...base, alt: 0.2, aspect: 1.8 });
    expect(low.position[2]).toBeGreaterThan(0); // behind (travel is −Z)
    expect(low.position[1]).toBeGreaterThan(1.1); // above
    expect(dist(high.position, base.pos)).toBeGreaterThan(dist(low.position, base.pos) * 2);
  });
  it('keeps Ingenuity centred left to right and above the bottom dock on wide screens', () => {
    expect(HUD_ANCHOR_Y).toBeLessThan(0.5);
    const wide = chaseGoal({ ...base, alt: 0.05, aspect: 1.8 });
    expect(wide.target[0]).toBeCloseTo(0, 9); // no sideways offset (camera right = ±X here)
    expect(wide.target[1]).toBeLessThan(base.pos[1]); // aimed below it, so it sits above the middle
    const tall = chaseGoal({ ...base, alt: 0.05, aspect: 0.5 });
    expect(tall.target[1]).toBeLessThan(base.pos[1]);
  });
});

describe('site dioramas', () => {
  it('sun direction: north is −Z, east is +X, up is +Y', () => {
    const n = dioramaSunDir(0, 0);
    expect(n[2]).toBeCloseTo(-1, 9);
    const e = dioramaSunDir(90, 0);
    expect(e[0]).toBeCloseTo(1, 9);
    expect(dioramaSunDir(123, 90)[1]).toBeCloseTo(1, 9);
  });
  it('the surface frame at a stop is right-handed with up along the radius', () => {
    const f = siteFrame(18.4, 77.4);
    const up = latLonToVec3(18.4, 77.4);
    expect(dist(f.up, up)).toBeLessThan(1e-12);
    // east × up = south, so north = up × east points toward the pole.
    const north: Vec3 = [-f.south[0], -f.south[1], -f.south[2]];
    expect(north[1]).toBeGreaterThan(0);
    const cross: Vec3 = [
      f.east[1] * f.up[2] - f.east[2] * f.up[1],
      f.east[2] * f.up[0] - f.east[0] * f.up[2],
      f.east[0] * f.up[1] - f.east[1] * f.up[0],
    ];
    expect(dist(cross, f.south)).toBeLessThan(1e-12);
  });
  it('Ingenuity lands clear of every machine, and the frame holds both', () => {
    for (const id of MACHINE_IDS) {
      const p = SITE_PRESETS[id];
      const l = siteLayout(p);
      if (id !== 'ingenuity') expect(Math.hypot(l.ingenuity[0], l.ingenuity[2])).toBeGreaterThan(2);
      expect(p.frame.right).toBeGreaterThan(p.ingenuity.right);
      expect(l.halfWidth).toBeGreaterThan(0);
    }
  });
});

describe('the Martian sky', () => {
  it('is butterscotch by day, blue around the Sun at sunset, dark with stars at night', () => {
    const day = skyLook(40);
    const dusk = skyLook(-2);
    const night = skyLook(-30);
    expect(day.horizon[0]).toBeGreaterThan(day.horizon[2]); // warm
    expect(dusk.glow[2]).toBeGreaterThan(dusk.glow[0]); // blue glow
    expect(night.zenith[0] + night.zenith[1] + night.zenith[2]).toBeLessThan(0.1);
    expect(night.stars).toBeGreaterThan(0.9);
    expect(day.stars).toBe(0);
    expect(night.sunIntensity).toBe(0);
    expect(night.ambientIntensity).toBeGreaterThan(0.4); // night reads as night, not black
  });
});

describe('models are scaled to real size by their bounding box', () => {
  it('uses the span, the height, or the mean of both', () => {
    expect(realSizeScale({ x: 16.7, y: 8.97, z: 12.6 }, { height: 2 })).toBeCloseTo(2 / 8.97, 9);
    expect(realSizeScale({ x: 1.1, y: 0.56, z: 0.99 }, { span: 1.2 })).toBeCloseTo(1.2 / 1.1, 9);
    expect(realSizeScale({ x: 2, y: 1, z: 1 }, { span: 4, height: 1 })).toBeCloseTo(1.5, 9);
    expect(realSizeScale({ x: 2, y: 1, z: 1 }, {})).toBe(1);
  });
});

describe('camera pose blending', () => {
  it('zooms geometrically about the pivot, ending exactly on each pose', () => {
    const a = { position: [0, 0, 1] as Vec3, target: [0, 0, 0.1] as Vec3, up: [0, 1, 0] as Vec3 };
    const b = { position: [0, 0, 0.001] as Vec3, target: [0, 0, 0.0001] as Vec3, up: [0, 1, 0] as Vec3 };
    expect(blendPose(a, b, 0, [0, 0, 0])).toEqual(a);
    expect(blendPose(a, b, 1, [0, 0, 0])).toEqual(b);
    // Half-way in log space: 1 → 0.001 passes 0.0316, not 0.5.
    expect(len(blendPose(a, b, 0.5, [0, 0, 0]).position)).toBeCloseTo(Math.sqrt(0.001), 6);
  });
});

// ---------------------------------------------------------------- the whole flight as one shot

interface Store {
  phase: Phase;
  flight: FlightState;
}

/** Run the choreographer frame by frame (16 ms) and check the shot never jumps. */
function film(script: (t: number, s: Store) => void, untilMs: number) {
  const c = new Choreographer();
  const s: Store = { phase: 'title', flight: { leg: -1, stage: 'prologue', from: 'ingenuity', stageStartedAt: 0, flyMs: 0 } };
  const frames: { t: number; shot: Shot; store: Store }[] = [];
  for (let t = 0; t <= untilMs; t += 16) {
    script(t, s);
    const shot = c.update(s.phase, s.flight, t, false);
    frames.push({ t, shot: { ...shot }, store: { phase: s.phase, flight: { ...s.flight } } });
  }
  return frames;
}

function expectContinuous(frames: { t: number; shot: Shot; store: Store }[]) {
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].shot;
    const b = frames[i].shot;
    const where = `at ${frames[i].t} ms (${frames[i].store.phase} ${frames[i].store.flight.stage})`;
    // The dive never jumps: at most a small step per 16 ms frame.
    expect(Math.abs(b.blend - a.blend), where).toBeLessThan(0.08);
    // A different diorama only comes in once the old one is fully left.
    if (a.siteId && b.siteId && a.siteId !== b.siteId) expect(a.blend).toBeLessThan(0.002);
    // Ingenuity never jumps along an arc of the same hop.
    if (a.arc && b.arc && a.arc.from === b.arc.from && a.arc.to === b.arc.to) expect(Math.abs(b.arc.p - a.arc.p)).toBeLessThan(0.08);
    expect(Math.abs(b.hover - a.hover)).toBeLessThan(0.2);
  }
}

describe('Flight 73 is one continuous shot', () => {
  const D0 = flyDurationMs(LEGS[0].distanceKm);
  const D1 = flyDurationMs(LEGS[1].distanceKm);
  const begin = 992;
  const liftOff = begin + 4000;
  const arrive0 = liftOff + Math.ceil(D0 / 16) * 16;
  const flyOn = arrive0 + 5000;
  const skipAt = flyOn + Math.round(D1 * 0.4);
  const epilogueAt = skipAt + 6000;
  const reportAt = epilogueAt + EPILOGUE_HOLD_MS + EPILOGUE_RISE_MS + 1000;

  const fired = new Set<string>();
  const once = (name: string, t: number, at: number) => t >= at && !fired.has(name) && fired.add(name) !== undefined;
  const frames = film((t, s) => {
    if (once('begin', t, begin)) {
      s.phase = 'flight';
      s.flight = { leg: -1, stage: 'prologue', from: 'ingenuity', stageStartedAt: t, flyMs: 0 };
    }
    if (once('liftOff', t, liftOff)) s.flight = { leg: 0, stage: 'flying', from: 'ingenuity', stageStartedAt: t, flyMs: D0 };
    if (s.flight.stage === 'flying' && s.flight.leg === 0 && t - s.flight.stageStartedAt >= D0) s.flight = { ...s.flight, stage: 'site', stageStartedAt: t };
    if (once('flyOn', t, flyOn)) s.flight = { leg: 1, stage: 'flying', from: 'viking-1', stageStartedAt: t, flyMs: D1 };
    if (once('skip', t, skipAt)) s.flight = { ...s.flight, stage: 'site', stageStartedAt: t }; // "Skip to Viking 2"
    if (once('epilogue', t, epilogueAt)) s.flight = { leg: MACHINE_IDS.length, stage: 'epilogue', from: 'viking-2', stageStartedAt: t, flyMs: 0 };
    if (once('report', t, reportAt)) s.phase = 'report';
  }, reportAt + 4000);

  const at = (t: number) => frames[Math.round(t / 16)].shot;

  it('has no jumps anywhere: title → prologue → flight → site → next leg → skip → epilogue → flight log', () => {
    expectContinuous(frames);
  });
  it('dives from the title globe into the home diorama', () => {
    expect(at(begin - 16).blend).toBe(0);
    expect(at(begin + OPENING_DESCENT_MS + 32).blend).toBe(1);
    expect(at(begin + 500).siteId).toBe('ingenuity');
  });
  it('climbs out of home as the first leg begins, then cruises over the globe', () => {
    expect(at(liftOff + 16).blend).toBeGreaterThan(0.95);
    expect(at(liftOff + 16).siteId).toBe('ingenuity');
    expect(at(liftOff + D0 / 2).blend).toBe(0);
    expect(at(liftOff + D0 / 2).siteId).toBe('viking-1'); // next diorama mounted early, still hidden
  });
  it('dives into the site over the last ~15 % of the leg and is there when the stage becomes site', () => {
    const dStart = liftOff + D0 - descentMs(D0);
    expect(at(dStart - 32).blend).toBe(0);
    expect(at(dStart + descentMs(D0) / 2).blend).toBeGreaterThan(0.3);
    expect(at(arrive0).blend).toBeGreaterThan(0.99);
    expect(at(arrive0 + 3000).hover).toBe(0); // landed
  });
  it('a skip jumps to the descent and lands within about a second, never teleporting', () => {
    expect(at(skipAt).blend).toBeLessThan(0.05);
    expect(at(skipAt + SKIP_CRUISE_MS + SKIP_DESCENT_MS + 64).blend).toBe(1);
    expect(at(skipAt + SKIP_CRUISE_MS + SKIP_DESCENT_MS + 64).siteId).toBe('viking-2');
  });
  it('holds at home in the epilogue, then rises to the whole globe', () => {
    expect(at(epilogueAt + 2000).blend).toBeGreaterThan(0); // rising out of Viking 2 toward home
    expect(at(epilogueAt + EPILOGUE_HOLD_MS - 32).siteId).toBe('ingenuity');
    expect(at(epilogueAt + EPILOGUE_HOLD_MS - 32).blend).toBe(1);
    expect(at(epilogueAt + EPILOGUE_HOLD_MS + EPILOGUE_RISE_MS + 32).blend).toBe(0);
    expect(at(reportAt + 3000).globeShot).toBe('report');
  });
  it('skip clock: fast cruise, then the descent, ending exactly on the leg', () => {
    const D = 6000;
    expect(skipClock(0, 1000, D)).toBe(1000);
    expect(skipClock(SKIP_CRUISE_MS, 1000, D)).toBeCloseTo(D - descentMs(D), 6);
    expect(skipClock(SKIP_CRUISE_MS + SKIP_DESCENT_MS, 1000, D)).toBe(D);
    expect(easeInOut(1)).toBe(1);
  });
});

// ---------------------------------------------------------------- Version 3

describe('boost', () => {
  it('banked time moves the flight on, without restarting the shot', () => {
    const D = flyDurationMs(LEGS[1].distanceKm);
    const flight: FlightState = { leg: 1, stage: 'flying', from: 'viking-1', stageStartedAt: 0, flyMs: D };
    const plain = new Choreographer();
    const boosted = new Choreographer();
    const end = Math.round((D * 0.3) / 16) * 16;
    for (let t = 0; t < end; t += 16) {
      plain.update('flight', flight, t, false);
      // Boost held from the start: 1.5 extra ms per real ms (x2.5 in all).
      boosted.update('flight', flight, t, false, { boostMs: t * 1.5 });
    }
    const a = plain.update('flight', flight, end, false).arc!;
    const b = boosted.update('flight', flight, end, false, { boostMs: end * 1.5 }).arc!;
    expect(b.p).toBeCloseTo(flightProgress(end * 2.5, D), 9);
    expect(b.p).toBeGreaterThan(a.p);
  });
});

describe('prologue rotor test', () => {
  it('spins up, stalls short of flight speed, then winds down after the fault', () => {
    expect(rotorTest('ready', 500).rotor).toBe(0);
    expect(rotorTest('spinning', 0).rotor).toBe(0);
    expect(rotorTest('spinning', SPINUP_MS / 2).rotor).toBeGreaterThan(0.2);
    const stalled = rotorTest('spinning', SPINUP_MS * 3).rotor;
    expect(stalled).toBeGreaterThan(STALL_SPEED - 0.05);
    expect(stalled).toBeLessThan(STALL_SPEED + 0.05);
    expect(rotorTest('fault', 0).judder).toBe(1);
    expect(rotorTest('fault', 0).rotor).toBeCloseTo(STALL_SPEED, 9);
    expect(rotorTest('fault', FAULT_SPINDOWN_MS).rotor).toBe(0);
    expect(rotorTest('fault', FAULT_SPINDOWN_MS).judder).toBe(0);
    expect(rotorTest('imagine', 0).rotor).toBe(0);
  });
  it('drives the shot in the prologue', () => {
    const c = new Choreographer();
    const f: FlightState = { leg: -1, stage: 'prologue', from: 'ingenuity', stageStartedAt: 0, flyMs: 0 };
    const shot = c.update('flight', f, 5000, false, { prologue: { step: 'spinning', at: 5000 - SPINUP_MS * 2 } });
    expect(shot.rotor).toBeGreaterThan(0.45);
    const still = new Choreographer().update('flight', f, 5000, true, { prologue: { step: 'spinning', at: 4000 } });
    expect(still.rotor).toBe(0); // reduced motion
  });
});

describe('the phantom', () => {
  const at = (stage: FlightState['stage'], leg: number, from: FlightState['from'] = 'ingenuity'): FlightState => ({
    leg,
    stage,
    from,
    stageStartedAt: 0,
    flyMs: 4000,
  });
  it('is the real, broken Ingenuity until lift-off', () => {
    expect(phantomLook('title', at('prologue', -1), 0, 0, 0)).toEqual({ phantom: 0, realAtHome: false });
    expect(phantomLook('flight', at('prologue', -1), 3000, 0.5, 0)).toEqual({ phantom: 0, realAtHome: false });
  });
  it('rises out of the real one, which stays at home', () => {
    expect(phantomLook('flight', at('flying', 0), 0, 0, 0).phantom).toBe(0);
    const mid = phantomLook('flight', at('flying', 0), PHANTOM_RISE_MS / 2, 1, 1);
    expect(mid.phantom).toBeGreaterThan(0.2);
    expect(mid.realAtHome).toBe(true);
    expect(phantomLook('flight', at('flying', 0), PHANTOM_RISE_MS, 1, 2).phantom).toBe(1);
    expect(phantomLook('flight', at('site', 3, 'pathfinder-sojourner'), 0, 0, 0).phantom).toBe(1);
    expect(phantomLook('flight', at('flying', 4, 'spirit'), 0, 1, 0).phantom).toBe(1);
  });
  it('settles onto the real one at home and fades into it as the rotors stop', () => {
    const last = MACHINE_IDS.indexOf('ingenuity');
    expect(phantomLook('flight', at('site', last, 'mars2020-edl'), 500, 1, 1.2).phantom).toBe(1); // still hovering
    expect(phantomLook('flight', at('site', last, 'mars2020-edl'), 3000, 0.5, 0).phantom).toBeGreaterThan(0);
    expect(phantomLook('flight', at('site', last, 'mars2020-edl'), 6000, 0, 0)).toEqual({ phantom: 0, realAtHome: false });
    expect(phantomLook('flight', at('epilogue', MACHINE_IDS.length), 0, 0, 0).phantom).toBe(0);
  });
});

describe('orbiting a site', () => {
  const up: Vec3 = [0, 1, 0];
  const off: Vec3 = [0, Math.sin(0.4), Math.cos(0.4)];
  const elev = (v: Vec3) => (Math.asin(v[1] / len(v)) * 180) / Math.PI;
  it('turns about up and keeps the distance', () => {
    const o = orbitOffset(off, up, Math.PI / 2, 0, 1);
    expect(len(o)).toBeCloseTo(1, 9);
    expect(o[1]).toBeCloseTo(off[1], 9);
    expect(Math.abs(o[0])).toBeCloseTo(Math.cos(0.4), 9); // swung round a quarter turn
  });
  it('clamps the elevation and the zoom', () => {
    expect(elev(orbitOffset(off, up, 0, -2, 1))).toBeCloseTo(ORBIT_MIN_ELEV, 6);
    expect(elev(orbitOffset(off, up, 0, 2, 1))).toBeCloseTo(ORBIT_MAX_ELEV, 6);
    expect(len(orbitOffset(off, up, 0, 0, 5))).toBeCloseTo(1.8, 9);
    expect(len(orbitOffset(off, up, 0, 0, 0.1))).toBeCloseTo(0.6, 9);
  });
  it('is the composed shot when untouched', () => {
    const o = orbitOffset(off, up, 0, 0, 1);
    for (let i = 0; i < 3; i++) expect(o[i]).toBeCloseTo(off[i], 9);
  });
});

describe('navigation camera', () => {
  it('sits just below Ingenuity, looking straight down, travel direction up the frame', () => {
    const n = navcamPose([0, 1.1, 0], [0, 1, 0], [0, 0, -1], 0.002);
    expect(n.position[1]).toBeCloseTo(1.098, 9);
    expect(n.target[1]).toBeLessThan(n.position[1]);
    expect(n.target[0]).toBeCloseTo(0, 9);
    expect(n.up).toEqual([0, 0, -1]);
  });
});
