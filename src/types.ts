// Shared contracts. Every module (astro, data, scene, ui) builds against these.
// Change only by agreement: the scene, the console and the data all depend on them.

export type World = 'moon' | 'mars' | 'deep';
export type ViewId = 'overview' | World;

export interface Source {
  label: string;
  url: string;
}

/** A machine tells its own story in four short first-person beats. */
export interface Story {
  /** Why I was sent. */
  why: string;
  /** What I found, or what my work made possible. */
  found: string;
  /** My last day: how contact ended, with the real date. */
  lastDay: string;
  /** Where I am now, and what my work still does today. */
  stillHere: string;
}

/** Where a deep-space machine sits in the schematic solar-system view. */
export type DeepAnchor = 'ceres' | 'eros' | 'earth-trailing' | 'outbound';

export type MachineKind =
  | 'Lander'
  | 'Rover'
  | 'Helicopter'
  | 'Experiment package'
  | 'Orbiter'
  | 'Probe'
  | 'Telescope';

export interface Machine {
  /** Stable kebab-case id, e.g. 'apollo-11'. See MACHINE_IDS. */
  id: string;
  /** Full display name, e.g. 'Apollo 11 · Eagle descent stage'. */
  name: string;
  /** At most 14 characters, used on markers and in the roll-call list. */
  shortName: string;
  world: World;
  kind: MachineKind;
  /** Named place, e.g. 'Tranquility Base, Mare Tranquillitatis'. */
  site: string;
  /** Planetocentric latitude in degrees north. Required for moon and mars. */
  lat?: number;
  /** East longitude in degrees, -180..180. Required for moon and mars. */
  lon?: number;
  /** True when the resting place is only known approximately. */
  approxPosition?: boolean;
  /** Deep-space machines only: where to draw it in the schematic. */
  deepAnchor?: DeepAnchor;
  /** Outbound probes only: approximate ecliptic longitude of the direction of travel, degrees. */
  headingEclipticLon?: number;
  /** ISO dates, YYYY-MM-DD (UTC). */
  launched: string;
  /** Date it reached its world: landing, orbit insertion. Deep-space probes: launch date. */
  arrived: string;
  /** Last signal received on Earth. */
  lastContact: string;
  /** e.g. '90 sols', '2 weeks'. */
  plannedLife: string;
  /** e.g. 'About 14½ years'. */
  actualLife: string;
  /** Answers the laser-ranging channel today. True only for the Apollo 11, 14 and 15 retroreflectors. */
  reflector: boolean;
  story: Story;
  /** 2–4 short fact chips, e.g. '45.16 km driven'. */
  facts: string[];
  sources: Source[];
}

/** The 18 machines on the roll call, in list order. data/machines.ts must match this exactly. */
export const MACHINE_IDS = [
  // Moon
  'surveyor-3',
  'apollo-11',
  'apollo-14',
  'apollo-15',
  'apollo-17',
  // Mars
  'viking-1',
  'viking-2',
  'pathfinder-sojourner',
  'spirit',
  'opportunity',
  'phoenix',
  'insight',
  'ingenuity',
  // Deep space
  'pioneer-10',
  'pioneer-11',
  'near-shoemaker',
  'dawn',
  'kepler',
] as const;

export type MachineId = (typeof MACHINE_IDS)[number];

/** Sun as seen from a site on another world, right now. */
export interface SiteSky {
  /** Sun elevation above the local horizon, degrees (negative = below). */
  elevationDeg: number;
  isDay: boolean;
  /** Mars only: local true solar time in hours, 0–24. */
  localSolarHours?: number;
}

/** Live light-travel numbers for a radio or laser call. */
export interface SignalPath {
  /** One-way distance from Earth, km. Null when we cannot estimate it honestly. */
  distanceKm: number | null;
  /** Real round-trip light time, seconds. Null with distanceKm. */
  roundTripS: number | null;
  /** True when the distance comes from a rough model rather than an ephemeris. */
  estimate: boolean;
  /** One line on how the number was obtained, shown in the console. */
  note: string;
}
