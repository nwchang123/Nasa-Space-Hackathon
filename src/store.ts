// App state shared by the 3D scene and the console UI.
// The scene READS everything here and WRITES only select() and hover().

import { create } from 'zustand';
import type { ViewId } from './types';
import { MACHINE_BY_ID } from './data/machines';

export type Phase = 'title' | 'timelapse' | 'rollcall' | 'report';
export type CallResult = 'silent' | 'echo';
export type Channel = 'radio' | 'laser';

export interface Ping {
  id: string;
  channel: Channel;
  /** Date.now() when the call was sent. */
  startedAt: number;
  /** How long the console waits for an answer, ms: real time for the Moon, compressed elsewhere. */
  waitMs: number;
  /** Null while the signal is travelling. */
  result: CallResult | null;
}

export interface AppState {
  phase: Phase;
  /** Which world the camera frames. */
  view: ViewId;
  selectedId: string | null;
  hoverId: string | null;
  /** Fractional year during the opening time-lapse; null means "now". */
  timelapseYear: number | null;
  /** Wall-clock time used for live lighting (Date.now()), refreshed every 30 s. */
  nowMs: number;
  /** Roll-call results so far. */
  called: Record<string, CallResult>;
  ping: Ping | null;

  setPhase(phase: Phase): void;
  setView(view: ViewId): void;
  select(id: string | null): void;
  hover(id: string | null): void;
  setTimelapseYear(year: number | null): void;
  tick(nowMs: number): void;
  startPing(ping: Omit<Ping, 'result'>): void;
  resolvePing(result: CallResult): void;
  clearPing(): void;
  reset(): void;
}

export const useApp = create<AppState>(set => ({
  phase: 'title',
  view: 'overview',
  selectedId: null,
  hoverId: null,
  timelapseYear: null,
  nowMs: Date.now(),
  called: {},
  ping: null,

  setPhase: phase => set({ phase }),
  setView: view => set({ view }),
  select: id =>
    set(state => {
      if (state.ping && state.ping.result === null) return {}; // a call is in flight
      if (id === null) return { selectedId: null };
      const m = MACHINE_BY_ID[id];
      return { selectedId: id, view: m ? m.world : state.view, ping: null };
    }),
  hover: id => set({ hoverId: id }),
  setTimelapseYear: timelapseYear => set({ timelapseYear }),
  tick: nowMs => set({ nowMs }),
  startPing: ping => set({ ping: { ...ping, result: null } }),
  resolvePing: result =>
    set(state => {
      if (!state.ping) return {};
      const previous = state.called[state.ping.id];
      // An echo is never downgraded: once a reflector has answered, it stays answered.
      const next: CallResult = previous === 'echo' ? 'echo' : result;
      return { ping: { ...state.ping, result }, called: { ...state.called, [state.ping.id]: next } };
    }),
  clearPing: () => set({ ping: null }),
  reset: () =>
    set({ phase: 'title', view: 'overview', selectedId: null, hoverId: null, timelapseYear: null, called: {}, ping: null }),
}));
