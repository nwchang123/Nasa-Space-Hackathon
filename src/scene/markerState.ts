// Pure marker styling rules, shared by globe and deep-space markers (unit-tested).

import type { CallResult, Phase } from '../store';

export const PALETTE = {
  amber: '#f2a93b',
  ghost: '#8fb3c9',
  bone: '#e9e4d8',
  signal: '#7dff9a',
  dim: '#2a3440',
} as const;

export type RingStyle = 'none' | 'pulse' | 'check' | 'echo';

export interface MarkerInput {
  phase: Phase;
  /** Fractional year during the time-lapse, else null. */
  timelapseYear: number | null;
  arrivedYear: number;
  lastContactYear: number;
  selected: boolean;
  hovered: boolean;
  called?: CallResult;
  /** Seconds, for breathing / pulsing. */
  t: number;
  reduced: boolean;
}

export interface MarkerVisual {
  visible: boolean;
  /** Hex colour of core, halo and ring. */
  color: string;
  /** Brightness 0..~2.5 (values above 1 = flare). */
  intensity: number;
  /** Multiplier on the halo size. */
  haloScale: number;
  ring: RingStyle;
  /** Pointer interaction allowed. */
  interactive: boolean;
}

/** Years over which the arrival flare decays during the time-lapse. */
export const FLARE_YEARS = 0.9;
/** Years over which a machine fades from amber to ghost after its last signal. */
export const FADE_YEARS = 1.6;

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = Math.min(1, Math.max(0, t));
  const ch = (shift: number) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * k);
  };
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

export function markerVisual(input: MarkerInput): MarkerVisual {
  const { timelapseYear: y, arrivedYear, lastContactYear, phase } = input;

  if (y !== null) {
    if (y < arrivedYear) return { visible: false, color: PALETTE.amber, intensity: 0, haloScale: 1, ring: 'none', interactive: false };
    const sinceArrival = y - arrivedYear;
    if (y < lastContactYear) {
      const flare = sinceArrival < FLARE_YEARS ? 1 - sinceArrival / FLARE_YEARS : 0;
      return {
        visible: true,
        color: PALETTE.amber,
        intensity: 0.95 + 1.5 * flare,
        haloScale: 1 + 1.6 * flare,
        ring: 'none',
        interactive: false,
      };
    }
    // Fell silent: a short arrival flare may still be decaying (Surveyor 3 lasted two weeks).
    const flare = sinceArrival < FLARE_YEARS ? 1 - sinceArrival / FLARE_YEARS : 0;
    const fade = Math.min(1, (y - lastContactYear) / FADE_YEARS);
    return {
      visible: true,
      color: mixHex(PALETTE.amber, PALETTE.ghost, fade),
      intensity: Math.max(0.95 - 0.6 * fade, 0.35) + 1.2 * flare,
      haloScale: 1 + 1.2 * flare,
      ring: 'none',
      interactive: false,
    };
  }

  const interactive = phase === 'rollcall' || phase === 'report';
  const breathe = input.reduced ? 0 : 0.12 * Math.sin(input.t * 0.8);

  if (input.called === 'echo') {
    return { visible: true, color: PALETTE.signal, intensity: 1.05, haloScale: 1.25, ring: input.selected ? 'pulse' : 'echo', interactive };
  }
  if (input.selected) {
    return { visible: true, color: PALETTE.amber, intensity: 1.15, haloScale: 1.35, ring: 'pulse', interactive };
  }
  if (input.hovered && interactive) {
    return { visible: true, color: input.called === 'silent' ? PALETTE.bone : PALETTE.ghost, intensity: 1.1, haloScale: 1.3, ring: input.called === 'silent' ? 'check' : 'none', interactive };
  }
  if (input.called === 'silent') {
    return { visible: true, color: PALETTE.bone, intensity: 0.5, haloScale: 0.9, ring: 'check', interactive };
  }
  return { visible: true, color: PALETTE.ghost, intensity: 0.58 + breathe, haloScale: 1, ring: 'none', interactive };
}
