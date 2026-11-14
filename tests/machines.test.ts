import { describe, expect, it } from 'vitest';
import { MACHINES, MACHINE_BY_ID } from '../src/data/machines';
import { MACHINE_IDS, type MachineKind } from '../src/types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: MachineKind[] = ['Lander', 'Rover', 'Helicopter', 'Landing hardware'];
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
// Split on sentence-ending punctuation (optionally inside a closing quote) followed by a space.
// Decimals like 45.16 stay intact.
const sentences = (s: string) => s.split(/(?<=[.!?][”’"]?)\s+/).filter(Boolean);
const validDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);
const allText = (id: string) => {
  const m = MACHINE_BY_ID[id];
  return [m.name, m.site, ...Object.values(m.story), ...m.facts].join(' ');
};

describe('Flight 73 stops (Mars only)', () => {
  it('lists exactly the MACHINE_IDS, in order, with no duplicates', () => {
    expect(MACHINES.map(m => m.id)).toEqual([...MACHINE_IDS]);
    expect(new Set(MACHINES.map(m => m.id)).size).toBe(MACHINES.length);
    expect(Object.keys(MACHINE_BY_ID)).toHaveLength(MACHINE_IDS.length);
  });

  it('is in order of arrival on Mars', () => {
    const arrived = MACHINES.map(m => m.arrived);
    expect([...arrived].sort()).toEqual(arrived);
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s has well-formed fields', (_id, m) => {
    expect(m.name.length).toBeGreaterThan(0);
    expect(m.shortName.length).toBeGreaterThan(0);
    expect(m.shortName.length).toBeLessThanOrEqual(14);
    expect(KINDS).toContain(m.kind);
    expect(m.site.length).toBeGreaterThan(0);
    expect(m.plannedLife.length).toBeGreaterThan(0);
    expect(m.actualLife.length).toBeGreaterThan(0);
    if (m.lastContactLabel !== undefined) {
      expect(m.lastContactLabel.length).toBeGreaterThan(0);
      expect(m.lastContactLabel.length).toBeLessThanOrEqual(20);
    }
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s has a valid Mars position', (_id, m) => {
    expect(Number.isFinite(m.lat)).toBe(true);
    expect(Number.isFinite(m.lon)).toBe(true);
    expect(m.lat).toBeGreaterThanOrEqual(-90);
    expect(m.lat).toBeLessThanOrEqual(90);
    expect(m.lon).toBeGreaterThanOrEqual(-180);
    expect(m.lon).toBeLessThanOrEqual(180);
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
      expect(beat).not.toMatch(/\bdraft\b/i);
      expect(words(beat).length, beat).toBeLessThanOrEqual(80);
      const s = sentences(beat);
      expect(s.length, beat).toBeGreaterThanOrEqual(2);
      expect(s.length, beat).toBeLessThanOrEqual(4);
      for (const sentence of s) expect(words(sentence).length, sentence).toBeLessThanOrEqual(22);
    }
  });

  it('names the real last-contact year in every lastDay or stillHere beat', () => {
    for (const m of MACHINES) {
      const year = m.lastContact.slice(0, 4);
      expect(m.story.lastDay + ' ' + m.story.stillHere, m.id).toContain(year);
    }
  });

  it.each(MACHINES.map(m => [m.id, m] as const))('%s has 2–4 facts and https sources', (_id, m) => {
    expect(m.facts.length).toBeGreaterThanOrEqual(2);
    expect(m.facts.length).toBeLessThanOrEqual(4);
    for (const f of m.facts) expect(f).not.toMatch(/\bdraft\b/i);
    expect(m.sources.length).toBeGreaterThanOrEqual(1);
    for (const s of m.sources) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.url.startsWith('https://')).toBe(true);
    }
  });

  it('gives only the landing hardware no radio, and labels its date honestly', () => {
    expect(MACHINES.filter(m => m.noRadio).map(m => m.id)).toEqual(['mars2020-edl']);
    expect(MACHINES.filter(m => m.kind === 'Landing hardware').map(m => m.id)).toEqual(['mars2020-edl']);
    const edl = MACHINE_BY_ID['mars2020-edl'];
    expect(edl.lastContactLabel).toBeDefined();
    expect(edl.lastContactLabel).not.toMatch(/signal/i);
    expect(edl.approxPosition).toBe(true);
    expect(edl.arrived).toBe('2021-02-18');
    expect(edl.lastContact).toBe('2021-02-18');
  });

  it('tells the backshell story in the first person plural', () => {
    const story = MACHINE_BY_ID['mars2020-edl'].story;
    for (const beat of Object.values(story)) expect(beat, beat).toMatch(/\b(We|we|Our|our|us)\b/);
    expect(story.stillHere).toMatch(/Ingenuity/);
    expect(story.stillHere).toMatch(/2022/);
  });

  it('places the backshell and Ingenuity in Jezero crater, a few km apart', () => {
    const a = MACHINE_BY_ID['mars2020-edl'];
    const b = MACHINE_BY_ID.ingenuity;
    for (const m of [a, b]) {
      expect(m.site).toMatch(/Jezero/);
      expect(m.lat).toBeGreaterThan(18);
      expect(m.lat).toBeLessThan(19);
      expect(m.lon).toBeGreaterThan(77);
      expect(m.lon).toBeLessThan(78);
    }
  });

  it('does not call Ingenuity’s team farewell its last signal', () => {
    expect(MACHINE_BY_ID.ingenuity.lastContactLabel).toMatch(/team/i);
  });

  it('keeps Moon and deep-space wording out of the stories (Apollo 11 is only a date anchor)', () => {
    for (const m of MACHINES) {
      const text = allText(m.id);
      expect(text, m.id).not.toMatch(/\blunar\b|asteroid|interstellar|dwarf planet|telescope/i);
    }
    const mentionsMoon = MACHINES.filter(m => /\bMoon\b/.test(allText(m.id))).map(m => m.id);
    expect(mentionsMoon).toEqual(['viking-1']);
  });
});
