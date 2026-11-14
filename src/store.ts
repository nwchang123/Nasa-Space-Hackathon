// App state shared by the 3D scene and the HUD.
// The scene READS everything here and WRITES only hover(), setStory() (3D hotspots),
// requestCall() (the antenna hotspot) and addBoost() (the Director, while boost is held).

import { create } from 'zustand';
import { HOME, LEGS, hop } from './flight/route';
import { MACHINE_IDS, type MachineId } from './types';

export type Phase = 'title' | 'flight' | 'report';

/**
 * Where we are on Flight 73:
 * - 'prologue': at home (Valinor Hills), before take-off. leg = -1.
 * - 'flying':   in the air from `from` toward MACHINE_IDS[leg]. On the planned route `from` is the
 *               previous stop (home for leg 0); a stop picked from the route strip is a direct hop
 *               from wherever we were standing.
 * - 'site':     landed at MACHINE_IDS[leg]; the machine tells its story.
 * - 'epilogue': home again after the last leg. leg = MACHINE_IDS.length.
 */
export type Stage = 'prologue' | 'flying' | 'site' | 'epilogue';

export interface FlightState {
  leg: number;
  stage: Stage;
  /** Where the current (or last) flight took off from. */
  from: MachineId;
  /** Date.now() when this stage began; the scene times its animations from here. */
  stageStartedAt: number;
  /** Length of the flying animation for this leg, ms (0 = jump straight there). */
  flyMs: number;
}

export interface Ping {
  id: MachineId;
  /** Date.now() when the radio call was sent. */
  startedAt: number;
  /** How long the console waits, ms (the real round trip, compressed). */
  waitMs: number;
  /** Null while the signal is travelling. Nobody on Mars answers. */
  result: 'silent' | null;
}

/** Story sections at a site, in order: 01 Why I came · 02 What I found · 03 My last day · 04 Still here. */
export type StorySection = 0 | 1 | 2 | 3;
export const STORY_KEYS = ['why', 'found', 'lastDay', 'stillHere'] as const;

/**
 * The prologue at home, as the visitor plays it:
 * 'ready' (spin-up button) → 'spinning' (rotor speeds up) → 'fault' (stalls, alarm, spins down)
 * → 'imagine' (the line that turns to fiction, and the lift-off button).
 */
export type PrologueStep = 'ready' | 'spinning' | 'fault' | 'imagine';

/** Flight camera: third-person chase, or Ingenuity's black-and-white downward navigation camera. */
export type CamMode = 'chase' | 'navcam';

/** Speed while boost is held (× real flight time). */
export const BOOST_FACTOR = 2.5;

export interface AppState {
  phase: Phase;
  flight: FlightState;
  hoverId: MachineId | null;
  /** Wall-clock time used for live lighting (Date.now()), refreshed every 30 s. */
  nowMs: number;
  /** Distance actually flown so far on this Flight 73, km (planned legs and direct hops). */
  flownKm: number;
  /** Stops landed at so far. */
  visited: Partial<Record<MachineId, true>>;
  /** Stops whose radio call went unanswered. */
  called: Partial<Record<MachineId, true>>;
  ping: Ping | null;
  /** Story section shown at a site. Reset to 0 on every arrival. */
  story: StorySection;
  /** Local solar hour (0–24) picked on the site card's sun scrubber, or null for the real "now". */
  siteHour: number | null;
  /**
   * The current site's signature actions (see src/data/signatures.ts), by key: a toggle is 0/1, a
   * slider its value, a button the Date.now() it was pressed. Cleared on every arrival and take-off.
   */
  sig: Record<string, number>;
  prologue: { step: PrologueStep; at: number };
  camMode: CamMode;
  /** Boost held (Space or the boost button) while flying. */
  boost: boolean;
  /** Extra flight time banked by boost in this stage, ms. See stageElapsed(). */
  boostMs: number;
  /** Date.now() of the latest "Call from Earth" request from a 3D hotspot (the HUD starts the call). */
  callRequest: number;

  setPhase(phase: Phase): void;
  startFlight(): void;
  /** Fly to MACHINE_IDS[leg]; `from` defaults to the planned leg's start. */
  flyTo(leg: number, flyMs: number, from?: MachineId): void;
  arrive(): void;
  toEpilogue(): void;
  hover(id: MachineId | null): void;
  tick(nowMs: number): void;
  startPing(ping: Omit<Ping, 'result'>): void;
  resolvePing(): void;
  reset(): void;
  setStory(i: StorySection): void;
  setSiteHour(h: number | null): void;
  setSig(key: string, value: number): void;
  setPrologue(step: PrologueStep): void;
  setCamMode(m: CamMode): void;
  setBoost(on: boolean): void;
  /** Bank extra flight time (called every frame by the Director while boost is held and flying). */
  addBoost(ms: number): void;
  requestCall(): void;
}

