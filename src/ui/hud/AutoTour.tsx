// The auto tour: with it on (store.autoTour, the switch in the top bar), Ingenuity moves the visit
// along by itself, so a visitor can sit back and still see everything, while each stop's hands-on
// action stays theirs:
// - at home: after its self-introduction, if the visitor has not tried the rotor test for a while
//   the hold button asks again, then Ingenuity tries it itself; after the turn to Flight 73, a
//   short countdown to lift-off;
// - on each leg: the flight is long enough for Ingenuity's lines (see tourFlyMs), and the dock
//   waits for them before landing;
// - at each stop: after the arrival intro, the four story sections in turn, each read aloud with a
//   close-up of its part; then the stop's action is offered (never forced: it can be skipped), and
//   once Ingenuity has answered it, a short countdown to the next stop.
// The moment the visitor takes over (drags or zooms the view, uses the bearing ruler, picks a
// section or a hotspot, opens the dossier or the scout camera, flies Ingenuity), the tour pauses
// where it is. It picks up again from the top bar's Resume, or by itself once nothing has been
// touched for a while (IDLE_RESUME_MS; the top bar counts the last seconds), unless the visitor
// pressed Pause themselves or is busy with the scout camera, the dossier or flying Ingenuity. A
// stop's action is offered, never required: after INVITE_WAIT_MS untouched the tour moves on.
// A pause lasts until the next stage.

import { useEffect, useState } from 'react';
import { LEG_SCRIPTS } from '../../data/flight';
import { MACHINE_BY_ID } from '../../data/machines';
import { SIGNATURES } from '../../data/signatures';
import { LEGS, flyDurationMs } from '../../flight/route';
import { STORY_KEYS, currentStop, useApp, type AppState, type StorySection } from '../../store';
import { MACHINE_IDS } from '../../types';
import { useThrottle } from '../throttle';
import { live } from '../../scene/registry';
import {
  CHAPTER_GAP_MS,
  DEMO_MS,
  IDLE_RESUME_MS,
  INTRO_GAP_MS,
  INVITE_WAIT_MS,
  LIFTOFF_COUNTDOWN_MS,
  NEXT_COUNTDOWN_MS,
  NO_TOUR,
  NUDGE_MS,
  RESUME_NOTICE_MS,
  chapterDone,
  readingMs,
  sentences,
  shouldAutoResume,
  tourFlyMs,
  useFeed,
  useTour,
} from '../tour';
import { prefersReducedMotion } from '../useClock';
import { speak, speechMs, type Speech } from '../voice';
import { PlayGlyph, TourSwitchGlyph } from './icons';

/** A planned leg's flight time: stretched for Ingenuity's lines while the auto tour is on. */
export function plannedFlyMs(leg: number): number {
  if (prefersReducedMotion()) return 0;
  const l = LEGS[leg];
  return useApp.getState().autoTour ? tourFlyMs(l.distanceKm, speechMs(LEG_SCRIPTS[l.to].enRoute)) : flyDurationMs(l.distanceKm);
}

/** Lift off from home on the first leg. */
export function liftOff() {
  useApp.getState().flyTo(0, plannedFlyMs(0));
}

/** On to the next planned stop, or home for the epilogue after the last. */
export function flyOn() {
  const s = useApp.getState();
  const next = s.flight.leg + 1;
  if (next < MACHINE_IDS.length) s.flyTo(next, plannedFlyMs(next));
  else s.toEpilogue();
}

type Step = 'intro' | 'test' | 'testing' | 'imagine' | 'gap' | 'chapter' | 'invite' | 'countdown' | 'idle';

interface Run {
  /** The stage this run belongs to. */
  key: string;
  step: Step;
  /** When the step began, Date.now(). */
  at: number;
  /** The story section (site). */
  i: number;
  speech: Speech | null;
  /** The section's text as spoken (lines joined), and its expected length, ms. */
  said: string;
  ms: number;
  /** Ingenuity has answered the stop's action (its inheritance line) at this stop. */
  answered: boolean;
}

const stageKey = (s: AppState) => (s.phase === 'flight' ? `${s.flight.stage}:${s.flight.leg}:${s.flight.stageStartedAt}` : '');

function go(run: Run, step: Step, now: number) {
  run.step = step;
  run.at = now;
}

