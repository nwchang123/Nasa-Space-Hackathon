// The choreography of Flight 73 as one continuous shot. Each frame, from the store and the clock,
// it works out which site diorama is in use, how far the camera has dived into it (blend: 0 = over
// the globe, 1 = standing at the site), where Ingenuity is on its arc, and what its rotors do.
// Everything is a function of time since a stage began, so it is frame-rate independent and has
// no jumps; a few transitions (skip, return to the globe) start from wherever the shot was.
// Stage time includes the time banked by boost (stageElapsed), so boost speeds up the flight, the
// odometer and the arrival together. In the prologue the visitor's rotor test drives the rotor:
// the throttle they hold open (wobbling, then juddering in the red zone), the fault's judder, and
// the wind-down.
// Pure TypeScript (no three.js), unit-tested.

import { HOME, hop } from '../flight/route';
import type { FlightState, Phase, PrologueStep } from '../store';
import { MACHINE_IDS, type MachineId } from '../types';
import { climbMs, descentMs, easeInOut, flightProgress, smoothstep, type LegLike } from './layout';

export type GlobeShot = 'title' | 'chase' | 'epilogue' | 'report';

/**
 * Title screen → home diorama at "Begin Flight 73", ms. The title shows Mars off to the right, so
 * the opening first swings the view round to put Jezero in the middle of the screen
 * (OPENING_CENTRE_MS, see CameraRig), and the dive straight down into it starts part way through
 * that turn (OPENING_DIVE_AT_MS), so the two read as one move instead of a sideways lunge.
 */
export const OPENING_DESCENT_MS = 3400;
export const OPENING_CENTRE_MS = 1150;
export const OPENING_DIVE_AT_MS = 700;
/**
 * The opening runs on its own clock, which advances at most this much per frame, ms. The first
 * frames of the dive build the home diorama and compile its shaders; on a slow machine one of those
 * frames can take most of a second. On the wall clock the camera would then leap from orbit to the
 * sand in a single frame; on this clock the dive simply waits for the frame and carries on.
 */
export const OPENING_FRAME_MAX_MS = 40;

/** How far the opening has turned the view onto Jezero, 0..1, `since` ms after "Begin Flight 73". */
export function openingCentre(since: number): number {
  return easeInOut(Math.min(1, Math.max(0, since / OPENING_CENTRE_MS)));
}

/** How far the opening dive has got (the shot's blend), 0..1, `since` ms after "Begin Flight 73". */
export function openingDive(since: number): number {
  return Math.min(1, Math.max(0, (since - OPENING_DIVE_AT_MS) / (OPENING_DESCENT_MS - OPENING_DIVE_AT_MS)));
}
/** In the epilogue the home diorama holds this long, then the view rises to the whole globe. */
export const EPILOGUE_HOLD_MS = 6500;
export const EPILOGUE_RISE_MS = 3800;
/** Back up to the globe for the flight log, or back to the title. */
export const RETURN_MS = 2400;
/** A skipped flight: the rest of the cruise passes in this long, then the descent plays. */
export const SKIP_CRUISE_MS = 300;
export const SKIP_DESCENT_MS = 650;
/** Ingenuity hovers this high above its spot as the camera arrives, m; touches down over LANDING_MS. */
export const HOVER_M = 2.4;
export const LANDING_MS = 1700;
export const SPINDOWN_MS = 1800;
/** Climbing out of a site the story has left behind, ms. */
export const LEAVE_MS = 900;
/**
 * Rotor test in the prologue: rotor speed at full throttle (the damaged rotor never reaches flight
 * speed), where the red zone starts (src/ui/throttle.ts RED_ZONE), the speed the fault winds down
 * from (about where a red-zone hold fails), and the wind-down.
 */
export const TEST_MAX_SPEED = 0.75;
export const TEST_RED_ZONE = 0.82;
export const FAULT_FROM_SPEED = 0.7;
export const FAULT_SPINDOWN_MS = 2000;
/** The fault's judder fades over this long, ms. */
export const JUDDER_MS = 1400;

