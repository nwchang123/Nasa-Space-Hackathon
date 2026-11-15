// Synthesized sound for Flight 73. No audio files; nothing plays until the visitor has clicked.
// Every source goes through one master chain (gain → compressor/limiter → speakers), so the whole
// mix is loud and full without clipping, and muting silences everything at once, continuous loops
// (the ambient pad, Mars wind, Ingenuity's rotors, the charge hum) included. Short feedback cues
// also pass through a "presence" stage (a little upper-mid lift) so they cut through the beds.

import {
  chordFor,
  chordMoves,
  chordSeconds,
  midiHz,
  PAD_ATTACK_S,
  PAD_CUTOFF_DRIFT_HZ,
  PAD_CUTOFF_HZ,
  PAD_DETUNE_CENTS,
  PAD_DRIFT_HZ,
  PAD_DRY,
  PAD_PANS,
  PAD_REVERB_S,
  PAD_VOICE_PEAK,
  PAD_WET,
  padDuck,
  timeConstant,
  type VoiceMove,
} from './ambientScore';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let presence: AudioNode | null = null;
let muted = false;

/** Master loudness: about 8× the original console level; the limiter keeps stacked cues clean. */
const MASTER_GAIN = 8;

export function setMuted(value: boolean) {
  muted = value;
  if (ctx && master) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(value ? 0 : MASTER_GAIN, t + 0.06);
    if (!value && ctx.state === 'suspended') void ctx.resume();
  }
}

export function isMuted() {
  return muted;
}

