// Each stop's one "signature action": a hands-on moment only that site has, driven by the
// visitor's hand (a slider dragged, a toggle, a control held and released), never a clip that
// plays by itself. The HUD renders the controls from these definitions and stores their values in
// the store (`sig`, by def.key); the scene effects in src/scene/signatures/ read them every frame.
// Every caption and readout that states a fact matches docs/FACT_CHECK.md ("Signature actions").

import { decodeReadout, scoopReadout, stormReadout, wakeReadout } from '../scene/signatures/logic';
import type { MachineId } from '../types';

/**
 * 'slider': sig[key] is the value (the scene follows it live). 'toggle': 0/1. 'hold': press and
 * hold to charge, release to fire — while held sig[`${key}:hold`] = 1 and sig[key] rises 0→1 over
 * chargeMs; on release sig[`${key}:hold`] = 0, sig[`${key}:fire`] = Date.now() and sig[key] keeps
 * the charge; the effect then runs for about durationMs. 'button' (kept for compatibility, unused):
 * sig[key] = Date.now() of the press.
 */
export type SignatureKind = 'button' | 'toggle' | 'slider' | 'hold';

export interface SignatureDef {
  /** Unique within its site; the store key (store.sig[key]). */
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
  /** Buttons and holds: how long the effect runs, ms (the HUD shows it as running meanwhile). */
  durationMs?: number;
  /** Holds: how long to hold for a full charge, ms. */
  chargeMs?: number;
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
      label: 'Scan the first photo, strip by strip (1976)',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      caption:
        'Minutes after landing on 20 July 1976, Viking 1 took the first photograph ever made on the surface of Mars: rocks, sand and, at right, one of its own footpads. Re-created here from this scene.',
    },
  ],
  'viking-2': [
    {
      key: 'frost',
      icon: '❄',
      label: 'Utopia winter frost',
      kind: 'toggle',
      caption:
        'On 18 May 1979 Viking 2 photographed a thin coating of water ice on the rocks and soil around it, one Martian year after frost first formed there.',
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
      caption:
        'Late on sol 2 (the night of 5 July 1997) Sojourner rolled down the lander’s rear ramp, tilted 20°. On sol 3 it began its first rock analysis, on a nearby rock named Barnacle Bill.',
    },
  ],
  spirit: [
    {
      key: 'drag',
      icon: '◎',
      label: 'Drive backwards, dragging the jammed wheel',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      caption:
        'Spirit’s right-front wheel stopped turning in 2006, so it drove backwards, dragging it. In 2007 the dragged wheel scraped up nearly pure silica: a sign of ancient hot springs or steam vents.',
    },
  ],
  opportunity: [
    {
      key: 'storm',
      icon: '≋',
      label: '2018 global dust storm (tau 1 → 11)',
      kind: 'slider',
      min: 1,
      max: 11,
      step: 0.1,
      initial: 1,
      caption:
        'Tau measures how much the dust blocks the Sun. Over Opportunity it reached an estimated 10.8 on the morning of 10 June 2018, the day of its last signal.',
      readout: v => stormReadout(v),
    },
  ],
  phoenix: [
    {
      key: 'scoop',
      icon: '⌄',
      label: 'Dig the trench, then let four sols pass',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      readout: v => scoopReadout(v),
      caption:
        'A trench Phoenix dug showed whitish clumps that vanished over four sols: water ice turning to vapour. Its laser saw snow fall from clouds about 4 km up and vaporise before reaching the ground.',
    },
  ],
  insight: [
    {
      key: 'quake',
      icon: '〰',
      label: 'Hold to charge a marsquake, release to pulse it',
      kind: 'hold',
      chargeMs: 2400,
      durationMs: 5000,
      caption: 'InSight’s arm set its seismometer on the ground. It recorded 1,319 marsquakes before the mission ended in December 2022.',
    },
    {
      key: 'larri',
      icon: '◇',
      label: 'Inspect the LaRRI laser reflector',
      kind: 'toggle',
      caption: 'A small reflector on the deck, waiting for a laser. When NASA described it in 2020, no laser for this kind of Mars research was in the works.',
    },
  ],
  'mars2020-edl': [
    {
      key: 'decode',
      icon: '◐',
      label: 'Decode the parachute, ring by ring',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      readout: v => decodeReadout(v),
      caption:
        'The orange and white gores spell DARE MIGHTY THINGS in binary, one word per ring, and the outer band gives the coordinates of JPL: 34°11′58″N 118°10′31″W.',
    },
  ],
  ingenuity: [
    {
      key: 'wake',
      icon: '☀',
      label: 'Run the daily wake-up routine, step by step',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      readout: v => wakeReadout(v),
      caption:
        'Its last software update tells it to wake every day, test its solar panel and batteries, take a colour photo and log temperatures. Whether it still does today is not known.',
    },
  ],
};

/** Store key for a site's action, e.g. 'spirit:drag' (unused: the store clears `sig` per stage, so def.key suffices). */
export const sigKey = (id: MachineId, key: string) => `${id}:${key}`;
