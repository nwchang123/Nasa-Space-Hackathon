// App state shared by the 3D scene and the console UI.
// The scene READS everything here and WRITES only hover().

import { create } from 'zustand';
import { MACHINE_IDS, type MachineId } from './types';

export type Phase = 'title' | 'flight' | 'report';

/**
 * Where we are on Flight 73:
 * - 'prologue': at home (Valinor Hills), before take-off. leg = -1.
 * - 'flying':   in the air toward MACHINE_IDS[leg] (from the previous stop, or home for leg 0).
 * - 'site':     landed at MACHINE_IDS[leg]; the machine tells its story.
 * - 'epilogue': home again after the last leg. leg = MACHINE_IDS.length.
 */
export type Stage = 'prologue' | 'flying' | 'site' | 'epilogue';

export interface FlightState {
  leg: number;
  stage: Stage;
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

export interface AppState {
  phase: Phase;
  flight: FlightState;
  hoverId: MachineId | null;
  /** Wall-clock time used for live lighting (Date.now()), refreshed every 30 s. */
  nowMs: number;
  /** Stops landed at so far. */
  visited: Partial<Record<MachineId, true>>;
  /** Stops whose radio call went unanswered. */
  called: Partial<Record<MachineId, true>>;
  ping: Ping | null;

  setPhase(phase: Phase): void;
  startFlight(): void;
  flyTo(leg: number, flyMs: number): void;
  arrive(): void;
  toEpilogue(): void;
  hover(id: MachineId | null): void;
  tick(nowMs: number): void;
  startPing(ping: Omit<Ping, 'result'>): void;
  resolvePing(): void;
  reset(): void;
}

const IDLE: FlightState = { leg: -1, stage: 'prologue', stageStartedAt: 0, flyMs: 0 };

/** The stop the flight is heading to or standing at, if any. */
export function currentStop(f: FlightState): MachineId | null {
  return f.leg >= 0 && f.leg < MACHINE_IDS.length ? MACHINE_IDS[f.leg] : null;
}

export const useApp = create<AppState>(set => ({
  phase: 'title',
  flight: IDLE,
  hoverId: null,
  nowMs: Date.now(),
  visited: {},
  called: {},
  ping: null,

  setPhase: phase => set({ phase }),
  startFlight: () =>
    set({ phase: 'flight', flight: { leg: -1, stage: 'prologue', stageStartedAt: Date.now(), flyMs: 0 }, visited: {}, called: {}, ping: null }),
  flyTo: (leg, flyMs) => set({ flight: { leg, stage: 'flying', stageStartedAt: Date.now(), flyMs }, ping: null }),
  arrive: () =>
    set(state => {
      const id = currentStop(state.flight);
      return {
        flight: { ...state.flight, stage: 'site', stageStartedAt: Date.now() },
        visited: id ? { ...state.visited, [id]: true } : state.visited,
      };
    }),
  toEpilogue: () => set({ flight: { leg: MACHINE_IDS.length, stage: 'epilogue', stageStartedAt: Date.now(), flyMs: 0 }, ping: null }),
  hover: id => set({ hoverId: id }),
  tick: nowMs => set({ nowMs }),
  startPing: ping => set({ ping: { ...ping, result: null } }),
  resolvePing: () =>
    set(state => (state.ping ? { ping: { ...state.ping, result: 'silent' }, called: { ...state.called, [state.ping.id]: true } } : {})),
  reset: () => set({ phase: 'title', flight: IDLE, hoverId: null, visited: {}, called: {}, ping: null }),
}));