/** True once the page has had a click or key press (browsers block sound before that). */
function hadGesture(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  if (!ctx && !hadGesture()) return null;
  try {
    if (!ctx) {
      const a = new AudioContext();
      const comp = a.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 6;
      comp.ratio.value = 14;
      comp.attack.value = 0.003;
      comp.release.value = 0.22;
      const m = a.createGain();
      m.gain.value = MASTER_GAIN;
      m.connect(comp).connect(a.destination);
      // Presence for the cues: clear the mud below, lift the upper mids a little.
      const hp = a.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 90;
      hp.Q.value = 0.6;
      const mid = a.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1600;
      mid.Q.value = 0.8;
      mid.gain.value = 3;
      const shelf = a.createBiquadFilter();
      shelf.type = 'highshelf';
      shelf.frequency.value = 2600;
      shelf.gain.value = 4;
      hp.connect(mid).connect(shelf).connect(m);
      ctx = a;
      master = m;
      presence = hp;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** The master bus, for full-range sources (loops, the quake's rumble). Only after audio(). */
function out(): AudioNode {
  return master!;
}

/** The cue bus (with presence). Only after audio(). */
function cue(): AudioNode {
  return presence ?? master!;
}

/** One enveloped oscillator note on the cue bus (or `dest`). */
function tone(
  freq: number,
  start: number,
  length: number,
  gain: number,
  type: OscillatorType = 'sine',
  endFreq?: number,
  dest?: AudioNode,
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + length);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(dest ?? cue());
  osc.start(t);
  osc.stop(t + length + 0.05);
}

/** Short noise buffer, shaped by `env(i / n)`. */
function noise(a: AudioContext, seconds: number, env: (k: number) => number): AudioBuffer {
  const n = Math.max(1, Math.floor(a.sampleRate * seconds));
  const buffer = a.createBuffer(1, n, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * env(i / n);
  return buffer;
}

/** Play a noise buffer through a filter at `gain`, `at` seconds from now (cue bus unless `dest`). */
function burst(
  a: AudioContext,
  buffer: AudioBuffer,
  filterType: BiquadFilterType,
  freq: number,
  gain: number,
  at = 0,
  q = 0.8,
  dest?: AudioNode,
): { filter: BiquadFilterNode; src: AudioBufferSourceNode } {
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buffer;
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(dest ?? cue());
  src.start(a.currentTime + at);
  return { filter, src };
}

/** A long looping pink-ish noise buffer, shared by the wind and the rotor loops. */
let loopNoise: AudioBuffer | null = null;
function pinkLoop(a: AudioContext): AudioBuffer {
  if (loopNoise && loopNoise.sampleRate === a.sampleRate) return loopNoise;
  const n = Math.floor(a.sampleRate * 6);
  const buffer = a.createBuffer(1, n, a.sampleRate);
  const d = buffer.getChannelData(0);
  // Paul Kellet's economy pink filter.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  loopNoise = buffer;
  return buffer;
}

// ---------------------------------------------------------------- console cues

/** Outgoing call. */
export function playSend(channel: 'radio' | 'laser') {
  if (channel === 'laser') {
    tone(1760, 0, 0.14, 0.11, 'triangle');
    tone(2637, 0.05, 0.22, 0.08, 'sine');
  } else {
    tone(880, 0, 0.24, 0.13);
    tone(1760, 0, 0.12, 0.03, 'triangle');
    tone(880, 0.28, 0.24, 0.1);
    tone(1760, 0.28, 0.12, 0.025, 'triangle');
  }
}

/** Nothing came back: a short burst of soft static. */
export function playSilence() {
  const a = audio();
  if (!a) return;
  burst(a, noise(a, 0.7, k => (k < 0.04 ? k * 25 : 1) * (1 - k)), 'bandpass', 1800, 0.1, 0, 0.7);
}

// ---- Version 3 cues

/** The rotor motor's whine, kept so the fault can wind it down. */
let motor: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode } | null = null;

function stopMotor(a: AudioContext, overSeconds: number) {
  const m = motor;
  if (!m) return;
  motor = null;
  const t = a.currentTime;
  m.osc.frequency.cancelScheduledValues(t);
  m.sub.frequency.cancelScheduledValues(t);
  m.gain.gain.cancelScheduledValues(t);
  m.osc.frequency.setValueAtTime(m.osc.frequency.value, t);
  m.sub.frequency.setValueAtTime(m.sub.frequency.value, t);
  m.gain.gain.setValueAtTime(m.gain.gain.value, t);
  m.osc.frequency.exponentialRampToValueAtTime(40, t + overSeconds);
  m.sub.frequency.exponentialRampToValueAtTime(20, t + overSeconds);
  m.gain.gain.exponentialRampToValueAtTime(0.0001, t + overSeconds);
  m.osc.stop(t + overSeconds + 0.05);
  m.sub.stop(t + overSeconds + 0.05);
}

/** Rotor motor spinning up over `ms` (a rising whine that holds, short of flight speed). */
export function playSpinUp(ms: number) {
  const a = audio();
  if (!a) return;
  stopMotor(a, 0.05);
  const t = a.currentTime;
  const up = Math.max(0.1, ms / 1000);
  const osc = a.createOscillator();
  const sub = a.createOscillator();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  osc.type = 'sawtooth';
  sub.type = 'triangle';
  filter.type = 'lowpass';
  filter.frequency.value = 1100;
  osc.frequency.setValueAtTime(55, t);
  osc.frequency.exponentialRampToValueAtTime(310, t + up);
  sub.frequency.setValueAtTime(28, t);
  sub.frequency.exponentialRampToValueAtTime(155, t + up);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.07, t + Math.min(0.3, up));
  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain).connect(out());
  osc.start(t);
  sub.start(t);
  // It never reaches flight speed; if nothing stops it, it fades out on its own.
  osc.stop(t + up + 6);
  sub.stop(t + up + 6);
  gain.gain.setValueAtTime(0.07, t + up + 4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + up + 6);
  motor = { osc, sub, gain };
}

/** Rotor fault: a two-tone alarm, a rattle, and the whine winding down. */
export function playFault() {
  const a = audio();
  if (!a) return;
  stopMotor(a, 1.8);
  for (let i = 0; i < 3; i++) {
    tone(988, i * 0.28, 0.13, 0.085, 'square');
    tone(740, i * 0.28 + 0.13, 0.13, 0.075, 'square');
  }
  burst(a, noise(a, 0.8, k => (1 - k) * (0.6 + 0.4 * Math.sin(k * 90))), 'lowpass', 520, 0.16);
  burst(a, noise(a, 0.5, k => (1 - k) ** 2 * (0.5 + 0.5 * Math.sin(k * 140))), 'bandpass', 1900, 0.06, 0.02, 1.1);
}

/** The prologue's red zone: one short, urgent warning beep pair (call it on a beat while it lasts). */
export function playRedZone() {
  tone(1480, 0, 0.09, 0.075, 'square');
  tone(1480, 0.12, 0.09, 0.06, 'square');
}

/** A low rumble (InSight's marsquake pulse); `k` 0..1 scales its strength and length. */
export function playQuake(k = 1) {
  const a = audio();
  if (!a) return;
  const x = Math.min(1, Math.max(0.05, k));
  const t = a.currentTime;
  const len = 1.1 + 1.4 * x;
  const peak = 0.07 + 0.13 * x;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(48, t);
  osc.frequency.exponentialRampToValueAtTime(29, t + len * 0.95);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(out());
  osc.start(t);
  osc.stop(t + len + 0.05);
  // Ground roar and the crackle of shaken grit, so the quake is heard on small speakers too.
  burst(a, noise(a, len * 0.9, u => (u < 0.05 ? u * 20 : 1) * (1 - u) ** 2), 'lowpass', 160, 0.12 + 0.16 * x, 0, 0.8, out());
  burst(a, noise(a, len * 0.7, u => (1 - u) ** 2.5 * (Math.random() < 0.08 ? 1 : 0.25)), 'bandpass', 380, 0.05 + 0.08 * x, 0.04, 1);
}

/** A camera shutter: the release click, the curtain, a second click, and the film motor winding on. */
export function playShutter() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  burst(a, noise(a, 0.008, k => 1 - k), 'highpass', 2800, 0.2, 0);
  const curtain = burst(a, noise(a, 0.045, k => Math.sin(Math.PI * k)), 'bandpass', 5200, 0.12, 0.012, 1.2);
  curtain.filter.frequency.setValueAtTime(5200, t + 0.012);
  curtain.filter.frequency.exponentialRampToValueAtTime(1900, t + 0.057);
  burst(a, noise(a, 0.01, k => 1 - k), 'highpass', 2200, 0.16, 0.066);
  tone(210, 0.07, 0.03, 0.05, 'triangle');
  // Tiny motor winding on.
  const m = a.createOscillator();
  const bp = a.createBiquadFilter();
  const g = a.createGain();
  const s = t + 0.11;
  m.type = 'sawtooth';
  m.frequency.setValueAtTime(170, s);
  m.frequency.linearRampToValueAtTime(260, s + 0.2);
  bp.type = 'bandpass';
  bp.frequency.value = 1300;
  bp.Q.value = 1.1;
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(0.045, s + 0.02);
  g.gain.setValueAtTime(0.045, s + 0.17);
  g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
  m.connect(bp).connect(g).connect(cue());
  m.start(s);
  m.stop(s + 0.25);
}

