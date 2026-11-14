// The hangar's own state, apart from Flight 73's store: what is shown, at what scale, in which
// light, the arrangement the scene built from it, and where a WebXR session stands.

import { create } from 'zustand';
import type { MachineId } from '../types';
import type { Arrangement } from './build';
import { HANGAR_PICKS, type HangarPick, type HangarScale } from './layout';

export type HangarLight = 'day' | 'night';

/** 'off' (sandbox) → 'starting' → 'scanning' (looking for the table) → 'placed'. */
export type XrState = 'off' | 'starting' | 'scanning' | 'placed';

export interface HangarState {
  pick: HangarPick;
  /** The last single machine shown, for leaving the row. */
  lastSingle: MachineId;
  scale: HangarScale;
  light: HangarLight;
  /** Built by the scene for the current pick and scale; null while the models load. */
  arrangement: Arrangement | null;
  xr: XrState;
  /** Why the last AR session could not start or ended early, for the visitor. */
  xrNote: string | null;
  /** A USDZ for AR Quick Look is being written (the sandbox draws only when moved meanwhile). */
  exporting: boolean;

  setPick(pick: HangarPick): void;
  /** The next (1) or previous (-1) of the ten choices, wrapping round. */
  step(dir: 1 | -1): void;
  /** The row, or back from it to the last single machine. */
  toggleRow(): void;
  setScale(scale: HangarScale): void;
  setLight(light: HangarLight): void;
  setArrangement(a: Arrangement | null): void;
  setXr(xr: XrState, note?: string | null): void;
  setExporting(on: boolean): void;
  /** Placed → scanning again, to put the models somewhere else. */
  replace(): void;
}

export const useHangar = create<HangarState>(set => ({
  pick: 'ingenuity',
  lastSingle: 'ingenuity',
  scale: 'table',
  light: 'day',
  arrangement: null,
  xr: 'off',
  xrNote: null,
  exporting: false,

  setPick: pick => set(pick === 'row' ? { pick } : { pick, lastSingle: pick }),
  step: dir =>
    set(s => {
      const i = HANGAR_PICKS.indexOf(s.pick);
      const n = HANGAR_PICKS.length;
      const pick = HANGAR_PICKS[(i + dir + n) % n];
      return pick === 'row' ? { pick } : { pick, lastSingle: pick };
    }),
  toggleRow: () => set(s => ({ pick: s.pick === 'row' ? s.lastSingle : 'row' })),
  setScale: scale => set({ scale }),
  setLight: light => set({ light }),
  setArrangement: arrangement => set({ arrangement }),
  setXr: (xr, note) => set(note === undefined ? { xr } : { xr, xrNote: note }),
  setExporting: exporting => set({ exporting }),
  replace: () => set(s => (s.xr === 'placed' ? { xr: 'scanning' } : {})),
}));
