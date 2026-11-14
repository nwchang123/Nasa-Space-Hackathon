import { describe, expect, it } from 'vitest';
import { MACHINE_BY_ID } from '../src/data/machines';
import type { Machine } from '../src/types';
import {
  MAX_WAIT_S,
  formatDate,
  formatDistance,
  formatDuration,
  formatSolarTime,
  formatSpeedup,
  laserHint,
  planCall,
} from '../src/ui/callPlan';
import { buildTimeline, countsAt } from '../src/ui/timeline';
import { MACHINES } from '../src/data/machines';

const NOW = new Date('2026-11-14T07:00:00Z');
const apollo11 = MACHINE_BY_ID['apollo-11'];
const opportunity = MACHINE_BY_ID['opportunity'];
const pioneer10 = MACHINE_BY_ID['pioneer-10'];
const moonNoReflector: Machine = { ...apollo11, id: 'apollo-17', reflector: false };

describe('calling a machine', () => {
  it('waits the real Moon round trip, about 2.5 s, in real time', () => {
    const plan = planCall(apollo11, 'radio', NOW);
    expect(plan.speedup).toBe(1);
    expect(plan.waitMs).toBeGreaterThan(2370);
    expect(plan.waitMs).toBeLessThan(2730);
  });

  it('radio calls are never answered', () => {
    for (const m of [apollo11, opportunity, pioneer10]) expect(planCall(m, 'radio', NOW).result).toBe('silent');
  });

  it('the laser echoes only from a reflector', () => {
    expect(planCall(apollo11, 'laser', NOW).result).toBe('echo');
    expect(planCall(moonNoReflector, 'laser', NOW).result).toBe('silent');
  });

  it('the laser is not available beyond the Moon', () => {
    const mars = planCall(opportunity, 'laser', NOW);
    expect(mars.available).toBe(false);
    expect(mars.unavailableReason).toMatch(/Moon/);
    expect(planCall(pioneer10, 'laser', NOW).available).toBe(false);
  });

  it('long Mars waits are compressed to the console limit and say by how much', () => {
    const plan = planCall(opportunity, 'radio', NOW);
    expect(plan.waitMs).toBe(MAX_WAIT_S * 1000);
    expect(plan.speedup).not.toBeNull();
    expect(plan.speedup!).toBeGreaterThan(30);
    expect(plan.speedup! * MAX_WAIT_S).toBeCloseTo(plan.path.roundTripS!, 6);
  });

  it('hints at the laser after a silent radio call to a reflector site, once', () => {
    const plan = planCall(apollo11, 'radio', NOW);
    expect(laserHint(apollo11, plan, false)).toMatch(/laser/i);
    expect(laserHint(apollo11, plan, true)).toBeNull();
    expect(laserHint(moonNoReflector, planCall(moonNoReflector, 'radio', NOW), false)).toBeNull();
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
    expect(formatDistance(142 * 149_597_870.7)).toBe('142 AU · 21.2 billion km');
    expect(formatSpeedup(344.2)).toBe('344×');
    expect(formatSpeedup(23_612)).toBe('23,600×');
    expect(formatSolarTime(15.7)).toBe('15:42');
    expect(formatSolarTime(23.999)).toBe('00:00');
  });
});

describe('opening time-lapse', () => {
  it('has an arrival and a last signal for every machine, in date order', () => {
    const events = buildTimeline(MACHINES);
    expect(events).toHaveLength(MACHINES.length * 2);
    for (let i = 1; i < events.length; i++) expect(events[i].year).toBeGreaterThanOrEqual(events[i - 1].year);
  });

  it('counts machines left behind and still talking', () => {
    expect(countsAt(MACHINES, 1960)).toEqual({ left: 0, working: 0 });
    const now = countsAt(MACHINES, 2026.87);
    expect(now.left).toBe(MACHINES.length);
    expect(now.working).toBe(0);
  });
});