/** A soft scanning tone over `ms` (Viking 1's first photo, built up a line at a time). */
export function playScan(ms: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = Math.max(0.2, ms / 1000);
  const osc = a.createOscillator();
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  const g = a.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 660;
  lfo.frequency.value = 7;
  lfoGain.gain.value = 18;
  lfo.connect(lfoGain).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04, t + 0.12);
  g.gain.setValueAtTime(0.04, t + Math.max(0.12, len - 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(cue());
  osc.start(t);
  lfo.start(t);
  osc.stop(t + len + 0.05);
  lfo.stop(t + len + 0.05);
}

/** A reflector answered. */
export function playEcho() {
  tone(1318.5, 0, 0.5, 0.12);
  tone(1975.5, 0.12, 0.7, 0.1);
  tone(2637, 0.24, 0.9, 0.07);
}

// ---------------------------------------------------------------- the guide's radio

let tickBuffer: AudioBuffer | null = null;
let lastTick = 0;
let voiceSounding = false;

/** Called by the voice module while Ingenuity's recorded voice is actually playing. */
export function setVoiceSounding(on: boolean) {
  voiceSounding = on;
  followVoice();
}

/**
 * The typing ticks' level (1 = the original click). Quiet on their own; under Ingenuity's voice
 * they only keep time, so the voice leads.
 */
export function typeTickLevel(underVoice: boolean): number {
  return underVoice ? 0.07 : 0.35;
}

function voiceAudible(): boolean {
  return voiceSounding || (typeof window !== 'undefined' && !!window.speechSynthesis?.speaking);
}

/** One typewriter / telegraph click (call every couple of typed characters; self-throttled). */
export function playTypeTick() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (t - lastTick < 0.028) return;
  lastTick = t;
  if (!tickBuffer || tickBuffer.sampleRate !== a.sampleRate) tickBuffer = noise(a, 0.012, k => (1 - k) ** 3);
  const k = typeTickLevel(voiceAudible());
  const r = 0.85 + Math.random() * 0.3;
  const { src } = burst(a, tickBuffer, 'bandpass', 3600 * r, 0.1 * k, 0, 1.4);
  src.playbackRate.value = r;
  tone(1900 * r, 0, 0.022, 0.026 * k, 'square');
}

/** A guide bubble opens: a burst of radio squelch, then two quick beeps. */
export function playRadioOpen() {
  const a = audio();
  if (!a) return;
  burst(a, noise(a, 0.14, k => (k < 0.1 ? k * 10 : 1) * (1 - k) ** 1.5), 'bandpass', 1500, 0.13, 0, 0.7);
  tone(1046.5, 0.12, 0.07, 0.075, 'square');
  tone(1568, 0.2, 0.09, 0.065, 'square');
}

/** The bubble closes: a short squelch tail. */
export function playRadioClose() {
  const a = audio();
  if (!a) return;
  burst(a, noise(a, 0.09, k => (1 - k) ** 2), 'bandpass', 1300, 0.1, 0, 0.7);
  tone(784, 0.02, 0.06, 0.045, 'square');
}

