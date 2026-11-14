// Pure rules behind the signature actions (unit-tested in tests/signatures.test.ts): timing of
// button effects, Opportunity's dust-storm sky, and the readouts the HUD shows.

import type { RGB, SkyLook } from '../sites';

/** Progress 0..1 of a button effect pressed at `at` (Date.now()), or null if never pressed. */
export function buttonProgress(at: number | undefined, durationMs: number, now: number, reduced: boolean): number | null {
  if (at === undefined) return null;
  if (reduced) return 1;
  return Math.min(1, Math.max(0, (now - at) / durationMs));
}

/** 0..1 within [a, b] of a progress value (clamped). */
export function phase(p: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}

export const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- Opportunity, June 2018

/** The slider's range: from a hazy day (tau 1) to the storm's peak over Opportunity. */
export const STORM_TAU_MIN = 1;
export const STORM_TAU_MAX = 11;
/** JPL's estimate over Opportunity on the morning of 10 June 2018, the day of its last signal. */
export const LAST_SIGNAL_TAU = 10.8;

/**
 * Direct sunlight through a dust layer of optical depth `tau`, relative to a tau-1 day, with the
 * Sun overhead (Beer–Lambert: e^(−Δτ)). A simple model: it ignores the scattered skylight that
 * still reaches the ground in a real storm.
 */
export function directSunlight(tau: number): number {
  return Math.exp(-(Math.max(STORM_TAU_MIN, tau) - STORM_TAU_MIN));
}

/** "4.2 %", "0.06 %", "< 0.01 %". */
export function formatPercent(x: number): string {
  const pct = x * 100;
  if (pct >= 10) return `${Math.round(pct)} %`;
  if (pct >= 1) return `${pct.toFixed(1)} %`;
  if (pct >= 0.01) return `${pct.toFixed(2)} %`;
  return '< 0.01 %';
}

export function stormReadout(tau: number | undefined): string {
  const t = tau ?? STORM_TAU_MIN;
  const pct = formatPercent(directSunlight(t));
  const base = `Tau ${t.toFixed(1)} · direct sunlight ${pct.startsWith('<') ? pct : `≈ ${pct}`} of a tau-1 day (simple model)`;
  return t >= LAST_SIGNAL_TAU - 0.05 ? `${base} · tau ≈ ${LAST_SIGNAL_TAU} on 10 June 2018: Opportunity’s last signal` : base;
}

const STORM_HAZE: RGB = [0.46, 0.22, 0.11];
const STORM_DARK: RGB = [0.06, 0.028, 0.016];

/**
 * The site's sky and light under the storm: the sky goes red-brown and then nearly black, the
 * Sun's disc and glow fade out, the haze closes in, and only a dim, reddish skylight is left.
 * Returns a new look (never mutates `look`). tau ≤ 1 (or undefined) leaves the look unchanged.
 */
export function stormLook(look: SkyLook, tau: number | undefined): SkyLook {
  if (tau === undefined || tau <= STORM_TAU_MIN) return look;
  const k = Math.min(1, (tau - STORM_TAU_MIN) / (STORM_TAU_MAX - STORM_TAU_MIN));
  const w = smooth(0, 0.3, k);
  const sky = mix(STORM_HAZE, STORM_DARK, smooth(0.35, 1, k));
  // The light on screen falls off more gently than direct sunlight (the readout's model): in a
  // real storm much of the light still arrives scattered by the dust.
  const light = Math.exp(-0.38 * (tau - STORM_TAU_MIN));
  const horizon = mix(look.horizon, sky, w);
  return {
    ...look,
    zenith: mix(look.zenith, [sky[0] * 0.7, sky[1] * 0.7, sky[2] * 0.7], w),
    horizon,
    glow: mix(look.glow, sky, w),
    glowStrength: look.glowStrength * Math.sqrt(light),
    sunUp: directSunlight(tau) < 0.002 ? 0 : look.sunUp,
    sunColor: mix(look.sunColor, [1, 0.5, 0.26], w),
    sunIntensity: look.sunIntensity * light,
    ambientSky: mix(look.ambientSky, [0.5, 0.26, 0.15], w),
    ambientGround: mix(look.ambientGround, [0.16, 0.08, 0.05], w),
    ambientIntensity: look.ambientIntensity * (1 - 0.62 * Math.pow(k, 1.5)),
    stars: look.stars * (1 - w),
    domeOpacity: look.domeOpacity + (1 - look.domeOpacity) * w,
    fog: horizon,
    fogNearM: (look.fogNearM ?? 25) + (2 - (look.fogNearM ?? 25)) * Math.pow(k, 0.6),
    fogFarM: (look.fogFarM ?? 110) + (16 - (look.fogFarM ?? 110)) * Math.pow(k, 0.6),
  };
}