/** Inputs beyond the flight state (all optional, so tests can leave them out). */
export interface ShotExtras {
  /** Flight time banked by boost in this stage, ms (store.boostMs). */
  boostMs?: number;
  /** The prologue's rotor test (store.prologue), with the visitor's throttle (0..1, default 0). */
  prologue?: { step: PrologueStep; at: number; throttle?: number };
}

/** Rotor speed for a throttle setting (0..1) in the rotor test, before wobble. */
export const testRotor = (throttle: number) => TEST_MAX_SPEED * Math.min(1, Math.max(0, throttle));

/**
 * Rotor speed and judder (0..1) of the prologue's rotor test, `since` ms into its step. While
 * 'spinning' the speed follows the visitor's throttle; it wobbles from 0.7 up and judders in the red
 * zone. 'fault' winds down from FAULT_FROM_SPEED with a fading judder.
 */
export function rotorTest(step: PrologueStep, since: number, throttle = 0): { rotor: number; judder: number } {
  const t = Math.max(0, since);
  if (step === 'spinning') {
    const k = Math.min(1, Math.max(0, throttle));
    const red = smoothstep(TEST_RED_ZONE, 1, k);
    const rough = 0.012 * smoothstep(0.7, TEST_RED_ZONE, k) + 0.04 * red;
    const wobble = rough * Math.sin(t * 0.021) * Math.sin(t * 0.0067 + 1);
    return { rotor: Math.max(0, testRotor(k) + (k > 0 ? wobble : 0)), judder: 0.3 * red };
  }
  if (step === 'fault') {
    return {
      rotor: FAULT_FROM_SPEED * (1 - easeInOut(t / FAULT_SPINDOWN_MS)),
      judder: 1 - smoothstep(0, JUDDER_MS, t),
    };
  }
  return { rotor: 0, judder: 0 };
}

export interface Arc extends LegLike {
  /** Fraction flown, 0..1 (same clock and easing as the odometer). */
  p: number;
}

export interface Shot {
  /** Diorama in use (mounted), or null. */
  siteId: MachineId | null;
  /** 0 = over the globe, 1 = standing at siteId. */
  blend: number;
  /** Ingenuity on a flight arc, or null when it rests. */
  arc: Arc | null;
  /** What the globe end of the shot is. */
  globeShot: GlobeShot;
  /** Ingenuity's height above its landing spot at the site, m. */
  hover: number;
  /** Rotor speed, 0..1. */
  rotor: number;
  /** Ingenuity is on screen (in flight, or anywhere near a site). */
  ingenuity: boolean;
  /** The prologue rotor fault: how hard Ingenuity shakes, 0..1. */
  judder?: number;
  /** A direct hop is still climbing out of the previous site. */
  leaving?: boolean;
  /** Prologue: time into the opening on its hitch-free clock (see OPENING_FRAME_MAX_MS), ms. */
  opening?: number;
}

interface Moment {
  p: number;
  near: 'from' | 'to';
  blend: number;
  hover: number;
}

/** Where a flight stands `t` ms in: climbing out of `from`, cruising, or diving into `to`. */
export function legMoment(t: number, flyMs: number): Moment {
  if (flyMs <= 0) return { p: 1, near: 'to', blend: 1, hover: HOVER_M };
  const p = flightProgress(t, flyMs);
  const c = climbMs(flyMs);
  const d = descentMs(flyMs);
  if (t < c) {
    const k = Math.max(0, t) / c;
    return { p, near: 'from', blend: 1 - easeInOut(k), hover: HOVER_M * smoothstep(0, 0.45, k) };
  }
  if (t > flyMs - d) return { p, near: 'to', blend: easeInOut((t - (flyMs - d)) / d), hover: HOVER_M };
  return { p, near: 'to', blend: 0, hover: HOVER_M };
}

/**
 * Virtual time into a skipped flight: from t0 (when "Skip" was pressed) the cruise fast-forwards
 * to the start of the descent in SKIP_CRUISE_MS, then the descent plays in SKIP_DESCENT_MS.
 */