/** Ingenuity reacts: a bright rising telemetry chirp. */
export function playChirp() {
  tone(1318.5, 0, 0.06, 0.085, 'triangle');
  tone(1760, 0.07, 0.06, 0.085, 'triangle');
  tone(2349, 0.14, 0.13, 0.095, 'triangle');
}

// ---------------------------------------------------------------- camera, scanner, HUD

/** The camera pushes in on a part: a rising whoosh with a scanner sweep. */
export function playFocusIn() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const { filter } = burst(a, noise(a, 0.7, k => Math.sin(Math.PI * Math.min(1, k * 1.25)) ** 2), 'bandpass', 300, 0.17, 0, 1.2);
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
  tone(420, 0.08, 0.55, 0.045, 'sine', 1680);
  tone(1680, 0.62, 0.08, 0.05, 'triangle');
}

/** The camera pulls back to the wide view: a falling whoosh. */
export function playFocusOut() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const { filter } = burst(a, noise(a, 0.7, k => Math.sin(Math.PI * Math.min(1, k * 1.25)) ** 2), 'bandpass', 2200, 0.15, 0, 1.2);
  filter.frequency.setValueAtTime(2200, t);
  filter.frequency.exponentialRampToValueAtTime(260, t + 0.6);
  tone(1400, 0.05, 0.5, 0.04, 'sine', 380);
}

/** A soft, shimmering scanner hum for about `ms` (Ingenuity's scanner beam on a part). */
export function playScanBeam(ms: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = Math.max(0.3, ms / 1000);
  const g = a.createGain();
  const trem = a.createGain();
  const lfo = a.createOscillator();
  const lfoDepth = a.createGain();
  lfo.frequency.value = 9;
  lfoDepth.gain.value = 0.35;
  trem.gain.value = 0.65;
  lfo.connect(lfoDepth).connect(trem.gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.035, t + 0.25);
  g.gain.setValueAtTime(0.035, t + Math.max(0.3, len - 0.35));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  trem.connect(g).connect(cue());
  const voices: [number, OscillatorType][] = [
    [520, 'sine'],
    [523.5, 'sine'],
    [1040, 'triangle'],
  ];
  for (const [f, type] of voices) {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(trem);
    o.start(t);
    o.stop(t + len + 0.05);
  }
  lfo.start(t);
  lfo.stop(t + len + 0.05);
}

let detentBuffer: AudioBuffer | null = null;
let lastDetent = 0;

/**
 * One precision detent: a very short, clean mechanical tick whose pitch follows `v` (0..1).
 * `soft` for the background ones (orbit, zoom). Self-guarded against stacking (≥ 20 ms apart).
 */
export function playDetent(v: number, soft = false) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (t - lastDetent < 0.02) return;
  lastDetent = t;
  const x = Math.min(1, Math.max(0, v));
  if (!detentBuffer || detentBuffer.sampleRate !== a.sampleRate) detentBuffer = noise(a, 0.006, k => (1 - k) ** 4);
  const k = soft ? 0.5 : 1;
  burst(a, detentBuffer, 'highpass', 4200, 0.12 * k, 0, 0.7);
  tone(1500 + 1700 * x, 0, 0.028, 0.045 * k, 'sine');
}

/** The Scout Cam viewfinder: up = a servo whirr and a two-beep autofocus lock; down = a soft click. */
export function playViewfinder(on: boolean) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (!on) {
    burst(a, noise(a, 0.012, k => 1 - k), 'highpass', 2600, 0.1);
    tone(900, 0.01, 0.07, 0.035, 'triangle', 600);
    return;
  }
  const m = a.createOscillator();
  const bp = a.createBiquadFilter();
  const g = a.createGain();
  m.type = 'sawtooth';
  m.frequency.setValueAtTime(260, t);
  m.frequency.exponentialRampToValueAtTime(560, t + 0.18);
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 1.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
  g.gain.setValueAtTime(0.05, t + 0.16);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  m.connect(bp).connect(g).connect(cue());
  m.start(t);
  m.stop(t + 0.22);
  tone(2093, 0.26, 0.05, 0.07, 'square');
  tone(2093, 0.34, 0.07, 0.07, 'square');
}

/** A short sonar-like ping, clear but soft (the bearing bar finds a hidden side). */
export function playLocate() {
  const a = audio();
  if (!a) return;
  tone(1480, 0, 0.55, 0.075, 'sine', 1400);
  tone(2960, 0, 0.12, 0.02, 'sine');
  tone(1480, 0.22, 0.4, 0.025, 'sine', 1400);
}

// ---------------------------------------------------------------- continuous loops

interface Loop {
  last: number;
  lastP: number;
  lastAt: number;
  update(v: number, p: number, t: number): void;
}

