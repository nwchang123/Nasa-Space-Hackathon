// The prologue's rotor throttle, pushed by the visitor (hold Space or the throttle button) and
// read by the HUD gauge, the choreographer (rotor speed) and the sound (rotor pitch, red-zone
// alarm). Kept out of the main store so its 60 Hz updates only reach what listens to it.

import { create } from 'zustand';

/** Throttle at or above this is the red zone: hold it there and the damaged blades fail. */
export const RED_ZONE = 0.82;

export interface ThrottleState {
  /** 0..1. */
  throttle: number;
  /** The visitor is holding the throttle open right now. */
  holding: boolean;
  setThrottle(v: number): void;
  setHolding(on: boolean): void;
}

export const useThrottle = create<ThrottleState>(set => ({
  throttle: 0,
  holding: false,
  setThrottle: throttle => set({ throttle: Math.min(1, Math.max(0, throttle)) }),
  setHolding: holding => set({ holding }),
}));
