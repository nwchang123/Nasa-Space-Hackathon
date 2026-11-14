// Events for the opening time-lapse: every arrival and every last signal, in date order.

import { yearFraction } from '../geo';
import type { Machine } from '../types';

export interface TimelineEvent {
  year: number;
  iso: string;
  machine: Machine;
  type: 'arrive' | 'silent';
  text: string;
}

export const TIMELAPSE_START = 1966.5;
export const TIMELAPSE_SECONDS = 26;

function arrivalVerb(m: Machine): string {
  if (m.world === 'deep') {
    if (m.deepAnchor === 'outbound' || m.deepAnchor === 'earth-trailing') return 'launches';
    return `reaches ${m.deepAnchor === 'ceres' ? 'Ceres' : 'Eros'}`;
  }
  if (m.kind === 'Helicopter') return 'arrives in Jezero crater';
  return 'lands';
}

export function buildTimeline(machines: Machine[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const m of machines) {
    events.push({ year: yearFraction(m.arrived), iso: m.arrived, machine: m, type: 'arrive', text: `${m.shortName} ${arrivalVerb(m)}` });
    events.push({ year: yearFraction(m.lastContact), iso: m.lastContact, machine: m, type: 'silent', text: `${m.shortName} falls silent` });
  }
  return events.sort((a, b) => a.year - b.year || (a.type === 'silent' ? -1 : 1));
}

/** How many machines have arrived, and how many of those are still talking, at a given year. */
export function countsAt(machines: Machine[], year: number) {
  let left = 0;
  let working = 0;
  for (const m of machines) {
    if (yearFraction(m.arrived) <= year) {
      left++;
      if (yearFraction(m.lastContact) > year) working++;
    }
  }
  return { left, working };
}