export function skipClock(sinceSkipMs: number, t0: number, flyMs: number): number {
  const dStart = flyMs - descentMs(flyMs);
  const cruiseFrom = Math.min(t0, dStart);
  const cruiseMs = t0 < dStart ? SKIP_CRUISE_MS : 0;
  if (sinceSkipMs < cruiseMs) return cruiseFrom + (dStart - cruiseFrom) * easeInOut(sinceSkipMs / cruiseMs);
  const descentFrom = Math.max(t0, dStart);
  const k = Math.min(1, (sinceSkipMs - cruiseMs) / SKIP_DESCENT_MS);
  return descentFrom + (flyMs - descentFrom) * k;
}

// Ingenuity is always somewhere: on its arc, at a site, or resting at home on the globe.
const REST: Shot = { siteId: null, blend: 0, arc: null, globeShot: 'title', hover: 0, rotor: 0, ingenuity: true };

/**
 * Stateful only where the story needs memory: when the current stage was first seen, the blend at
 * that moment, a skip in progress, and when Ingenuity settled at a site.
 * With `reduced` motion every move is a step (the stage covers it with a short dip to black).
 */
export class Choreographer {
  shot: Shot = { ...REST };
  private key = '';
  private seenAt = 0;
  private blendAtChange = 0;
  private flying: { leg: number; from: MachineId; t: number; flyMs: number } | null = null;
  private skip: { leg: number; from: MachineId; t0: number; flyMs: number; at: number } | null = null;
  private settledAt = 0;
  private lastNow = 0;
  /** The opening's own clock, ms (OPENING_FRAME_MAX_MS). */
  private openingMs = 0;
  private ticked = false;
  private leaving: { site: MachineId; from: number; at: number } | null = null;

