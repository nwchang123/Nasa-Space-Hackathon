// At the first stop, while Ingenuity says its arrival intro, the site card's solar-time scale sweeps
// by itself from morning to night and back to live: the scene relights with it and the marker
// visibly moves, which tells the visitor the hour can be dragged. Once per flight (not on a revisit
// or a replay of the intro), never with reduced motion, and it hands over at once when the visitor
// touches the scale or the Live button. It writes the same store value the scale writes (siteHour).

import { useCallback, useEffect, useRef } from 'react';
import clips from '../../data/voiceClips.json';
import { useApp } from '../../store';
import type { MachineId } from '../../types';
import { useFeed } from '../tour';
import { prefersReducedMotion } from '../useClock';

/** The stop that shows the sweep: the first one. */
export const SWEEP_STOP: MachineId = 'viking-1';
/** The day the scale sweeps through, local solar hours: from morning to night. */
export const SWEEP_FROM = 6;
export const SWEEP_TO = 22;
/** The short legs from the live hour to the morning and from the night back to it. */
const LEG_MS_PER_HOUR = 110;
const LEG_MIN_MS = 600;
const LEG_MAX_MS = 1800;
const MAIN_MIN_MS = 4000;

/** As long as the recorded arrival intro at the sweep's stop, ms. */
const INTRO_MS = (() => {
  const clip = (clips as { stop: string; kind: string; duration: number }[]).find(c => c.stop === SWEEP_STOP && c.kind === 'intro');
  return clip ? clip.duration * 1000 : 14000;
})();

export interface SweepPlan {
  live: number;
  lead: number;
  main: number;
  back: number;
}

/** Lead from the live hour to morning, the day itself, then back to the live hour: about `totalMs` in all. */
export function planSweep(liveHour: number, totalMs: number): SweepPlan {
  const leg = (a: number, b: number) => Math.min(LEG_MAX_MS, Math.max(LEG_MIN_MS, Math.abs(a - b) * LEG_MS_PER_HOUR));
  const lead = leg(liveHour, SWEEP_FROM);
  const back = leg(SWEEP_TO, liveHour);
  return { live: liveHour, lead, main: Math.max(MAIN_MIN_MS, totalMs - lead - back), back };
}

const ease = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));
const mix = (a: number, b: number, k: number) => a + (b - a) * ease(k);

/** The hour `t` ms into the sweep; null once it is over (back to live). */
export function sweepHour(p: SweepPlan, t: number): number | null {
  if (t < 0) return p.live;
  if (t < p.lead) return mix(p.live, SWEEP_FROM, t / p.lead);
  t -= p.lead;
  if (t < p.main) return mix(SWEEP_FROM, SWEEP_TO, t / p.main);
  t -= p.main;
  if (t < p.back) return mix(SWEEP_TO, p.live, t / p.back);
  return null;
}

// Which arrival intro (useFeed's message id) owns this flight's sweep, and whether it is over. A new
// flight starts at the prologue. Keyed to the message, not to a mount, so React's StrictMode
// remount picks the same sweep up again while a revisit or a replay (a new message) does not.
let owner: number | null = null;
let finished = false;
useApp.subscribe(s => {
  if (s.phase === 'title' || s.flight.stage === 'prologue') {
    owner = null;
    finished = false;
  }
});

/** Runs the sweep at SWEEP_STOP during its arrival intro. Returns a stop() for the visitor's own input. */
export function useIntroSweep(stop: MachineId, liveHour: number): () => void {
  const atStop = useApp(s => s.phase === 'flight' && s.flight.stage === 'site' && stop === SWEEP_STOP);
  const introId = useFeed(s => (s.kind === 'intro' ? s.id : 0));
  const live = useRef(liveHour);
  live.current = liveHour;
  const here = useRef(atStop);
  here.current = atStop;
  const raf = useRef(0);

  // The visitor's own hand on the scale or the Live button: stop now, and no sweep later at this stop.
  const halt = useCallback(() => {
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    if (here.current) {
      owner = owner ?? -1;
      finished = true;
    }
  }, []);

  useEffect(() => {
    if (!atStop || !introId || prefersReducedMotion()) return;
    if (owner !== null && (owner !== introId || finished)) return;
    owner = introId;
    const plan = planSweep(live.current, INTRO_MS);
    const t0 = performance.now();
    const setSiteHour = useApp.getState().setSiteHour;
    const tick = () => {
      const h = sweepHour(plan, performance.now() - t0);
      if (h === null) {
        raf.current = 0;
        finished = true;
        setSiteHour(null);
        return;
      }
      setSiteHour(h);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      // Unmounted mid-sweep (or StrictMode's trial unmount): leave the scene on live time.
      if (!raf.current) return;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      setSiteHour(null);
    };
  }, [atStop, introId]);

  return halt;
}
