// What happens when the console calls a machine: how long we wait, how much the wait
// is sped up, and whether anything answers. Pure, so it can be tested.

import { signalPath } from '../astro';
import type { CallResult, Channel } from '../store';
import type { Machine, MachineId, SignalPath } from '../types';

/** Longest wait the console makes a visitor sit through, seconds. Shorter real waits play in real time. */
export const MAX_WAIT_S = 6;

export interface CallPlan {
  channel: Channel;
  available: boolean;
  /** Why the channel cannot be used here, when unavailable. */
  unavailableReason?: string;
  path: SignalPath;
  /** How long the console waits, ms. */
  waitMs: number;
  /** 1 = real time; >1 = the wait is shown this many times faster; null = unknown distance. */
  speedup: number | null;
  result: CallResult;
}

export function planCall(machine: Machine, channel: Channel, date: Date): CallPlan {
  const path = signalPath(machine.id as MachineId, machine.world, date);
  const result: CallResult = channel === 'laser' && machine.reflector ? 'echo' : 'silent';

  if (channel === 'laser' && machine.world !== 'moon') {
    return {
      channel,
      available: false,
      unavailableReason:
        machine.world === 'mars'
          ? 'A laser pulse spreads too wide over the distance to Mars to bounce back. Laser ranging only reaches the Moon.'
          : 'Far too distant for a reflected laser pulse. Laser ranging only reaches the Moon.',
      path,
      waitMs: 0,
      speedup: null,
      result: 'silent',
    };
  }

  const rt = path.roundTripS;
  if (rt === null) return { channel, available: true, path, waitMs: MAX_WAIT_S * 1000, speedup: null, result };
  if (rt <= MAX_WAIT_S) return { channel, available: true, path, waitMs: Math.round(rt * 1000), speedup: 1, result };
  return { channel, available: true, path, waitMs: MAX_WAIT_S * 1000, speedup: rt / MAX_WAIT_S, result };
}

/** Console line printed when a call comes back. */
export function resultLine(machine: Machine, plan: CallPlan): string {
  if (plan.result === 'echo') return 'RETURN DETECTED. Photons came back from the reflector.';
  if (plan.channel === 'laser') return 'No return. Nothing at this site reflects a laser back to Earth.';
  return `No carrier. ${machine.shortName} has not answered since ${formatDate(machine.lastContact)}.`;
}

/** Shown after a radio call to a site whose reflector would have answered the laser. */
export function laserHint(machine: Machine, plan: CallPlan, alreadyEchoed: boolean): string | null {
  if (plan.channel !== 'radio' || !machine.reflector || alreadyEchoed) return null;
  return 'Its radio died long ago. But the crew left something here that needs no power at all. Try the laser.';
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

/** Distance in words: '384,211 km', '2.07 AU · 309.8 million km', '142 AU'. */
export function formatDistance(km: number): string {
  if (km < 2_000_000) return `${Math.round(km).toLocaleString('en-US')} km`;
  const au = km / AU_KM;
  if (au < 20) return `${au.toFixed(2)} AU · ${(km / 1e6).toFixed(1)} million km`;
  return `${Math.round(au)} AU · ${(km / 1e9).toFixed(1)} billion km`;
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

/** Working life in years between two ISO dates. */
export function yearsBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / (365.25 * 86_400_000);
}
