// Time scales.
// TT = TAI + 32.184 s; TAI − UTC from the IERS leap-second list (Bulletin C).
// Before 1972 UTC had no integer leap seconds; 10 s is used there (error < 10 s, irrelevant here).

const LEAP_SECONDS: ReadonlyArray<readonly [number, number]> = [
  [Date.UTC(1972, 0, 1), 10],
  [Date.UTC(1972, 6, 1), 11],
  [Date.UTC(1973, 0, 1), 12],
  [Date.UTC(1974, 0, 1), 13],
  [Date.UTC(1975, 0, 1), 14],
  [Date.UTC(1976, 0, 1), 15],
  [Date.UTC(1977, 0, 1), 16],
  [Date.UTC(1978, 0, 1), 17],
  [Date.UTC(1979, 0, 1), 18],
  [Date.UTC(1980, 0, 1), 19],
  [Date.UTC(1981, 6, 1), 20],
  [Date.UTC(1982, 6, 1), 21],
  [Date.UTC(1983, 6, 1), 22],
  [Date.UTC(1985, 6, 1), 23],
  [Date.UTC(1988, 0, 1), 24],
  [Date.UTC(1990, 0, 1), 25],
  [Date.UTC(1991, 0, 1), 26],
  [Date.UTC(1992, 6, 1), 27],
  [Date.UTC(1993, 6, 1), 28],
  [Date.UTC(1994, 6, 1), 29],
  [Date.UTC(1996, 0, 1), 30],
  [Date.UTC(1997, 6, 1), 31],
  [Date.UTC(1999, 0, 1), 32],
  [Date.UTC(2006, 0, 1), 33],
  [Date.UTC(2009, 0, 1), 34],
  [Date.UTC(2012, 6, 1), 35],
  [Date.UTC(2015, 6, 1), 36],
  [Date.UTC(2017, 0, 1), 37],
];

export const J2000 = 2451545.0;
export const MS_PER_DAY = 86_400_000;

/** TT − UTC in seconds for a UTC instant (ms since 1970). */
export function ttMinusUtcSeconds(ms: number): number {
  let tai = 10;
  for (const [t, s] of LEAP_SECONDS) if (ms >= t) tai = s;
  return tai + 32.184;
}

/** Julian Date (UT) for a JS Date. */
export function jdUT(date: Date): number {
  return 2440587.5 + date.getTime() / MS_PER_DAY;
}

/** Julian Ephemeris Date (TT) for a JS Date. */
export function jdTT(date: Date): number {
  return jdUT(date) + ttMinusUtcSeconds(date.getTime()) / 86400;
}

/** Julian centuries of TT since J2000.0. */
export function centuriesTT(jde: number): number {
  return (jde - J2000) / 36525;
}
