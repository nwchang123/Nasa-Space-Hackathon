import { describe, expect, it } from 'vitest';
import { LEG_SCRIPTS } from '../src/data/flight';
import { MACHINE_BY_ID } from '../src/data/machines';
import { LEGS, flyDurationMs } from '../src/flight/route';
import { OPENING_CENTRE_MS, OPENING_DESCENT_MS, OPENING_DIVE_AT_MS, openingCentre, openingDive } from '../src/scene/choreo';
import { descentMs } from '../src/scene/layout';
import { STORY_KEYS, useApp } from '../src/store';
import { MACHINE_IDS } from '../src/types';
import { MAX_TOUR_FLY_MS, chapterDone, readingMs, sentences, tourFlyMs } from '../src/ui/tour';
import { speechMs } from '../src/ui/voice';

describe('the opening descent', () => {
  it('turns the view onto Jezero first, then dives, as one move', () => {
    expect(openingCentre(0)).toBe(0);
    expect(openingCentre(OPENING_CENTRE_MS)).toBe(1);
    expect(openingDive(0)).toBe(0);
    expect(openingDive(OPENING_DIVE_AT_MS)).toBe(0);
    expect(openingDive(OPENING_DESCENT_MS)).toBe(1);
    // The dive starts before the turn is over (no stop in between), but not before it is well along.
    expect(OPENING_DIVE_AT_MS).toBeLessThan(OPENING_CENTRE_MS);
    expect(openingCentre(OPENING_DIVE_AT_MS)).toBeGreaterThan(0.5);
    // Both only ever move forward.
    let c = 0;
    let d = 0;
    for (let t = 0; t <= OPENING_DESCENT_MS + 100; t += 25) {
      expect(openingCentre(t)).toBeGreaterThanOrEqual(c);
      expect(openingDive(t)).toBeGreaterThanOrEqual(d);
      c = openingCentre(t);
      d = openingDive(t);
    }
  });
});

describe('the auto tour', () => {
  it('reads every story section aloud sentence by sentence, losing nothing', () => {
    for (const id of MACHINE_IDS) {
      for (const key of STORY_KEYS) {
        const text = MACHINE_BY_ID[id].story[key];
        const lines = sentences(text);
        expect(lines.length, `${id} ${key}`).toBeGreaterThan(0);
        expect(lines.join(' ').replace(/\s+/g, ' '), `${id} ${key}`).toBe(text.trim().replace(/\s+/g, ' '));
      }
    }
  });

  it('gives longer texts longer reading and speaking times', () => {
    expect(readingMs('A short line.')).toBeLessThan(readingMs('A much longer line, with a good deal more in it to read.'));
    expect(speechMs(['A short line.'])).toBeLessThan(speechMs(['A much longer line, with a good deal more in it to say aloud.']));
  });

  it("times a recorded line by its clip, and Ingenuity's other lines by an estimate", () => {
    const intro = LEG_SCRIPTS['viking-1'].arrivalIntro;
    expect(speechMs(intro)).toBe(14528);
    expect(speechMs(LEG_SCRIPTS['viking-1'].enRoute)).toBeGreaterThan(3000);
  });

  it('stretches each planned leg so its lines end before the dive into the stop', () => {
    for (const leg of LEGS) {
      const say = speechMs(LEG_SCRIPTS[leg.to].enRoute);
      const ms = tourFlyMs(leg.distanceKm, say);
      expect(ms, leg.to).toBeGreaterThanOrEqual(flyDurationMs(leg.distanceKm));
      expect(ms, leg.to).toBeLessThanOrEqual(MAX_TOUR_FLY_MS);
      if (ms < MAX_TOUR_FLY_MS) expect(say + 900 + descentMs(ms), leg.to).toBeLessThanOrEqual(ms + 1);
    }
  });

  it('moves on from a section once it has been heard, or read, or has run far too long', () => {
    expect(chapterDone(500, 8000, true)).toBe(false); // heard already? not before a short beat
    expect(chapterDone(3000, 8000, true)).toBe(true);
    expect(chapterDone(7000, 8000, false)).toBe(false);
    expect(chapterDone(8000 * 1.8 + 4000, 8000, false)).toBe(true);
  });

  it('pauses only while it is on, and a pause lasts until the next stage', () => {
    const s = useApp.getState();
    s.startFlight();
    s.setAutoTour(false);
    useApp.getState().pauseTour();
    expect(useApp.getState().tourPaused).toBe(false);
    useApp.getState().setAutoTour(true);
    useApp.getState().pauseTour();
    expect(useApp.getState().tourPaused).toBe(true);
    useApp.getState().flyTo(0, 1000);
    expect(useApp.getState().tourPaused).toBe(false);
    useApp.getState().pauseTour();
    useApp.getState().resumeTour();
    expect(useApp.getState().tourPaused).toBe(false);
    useApp.getState().reset();
  });
});
