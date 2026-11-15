// Shared state for the guided visit: what Ingenuity's radio is saying (so the dock can wait for
// the prologue's self-introduction, and the auto tour for any message), and the auto tour's own
// marks for the HUD (the section being read, the invitation to try the stop's action, the countdown
// to the next move). Plus the tour's timing rules, pure and unit-tested (tests/auto-tour.test.ts).

import { create } from 'zustand';
import { flyDurationMs } from '../flight/route';
import { descentMs } from '../scene/layout';

/** Which radio message a feed is on. `key` names the feed: 'prologue', 'flying:<leg>:<start>', 'site:<stop>', 'epilogue'. */
export interface FeedState {
  key: string;
  kind: 'intro' | 'imagine' | 'react' | null;
  /** Changes on every message (and replay). */
  id: number;
  /** The visitor has heard it (the voice ended) or had time to read it (no voice). */
  done: boolean;
}

export const useFeed = create<FeedState>(() => ({ key: '', kind: null, id: 0, done: false }));

/** The auto tour's marks for the HUD. */
export interface TourUi {
  /** The story section being read aloud: which, since when (Date.now()), and about how long, ms. */
  chapter: { i: number; at: number; ms: number } | null;
  /** The stop's hands-on action is waiting for the visitor (highlighted in the dock). */
  invite: boolean;
  /** When the invitation's current wait began (it starts again while the visitor is busy with it), Date.now(). */
  inviteAt: number;
  /** Date.now() of the latest "Skip this step" on the invitation. */
  skipAt: number;
  /** The move about to happen by itself: since when, how long, ms. */
  countdown: { at: number; ms: number } | null;
  /** Prologue: the rotor test has waited a while, so the hold button asks again. */
  nudge: boolean;
  /** Paused by a touch on the view: when the tour will pick up again by itself (if nothing else is touched), Date.now(); null if it will not. */
  resumeAt: number | null;
  /** The stop's action the tour is running itself while a section is read (its key), or null. */
  demo: string | null;
}

export const NO_TOUR: TourUi = { chapter: null, invite: false, inviteAt: 0, skipAt: 0, countdown: null, nudge: false, resumeAt: null, demo: null };
export const useTour = create<TourUi>(() => ({ ...NO_TOUR }));

// ---------------------------------------------------------------- timing

/** After the arrival intro, the first section starts after this pause, ms. */
export const INTRO_GAP_MS = 900;
/** Between two sections, ms. */
export const CHAPTER_GAP_MS = 700;
/** The countdown before flying on to the next stop by itself, ms. */
export const NEXT_COUNTDOWN_MS = 4000;
/** The countdown before lifting off from home, ms. */
export const LIFTOFF_COUNTDOWN_MS = 6000;
/** The rotor test waits this long for the visitor before asking again, then before trying it itself, ms. */
export const NUDGE_MS = 10000;
export const DEMO_MS = 16000;
/**
 * A stop's hands-on action is offered for this long, then the tour moves on by itself (the wait
 * starts again whenever the visitor touches its controls), so a visitor who only watches is never
 * held at a stop until they click, ms.
 */
export const INVITE_WAIT_MS = 12000;
/**
 * After the visitor takes over (picks a section, opens the dossier…), the tour picks up again by
 * itself once there has been no input for this long, ms. Not after an explicit Pause, and not while
 * they are busy elsewhere (the scout camera, the dossier, flying Ingenuity). Looking around the 3D
 * model does not interrupt the tour.
 */
export const IDLE_RESUME_MS = 25000;
/** The top bar counts down the last seconds before the tour picks up again, ms. */
export const RESUME_NOTICE_MS = 6000;

/** Whether a tour paused by a touch should pick up again by itself now. */
export function shouldAutoResume(o: { idleMs: number; byHand: boolean; busy: boolean }): boolean {
  return !o.byHand && !o.busy && o.idleMs >= IDLE_RESUME_MS;
}

/** Keys that fly Ingenuity manually at a stop. */
export const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Whether pressing down on a UI element should pause the auto tour: only opening the dossier card
 * interrupts (orbiting/zooming on `.stage` or the `.brg` camera heading bar keeps the tour going).
 */
export function shouldPauseOnPointerTarget(o: { inDossierToggle: boolean }): boolean {
  return o.inDossierToggle;
}

/** Whether a key press should pause the auto tour (manual flight keys at a site, never view controls). */
export function shouldPauseOnKey(o: { stage: string; code: string; typing: boolean; inRuler: boolean }): boolean {
  if (o.inRuler || o.typing) return false;
  return o.stage === 'site' && FLY_KEYS.has(o.code);
}
/** A flight is never stretched beyond this for its lines, ms. */
export const MAX_TOUR_FLY_MS = 24000;
/** The arrival waits at most this long for the leg's lines to finish, ms. */
export const ARRIVAL_HOLD_MS = 5000;
/** Reading pace without the voice: a base plus this many ms per character (about 16 a second). */
const READ_BASE_MS = 1400;
const READ_CHAR_MS = 62;

/** How long a text takes to read without the voice, ms. */
export function readingMs(text: string): number {
  return Math.round(READ_BASE_MS + text.length * READ_CHAR_MS);
}

/** A story section as lines to speak: one per sentence (long utterances get cut off in some browsers). */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[A-Z0-9“"‘'(])/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * A planned leg's flight time with the auto tour on: long enough for Ingenuity's lines on the way
 * (said from the take-off) to finish before the dive into the stop, never shorter than the leg's own.
 */
export function tourFlyMs(distanceKm: number, speakMs: number): number {
  const base = flyDurationMs(distanceKm);
  // Lines start ~0.4 s after the take-off and should end with a little margin before the descent.
  let ms = base;
  for (let i = 0; i < 4; i++) ms = Math.max(base, speakMs + 900 + descentMs(ms));
  return Math.round(Math.min(MAX_TOUR_FLY_MS, ms));
}

/** A stop's action run by the tour (signatures.ts playsDuring) starts this long into its section, ms… */
export const ACTION_DEMO_DELAY_MS = 1500;

/** …and takes about 60 % of the section's reading time, from 3.5 to 8 s, ms. */
export function actionDemoMs(chapterMs: number): number {
  return Math.round(Math.min(8000, Math.max(3500, chapterMs * 0.6)));
}

/** Where the tour's hand has the slider `elapsedMs` into its run of `ms`: from → to, eased in and out. */
export function actionDemoValue(elapsedMs: number, ms: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, ms > 0 ? elapsedMs / ms : 1));
  const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return from + (to - from) * k;
}

/** Whether a section has been read: the voice has finished (or there is none and it has had its reading time), or it ran far too long. */
export function chapterDone(elapsedMs: number, estimateMs: number, voiceDone: boolean): boolean {
  if (elapsedMs >= estimateMs * 1.8 + 4000) return true;
  return voiceDone && elapsedMs >= Math.min(estimateMs, 2500);
}