  update(phase: Phase, f: FlightState, now: number, reduced: boolean, extras: ShotExtras = {}): Shot {
    const boostMs = extras.boostMs ?? 0;
    const ease = reduced ? (k: number) => (k > 0 ? 1 : 0) : easeInOut;
    const key = phase === 'flight' ? `${f.stage}:${f.leg}:${f.stageStartedAt}` : phase;
    if (key !== this.key) {
      this.key = key;
      this.seenAt = now;
      this.blendAtChange = this.shot.blend;
      const fl = this.flying;
      const skipped = phase === 'flight' && f.stage === 'site' && fl && fl.leg === f.leg && fl.t < fl.flyMs && !reduced;
      this.skip = skipped && fl ? { leg: fl.leg, from: fl.from, t0: fl.t, flyMs: fl.flyMs, at: now } : null;
      if (!(phase === 'flight' && f.stage === 'flying')) this.flying = null;
      this.settledAt = now;
      this.openingMs = 0;
      if (phase !== 'flight') this.leaving = null;
    } else if (this.ticked) {
      this.openingMs += Math.min(OPENING_FRAME_MAX_MS, Math.max(0, now - this.lastNow));
    }
    this.ticked = true;
    const since = now - this.seenAt;
    const dt = this.lastNow ? Math.min(0.1, Math.max(0, (now - this.lastNow) / 1000)) : 0;
    this.lastNow = now;
    const prev = this.shot;
    const spinDown = reduced ? 0 : Math.max(0, prev.rotor - dt * (1000 / SPINDOWN_MS));
    let next: Shot;

    const flight = (from: MachineId, leg: number, t: number, flyMs: number): Shot => {
      const h = hop(from, leg);
      const m = reduced ? legMoment(flyMs, 0) : legMoment(t, flyMs);
      return {
        siteId: m.near === 'from' ? h.from : h.to,
        // Leaving a site the camera had not fully reached (lift-off pressed early): start from there.
        blend: m.near === 'from' ? Math.min(m.blend, this.blendAtChange) : m.blend,
        arc: { from: h.from, to: h.to, distanceKm: h.distanceKm, p: m.p },
        globeShot: 'chase',
        hover: reduced ? 0 : m.hover,
        rotor: reduced ? 0 : smoothstep(0, 600, t),
        ingenuity: true,
      };
    };

    if (phase !== 'flight') {
      // Title or flight log: rise back to the globe from wherever the shot was.
      const blend = this.blendAtChange * (1 - ease(since / RETURN_MS));
      next = { ...REST, siteId: blend > 0 ? prev.siteId : null, blend, globeShot: phase === 'report' ? 'report' : 'title', rotor: spinDown };
    } else if (f.stage === 'prologue') {
      const blend = this.blendAtChange + (1 - this.blendAtChange) * ease(reduced ? since : openingDive(this.openingMs));
      const pr = extras.prologue;
      const test = pr && !reduced ? rotorTest(pr.step, now - pr.at, pr.throttle ?? 0) : { rotor: 0, judder: 0 };
      next = { ...REST, siteId: HOME, blend, globeShot: 'title', rotor: test.rotor, judder: test.judder, opening: this.openingMs };
    } else if (f.stage === 'flying') {
      const t = now - f.stageStartedAt + boostMs;
      this.flying = { leg: f.leg, from: f.from, t: Math.min(t, f.flyMs), flyMs: f.flyMs };
      next = flight(f.from, f.leg, t, f.flyMs);
    } else if (f.stage === 'site') {
      const sk = this.skip;
      const vt = sk ? skipClock(now - sk.at, sk.t0, sk.flyMs) : Infinity;
      if (sk && vt < sk.flyMs) {
        next = flight(sk.from, sk.leg, vt, sk.flyMs);
        this.settledAt = now;
      } else {
        if (sk) {
          // The skipped flight has finished its descent: we are fully at the site.
          this.skip = null;
          this.settledAt = now;
          this.blendAtChange = 1;
        }
        const stop = MACHINE_IDS[f.leg];
        const landed = now - this.settledAt;
        const hover = reduced ? 0 : HOVER_M * (1 - easeInOut(landed / LANDING_MS));
        const rotor = reduced ? 0 : landed < LANDING_MS ? 1 : Math.max(0, 1 - (landed - LANDING_MS) / SPINDOWN_MS);
        // Normally the flight has already dived all the way in; otherwise dive in from where we are.
        const blend = this.blendAtChange + (1 - this.blendAtChange) * ease(since / RETURN_MS);
        next = { siteId: stop, blend, arc: null, globeShot: 'chase', hover, rotor, ingenuity: true };
      }
    } else {
      // Epilogue: home, blade broken, then the long rise to the whole globe.
      const t = now - f.stageStartedAt + boostMs;
      const rise = t < EPILOGUE_HOLD_MS ? 0 : ease((t - EPILOGUE_HOLD_MS) / EPILOGUE_RISE_MS);
      const blend = rise > 0 ? 1 - rise : this.blendAtChange + (1 - this.blendAtChange) * ease(since / RETURN_MS);
      next = { ...REST, siteId: blend > 0 ? HOME : null, blend, globeShot: 'epilogue', rotor: spinDown };
    }

    // A different diorama may only come in once the old one is fully left behind (blend 0): if the
    // story jumps (the epilogue reached from another stop, a hop picked mid-move), climb out of the
    // old site first, then dive into the new one from the globe.
    if (prev.siteId && next.siteId && next.siteId !== prev.siteId && prev.blend > 0.001) {
      if (!this.leaving || this.leaving.site !== prev.siteId) this.leaving = { site: prev.siteId, from: prev.blend, at: now };
      const k = (now - this.leaving.at) / LEAVE_MS;
      const blend = reduced || k >= 1 ? 0 : this.leaving.from * (1 - easeInOut(k));
      // Keep the old globe pose and arc as well as its terrain. Otherwise the new flight's
      // camera pulls the still-visible old diorama across the screen before the handoff.
      next = { ...prev, blend, leaving: true };
    } else if (this.leaving) {
      this.leaving = null;
      this.seenAt = now;
      this.blendAtChange = 0;
      if (next.siteId && next.arc === null) next = { ...next, blend: 0 };
    }
    this.shot = next;
    return next;
  }
}
