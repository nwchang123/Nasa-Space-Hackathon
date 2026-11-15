// The ambient pad under Flight 73: the score only (which chord, when each voice moves, how loud,
// how far it steps back under Ingenuity's voice). Pure numbers, so it is unit-tested; sound.ts
// turns it into Web Audio. No audio files.
//
// Four voices hold a slow chord. At each change only the voices whose note changes move, one after
// another: a voice fades out, is retuned while silent, and fades back in, so the harmony morphs
// rather than jumps, and no pitch ever slides. A3 is in every chord and never moves: a quiet drone
// the whole flight hangs from.

/** The chords, MIDI notes, voice by voice (D minor with sus colours; A3 = 57 always in voice 2). */
export const PAD_CHORDS: readonly (readonly number[])[] = [
  [50, 53, 57, 60], // Dm7      D3 F3 A3 C4
  [46, 53, 57, 62], // Bbmaj7   Bb2 F3 A3 D4
  [48, 55, 57, 64], // C6/9     C3 G3 A3 E4
  [43, 50, 57, 65], // Gsus2/F  G2 D3 A3 F4
  [41, 48, 57, 64], // Fmaj7    F2 C3 A3 E4
  [45, 52, 57, 62], // Asus4    A2 E3 A3 D4
];

export const PAD_VOICES = 4;

/** How long each chord holds, s (cycled; uneven, so the changes never fall into a beat). */
const CHORD_SECONDS = [14, 12, 16, 13, 15, 12];

/** Between one moving voice and the next, s. */
export const PAD_STAGGER_S = 0.8;
/** A moving voice's fade out (to under 5 %), and its fade back in (to 95 %), s. */
export const PAD_RELEASE_S = 4.2;
export const PAD_ATTACK_S = 5;
/** A held voice's level (two detuned saws each). */
export const PAD_VOICE_PEAK = 0.5;
/** Each voice's two oscillators, cents apart from the note: a slow, cool chorus. */
export const PAD_DETUNE_CENTS: readonly [number, number] = [-6, 7];
/** Where the voices sit, left to right. */
export const PAD_PANS: readonly number[] = [-0.45, -0.15, 0.2, 0.5];

/** The low-pass over the pad: its centre, how far it drifts each way, and how slowly, Hz. */
export const PAD_CUTOFF_HZ = 750;
export const PAD_CUTOFF_DRIFT_HZ = 150;
export const PAD_DRIFT_HZ = 1 / 37;

/** The reverb: a short generated noise tail, s, and how much of it is heard against the dry pad. */
export const PAD_REVERB_S = 2.6;
export const PAD_DRY = 0.75;
export const PAD_WET = 0.5;

/** Under Ingenuity's voice the pad steps back by this much, quickly, and returns slowly. */
export const PAD_DUCK_DB = -9;
export const PAD_DUCK_DOWN_S = 0.3;
export const PAD_DUCK_UP_S = 1.2;

/** The pad's level, 0..1, by where we are: cruising, standing at a site (the wind takes more of
 * the room there), or in the AR hangar. */
export const AMBIENT_LEVEL = { flight: 1, site: 0.8, hangar: 0.55 } as const;

export function midiHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

export function dbGain(db: number): number {
  return 10 ** (db / 20);
}

/** A setTargetAtTime time constant that gets 95 % of the way in `seconds`. */
export function timeConstant(seconds: number): number {
  return seconds / 3;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

export function chordFor(step: number): readonly number[] {
  return PAD_CHORDS[wrap(step, PAD_CHORDS.length)];
}

export function chordSeconds(step: number): number {
  return CHORD_SECONDS[wrap(step, CHORD_SECONDS.length)];
}

export interface VoiceMove {
  voice: number;
  midi: number;
  /** The fade out starts. */
  releaseAt: number;
  /** Retuned (silent by now), and the fade in starts. */
  retuneAt: number;
  /** Full again. */
  peakAt: number;
}

/**
 * The voice moves for a chord change at `at` (s on the audio clock). From silence (`from` null)
 * every voice fades in; otherwise only the voices whose note changes, one after another.
 */
export function chordMoves(from: readonly number[] | null, to: readonly number[], at: number): VoiceMove[] {
  const moves: VoiceMove[] = [];
  for (let v = 0; v < PAD_VOICES; v++) {
    if (from && from[v] === to[v]) continue;
    const releaseAt = at + moves.length * PAD_STAGGER_S;
    const retuneAt = from ? releaseAt + PAD_RELEASE_S : releaseAt;
    moves.push({ voice: v, midi: to[v], releaseAt, retuneAt, peakAt: retuneAt + PAD_ATTACK_S });
  }
  return moves;
}

/** The pad's gain under Ingenuity's voice (or not), and how fast it gets there, s. */
export function padDuck(underVoice: boolean): { gain: number; seconds: number } {
  return underVoice ? { gain: dbGain(PAD_DUCK_DB), seconds: PAD_DUCK_DOWN_S } : { gain: 1, seconds: PAD_DUCK_UP_S };
}

/** The pad's level in flight: `ground` 0 cruising, 1 standing at a site. */
export function ambientLevel(ground: number): number {
  const g = Math.min(1, Math.max(0, ground));
  return AMBIENT_LEVEL.flight + (AMBIENT_LEVEL.site - AMBIENT_LEVEL.flight) * g;
}