/** Smoothly move a loop to `v` (and pitch `p`), at most ~25 times a second (callers may call every frame). */
function drive(loop: Loop, v: number, p = 1) {
  const a = ctx;
  if (!a) return;
  const t = a.currentTime;
  const changed = Math.abs(v - loop.last) > 0.01 || Math.abs(p - loop.lastP) > 0.01 || (v === 0 && loop.last !== 0);
  if (!changed || t - loop.lastAt < 0.04) return;
  loop.last = v;
  loop.lastP = p;
  loop.lastAt = t;
  loop.update(v, p, t);
}

/**
 * The continuous beds' full levels, before the master gain. Kept under the voice and the cues.
 * Rendered through the master chain: the rotors only need to say the helicopter is flying (about
 * 14 dB under Ingenuity's voice at cruise, a few dB under the ambient pad), and the wind is a faint
 * texture under the pad (about 10 dB under it at a site, 14 dB under the voice at the height of
 * Opportunity's storm).
 */
const ROTOR_BED = 0.016;
const WIND_BED = 0.018;
const WIND_WHISTLE = 0.1;

let rotorLoop: Loop | null = null;

/**
 * Ingenuity's rotors, continuously: blade-pass thump, a buzzy drone and a motor whine.
 * `speed` 0..1.2 sets loudness and blade rate smoothly (0 is silent); `pitch` scales every
 * frequency (1 = normal; boost raises it, a careful hover lowers it). Created lazily on first use.
 */
export function setRotorLoop(speed: number, pitch = 1) {
  const s = Math.min(1.2, Math.max(0, speed));
  const p = Math.min(1.6, Math.max(0.6, pitch));
  if (!rotorLoop) {
    if (s < 0.01) return;
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const level = a.createGain();
    level.gain.value = 0;
    level.connect(out());
    // Buzzy drone at the blade-pass rate.
    const saw = a.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 40;
    const sawLp = a.createBiquadFilter();
    sawLp.type = 'lowpass';
    sawLp.frequency.value = 520;
    const sawG = a.createGain();
    sawG.gain.value = 0.32;
    saw.connect(sawLp).connect(sawG).connect(level);
    // Chopping air: band-passed noise, amplitude-modulated at the blade-pass rate.
    const src = a.createBufferSource();
    src.buffer = pinkLoop(a);
    src.loop = true;
    const band = a.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.7;
    const chop = a.createGain();
    chop.gain.value = 0.55;
    const am = a.createOscillator();
    am.type = 'triangle';
    am.frequency.value = 40;
    const amDepth = a.createGain();
    amDepth.gain.value = 0.45;
    am.connect(amDepth).connect(chop.gain);
    src.connect(band).connect(chop).connect(level);
    // Motor whine.
    const whine = a.createOscillator();
    whine.type = 'triangle';
    whine.frequency.value = 240;
    const whineG = a.createGain();
    whineG.gain.value = 0.06;
    whine.connect(whineG).connect(level);
    saw.start(t);
    src.start(t);
    am.start(t);
    whine.start(t);
    rotorLoop = {
      last: 0,
      lastP: 1,
      lastAt: -1,
      update(v, pm, at) {
        const r = Math.min(1, v);
        const bp = (26 + 58 * r) * pm; // blade-pass rate on screen, Hz
        level.gain.setTargetAtTime(ROTOR_BED * v ** 0.8, at, 0.09);
        saw.frequency.setTargetAtTime(bp, at, 0.12);
        am.frequency.setTargetAtTime(bp, at, 0.12);
        sawLp.frequency.setTargetAtTime(420 + 300 * r * pm, at, 0.15);
        whine.frequency.setTargetAtTime((160 + 320 * r) * pm, at, 0.15);
        band.frequency.setTargetAtTime((450 + 650 * r) * pm, at, 0.15);
      },
    };
  }
  drive(rotorLoop, s, p);
}

let windLoop: Loop | null = null;

