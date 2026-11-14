import { describe, expect, it } from 'vitest';
import { MACHINE_BY_ID } from '../src/data/machines';
import {
  MAX_WAIT_S,
  formatDate,
  formatDistance,
  formatDuration,
  formatKm,
  formatSolarTime,
  formatSpeedup,
  planCall,
  silenceLine,
  skyWords,
} from '../src/ui/callPlan';

const NOW = new Date('2026-11-14T07:00:00Z');
const opportunity = MACHINE_BY_ID['opportunity'];

describe('a radio call to Mars', () => {
  it('compresses the real round trip to the console limit and says by how much', () => {
    const plan = planCall(opportunity, NOW);
    expect(plan.waitMs).toBe(MAX_WAIT_S * 1000);
    expect(plan.path.roundTripS).toBeGreaterThan(6 * 60); // Mars is always more than 6 light-minutes away
    expect(plan.speedup! * MAX_WAIT_S).toBeCloseTo(plan.path.roundTripS!, 6);
  });

  it('uses tonight’s Earth–Mars distance (about 1.32 AU on 14 Nov 2026)', () => {
    const plan = planCall(opportunity, NOW);
    expect(plan.path.distanceKm! / 149_597_870.7).toBeCloseTo(1.32, 1);
    expect(plan.path.estimate).toBe(false);
  });

  it('reports silence with the real last-signal date', () => {
    expect(silenceLine(opportunity)).toBe('No carrier. Opportunity has not answered since 10 June 2018.');
  });
});

describe('formatting', () => {
  it('formats dates, durations, distances and speed-ups', () => {
    expect(formatDate('2018-06-10')).toBe('10 June 2018');
    expect(formatDuration(2.5634)).toBe('2.563 s');
    expect(formatDuration(2066)).toBe('34 min 26 s');
    expect(formatDuration(141_720)).toBe('39 h 22 min');
    expect(formatDistance(384_211.4)).toBe('384,211 km');
    expect(formatDistance(309_800_000)).toBe('2.07 AU · 309.8 million km');
    expect(formatKm(53_306.4)).toBe('53,306 km');
    expect(formatSpeedup(344.2)).toBe('344×');
    expect(formatSpeedup(23_612)).toBe('23,600×');
    expect(formatSolarTime(15.7)).toBe('15:42');
    expect(formatSolarTime(23.999)).toBe('00:00');
  });

  it('describes the local sky', () => {
    expect(skyWords(34.4, 15.7)).toBe('Sun 34° up · 15:42 local solar time');
    expect(skyWords(-5, 18.9)).toBe('Twilight, Sun 5° below the horizon · 18:54 local solar time');
    expect(skyWords(-40, undefined)).toBe('Night, Sun 40° below the horizon');
  });
});
