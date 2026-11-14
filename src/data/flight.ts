// Ingenuity's voice for Flight 73. STUB: the content fork writes and fact-checks the real lines.
// Ingenuity narrates in the first person. The flight is imagined; every fact inside it is real
// and listed in docs/FACT_CHECK.md.

import type { MachineId } from '../types';

/** Shown on the title screen and in the footer for the whole flight. */
export const FICTION_NOTE = 'Flight 73 never happened. Every place, date and number on this flight is real.';

/** Opening, at Valinor Hills with the broken blades. 3–5 short lines. */
export const PROLOGUE: string[] = ['Draft prologue.'];

export interface LegScript {
  /** 1–3 short lines Ingenuity says while flying to this stop. */
  enRoute: string[];
  /** One line, said at the stop after the machine's story: what this machine passed on to those who came after, ending with Ingenuity. */
  inheritance: string;
}

export const LEG_SCRIPTS: Record<MachineId, LegScript> = {
  'viking-1': { enRoute: ['Draft.'], inheritance: 'Draft.' },
  'viking-2': { enRoute: ['Draft.'], inheritance: 'Draft.' },
  'pathfinder-sojourner': { enRoute: ['Draft.'], inheritance: 'Draft.' },
  spirit: { enRoute: ['Draft.'], inheritance: 'Draft.' },
  opportunity: { enRoute: ['Draft.'], inheritance: 'Draft.' },
  phoenix: { enRoute: ['Draft.'], inheritance: 'Draft.' },
  insight: { enRoute: ['Draft.'], inheritance: 'Draft.' },
  'mars2020-edl': { enRoute: ['Draft.'], inheritance: 'Draft.' },
  ingenuity: { enRoute: ['Draft.'], inheritance: 'Draft.' },
};

/** Closing, back home at Valinor Hills. 3–5 short lines. */
export const EPILOGUE: string[] = ['Draft epilogue.'];