/** The Mars wind bed, continuously: thin, gusty, filtered noise. `level` 0..1, smooth. Created lazily. */
export function setWind(level: number) {
  const v = Math.min(1, Math.max(0, level));
  if (!windLoop) {
    if (v < 0.01) return;
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const lvl = a.createGain();
    lvl.gain.value = 0;
    lvl.connect(out());
    const src = a.createBufferSource();
    src.buffer = pinkLoop(a);
    src.loop = true;
    src.playbackRate.value = 0.7;
    const band = a.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 380;
    band.Q.value = 0.55;
    const gust = a.createGain();
    gust.gain.value = 0.7;
    // Two slow, unrelated LFOs: gusts that never repeat exactly.
    for (const [f, d] of [
      [0.07, 0.22],
      [0.19, 0.12],
    ] as const) {
      const lfo = a.createOscillator();
      lfo.frequency.value = f;
      const depth = a.createGain();
      depth.gain.value = d;
      lfo.connect(depth).connect(gust.gain);
      lfo.start(t);
    }
    src.connect(band).connect(gust).connect(lvl);
    // A faint whistle riding the gusts.
    const whistle = a.createBiquadFilter();
    whistle.type = 'bandpass';
    whistle.frequency.value = 900;
    whistle.Q.value = 5;
    const wg = a.createGain();
    wg.gain.value = WIND_WHISTLE;
    band.connect(whistle).connect(wg).connect(gust);
    src.start(t);
    windLoop = {
      last: 0,
      lastP: 1,
      lastAt: -1,
      update(x, _p, at) {
        lvl.gain.setTargetAtTime(WIND_BED * x, at, 0.6);
        band.frequency.setTargetAtTime(300 + 520 * x, at, 0.8);
        whistle.frequency.setTargetAtTime(760 + 700 * x, at, 0.8);
      },
    };
  }
  drive(windLoop, v);
}

// ---- the ambient pad (the score is in ambientScore.ts)

/**
 * The pad's full level before the master chain. Rendered offline through that chain (gain 8 and
 * the compressor, whose make-up gain lifts quiet beds too): about 9 dB under the speech level of
 * Ingenuity's recorded voice in flight, 11 dB at a site, about 19 dB under it while ducked. It is
 * the flight's background music, so it sits clearly above the wind.
 */
const AMBIENT_BED = 0.011;
/** How slowly the pad comes up or goes down with the scene, s (time constant). */
const AMBIENT_FADE_TC = 1;

export interface Pad {
  /** The pad's level gain (set by setAmbience; 0 when built). */
  level: GainNode;
  /** Schedule the chord changes up to `until`, s on the audio clock. */
  scheduleUntil(until: number): void;
  /** Step back under Ingenuity's voice, or return. */
  setDuck(underVoice: boolean, at: number): void;
}

/** A short reverb tail: stereo noise that decays and darkens. */
function reverbImpulse(a: BaseAudioContext): AudioBuffer {
  const n = Math.floor(a.sampleRate * PAD_REVERB_S);
  const b = a.createBuffer(2, n, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.45 * k);
      d[i] = lp * Math.exp(-4 * k) * (1 - k);
    }
  }
  return b;
}

/**
 * The ambient pad on `a`, into `dest`: four voices of two detuned saws, spread left to right,
 * through a slowly drifting low-pass and a short reverb. Silent until scheduled; the level starts
 * at 0. Also rendered offline, to measure it against the voice.
 */
export function createPad(a: BaseAudioContext, dest: AudioNode): Pad {
  const t0 = a.currentTime;
  const level = a.createGain();
  level.gain.value = 0;
  const duck = a.createGain();
  level.connect(duck).connect(dest);

  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = PAD_CUTOFF_HZ;
  filter.Q.value = 0.5;
  const drift = a.createOscillator();
  drift.frequency.value = PAD_DRIFT_HZ;
  const depth = a.createGain();
  depth.gain.value = PAD_CUTOFF_DRIFT_HZ;
  drift.connect(depth).connect(filter.frequency);
  drift.start(t0);

  const dry = a.createGain();
  dry.gain.value = PAD_DRY;
  const verb = a.createConvolver();
  verb.buffer = reverbImpulse(a);
  const wet = a.createGain();
  wet.gain.value = PAD_WET;
  filter.connect(dry).connect(level);
  filter.connect(verb).connect(wet).connect(level);

  const voices = PAD_PANS.map(pan => {
    const env = a.createGain();
    env.gain.value = 0;
    const oscs = PAD_DETUNE_CENTS.map(cents => {
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = cents;
      o.connect(env);
      o.start(t0);
      return o;
    });
    if (typeof a.createStereoPanner === 'function') {
      const p = a.createStereoPanner();
      p.pan.value = pan;
      env.connect(p).connect(filter);
    } else {
      env.connect(filter);
    }
    return { env, oscs };
  });

  const play = (moves: VoiceMove[]) => {
    for (const m of moves) {
      const v = voices[m.voice];
      if (m.retuneAt > m.releaseAt) v.env.gain.setTargetAtTime(0, m.releaseAt, timeConstant(m.retuneAt - m.releaseAt));
      for (const o of v.oscs) o.frequency.setValueAtTime(midiHz(m.midi), m.retuneAt);
      v.env.gain.setTargetAtTime(PAD_VOICE_PEAK, m.retuneAt, timeConstant(PAD_ATTACK_S));
    }
  };

  let step = 0;
  let held: readonly number[] | null = null;
  let nextAt = t0 + 0.05;
  return {
    level,
    scheduleUntil(until) {
      // A throttled timer (a background tab) may come late: start the next change now.
      if (nextAt < a.currentTime) nextAt = a.currentTime + 0.05;
      while (nextAt <= until) {
        const chord = chordFor(step);
        play(chordMoves(held, chord, nextAt));
        held = chord;
        nextAt += chordSeconds(step);
        step++;
      }
    },
    setDuck(underVoice, at) {
      const d = padDuck(underVoice);
      duck.gain.setTargetAtTime(d.gain, at, timeConstant(d.seconds));
    },
  };
}