/**
 * Time into the current stage, ms, including time banked by boost. Everything that times a
 * stage (the HUD odometer and arrival, the choreographer, the camera) must use this, not
 * Date.now() - stageStartedAt, so boost speeds them all up together.
 */
export function stageElapsed(s: Pick<AppState, 'flight' | 'boostMs'>, now = Date.now()): number {
  return now - s.flight.stageStartedAt + s.boostMs;
}

const IDLE: FlightState = { leg: -1, stage: 'prologue', from: HOME, stageStartedAt: 0, flyMs: 0 };

/** Per-stage state, cleared whenever the stage changes (take-off, arrival, home). */
const FRESH_STAGE = { story: 0 as StorySection, siteHour: null, sig: {}, boost: false, boostMs: 0 };

/** Where we are standing (home before take-off and after landing back), or null while flying. */
export function standingAt(f: FlightState): MachineId | null {
  if (f.stage === 'flying') return null;
  if (f.stage === 'site') return MACHINE_IDS[f.leg];
  return HOME;
}

/** The stop the flight is heading to or standing at, if any. */
export function currentStop(f: FlightState): MachineId | null {
  return f.leg >= 0 && f.leg < MACHINE_IDS.length ? MACHINE_IDS[f.leg] : null;
}

export const useApp = create<AppState>(set => ({
  phase: 'title',
  flight: IDLE,
  hoverId: null,
  nowMs: Date.now(),
  flownKm: 0,
  visited: {},
  called: {},
  ping: null,
  ...FRESH_STAGE,
  prologue: { step: 'ready', at: 0 },
  camMode: 'chase',
  callRequest: 0,

  setPhase: phase => set({ phase }),
  startFlight: () =>
    set({
      phase: 'flight',
      flight: { ...IDLE, stageStartedAt: Date.now() },
      flownKm: 0,
      visited: {},
      called: {},
      ping: null,
      ...FRESH_STAGE,
      prologue: { step: 'ready', at: Date.now() },
      camMode: 'chase',
    }),
  flyTo: (leg, flyMs, from = LEGS[leg].from) =>
    set({ flight: { leg, stage: 'flying', from, stageStartedAt: Date.now(), flyMs }, ping: null, ...FRESH_STAGE }),
  arrive: () =>
    set(state => {
      const id = currentStop(state.flight);
      return {
        ...FRESH_STAGE,
        flight: { ...state.flight, stage: 'site', stageStartedAt: Date.now() },
        flownKm: state.flight.stage === 'flying' ? state.flownKm + hop(state.flight.from, state.flight.leg).distanceKm : state.flownKm,
        visited: id ? { ...state.visited, [id]: true } : state.visited,
      };
    }),
  toEpilogue: () =>
    set(state => ({
      flight: { leg: MACHINE_IDS.length, stage: 'epilogue', from: state.flight.from, stageStartedAt: Date.now(), flyMs: 0 },
      ping: null,
      ...FRESH_STAGE,
    })),
  hover: id => set({ hoverId: id }),
  tick: nowMs => set({ nowMs }),
  startPing: ping => set({ ping: { ...ping, result: null } }),
  resolvePing: () =>
    set(state => (state.ping ? { ping: { ...state.ping, result: 'silent' }, called: { ...state.called, [state.ping.id]: true } } : {})),
  reset: () =>
    set({ phase: 'title', flight: IDLE, hoverId: null, flownKm: 0, visited: {}, called: {}, ping: null, ...FRESH_STAGE, camMode: 'chase' }),
  setStory: story => set({ story }),
  setSiteHour: siteHour => set({ siteHour }),
  setSig: (key, value) => set(state => ({ sig: { ...state.sig, [key]: value } })),
  setPrologue: step => set({ prologue: { step, at: Date.now() } }),
  setCamMode: camMode => set({ camMode }),
  setBoost: boost => set({ boost }),
  addBoost: ms => set(state => ({ boostMs: state.boostMs + ms })),
  requestCall: () => set({ callRequest: Date.now() }),
}));
