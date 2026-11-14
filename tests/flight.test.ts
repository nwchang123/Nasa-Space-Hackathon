import { describe, expect, it } from 'vitest';
import { EPILOGUE, FICTION_NOTE, LEG_SCRIPTS, PROLOGUE } from '../src/data/flight';
import { MACHINE_BY_ID } from '../src/data/machines';
import { LEGS, interpolate } from '../src/flight/route';
import { MACHINE_IDS, type MachineId } from '../src/types';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
// Sentence ends: . ! ? (optionally inside a closing quote) followed by a space. 45.16 stays whole.
const sentences = (s: string) => s.split(/(?<=[.!?][”’"]?)\s+/).filter(Boolean);
const years = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / (365.25 * 86_400_000);
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const arrived = (id: MachineId) => MACHINE_BY_ID[id].arrived;
const legTo = (id: MachineId) => LEGS.find(l => l.to === id)!;
/** Latitudes sampled along a leg's great circle, as drawn by the scene. */
const legLats = (id: MachineId) => {
  const leg = legTo(id);
  const a = MACHINE_BY_ID[leg.from];
  const b = MACHINE_BY_ID[leg.to];
  return Array.from({ length: 201 }, (_, i) => interpolate(a, b, i / 200).lat);
};

const allLines: string[] = [
  ...PROLOGUE,
  ...EPILOGUE,
  ...MACHINE_IDS.flatMap(id => [...LEG_SCRIPTS[id].enRoute, LEG_SCRIPTS[id].inheritance]),
];

function checkLine(line: string) {
  expect(line.trim().length, line).toBeGreaterThan(0);
  expect(line, line).not.toMatch(/\bdraft\b/i);
  expect(words(line).length, line).toBeLessThanOrEqual(30);
  for (const s of sentences(line)) expect(words(s).length, s).toBeLessThanOrEqual(18);
}

describe('Flight 73 script: shape and voice', () => {
  it('has a 3–5 line prologue and epilogue', () => {
    expect(PROLOGUE.length).toBeGreaterThanOrEqual(3);
    expect(PROLOGUE.length).toBeLessThanOrEqual(5);
    expect(EPILOGUE.length).toBeGreaterThanOrEqual(3);
    expect(EPILOGUE.length).toBeLessThanOrEqual(5);
  });

  it('has a script for exactly the nine stops', () => {
    expect(Object.keys(LEG_SCRIPTS).sort()).toEqual([...MACHINE_IDS].sort());
    for (const id of MACHINE_IDS) {
      const s = LEG_SCRIPTS[id];
      expect(s.enRoute.length, id).toBeGreaterThanOrEqual(1);
      expect(s.enRoute.length, id).toBeLessThanOrEqual(3);
      expect(typeof s.inheritance).toBe('string');
    }
  });

  it.each(allLines.map(l => [l] as const))('keeps "%s" short', line => checkLine(line));

  it('puts no words in anyone’s mouth', () => {
    // Quoted names ("follow the water") are fine; a quote attributed to a speaker is not.
    const attributed = /\b(said|says|told|wrote|asked)\b[^“"]*[“"]|[”"][^“"]*\b(said|says|told|wrote)\b/i;
    for (const line of allLines) expect(line, line).not.toMatch(attributed);
  });

  it('never repeats a distance or heading the console already shows', () => {
    for (const id of MACHINE_IDS) {
      for (const line of LEG_SCRIPTS[id].enRoute) {
        expect(line, line).not.toMatch(/\d[\d,.]*\s*(km|kilomet)/i);
        expect(line, line).not.toMatch(/\bheading\b|\bbearing\b/i);
      }
    }
  });

  it('says plainly that the flight is imagined', () => {
    expect(FICTION_NOTE).toMatch(/never happened/);
    expect(PROLOGUE.join(' ')).toMatch(/imagine/);
  });
});

describe('Flight 73 script: story beats', () => {
  it('opens on the real last flight, the broken blades and the farewell downlink', () => {
    const text = PROLOGUE.join(' ');
    expect(text).toContain('18 January 2024');
    expect(text).toContain('Flight 72');
    expect(text).toMatch(/blades/);
    expect(text).toContain('16 April 2024');
    expect(PROLOGUE[PROLOGUE.length - 1]).toMatch(/Flight 73/);
  });

  it('ends on the real daily routine, SkyFall and "Still here"', () => {
    const text = EPILOGUE.join(' ');
    expect(text).toMatch(/wake/);
    expect(text).toMatch(/solar panel/);
    expect(text).toMatch(/batteries/);
    expect(text).toMatch(/photo/);
    expect(text).toMatch(/temperatures/);
    expect(text).toMatch(/SkyFall/);
    expect(EPILOGUE[EPILOGUE.length - 1]).toMatch(/Still here\.$/);
  });

  it('flies home last, and hands on to SkyFall there', () => {
    expect(LEGS[LEGS.length - 1].to).toBe('ingenuity');
    expect(LEG_SCRIPTS.ingenuity.inheritance).toMatch(/SkyFall/);
  });

  it('does not use the unsourced Viking "follow the water" link', () => {
    for (const id of ['viking-1', 'viking-2'] as const) {
      const s = LEG_SCRIPTS[id];
      expect([...s.enRoute, s.inheritance].join(' '), id).not.toMatch(/follow the water/i);
    }
  });
});

describe('Flight 73 script: claims agree with the data and the route', () => {
  it('"the longest leg of all" is the leg to Opportunity', () => {
    const longest = LEGS.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
    expect(longest.to).toBe('opportunity');
    expect(LEG_SCRIPTS.opportunity.enRoute.join(' ')).toMatch(/longest leg/);
  });

  it('"the last hop is the shortest" holds', () => {
    const shortest = LEGS.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
    expect(shortest.to).toBe('ingenuity');
    expect(shortest.index).toBe(LEGS.length - 1);
  });

  it('the leg to Viking 2 runs almost over the north pole', () => {
    expect(Math.max(...legLats('viking-2'))).toBeGreaterThan(85);
  });

  it('the leg to Opportunity passes close to the south pole', () => {
    expect(Math.min(...legLats('opportunity'))).toBeLessThan(-80);
  });

  it('the leg to Spirit crosses the equator, and Spirit is the first southern stop', () => {
    const lats = legLats('spirit');
    expect(lats[0]).toBeGreaterThan(0);
    expect(lats[lats.length - 1]).toBeLessThan(0);
    const firstSouth = MACHINE_IDS.find(id => MACHINE_BY_ID[id].lat < 0);
    expect(firstSouth).toBe('spirit');
  });

  it('the leg to Phoenix heads north again, into the arctic', () => {
    expect(MACHINE_BY_ID.phoenix.lat).toBeGreaterThan(MACHINE_BY_ID.opportunity.lat);
    expect(MACHINE_BY_ID.phoenix.lat).toBeGreaterThan(66);
  });

  it('date gaps in the lines match the data', () => {
    // "Viking 1 landed in 1976, almost 45 years before I did."
    const v1 = years(arrived('viking-1'), arrived('ingenuity'));
    expect(v1).toBeGreaterThan(44);
    expect(v1).toBeLessThan(45);
    // "From 1976 to 1980, the two Viking landers worked on Mars at the same time."
    expect(MACHINE_BY_ID['viking-2'].lastContact.slice(0, 4)).toBe('1980');
    expect(MACHINE_BY_ID['viking-1'].lastContact > MACHINE_BY_ID['viking-2'].lastContact).toBe(true);
    // "NASA did not land on Mars again for almost 21 years after the Vikings."
    const gap = years(arrived('viking-2'), arrived('pathfinder-sojourner'));
    expect(gap).toBeGreaterThan(20);
    expect(gap).toBeLessThan(21);
    // "Its twin, Opportunity, followed three weeks later."
    expect(days(arrived('spirit'), arrived('opportunity'))).toBe(21);
    // "Almost 32 years later, Phoenix went farther north"
    const ph = years(arrived('viking-2'), arrived('phoenix'));
    expect(ph).toBeGreaterThan(31);
    expect(ph).toBeLessThan(32);
    expect(MACHINE_BY_ID.phoenix.lat).toBeGreaterThan(MACHINE_BY_ID['viking-2'].lat);
    // "InSight landed in November 2018, just over two years before I did."
    const ins = years(arrived('insight'), arrived('ingenuity'));
    expect(ins).toBeGreaterThan(2);
    expect(ins).toBeLessThan(2.5);
  });
});