let pad: { pad: Pad; loop: Loop } | null = null;
let padDucked = false;

/** Duck the pad while Ingenuity's voice is heard (called on the voice's own events, and polled). */
function followVoice() {
  if (!pad || !ctx) return;
  const under = voiceAudible();
  if (under === padDucked) return;
  padDucked = under;
  pad.pad.setDuck(under, ctx.currentTime);
}

/**
 * The ambient pad, continuously: slow chords under everything. `level` 0..1 (see ambientLevel),
 * smooth. Created lazily on the first non-zero level after the visitor's first click; its chords
 * then run on their own clock.
 */
export function setAmbience(level: number) {
  const v = Math.min(1, Math.max(0, level));
  if (!pad) {
    if (v < 0.01) return;
    const a = audio();
    if (!a) return;
    const p = createPad(a, out());
    pad = {
      pad: p,
      loop: {
        last: 0,
        lastP: 1,
        lastAt: -1,
        update(x, _p, at) {
          p.level.gain.setTargetAtTime(AMBIENT_BED * x, at, AMBIENT_FADE_TC);
        },
      },
    };
    const tick = () => {
      p.scheduleUntil(a.currentTime + 1);
      followVoice();
    };
    tick();
    window.setInterval(tick, 250);
  }
  drive(pad.loop, v);
}

let chargeLoop: Loop | null = null;

/** A hold-to-charge action building up: a rising whine over a pulsing hum. `level` 0..1; 0 is silent. */
export function setChargeLoop(level: number) {
  const v = Math.min(1, Math.max(0, level));
  if (!chargeLoop) {
    if (v < 0.01) return;
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const lvl = a.createGain();
    lvl.gain.value = 0;
    lvl.connect(cue());
    const hum = a.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 70;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const pulse = a.createGain();
    pulse.gain.value = 0.6;
    const lfo = a.createOscillator();
    lfo.frequency.value = 3;
    const depth = a.createGain();
    depth.gain.value = 0.35;
    lfo.connect(depth).connect(pulse.gain);
    hum.connect(lp).connect(pulse).connect(lvl);
    const whine = a.createOscillator();
    whine.type = 'triangle';
    whine.frequency.value = 300;
    const wg = a.createGain();
    wg.gain.value = 0.35;
    whine.connect(wg).connect(lvl);
    hum.start(t);
    lfo.start(t);
    whine.start(t);
    chargeLoop = {
      last: 0,
      lastP: 1,
      lastAt: -1,
      update(x, _p, at) {
        lvl.gain.setTargetAtTime(x > 0 ? 0.03 + 0.07 * x : 0, at, x > 0 ? 0.06 : 0.04);
        hum.frequency.setTargetAtTime(60 + 70 * x, at, 0.08);
        lp.frequency.setTargetAtTime(320 + 900 * x, at, 0.08);
        lfo.frequency.setTargetAtTime(2.5 + 10 * x, at, 0.1);
        whine.frequency.setTargetAtTime(280 + 900 * x, at, 0.08);
      },
    };
  }
  drive(chargeLoop, v);
}

// ---------------------------------------------------------------- signature actions

/** Viking 2's frost: an icy, crystalline shimmer. */
export function playFrost() {
  const a = audio();
  if (!a) return;
  for (let i = 0; i < 9; i++) {
    const f = 2400 + Math.random() * 2800;
    tone(f, i * 0.07 + Math.random() * 0.04, 0.35 + Math.random() * 0.3, 0.028, 'sine');
  }
  burst(a, noise(a, 0.9, k => Math.sin(Math.PI * k) ** 2), 'highpass', 6000, 0.06);
}

let lastRoll = 0;
/** One small motor/wheel tick (Sojourner on the ramp). Self-throttled; call on every slider move. */
export function playRollTick() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (t - lastRoll < 0.07) return;
  lastRoll = t;
  tone(150 + Math.random() * 25, 0, 0.05, 0.08, 'square');
  burst(a, noise(a, 0.02, k => 1 - k), 'bandpass', 2600, 0.06, 0.01, 1.5);
}