// ---------------------------------------------------------------- Perseverance's parachute

/** What each ring of gores spells, inner to outer (NASA's decoded image, PIA24431). */
export const PARACHUTE_RINGS = ['DARE', 'MIGHTY', 'THINGS', '34°11′58″N 118°10′31″W'] as const;

/** How many rings are decoded at progress p (0..1): one after another, the last at ~85 %. */
export function ringsDecoded(p: number): number {
  return Math.min(PARACHUTE_RINGS.length, Math.floor(p / 0.2125));
}

// ---------------------------------------------------------------- Ingenuity's day

/** The daily routine its last software update set (INGB), in order. */
export const WAKE_STEPS = ['Wake up', 'Solar panel: tested', 'Batteries: tested', 'Colour photo taken', 'Temperatures logged'] as const;

/** How many routine steps are done at progress p (0..1). */
export function wakeStepsDone(p: number): number {
  if (p <= 0) return 0;
  return Math.min(WAKE_STEPS.length, 1 + Math.floor((p / 0.9) * (WAKE_STEPS.length - 1)));
}

// ---------------------------------------------------------------- Sojourner off the ramp

export interface RoverPathPoint {
  /** 'ramp': rolling down; 'drive': forward on the ground; 'back': reversing to the rock. */
  leg: 'ramp' | 'drive' | 'back';
  /** Progress along the ramp, 0..1 (ramp leg only). */
  ramp: number;
  /** Distance along the ramp's direction from its foot, m (ground legs). */
  s: number;
  /** Sideways offset from that line, m (toward the rock's side). */
  lat: number;
  /** d(lat)/d(s): how much the heading turns from the ramp's direction. */
  slope: number;
}

/**
 * Sojourner's path (m, from the ramp's foot): forward past the rock (at rockS along, rockSide
 * aside), a swerve onto the rock's line, then backing up until its rear is just short of it.
 */
export const ROVER_PATH = { rockS: 2.1, driveEnd: 3.55, swerveFrom: 2.45, swerveTo: 3.35, rockSide: 0.62, stopAt: 2.68 } as const;

/** Where the slider (0..1) puts Sojourner on its way from the ramp's top to Barnacle Bill. */
export function sojournerPath(p: number): RoverPathPoint {
  const { driveEnd, swerveFrom, swerveTo, rockSide, stopAt } = ROVER_PATH;
  const q = Math.min(1, Math.max(0, p));
  const lateral = (s: number) => rockSide * smooth(swerveFrom, swerveTo, s);
  if (q < 0.25) return { leg: 'ramp', ramp: q / 0.25, s: 0, lat: 0, slope: 0 };
  if (q < 0.76) {
    const s = 0.15 + (driveEnd - 0.15) * phase(q, 0.25, 0.7);
    const t = Math.min(1, Math.max(0, (s - swerveFrom) / (swerveTo - swerveFrom)));
    const slope = (rockSide * 6 * t * (1 - t)) / (swerveTo - swerveFrom);
    return { leg: 'drive', ramp: 1, s, lat: lateral(s), slope };
  }
  const s = driveEnd + (stopAt - driveEnd) * phase(q, 0.78, 1);
  return { leg: 'back', ramp: 1, s, lat: rockSide, slope: 0 };
}
