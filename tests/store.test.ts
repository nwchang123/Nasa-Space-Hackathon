import { beforeEach, describe, expect, it } from 'vitest';
import { MACHINE_BY_ID } from '../src/data/machines';
import { HOME, LEGS, TOTAL_KM, greatCircleKm, hop } from '../src/flight/route';
import { currentStop, standingAt, useApp } from '../src/store';
import { MACHINE_IDS } from '../src/types';

const app = () => useApp.getState();

beforeEach(() => {
  app().reset();
  app().startFlight();
});

describe('direct hops', () => {
  it('uses the planned leg when starting from its planned origin', () => {
    const h = hop(HOME, 0);
    expect(h.onRoute).toBe(true);
    expect(h.distanceKm).toBe(LEGS[0].distanceKm);
  });

  it('measures a direct hop from wherever we stand', () => {
    const i = MACHINE_IDS.indexOf('opportunity');
    const h = hop(HOME, i);
    expect(h.onRoute).toBe(false);
    expect(h.to).toBe('opportunity');
    expect(h.distanceKm).toBeCloseTo(greatCircleKm(MACHINE_BY_ID[HOME], MACHINE_BY_ID.opportunity), 6);
  });
});

describe('flight state', () => {
  it('stands at home before take-off and nowhere while flying', () => {
    expect(standingAt(app().flight)).toBe(HOME);
    app().flyTo(0, 1000);
    expect(app().flight.from).toBe(HOME);
    expect(standingAt(app().flight)).toBeNull();
    app().arrive();
    expect(standingAt(app().flight)).toBe(MACHINE_IDS[0]);
    expect(currentStop(app().flight)).toBe(MACHINE_IDS[0]);
  });

  it('adds up the planned route exactly when every leg is flown in order', () => {
    MACHINE_IDS.forEach((_, i) => {
      app().flyTo(i, 0);
      app().arrive();
    });
    expect(app().flownKm).toBeCloseTo(TOTAL_KM, 6);
    expect(Object.keys(app().visited)).toHaveLength(MACHINE_IDS.length);
  });

  it('counts a direct hop by its own distance, once, and resumes the route from there', () => {
    const i = MACHINE_IDS.indexOf('insight');
    app().flyTo(i, 0, HOME);
    app().arrive();
    app().arrive(); // a second arrive (e.g. Skip racing the animation) must not count twice
    expect(app().flownKm).toBeCloseTo(hop(HOME, i).distanceKm, 6);
    expect(app().visited).toEqual({ insight: true });
    app().flyTo(i + 1, 0);
    expect(app().flight.from).toBe('insight');
    expect(hop(app().flight.from, i + 1).onRoute).toBe(true);
  });

  it('starts every new flight from zero', () => {
    app().flyTo(0, 0);
    app().arrive();
    app().startFlight();
    expect(app().flownKm).toBe(0);
    expect(app().flight.stage).toBe('prologue');
    expect(app().flight.from).toBe(HOME);
  });
});
