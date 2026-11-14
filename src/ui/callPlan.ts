// A radio call from Earth to a machine on Mars: how long the console waits, and how much the
// real round trip is sped up. Nobody answers. Pure, so it can be tested.

import { signalPath } from '../astro';
import type { Machine, SignalPath } from '../types';

/** Longest wait the console makes a visitor sit through, seconds. */
export const MAX_WAIT_S = 6;

export interface CallPlan {
  path: SignalPath;
  /** How long the console waits, ms. */
  waitMs: number;
  /** 1 = real time; >1 = the wait is shown this many times faster; null = unknown distance. */
  speedup: number | null;
}

export function planCall(machine: Machine, date: Date): CallPlan {
  const path = signalPath(machine.id, 'mars', date);
  const rt = path.roundTripS;
  if (rt === null) return { path, waitMs: MAX_WAIT_S * 1000, speedup: null };
  if (rt <= MAX_WAIT_S) return { path, waitMs: Math.round(rt * 1000), speedup: 1 };
  return { path, waitMs: MAX_WAIT_S * 1000, speedup: rt / MAX_WAIT_S };
}

/** Console line printed when the listening window closes. */
export function silenceLine(machine: Machine): string {
  return `No carrier. ${machine.shortName} has not answered since ${formatDate(machine.lastContact)}.`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2018-06-10' → '10 June 2018'. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Seconds → '2.563 s', '12.4 s', '34 min 26 s', '39 h 22 min'. */
export function formatDuration(s: number): string {
  if (s < 10) return `${s.toFixed(3)} s`;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m} min ${Math.round(s - m * 60)} s`;
  }
  const h = Math.floor(s / 3600);
  return `${h} h ${Math.round((s - h * 3600) / 60)} min`;
}

const AU_KM = 149_597_870.7;

/** Distance in words: '384,211 km', '2.07 AU · 309.8 million km'. */
export function formatDistance(km: number): string {
  if (km < 2_000_000) return `${Math.round(km).toLocaleString('en-US')} km`;
  const au = km / AU_KM;
  return `${au.toFixed(2)} AU · ${(km / 1e6).toFixed(1)} million km`;
}

/** 1234.5 → '1,235 km'. */
export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

/** 344.2 → '344×'; 23612 → '23,600×'. */
export function formatSpeedup(x: number): string {
  const digits = Math.floor(Math.log10(x));
  const step = digits >= 3 ? 10 ** (digits - 2) : 1;
  return `${(Math.round(x / step) * step).toLocaleString('en-US')}×`;
}

/** 15.7 → '15:42'. */
export function formatSolarTime(hours: number): string {
  const total = Math.round(hours * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Years between two ISO dates. */
export function yearsBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / (365.25 * 86_400_000);
}

/** Describe the Sun at a site in words: 'Sun 34° up · 15:42 local solar time'. */
export function skyWords(elevationDeg: number, localSolarHours: number | undefined): string {
  const time = localSolarHours === undefined ? '' : ` · ${formatSolarTime(localSolarHours)} local solar time`;
  if (elevationDeg > 0) return `Sun ${Math.round(elevationDeg)}° up${time}`;
  if (elevationDeg > -12) return `Twilight, Sun ${Math.round(-elevationDeg)}° below the horizon${time}`;
  return `Night, Sun ${Math.round(-elevationDeg)}° below the horizon${time}`;
}
