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

/**
 * Opening, at Valinor Hills with the broken blades. 3–5 short lines. The first PROLOGUE_TEST_AT
 * lines come before the visitor's rotor test; the rest, the turn to fiction, after it fails.
 */
export const PROLOGUE: string[] = [
  '18 January 2024. Flight 72 was meant to be a short hop to check my systems.',
  'The sand below was probably too smooth for my navigation camera to follow.',
  'I came down hard, and my rotor blades broke. My team said goodbye on 16 April 2024.',
  'I will never fly again.',
  'But let me imagine one last flight. Flight 73.',
];

/** How many PROLOGUE lines are shown before the rotor test. */
export const PROLOGUE_TEST_AT = 3;

/** The fault bar when the rotor test stalls (the damage is real: docs/FACT_CHECK.md, Prologue). */
export const ROTOR_FAULT = 'Rotor imbalance — blades damaged on Flight 72';

export interface LegScript {
  /** 1–3 short lines Ingenuity says while flying to this stop. */
  enRoute: string[];
  /**
   * 2–3 short lines Ingenuity says in its radio bubble just after landing at this stop: where we
   * are, who this elder is and its greatest feat, then an invitation to pick a numbered hotspot.
   */
  arrivalIntro: string[];
  /** One line, said at the stop after the machine's story: what this machine passed on to those who came after, ending with Ingenuity. */
  inheritance: string;
}

export const LEG_SCRIPTS: Record<MachineId, LegScript> = {
  'viking-1': {
    enRoute: [
      'First stop is the oldest. Viking 1 landed in 1976, almost 45 years before I did.',
      'Time to meet my elders, one by one, in the order they landed.',
    ],
    arrivalIntro: [
      'We are on Chryse Planitia, the Golden Plain. Meet Viking 1.',
      'In 1976 it became the first spacecraft to land safely on Mars and keep working.',
      'Click a numbered point on the lander, and I will fly over and scan it.',
    ],
    inheritance: 'Everyone on this flight landed after you.',
  },
  'viking-2': {
    enRoute: [
      'The shortest way to Viking 2 runs almost over the north pole.',
      'From 1976 to 1980, the two Viking landers worked on Mars at the same time.',
    ],
    arrivalIntro: [
      'Utopia Planitia, a rocky plain nearer the polar ice. This is Viking 2.',
      'It landed tilted among the boulders, then sent data home for more than three and a half years.',
      'Click a numbered point, and I will light up that part for you.',
    ],
    inheritance: 'You were moved north, toward the polar ice. Almost 32 years later, Phoenix went farther north and dug some up.',
  },
  'pathfinder-sojourner': {
    enRoute: [
      'NASA did not land on Mars again for almost 21 years after the Vikings.',
      'Then Pathfinder came, carrying the first rover ever to drive on Mars.',
    ],
    arrivalIntro: [
      'Ares Vallis. Pathfinder came down here wrapped in giant airbags, bouncing about 15 times.',
      'Its little rover, Sojourner, was the first ever to drive on Mars.',
      'Click a numbered point, and I will fly in close to scan it.',
    ],
    inheritance: 'Sojourner rolled first. Every NASA rover since has followed her, including the one that carried me here.',
  },
  spirit: {
    enRoute: [
      'We cross the equator. Spirit is our first stop in the southern hemisphere.',
      'It landed in January 2004. Its twin, Opportunity, followed three weeks later.',
    ],
    arrivalIntro: [
      'Troy, beside Home Plate in Gusev crater. Spirit got stuck in soft soil here.',
      'Dragging a dead wheel, it scraped up signs of ancient hot springs or steam vents.',
      'Click a numbered point on the rover, and let us take a closer look.',
    ],
    inheritance: 'Stuck in soft soil, you kept working as a science station that could not move. Now I do the same.',
  },
  opportunity: {
    enRoute: [
      'The longest leg of all. The twins landed on opposite sides of Mars.',
      'The shortest path between them passes close to the south pole.',
    ],
    arrivalIntro: [
      'Perseverance Valley, on the rim of Endeavour crater. Here rests Opportunity.',
      'It was built to drive one kilometre. It drove more than a marathon, and proved water once lasted here.',
      'Click a numbered point on the rover, and I will scan it with my light.',
    ],
    inheritance: 'You showed that water once lasted here. Perseverance went to Jezero, once a lake, and found possible signs of ancient life.',
  },
  phoenix: {
    enRoute: [
      'North again, to the Martian arctic. NASA’s plan back then was to “follow the water.”',
      'Phoenix reused a spacecraft built for a cancelled 2001 mission.',
      'It also carries a DVD for future visitors, called “the first library on Mars.”',
    ],
    arrivalIntro: [
      'The Martian arctic. Phoenix landed farther north than any Mars mission before it.',
      'It dug a trench here and found water ice, hiding just under the soil.',
      'Click a numbered point on the lander, and I will fly over to look.',
    ],
    inheritance: 'You found ice hiding just under the soil. The helicopters coming after me are meant to look for more.',
  },
  insight: {
    enRoute: [
      'InSight landed in November 2018, just over two years before I did.',
      'It never drove anywhere. It sat still and listened to Mars shake.',
    ],
    arrivalIntro: [
      'Elysium Planitia, a quiet plain. This is InSight, the lander that studied the inside of Mars.',
      'Its seismometer felt 1,319 marsquakes, and waves from two of them revealed a liquid iron core.',
      'Click a numbered point on the lander, and I will fly in to scan it.',
    ],
    inheritance: 'You looked inside Mars, all the way down to its core. I only ever saw the surface, from 24 metres up.',
  },
  'mars2020-edl': {
    enRoute: [
      'Back to Jezero crater. One stop before home, and I have been there before.',
      'In April 2022, on Flight 26, I flew out to photograph it.',
    ],
    arrivalIntro: [
      'Jezero crater, where Perseverance and I came down. Here lie the parachute and backshell that slowed us.',
      'That parachute was the biggest ever used on Mars. Its panels hide a message in binary.',
      'Click a numbered point, and I will scan it again for you.',
    ],
    inheritance: 'You brought Perseverance and me down safely. My photos of you may help future landers come down safer.',
  },
  ingenuity: {
    enRoute: [
      'The last hop is the shortest of all.',
      'Perseverance once photographed a piece of my blade, 15 metres west of where I rest.',
    ],
    arrivalIntro: [
      'Home: Valinor Hills, in Jezero crater. That is the real me, resting with broken blades.',
      'I was meant to fly five times on Mars. I flew 72.',
      'Click a numbered point, and I will show you what is left of me.',
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
