// Ingenuity's voice for Flight 73. Ingenuity narrates in the first person.
// The flight is imagined; every fact inside it is real and listed, with its source, in
// docs/FACT_CHECK.md ("Flight 73 script"). Geometric lines ("the longest leg", "close to the
// south pole") are checked against src/flight/route.ts by tests/flight.test.ts.
//
// House rules: English, sentences of at most 18 words, lines of at most 30 words, no quotes put
// in anyone's mouth, and no distances or headings (the console already shows those).

import type { MachineId } from '../types';

/** Shown on the title screen and in the footer for the whole flight. */
export const FICTION_NOTE = 'Flight 73 never happened. Every machine, place and date on the way is real.';

/** Opening, at Valinor Hills with the broken blades. 3–5 short lines. */
export const PROLOGUE: string[] = [
  '18 January 2024. Flight 72 was meant to be a short hop to check my systems.',
  'The sand below was probably too smooth for my navigation camera to follow.',
  'I came down hard, and my rotor blades broke.',
  'My team said goodbye on 16 April 2024. I cannot fly again.',
  'So let me imagine one more flight. Flight 73.',
];

export interface LegScript {
  /** 1–3 short lines Ingenuity says while flying to this stop. */
  enRoute: string[];
  /** One line, said at the stop after the machine's story: what this machine passed on to those who came after, ending with Ingenuity. */
  inheritance: string;
}

export const LEG_SCRIPTS: Record<MachineId, LegScript> = {
  'viking-1': {
    enRoute: [
      'First stop is the oldest. Viking 1 landed in 1976, almost 45 years before I did.',
      'Time to meet my elders, one by one, in the order they landed.',
    ],
    inheritance: 'Everyone on this flight landed after you. You showed it could be done.',
  },
  'viking-2': {
    enRoute: [
      'The shortest way to Viking 2 runs almost over the north pole.',
      'From 1976 to 1980, the two Viking landers worked on Mars at the same time.',
    ],
    inheritance: 'You were moved north, toward the polar ice. Almost 32 years later, Phoenix went farther north and dug some up.',
  },
  'pathfinder-sojourner': {
    enRoute: [
      'NASA did not land on Mars again for almost 21 years after the Vikings.',
      'Then Pathfinder came, carrying the first rover ever to drive on Mars.',
    ],
    inheritance: 'Sojourner rolled first. Every NASA rover since has followed her, including the one that carried me here.',
  },
  spirit: {
    enRoute: [
      'We cross the equator. Spirit is our first stop in the southern hemisphere.',
      'It landed in January 2004. Its twin, Opportunity, followed three weeks later.',
    ],
    inheritance: 'Stuck in soft soil, you kept working as a science station that could not move. Now I do the same.',
  },
  opportunity: {
    enRoute: [
      'The longest leg of all. The twins landed on opposite sides of Mars.',
      'The shortest path between them passes close to the south pole.',
    ],
    inheritance: 'You showed that water once lasted here. Perseverance went to Jezero, once a lake, and found possible signs of ancient life.',
  },
  phoenix: {
    enRoute: [
      'North again, to the Martian arctic. NASA’s plan back then was to “follow the water.”',
      'Phoenix reused a spacecraft built for a cancelled 2001 mission.',
      'It also carries a DVD for future visitors, called “the first library on Mars.”',
    ],
    inheritance: 'You found ice hiding just under the soil. The helicopters coming after me are meant to look for more.',
  },
  insight: {
    enRoute: [
      'InSight landed in November 2018, just over two years before I did.',
      'It never drove anywhere. It sat still and listened to Mars shake.',
    ],
    inheritance: 'You looked inside Mars, all the way down to its core. I only ever saw the surface, from 24 metres up.',
  },
  'mars2020-edl': {
    enRoute: [
      'Back to Jezero crater. One stop before home, and I have been there before.',
      'In April 2022, on Flight 26, I flew out to photograph it.',
    ],
    inheritance: 'You brought Perseverance and me down safely. My photos of you may help future landers come down safer.',
  },
  ingenuity: {
    enRoute: [
      'The last hop is the shortest of all.',
      'Perseverance once photographed a piece of my blade, 15 metres west of where I rest.',
    ],
    inheritance: 'NASA’s SkyFall mission will build on what I proved. Three new helicopters will scout landing sites for astronauts and map buried ice.',
  },
};

/** Closing, back home at Valinor Hills. 3–5 short lines. */
export const EPILOGUE: string[] = [
  'Home again, on my sand ripple at Valinor Hills.',
  'My last software update tells me to wake up every day.',
  'I test my solar panel and batteries, take a photo, and log temperatures.',
  'My memory could hold about 20 years of those days, for whoever visits next.',
  'Someday SkyFall’s helicopters will fly in this sky. I will be right here. Still here.',
];
