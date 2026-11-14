// Shared contracts for Still Here: Flight 73. Every module (astro, data, flight, scene, ui)
// builds against these. Change only by agreement.

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
  /** My last day: how it ended, with the real date. */
  lastDay: string;
  /** Where I am now, and what my work still does today. */
  stillHere: string;
}

export type MachineKind = 'Lander' | 'Rover' | 'Helicopter' | 'Landing hardware';

export interface Machine {
  /** Stable kebab-case id. See MACHINE_IDS. */
  id: MachineId;
  /** Full display name, e.g. 'Opportunity rover'. */
  name: string;
  /** At most 14 characters, for markers and the route strip. */
  shortName: string;
  kind: MachineKind;
  /** Named place, e.g. 'Perseverance Valley, Endeavour crater rim'. */
  site: string;
  /** Planetocentric latitude, degrees north. */
  lat: number;
  /** East longitude, degrees, −180..180. */
  lon: number;
  /** True when the resting place is only known approximately. */
  approxPosition?: boolean;
  /** ISO dates, YYYY-MM-DD (UTC). */
  launched: string;
  /** Date it reached the surface of Mars. */
  arrived: string;
  /** Last signal received on Earth (or, for hardware with no radio, the date it was cut loose). */
  lastContact: string;
  /** UI label for lastContact. Default 'Last signal'; e.g. 'Cut loose' for landing hardware. */
  lastContactLabel?: string;
  /** e.g. '90 sols'. */
  plannedLife: string;
  /** e.g. 'About 14½ years'. */
  actualLife: string;
  /** Hardware that never had a radio of its own: the console offers no radio call. */
  noRadio?: boolean;
  story: Story;
  /** 2–4 short fact chips, e.g. '45.16 km driven'. */
  facts: string[];
  sources: Source[];
}

/**
 * The flight route, in order. Flight 73 starts at Ingenuity's resting place, visits each
 * stop in order of arrival on Mars, and ends back at Ingenuity. data/machines.ts must list
 * the machines in exactly this order.
 */
export const MACHINE_IDS = [
  'viking-1',
  'viking-2',
  'pathfinder-sojourner',
  'spirit',
  'opportunity',
  'phoenix',
  'insight',
  'mars2020-edl',
  'ingenuity',
] as const;

export type MachineId = (typeof MACHINE_IDS)[number];

/** Sun as seen from a site on Mars, right now. */
export interface SiteSky {
  /** Sun elevation above the local horizon, degrees (negative = below). */
  elevationDeg: number;
  /** Sun azimuth, degrees clockwise from north. */
  azimuthDeg: number;
  isDay: boolean;
  /** Local true solar time, hours 0–24. */
  localSolarHours?: number;
}

/** Live light-travel numbers for a radio call. */
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
