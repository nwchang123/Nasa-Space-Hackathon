// Each stop's one "signature action": a hands-on moment only that site has. The HUD renders the
// controls from these definitions and stores their values in the store (`sig`, by key); the scene
// effects in src/scene/signatures/ read them. Every caption and readout that states a fact must
// match docs/FACT_CHECK.md ("Signature actions").

import type { MachineId } from '../types';

export type SignatureKind = 'button' | 'toggle' | 'slider';

export interface SignatureDef {
  /** Unique within its site; the store key. */
  key: string;
  /** Small glyph shown before the label. */
  icon: string;
  /** Control label, English. */
  label: string;
  kind: SignatureKind;
  /** Slider range and start value. */
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
  /** Buttons: how long the effect runs, ms (the HUD shows it as running meanwhile). */
  durationMs?: number;
  /** One line shown under the control once it has been used. */
  caption?: string;
  /** A live readout under the control (value is undefined until first used; now = Date.now()). */
  readout?: (value: number | undefined, now: number) => string | null;
}

export const SIGNATURES: Partial<Record<MachineId, SignatureDef[]>> = {
  'viking-1': [
    {
      key: 'scan',
      icon: '◫',
      label: 'Scan the first photo from the surface (1976)',
      kind: 'button',
      durationMs: 9000,
      caption: 'Viking 1’s first picture from the ground: one of its own footpads, scanned a line at a time.',
    },
  ],
  'viking-2': [
    {
      key: 'frost',
      icon: '❄',
      label: 'Utopia winter frost',
      kind: 'toggle',
      caption: 'Viking 2 photographed a thin layer of water frost on the ground around it.',
    },
  ],
  'pathfinder-sojourner': [
    {
      key: 'roll',
      icon: '◎',
      label: 'Roll Sojourner down the ramp',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.01,
      initial: 0,
    },
  ],
  spirit: [
    {
      key: 'drag',
      icon: '◎',
      label: 'Drag the jammed right-front wheel',
      kind: 'button',
      durationMs: 6000,
      caption: 'Pure silica · hot-spring evidence (2007)',
    },
  ],
  opportunity: [
    {
      key: 'storm',
      icon: '≋',
      label: '2018 global dust storm',
      kind: 'slider',
      min: 1,
      max: 11,
      step: 0.1,
      initial: 1,
      readout: v => `Tau ${(v ?? 1).toFixed(1)}`,
    },
  ],
  phoenix: [
    {
      key: 'scoop',
      icon: '⌄',
      label: 'Scoop arctic soil for water ice',
      kind: 'button',
      durationMs: 8000,
    },
  ],
  insight: [
    {
      key: 'quake',
      icon: '〰',
      label: 'Pulse a marsquake',
      kind: 'button',
      durationMs: 5000,
    },
    {
      key: 'larri',
      icon: '◇',
      label: 'Inspect the LaRRI laser reflector',
      kind: 'toggle',
    },
  ],
  'mars2020-edl': [
    {
      key: 'decode',
      icon: '◐',
      label: 'Decode the parachute',
      kind: 'button',
      durationMs: 10000,
    },
  ],
  ingenuity: [
    {
      key: 'wake',
      icon: '☀',
      label: 'Run the daily wake-up routine',
      kind: 'button',
      durationMs: 9000,
    },
  ],
};

/** Store key for a site's action, e.g. 'spirit:drag'. */
export const sigKey = (id: MachineId, key: string) => `${id}:${key}`;