function countdown(run: Run, now: number, ms: number) {
  go(run, 'countdown', now);
  run.ms = ms;
  useTour.setState({ countdown: { at: now, ms }, invite: false, chapter: null, nudge: false });
}

function startChapter(run: Run, s: AppState, i: number, now: number) {
  const stop = currentStop(s.flight);
  if (!stop) return;
  const text = MACHINE_BY_ID[stop].story[STORY_KEYS[i]];
  const lines = sentences(text);
  s.setStory(i as StorySection);
  s.setFocus({ kind: 'hotspot', id: String(i), strength: 1 });
  run.i = i;
  run.speech = speak(lines);
  run.said = lines.join('\n');
  run.ms = run.speech ? speechMs(lines) : readingMs(text);
  go(run, 'chapter', now);
  useTour.setState({ chapter: { i, at: now, ms: run.ms }, invite: false });
}

function invite(run: Run, s: AppState, now: number) {
  const stop = currentStop(s.flight);
  const defs = stop ? (SIGNATURES[stop] ?? []) : [];
  useTour.setState({ chapter: null });
  if (defs.length === 0 || run.answered) {
    countdown(run, now, NEXT_COUNTDOWN_MS);
    return;
  }
  go(run, 'invite', now);
  s.setFocus({ kind: 'signature', id: defs[0].key, strength: 1 });
  useTour.setState({ invite: true, inviteAt: now });
}

/** Pick the tour up again where it was paused (or switched back on). */
function resume(run: Run, s: AppState, now: number) {
  if (run.step === 'chapter') startChapter(run, s, s.story, now);
  else if (run.step === 'countdown') countdown(run, now, run.ms);
  else if (run.step === 'invite') {
    run.at = now;
    useTour.setState({ invite: true, inviteAt: now });
  } else run.at = now;
}

/** The latest input of any kind (pointer, wheel, key), and the latest on the invitation's controls, Date.now(). */
let lastInput = Date.now();
let inviteTouch = 0;
/** The visitor pressed Pause themselves: no picking up by itself until they resume. */
let byHand = false;

/** Pause the tour on purpose (the countdown's Pause): it then waits for Resume, however long. */
export function pauseByHand() {
  byHand = true;
  useApp.getState().pauseTour();
}

/** The visitor is busy with something the tour should not cut across. */
function busyElsewhere(s: AppState): boolean {
  if (s.scoutCam) return true;
  if (live.flyer.site !== null && live.flyer.alt > 0.3) return true;
  return typeof document !== 'undefined' && document.querySelector('.dossier:not([hidden])') !== null;
}

function prologue(run: Run, s: AppState, now: number) {
  const feed = useFeed.getState();
  const step = s.prologue.step;
  const reduced = prefersReducedMotion();
  switch (run.step) {
    case 'intro':
      if (step !== 'ready') go(run, 'testing', now);
      else if (feed.key === 'prologue' && feed.kind === 'intro' && feed.done) go(run, 'test', now);
      break;
    case 'test':
      if (step !== 'ready') {
        useTour.setState({ nudge: false });
        go(run, 'testing', now);
      } else if (now - run.at >= DEMO_MS) {
        // Nobody has tried: Ingenuity runs the rotor test itself (the throttle opens until the
        // damaged blades fail, as if held).
        useTour.setState({ nudge: false });
        if (reduced) s.setPrologue('imagine');
        else useThrottle.getState().setHolding(true);
        go(run, 'testing', now);
      } else if (now - run.at >= NUDGE_MS && !useTour.getState().nudge) useTour.setState({ nudge: true });
      break;
    case 'testing':
      if (step === 'ready') go(run, 'test', now);
      else if (step === 'imagine') go(run, 'imagine', now);
      break;
    case 'imagine':
      if ((feed.key === 'prologue' && feed.kind === 'imagine' && feed.done) || now - run.at > 20000) countdown(run, now, LIFTOFF_COUNTDOWN_MS);
      break;
    case 'countdown':
      if (now - run.at >= run.ms) {
        go(run, 'idle', now);
        useTour.setState({ countdown: null });
        liftOff();
      }
      break;
  }
}