let lastGrain = 0;
/**
 * One short grain of a slider-driven texture, for continuous pulls: 'scrape' (a dragged wheel
 * grinding soil), 'dig' (a scoop biting into soil). `amount` 0..1 scales it. Self-throttled.
 */
export function playGrain(kind: 'scrape' | 'dig', amount = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (t - lastGrain < 0.075) return;
  lastGrain = t;
  const x = Math.min(1, Math.max(0.2, amount));
  if (kind === 'scrape') {
    burst(a, noise(a, 0.11, k => (k < 0.1 ? k * 10 : 1) * (1 - k) * (0.4 + 0.6 * Math.random())), 'lowpass', 900, 0.15 * x);
    burst(a, noise(a, 0.08, k => (1 - k) * (Math.random() < 0.1 ? 1 : 0.3)), 'bandpass', 2400, 0.05 * x, 0, 1.2);
    tone(58 + Math.random() * 10, 0, 0.1, 0.04 * x, 'sawtooth', undefined, out());
  } else {
    burst(a, noise(a, 0.16, k => (k < 0.05 ? k * 20 : 1) * (1 - k) ** 2 * (0.5 + 0.5 * Math.random())), 'lowpass', 750 + Math.random() * 400, 0.16 * x);
    tone(100 + Math.random() * 25, 0, 0.1, 0.05 * x, 'sine', undefined, out());
  }
}

/** Spirit's dragged wheel grinding through soil, for about `ms`. */
export function playScrape(ms: number) {
  const a = audio();
  if (!a) return;
  const len = Math.min(8, Math.max(0.4, ms / 1000));
  // Grit: noise chopped into uneven grains.
  let grain = 1;
  const buf = noise(a, len, k => {
    if (Math.random() < 0.004) grain = 0.35 + Math.random() * 0.65;
    return Math.min(1, k * 12) * Math.min(1, (1 - k) * 6) * grain;
  });
  burst(a, buf, 'lowpass', 900, 0.15);
  burst(a, buf, 'bandpass', 2400, 0.05, 0, 1.2);
  // A low groan from the motor straining.
  const t = a.currentTime;
  const o = a.createOscillator();
  const lfo = a.createOscillator();
  const lfoD = a.createGain();
  const lp = a.createBiquadFilter();
  const g = a.createGain();
  o.type = 'sawtooth';
  o.frequency.value = 62;
  lfo.frequency.value = 2.3;
  lfoD.gain.value = 9;
  lfo.connect(lfoD).connect(o.frequency);
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.3);
  g.gain.setValueAtTime(0.05, t + len - 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(lp).connect(g).connect(out());
  o.start(t);
  lfo.start(t);
  o.stop(t + len + 0.05);
  lfo.stop(t + len + 0.05);
}

/** Phoenix's scoop crunching into the soil, spread over the first part of `ms`. */
export function playDig(ms: number) {
  const a = audio();
  if (!a) return;
  const span = Math.max(0.6, (ms / 1000) * 0.55);
  const n = Math.max(3, Math.round(span / 0.55));
  for (let i = 0; i < n; i++) {
    const at = (i * span) / n + Math.random() * 0.12;
    const env = (k: number) => (k < 0.05 ? k * 20 : 1) * (1 - k) ** 2 * (0.5 + 0.5 * Math.random());
    burst(a, noise(a, 0.22, env), 'lowpass', 700 + Math.random() * 500, 0.16, at);
    tone(95 + Math.random() * 30, at, 0.12, 0.05, 'sine', undefined, out());
  }
  // The arm's servo, under the scoops.
  tone(420, 0, span, 0.012, 'square', 520);
}

/** InSight's LaRRI reflector catches a laser: a zap and a bright return ping. */
export function playLaserPing() {
  tone(4200, 0, 0.09, 0.05, 'sawtooth', 1500);
  tone(2637, 0.1, 0.45, 0.09, 'sine');
  tone(3951, 0.28, 0.6, 0.05, 'sine');
}

/** A gust of the dust storm; louder and lower as `k` (0..1) rises. */
export function playStormGust(k: number) {
  const a = audio();
  if (!a) return;
  const x = Math.min(1, Math.max(0, k));
  const t = a.currentTime;
  const f0 = 500 + 700 * x;
  const { filter } = burst(a, noise(a, 1.3, u => Math.sin(Math.PI * u) ** 1.5), 'bandpass', f0, 0.06 + 0.16 * x, 0, 0.6, out());
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(300 + 400 * x, t + 1.2);
}

/** A small switch click; a higher note for on, lower for off. */
export function playToggle(on: boolean) {
  const a = audio();
  if (!a) return;
  burst(a, noise(a, 0.012, k => 1 - k), 'highpass', 3000, 0.11);
  tone(on ? 1250 : 820, 0.008, 0.08, 0.06, 'triangle');
}
