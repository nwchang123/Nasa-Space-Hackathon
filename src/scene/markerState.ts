// Pure marker styling rules for the Flight 73 globe (unit-tested).

import type { FlightState, Phase } from '../store';
import { MACHINE_IDS, type MachineId } from '../types';

export const PALETTE = {
  amber: '#f2a93b',
  ghost: '#8fb3c9',
  bone: '#e9e4d8',
  signal: '#7dff9a',
  dim: '#2a3440',
} as const;

/**
 * Where a stop stands on the flight: still ahead, being flown to (or stood at), or already visited.
 * On the title screen Ingenuity's own spot, where Flight 73 starts, is marked like a destination.
 */
export type MarkerStatus = 'upcoming' | 'destination' | 'visited';

export function markerStatus(id: MachineId, phase: Phase, flight: FlightState, visited: Partial<Record<MachineId, true>>): MarkerStatus {
  if (phase === 'title') return id === 'ingenuity' ? 'destination' : 'upcoming';
  if (phase === 'flight' && (flight.stage === 'flying' || flight.stage === 'site') && MACHINE_IDS.indexOf(id) === flight.leg) {
    return 'destination';
  }
  return visited[id] ? 'visited' : 'upcoming';
}

/**
 * Hover labels work in every phase. On the title screen only the text column takes the pointer
 * (see .title-screen in styles.css), so the globe beside it can be explored.
 */
export function markersInteractive(_phase: Phase): boolean {
  return true;
}

export type RingStyle = 'none' | 'pulse';

export interface MarkerInput {
  status: MarkerStatus;
  hovered: boolean;
  interactive: boolean;
  /** Seconds, for breathing. */
  t: number;
  reduced: boolean;
}

export interface MarkerVisual {
  /** Hex colour of core, halo and ring. */
  color: string;
  /** Brightness 0..~2 (above 1 = flare). */
  intensity: number;
  /** Multiplier on the halo size. */
  haloScale: number;
  ring: RingStyle;
}

export function markerVisual(input: MarkerInput): MarkerVisual {
  const hover = input.hovered && input.interactive;
  let v: MarkerVisual;
  if (input.status === 'destination') {
    v = { color: PALETTE.amber, intensity: 1.2, haloScale: 1.4, ring: 'pulse' };
  } else if (input.status === 'visited') {
    v = { color: PALETTE.bone, intensity: 0.45, haloScale: 0.85, ring: 'none' };
  } else {
    const breathe = input.reduced ? 0 : 0.08 * Math.sin(input.t * 0.8);
    v = { color: PALETTE.ghost, intensity: 0.5 + breathe, haloScale: 1, ring: 'none' };
  }
  if (hover) v = { ...v, intensity: v.intensity + 0.45, haloScale: v.haloScale * 1.25 };
  return v;
}
