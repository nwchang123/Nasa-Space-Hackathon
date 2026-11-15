// The ambient pad's score: chords, timing, voice moves, the duck under Ingenuity's voice, levels.

import { describe, expect, it } from 'vitest';
import {
  AMBIENT_LEVEL,
  ambientLevel,
  chordFor,
  chordMoves,
  chordSeconds,
  dbGain,
  midiHz,
  PAD_ATTACK_S,
  PAD_CHORDS,
  PAD_CUTOFF_DRIFT_HZ,
  PAD_CUTOFF_HZ,
  PAD_DUCK_DB,
  PAD_PANS,
  PAD_RELEASE_S,
  PAD_VOICES,
  padDuck,
  timeConstant,
} from '../src/ui/ambientScore';

describe('ambient pad chords', () => {
  it('voices every chord in a low, soft register without semitone rubs', () => {
    for (const chord of PAD_CHORDS) {
      expect(chord).toHaveLength(PAD_VOICES);
      expect(new Set(chord).size).toBe(PAD_VOICES);
      const sorted = [...chord].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThan(1);
      for (const m of chord) {
        expect(midiHz(m)).toBeGreaterThan(80);
        expect(midiHz(m)).toBeLessThan(400);
      }
    }
  });

  it('holds A3 in every chord as a drone that never moves', () => {
    for (const chord of PAD_CHORDS) expect(chord[2]).toBe(57);
    expect(midiHz(57)).toBeCloseTo(220, 6);
    for (let s = 0; s < PAD_CHORDS.length; s++) expect(chordMoves(chordFor(s), chordFor(s + 1), 0).some(m => m.voice === 2)).toBe(false);
  });

  it('changes chord every 12 to 16 s, unevenly, and cycles', () => {
    const lengths = Array.from({ length: 12 }, (_, s) => chordSeconds(s));
    for (const l of lengths) {
      expect(l).toBeGreaterThanOrEqual(12);
      expect(l).toBeLessThanOrEqual(16);
    }
    expect(new Set(lengths).size).toBeGreaterThan(2);
    expect(chordFor(PAD_CHORDS.length)).toBe(chordFor(0));
    expect(chordFor(-1)).toBe(chordFor(PAD_CHORDS.length - 1));
  });
});

describe('ambient pad voice moves', () => {
  it('fades every voice in from silence at the start', () => {
    const moves = chordMoves(null, chordFor(0), 10);
    expect(moves.map(m => m.voice)).toEqual([0, 1, 2, 3]);
    for (const m of moves) {
      expect(m.retuneAt).toBe(m.releaseAt);
      expect(m.peakAt - m.retuneAt).toBeCloseTo(PAD_ATTACK_S, 9);
    }
  });

  it('moves only the voices that change, one after another, with 4 to 6 s fades', () => {
    expect(PAD_RELEASE_S).toBeGreaterThanOrEqual(4);
    expect(PAD_RELEASE_S).toBeLessThanOrEqual(6);
    expect(PAD_ATTACK_S).toBeGreaterThanOrEqual(4);
    expect(PAD_ATTACK_S).toBeLessThanOrEqual(6);
    for (let s = 0; s < PAD_CHORDS.length; s++) {
      const from = chordFor(s);
      const to = chordFor(s + 1);
      const moves = chordMoves(from, to, 100);
      expect(moves.length).toBe(to.filter((m, v) => m !== from[v]).length);
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        expect(m.midi).toBe(to[m.voice]);
        expect(m.retuneAt - m.releaseAt).toBeCloseTo(PAD_RELEASE_S, 9);
        if (i > 0) expect(m.releaseAt).toBeGreaterThan(moves[i - 1].releaseAt);
        // Settled before the next change, even after the shortest chord.
        expect(m.peakAt - 100).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('ambient pad levels', () => {
  it('steps back 8 to 10 dB under the voice, fast, and returns slowly', () => {
    expect(PAD_DUCK_DB).toBeLessThanOrEqual(-8);
    expect(PAD_DUCK_DB).toBeGreaterThanOrEqual(-10);
    const down = padDuck(true);
    const up = padDuck(false);
    expect(down.gain).toBeCloseTo(dbGain(PAD_DUCK_DB), 9);
    expect(up.gain).toBe(1);
    expect(down.seconds).toBeLessThan(up.seconds);
    expect(timeConstant(down.seconds)).toBeCloseTo(0.1, 9);
    expect(timeConstant(up.seconds)).toBeCloseTo(0.4, 9);
  });

  it('is fullest in flight, a little lower at a site, quietest in the hangar', () => {
    expect(ambientLevel(0)).toBe(AMBIENT_LEVEL.flight);
    expect(ambientLevel(1)).toBe(AMBIENT_LEVEL.site);
    expect(ambientLevel(0.5)).toBeLessThan(AMBIENT_LEVEL.flight);
    expect(ambientLevel(0.5)).toBeGreaterThan(AMBIENT_LEVEL.site);
    expect(ambientLevel(-3)).toBe(AMBIENT_LEVEL.flight);
    expect(AMBIENT_LEVEL.hangar).toBeLessThan(AMBIENT_LEVEL.site);
  });

  it('keeps the low-pass drifting inside about 600 to 900 Hz, and the voices spread', () => {
    expect(PAD_CUTOFF_HZ - PAD_CUTOFF_DRIFT_HZ).toBeGreaterThanOrEqual(580);
    expect(PAD_CUTOFF_HZ + PAD_CUTOFF_DRIFT_HZ).toBeLessThanOrEqual(920);
    expect(PAD_PANS).toHaveLength(PAD_VOICES);
    for (const p of PAD_PANS) expect(Math.abs(p)).toBeLessThan(1);
  });
});
