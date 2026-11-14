import { describe, expect, it } from 'vitest';
import { MACHINES, MACHINE_BY_ID } from '../src/data/machines';
import { MACHINE_IDS } from '../src/types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['Lander', 'Rover', 'Helicopter', 'Experiment package', 'Orbiter', 'Probe', 'Telescope'];
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
// Split on sentence-ending punctuation followed by a space (decimals like 45.16 stay intact).
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
const validDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);

describe('roll-call data', () => {
  it('lists exactly the MACHINE_IDS, in order, with no duplicates', () => {
    expect(MACHINES.map(m => m.id)).toEqual([...MACHINE_IDS]);
    expect(new Set(MACHINES.map(m => m.id)).size).toBe(MACHINES.length);
    expect(Object.keys(MACHINE_BY_ID)).toHaveLength(18);
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s has well-formed fields', (_id, m) => {
    expect(m.name.length).toBeGreaterThan(0);
    expect(m.shortName.length).toBeGreaterThan(0);
    expect(m.shortName.length).toBeLessThanOrEqual(14);
    expect(KINDS).toContain(m.kind);
    expect(m.site.length).toBeGreaterThan(0);
    expect(m.plannedLife.length).toBeGreaterThan(0);
    expect(m.actualLife.length).toBeGreaterThan(0);
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s has a valid position for its world', (_id, m) => {
    if (m.world === 'moon' || m.world === 'mars') {
      expect(typeof m.lat).toBe('number');
      expect(typeof m.lon).toBe('number');
      expect(m.lat!).toBeGreaterThanOrEqual(-90);
      expect(m.lat!).toBeLessThanOrEqual(90);
      expect(m.lon!).toBeGreaterThanOrEqual(-180);
      expect(m.lon!).toBeLessThanOrEqual(180);
      expect(m.deepAnchor).toBeUndefined();
    } else {
      expect(m.deepAnchor).toBeDefined();
      expect(m.lat).toBeUndefined();
      expect(m.lon).toBeUndefined();
      if (m.deepAnchor === 'outbound') {
        expect(m.headingEclipticLon).toBeGreaterThanOrEqual(0);
        expect(m.headingEclipticLon).toBeLessThan(360);
      }
    }
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s has valid, ordered UTC dates', (_id, m) => {
    for (const d of [m.launched, m.arrived, m.lastContact]) expect(validDate(d), d).toBe(true);
    expect(m.launched <= m.arrived).toBe(true);
    expect(m.arrived <= m.lastContact).toBe(true);
    expect(m.lastContact < '2026-11-15').toBe(true);
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s tells a four-beat story within length limits', (_id, m) => {
    for (const beat of [m.story.why, m.story.found, m.story.lastDay, m.story.stillHere]) {
      expect(beat.trim().length).toBeGreaterThan(0);
      expect(words(beat).length, beat).toBeLessThanOrEqual(80);
      const s = sentences(beat);
      expect(s.length, beat).toBeGreaterThanOrEqual(2);
      expect(s.length, beat).toBeLessThanOrEqual(4);
      for (const sentence of s) expect(words(sentence).length, sentence).toBeLessThanOrEqual(22);
    }
  });

  it('names the real last-contact year in every lastDay beat', () => {
    for (const m of MACHINES) {
      const year = m.lastContact.slice(0, 4);
      const text = m.story.lastDay + ' ' + m.story.stillHere;
      // Apollo stations end in 1977; the Apollo 11 seismometer in 1969; everyone else in lastDay.
      expect(text, m.id).toContain(year);
    }
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s has 2–4 facts and https sources', (_id, m) => {
    expect(m.facts.length).toBeGreaterThanOrEqual(2);
    expect(m.facts.length).toBeLessThanOrEqual(4);
    expect(m.sources.length).toBeGreaterThanOrEqual(1);
    for (const s of m.sources) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.url.startsWith('https://')).toBe(true);
    }
  });

  it('marks exactly the three Apollo laser reflectors as answering', () => {
    expect(MACHINES.filter(m => m.reflector).map(m => m.id)).toEqual(['apollo-11', 'apollo-14', 'apollo-15']);
  });

  it('never hard-codes a precise laser round-trip time in the stories', () => {
    for (const m of MACHINES) {
      const text = Object.values(m.story).join(' ');
      expect(text, m.id).not.toMatch(/2\.5\d?\s*(s|sec|second)/i);
    }
  });
});
