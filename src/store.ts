// App state shared by the 3D scene and the HUD.
// The scene READS everything here and WRITES only hover(), setStory() (3D hotspots),
// requestCall() (the antenna hotspot), addBoost() (the Director, while boost is held), setFocus()
// (hotspots, signature actions and the free flight at a site) and addSnapshot() (the scout camera).
// The AR hangar (src/hangar) keeps its own store; here it is only a phase to open and close.

import { create } from 'zustand';
import { HOME, LEGS, hop } from './flight/route';
import { MACHINE_IDS, type MachineId } from './types';

/** 'hangar': the AR hangar, opened over any other phase, which it leaves exactly as it was. */
export type Phase = 'title' | 'flight' | 'report' | 'hangar';

/** The address fragment that opens the AR hangar directly (its QR code points there). */
export const HANGAR_HASH = '#hangar';

/** A visitor who opens the hangar's link lands in it, without the globe loading behind. */
function initialPhase(): Phase {
  return typeof window !== 'undefined' && window.location.hash === HANGAR_HASH ? 'hangar' : 'title';
}

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

/**
 * What the site camera is looking at close up: a story hotspot (id '0'..'3', or 'call' for the
 * antenna) or a signature action (id = its def.key). `strength` 1 is the full close-up; less is a
 * gentle push in (used when Ingenuity flies near a hotspot, so the visitor keeps control).
 */
export interface Focus {
  kind: 'hotspot' | 'signature';
  id: string;
  strength: number;
  /** Date.now() when it was set. */
  at: number;
}

/** A scout camera photo taken at a site. */
export interface Snapshot {
  /** Date.now() when it was taken (also its key). */
  at: number;
  /** A small JPEG data URL (about 160 px wide). */
  url: string;
  /** The story section of the hotspot it framed, or null if nothing was in the frame. */
  section: StorySection | null;
}

/** A scout camera photo kept for the flight log, with the stop it was taken at. */
export interface AlbumShot extends Snapshot {
  stop: MachineId;
}

/** Photos kept in the flight log's album for one Flight 73 (oldest dropped first). */
export const ALBUM_MAX = 24;

export interface AppState {
  phase: Phase;
  /** The phase the hangar returns to. */
  hangarFrom: Exclude<Phase, 'hangar'>;
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
  /** The site camera's close-up subject, or null for the wide view. Cleared on every stage change. */
  focus: Focus | null;
  /** Date.now() of the latest "Reset wide view" (the scene drops the orbit, focus and follow). */
  viewResetAt: number;
  /** The scout camera's viewfinder is up (key C at a site). */
  scoutCam: boolean;
  /** Date.now() of the latest "Capture" press (the scene grabs the frame). */
  snapshotRequest: number;
  /** Photos taken at this site, oldest first. Cleared on every stage change. */
  snapshots: Snapshot[];
  /** Every photo of this Flight 73, for the flight log. Kept across stops; cleared on a new flight. */
  album: AlbumShot[];

  setPhase(phase: Phase): void;
  /** Open the AR hangar over the current phase (the flight's state is left untouched). */
  openHangar(): void;
  /** Back to where the hangar was opened from. */
  closeHangar(): void;
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
  setFocus(f: Omit<Focus, 'at'> | null): void;
  /** Back to the site's wide view: no focus, no orbit, the camera stops following Ingenuity. */
  resetView(): void;
  setScoutCam(on: boolean): void;
  requestSnapshot(): void;
  addSnapshot(s: Snapshot): void;
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
const FRESH_STAGE = {
  story: 0 as StorySection,
  siteHour: null,
  sig: {},
  boost: false,
  boostMs: 0,
  focus: null,
  scoutCam: false,
  snapshots: [] as Snapshot[],
};

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
  phase: initialPhase(),
  hangarFrom: 'title',
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
  viewResetAt: 0,
  snapshotRequest: 0,
  album: [],

  setPhase: phase => set({ phase }),
  openHangar: () => set(s => (s.phase === 'hangar' ? {} : { phase: 'hangar', hangarFrom: s.phase })),
  closeHangar: () => set(s => (s.phase === 'hangar' ? { phase: s.hangarFrom } : {})),
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
      album: [],
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
    set({ phase: 'title', flight: IDLE, hoverId: null, flownKm: 0, visited: {}, called: {}, ping: null, ...FRESH_STAGE, camMode: 'chase', album: [] }),
  setStory: story => set({ story }),
  setSiteHour: siteHour => set({ siteHour }),
  setSig: (key, value) => set(state => ({ sig: { ...state.sig, [key]: value } })),
  setPrologue: step => set({ prologue: { step, at: Date.now() } }),
  setCamMode: camMode => set({ camMode }),
  setBoost: boost => set({ boost }),
  addBoost: ms => set(state => ({ boostMs: state.boostMs + ms })),
  requestCall: () => set({ callRequest: Date.now() }),
  setFocus: f => set({ focus: f ? { ...f, at: Date.now() } : null }),
  resetView: () => set({ focus: null, viewResetAt: Date.now() }),
  setScoutCam: scoutCam => set({ scoutCam }),
  requestSnapshot: () => set({ snapshotRequest: Date.now() }),
  addSnapshot: s =>
    set(state => {
      const stop = currentStop(state.flight) ?? HOME;
      return { snapshots: [...state.snapshots, s].slice(-6), album: [...state.album, { ...s, stop }].slice(-ALBUM_MAX) };
    }),
}));
