import { describe, expect, it } from 'vitest';
import { Choreographer, OPENING_DESCENT_MS, OPENING_FRAME_MAX_MS } from '../src/scene/choreo';
import type { FlightState } from '../src/store';
import { IDLE_RESUME_MS, INVITE_WAIT_MS, NO_TOUR, shouldAutoResume } from '../src/ui/tour';

describe('the opening on its own clock', () => {
  const prologue: FlightState = { leg: -1, stage: 'prologue', from: 'ingenuity', stageStartedAt: 0, flyMs: 0 };

  /** Run the opening at 60 fps, with one long stalled frame `stallMs` long at `stallAt`. */
  function run(stallAt: number, stallMs: number) {
    const c = new Choreographer();
    c.update('title', prologue, -16, false);
    const blends: number[] = [];
    let t = 0;
    let stalled = false;
    while (t < OPENING_DESCENT_MS + stallMs + 2000) {
      blends.push(c.update('flight', prologue, t, false).blend);
      t += !stalled && t >= stallAt ? ((stalled = true), stallMs) : 16;
    }
    return blends;
  }

  it('never leaps across a slow frame: the dive waits for it and carries on', () => {
    const blends = run(1500, 750);
    let maxStep = 0;
    for (let i = 1; i < blends.length; i++) maxStep = Math.max(maxStep, blends[i] - blends[i - 1]);
    // A 750 ms frame on the wall clock would jump the shot by a third of the dive.
    expect(maxStep).toBeLessThan(0.04);
    expect(blends[blends.length - 1]).toBe(1);
  });

  it('runs at the normal pace when frames are smooth', () => {
    const blends = run(Infinity, 0);
    const landed = blends.findIndex(b => b >= 1);
    expect(landed * 16).toBeGreaterThan(OPENING_DESCENT_MS - 100);
    expect(landed * 16).toBeLessThan(OPENING_DESCENT_MS + 100);
  });

  it('advances at most a frame’s worth per update', () => {
    expect(OPENING_FRAME_MAX_MS).toBeGreaterThanOrEqual(33);
    expect(OPENING_FRAME_MAX_MS).toBeLessThanOrEqual(50);
  });

  it('carries its clock on the shot, for the camera’s turn onto Jezero', () => {
    const c = new Choreographer();
    c.update('title', prologue, -16, false);
    c.update('flight', prologue, 0, false);
    const shot = c.update('flight', prologue, 5000, false);
    expect(shot.opening).toBe(OPENING_FRAME_MAX_MS);
  });
});

describe('the auto tour never holds a visitor who only watches', () => {
  it('offers a stop’s action for a while, then moves on', () => {
    expect(INVITE_WAIT_MS).toBeGreaterThanOrEqual(8000);
    expect(INVITE_WAIT_MS).toBeLessThanOrEqual(20000);
    expect(NO_TOUR.inviteAt).toBe(0);
    expect(NO_TOUR.resumeAt).toBeNull();
  });

  it('picks up again by itself after a touch, once nothing has been touched for a while', () => {
    expect(shouldAutoResume({ idleMs: IDLE_RESUME_MS - 1, byHand: false, busy: false })).toBe(false);
    expect(shouldAutoResume({ idleMs: IDLE_RESUME_MS, byHand: false, busy: false })).toBe(true);
  });

  it('but never after an explicit Pause, nor while the visitor is busy elsewhere', () => {
    expect(shouldAutoResume({ idleMs: IDLE_RESUME_MS * 10, byHand: true, busy: false })).toBe(false);
    expect(shouldAutoResume({ idleMs: IDLE_RESUME_MS * 10, byHand: false, busy: true })).toBe(false);
  });
});