function site(run: Run, s: AppState, now: number) {
  const stop = currentStop(s.flight);
  if (!stop) return;
  const feed = useFeed.getState();
  const here = feed.key === `site:${stop}`;
  if (here && feed.kind === 'react') run.answered = true;
  switch (run.step) {
    case 'intro':
      // The arrival intro has been heard (or never came: give up waiting after a while).
      if ((here && feed.kind !== null && feed.done) || now - run.at > 30000) {
        run.i = 0;
        go(run, 'gap', now);
      }
      break;
    case 'gap':
      if (now - run.at >= (run.i === 0 ? INTRO_GAP_MS : CHAPTER_GAP_MS)) startChapter(run, s, run.i, now);
      break;
    case 'chapter': {
      const elapsed = now - run.at;
      const n = run.speech ? run.speech.charsAt() : null;
      const voiceDone = n !== null ? n >= run.said.length : elapsed >= readingMs(run.said);
      if (chapterDone(elapsed, run.ms, voiceDone)) {
        run.speech = null;
        if (run.i < 3) {
          run.i += 1;
          useTour.setState({ chapter: null });
          go(run, 'gap', now);
        } else invite(run, s, now);
      }
      break;
    }
    case 'invite': {
      const tour = useTour.getState();
      if (tour.skipAt > run.at) countdown(run, now, NEXT_COUNTDOWN_MS);
      else if (here && feed.kind === 'react') {
        // The visitor did it: wait for Ingenuity's answer to be heard, then move on.
        if (feed.done) countdown(run, now, NEXT_COUNTDOWN_MS);
      } else {
        // Offered, not required: untouched for INVITE_WAIT_MS, the tour moves on by itself.
        const from = Math.max(run.at, inviteTouch);
        if (tour.inviteAt !== from) useTour.setState({ inviteAt: from });
        if (now - from >= INVITE_WAIT_MS) countdown(run, now, NEXT_COUNTDOWN_MS);
      }
      break;
    }
    case 'countdown':
      if (now - run.at >= run.ms) {
        go(run, 'idle', now);
        useTour.setState({ countdown: null });
        flyOn();
      }
      break;
  }
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
/** Keys that fly Ingenuity or turn the view at a stop. */
const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
/** Keys that turn the view from the focused bearing ruler (its "Camera heading" slider). */
const RULER_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

/** The visitor took over: pause, if there is a tour to pause (at home before lift-off, or at a stop). */
function takeOver() {
  const s = useApp.getState();
  if (s.phase !== 'flight' || !s.autoTour || s.tourPaused) return;
  if (s.flight.stage === 'prologue' || s.flight.stage === 'site') s.pauseTour();
}

/** Runs the tour (nothing to render: the dock and the top bar show its marks). */
export function AutoTour() {
  useEffect(() => {
    let run: Run = { key: '', step: 'idle', at: 0, i: 0, speech: null, said: '', ms: 0, answered: false };
    let held = false;
    const tick = () => {
      const s = useApp.getState();
      const now = Date.now();
      const key = stageKey(s);
      if (key !== run.key) {
        useTour.setState({ ...NO_TOUR });
        run = { key, step: 'intro', at: now, i: 0, speech: null, said: '', ms: 0, answered: false };
        held = false;
        byHand = false;
      }
      if (!s.autoTour || s.tourPaused) {
        if (!held) {
          held = true;
          useTour.setState({ chapter: null, countdown: null, nudge: false, invite: false });
        }
        // A section picked by the visitor: stop reading the one the tour was on.
        if (run.step === 'chapter' && run.speech && s.story !== run.i) {
          run.speech.stop();
          run.speech = null;
        }
        // Paused by a touch: pick up again by itself once nothing has been touched for a while.
        const stage = s.flight.stage;
        if (s.autoTour && s.tourPaused && (stage === 'prologue' || stage === 'site')) {
          const busy = busyElsewhere(s);
          if (shouldAutoResume({ idleMs: now - lastInput, byHand, busy })) {
            useTour.setState({ resumeAt: null });
            s.resumeTour();
            return;
          }
          const at = byHand || busy ? null : lastInput + IDLE_RESUME_MS;
          if (useTour.getState().resumeAt !== at) useTour.setState({ resumeAt: at });
        } else if (useTour.getState().resumeAt !== null) useTour.setState({ resumeAt: null });
        return;
      }
      if (held) {
        held = false;
        byHand = false;
        useTour.setState({ resumeAt: null });
        resume(run, s, now);
      }
      if (s.flight.stage === 'prologue') prologue(run, s, now);
      else if (s.flight.stage === 'site') site(run, s, now);
    };
    const id = window.setInterval(tick, 150);
    return () => {
      window.clearInterval(id);
      useTour.setState({ ...NO_TOUR });
    };
  }, []);

  // One touch takes over: the view (the 3D stage, its hotspots), the bearing ruler, the dossier,
  // the scout camera, the flying keys, the ruler's own keys when it has focus. (The story tabs
  // pause it themselves, in the dock.)
  useEffect(() => {
    const touchInvite = (t: EventTarget | null) => {
      if (t instanceof Element && t.closest('.tour-invite')) inviteTouch = Date.now();
    };
    const down = (e: Event) => {
      const t = e.target;
      lastInput = Date.now();
      touchInvite(t);
      if (t instanceof Element && t.closest('.stage, .brg, .dossier-toggle')) takeOver();
    };
    const moved = () => {
      lastInput = Date.now();
    };
    const changed = (e: Event) => touchInvite(e.target);
    const key = (e: KeyboardEvent) => {
      const t = e.target;
      lastInput = Date.now();
      touchInvite(t);
      if (t instanceof Element && t.closest('.brg')) {
        if (RULER_KEYS.has(e.key)) takeOver();
        return;
      }
      if (isTyping(t) || !FLY_KEYS.has(e.code)) return;
      if (useApp.getState().flight.stage === 'site') takeOver();
    };
    let scout = useApp.getState().scoutCam;
    const unsub = useApp.subscribe(s => {
      if (s.scoutCam && !scout) takeOver();
      scout = s.scoutCam;
    });
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('wheel', down, { capture: true, passive: true });
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointermove', moved, { capture: true, passive: true });
    window.addEventListener('input', changed, true);
    return () => {
      unsub();
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('wheel', down, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointermove', moved, true);
      window.removeEventListener('input', changed, true);
    };
  }, []);
  return null;
}

/** The auto tour's switch for the top bar, and its resume button while the visitor has taken over. */
export function TourToggle() {
  const on = useApp(s => s.autoTour);
  const paused = useApp(s => s.tourPaused);
  const setAutoTour = useApp(s => s.setAutoTour);
  const resumeTour = useApp(s => s.resumeTour);
  const resumeLeft = useResumeLeft();
  return (
    <div className="tour-toggle" role="group" aria-label="Auto tour">
      {on && paused && (
        <button
          type="button"
          className="icon-btn glyph-btn tour-resume hud-tip"
          onClick={resumeTour}
          aria-label={resumeLeft !== null ? `Resume auto tour, resuming in ${resumeLeft} seconds` : 'Resume auto tour'}
          data-tip={resumeLeft !== null ? `Resuming in ${resumeLeft} s` : 'Resume auto tour'}
        >
          <PlayGlyph />
          {resumeLeft !== null && (
            <span className="tabular tour-resume-left" aria-hidden="true">
              {resumeLeft}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        className={`icon-btn glyph-btn tour-switch hud-tip${on ? ' on' : ''}${paused ? ' paused' : ''}`}
        aria-label="Auto tour"
        aria-pressed={on}
        onClick={() => setAutoTour(!on)}
        data-tip={on ? (paused ? 'Auto tour paused · switch off' : 'Auto tour on · switch off') : 'Auto tour off · switch on'}
      >
        <TourSwitchGlyph on={on} paused={paused} />
      </button>
    </div>
  );
}

/** Seconds before a paused tour picks up by itself, in the last RESUME_NOTICE_MS only; null otherwise. */
function useResumeLeft(): number | null {
  const at = useTour(s => s.resumeAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [at]);
  if (at === null) return null;
  const left = at - now;
  return left <= RESUME_NOTICE_MS ? Math.max(1, Math.ceil(left / 1000)) : null;
}

/** Seconds left on the tour's countdown, updated a few times a second; null when there is none. */
export function useCountdownLeft(): number | null {
  const cd = useTour(s => s.countdown);
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!cd) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [cd]);
  return cd ? Math.max(0, Math.ceil((cd.at + cd.ms - Date.now()) / 1000)) : null;
}
