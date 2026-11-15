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
  /** Control label, English: the full instruction (aria-label and tooltip). */
  label: string;
  /** The few words shown on the control itself; the full label is its tooltip. */
  short?: string;
  kind: SignatureKind;
  /** Slider range and start value. */
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
  /**
   * Toggles and sliders: the value the stop opens with, as if the visitor had already used the
   * control, so the outcome is on show from the start (visitors rarely try a control on their own);
   * they can still turn it back and run it again. Never written to the store: until the visitor
   * touches the control, sig[key] stays undefined and readers fall back to it (sigOrPreset), so
   * arriving fires no reaction, sound or close-up.
   */
  preset?: number;
  /**
   * The story section (0-3) that tells this action: while it is read, the auto tour runs the action
   * itself, so a visitor who only watches still sees it (src/ui/hud/AutoTour.tsx). A slider is
   * eased to the top of its range as a hand would, a toggle switched on, a hold charged and
   * released. Any touch pauses the tour and leaves the control where it is.
   */
  playsDuring?: number;
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
      short: 'Scan the 1976 photo',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      // 01 "Why I came": the landing on 20 July 1976 (the photo was taken minutes after).
      playsDuring: 0,
      caption:
        'Minutes after landing on 20 July 1976, Viking 1 took the first photograph ever made on the surface of Mars: rocks, sand and, at right, one of its own footpads. Re-created here from this scene.',
    },
  ],
  'viking-2': [
    {
      key: 'frost',
      icon: '❄',
      label: 'Utopia winter frost',
      short: 'Winter frost',
      kind: 'toggle',
      // No section tells the 1979 frost, so it is on from the start.
      preset: 1,
      caption:
        'On 18 May 1979 Viking 2 photographed a thin coating of water ice on the rocks and soil around it, one Martian year after frost first formed there.',
    },
  ],
  'pathfinder-sojourner': [
    {
      key: 'roll',
      icon: '◎',
      label: 'Roll Sojourner down the ramp',
      short: 'Roll down the ramp',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.01,
      initial: 0,
      // 02 "What I found": "rolled down my ramp on the second sol".
      playsDuring: 1,
      caption:
        'Late on sol 2 (the night of 5 July 1997) Sojourner rolled down the lander’s rear ramp, tilted 20°. On sol 3 it began its first rock analysis, on a nearby rock named Barnacle Bill.',
    },
  ],
  spirit: [
    {
      key: 'drag',
      icon: '◎',
      label: 'Drive backwards, dragging the jammed wheel',
      short: 'Drive backwards',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      // Section 02, "What I found", tells of the dragged wheel and the silica.
      playsDuring: 1,
      caption:
        'Spirit’s right-front wheel stopped turning in 2006, so it drove backwards, dragging it. In 2007 the dragged wheel scraped up nearly pure silica: a sign of ancient hot springs or steam vents.',
    },
  ],
  opportunity: [
    {
      key: 'storm',
      icon: '≋',
      label: '2018 global dust storm (tau 1 → 11)',
      short: '2018 dust storm',
      kind: 'slider',
      min: 1,
      max: 11,
      step: 0.1,
      initial: 1,
      // 03 "My last day": the June 2018 storm.
      playsDuring: 2,
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
      short: 'Dig the trench',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      // 02 "What I found": the trench and its ice.
      playsDuring: 1,
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
      short: 'Hold for a marsquake',
      kind: 'hold',
      chargeMs: 2400,
      durationMs: 5000,
      // 02 "What I found": 1,319 marsquakes.
      playsDuring: 1,
      caption: 'InSight’s arm set its seismometer on the ground. It recorded 1,319 marsquakes before the mission ended in December 2022.',
    },
    {
      key: 'larri',
      icon: '◇',
      label: 'Inspect the LaRRI laser reflector',
      short: 'Laser reflector',
      kind: 'toggle',
      // 04 "Still here": "a small laser reflector, in case a future orbiter brings a laser".
      playsDuring: 3,
      caption: 'A small reflector on the deck, waiting for a laser. When NASA described it in 2020, no laser for this kind of Mars research was in the works.',
    },
  ],
  'mars2020-edl': [
    {
      key: 'decode',
      icon: '◐',
      label: 'Decode the parachute, ring by ring',
      short: 'Decode the parachute',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      // 02 "What I found": "Dare Mighty Things" in binary.
      playsDuring: 1,
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
      short: 'Daily wake-up',
      kind: 'slider',
      min: 0,
      max: 1,
      step: 0.005,
      initial: 0,
      // 04 "Still here": a stationary testbed, still sending weather data.
      playsDuring: 3,
      readout: v => wakeReadout(v),
      caption:
        'Its last software update tells it to wake every day, test its solar panel and batteries, take a colour photo and log temperatures. Whether it still does today is not known.',
    },
  ],
};

/** The value each control with a preset opens with, by key (keys are unique across the stops). */
export const SIG_PRESETS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.values(SIGNATURES)
    .flatMap(defs => defs ?? [])
    .filter(d => d.preset !== undefined)
    .map(d => [d.key, d.preset as number]),
);

/** A control's value as shown: the visitor's once they have used it, else the stop's preset (else undefined). */
export function sigOrPreset(key: string, value: number | undefined): number | undefined {
  return value ?? SIG_PRESETS[key];
}

/** Store key for a site's action, e.g. 'spirit:drag' (unused: the store clears `sig` per stage, so def.key suffices). */
export const sigKey = (id: MachineId, key: string) => `${id}:${key}`;
