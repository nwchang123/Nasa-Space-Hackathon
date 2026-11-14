// Small synthesized console sounds. No audio files; nothing plays until the visitor clicks.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, length: number, gain: number, type: OscillatorType = 'sine') {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

/** Outgoing call. */
export function playSend(channel: 'radio' | 'laser') {
  if (channel === 'laser') {
    tone(1760, 0, 0.12, 0.05, 'triangle');
    tone(2637, 0.05, 0.18, 0.03, 'sine');
  } else {
    tone(880, 0, 0.22, 0.06);
    tone(880, 0.28, 0.22, 0.04);
  }
}

/** Nothing came back: a short burst of soft static. */
export function playSilence() {
  const a = audio();
  if (!a) return;
  const length = 0.6;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * length), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const g = a.createGain();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  g.gain.value = 0.035;
  src.buffer = buffer;
  src.connect(filter).connect(g).connect(a.destination);
  src.start();
}

// ---- Version 3 cues

/** Short noise buffer, shaped by `env(i / n)`. */
function noise(a: AudioContext, seconds: number, env: (k: number) => number): AudioBuffer {
  const n = Math.max(1, Math.floor(a.sampleRate * seconds));
  const buffer = a.createBuffer(1, n, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * env(i / n);
  return buffer;
}

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
  filter.frequency.value = 900;
  osc.frequency.setValueAtTime(55, t);
  osc.frequency.exponentialRampToValueAtTime(310, t + up);
  sub.frequency.setValueAtTime(28, t);
  sub.frequency.exponentialRampToValueAtTime(155, t + up);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.03, t + Math.min(0.3, up));
  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain).connect(a.destination);
  osc.start(t);
  sub.start(t);
  // It never reaches flight speed; if nothing stops it, it fades out on its own.
  osc.stop(t + up + 6);
  sub.stop(t + up + 6);
  gain.gain.setValueAtTime(0.03, t + up + 4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + up + 6);
  motor = { osc, sub, gain };
}

/** Rotor fault: a two-tone alarm, a rattle, and the whine winding down. */
export function playFault() {
  const a = audio();
  if (!a) return;
  stopMotor(a, 1.8);
  for (let i = 0; i < 3; i++) {
    tone(988, i * 0.28, 0.12, 0.035, 'square');
    tone(740, i * 0.28 + 0.13, 0.12, 0.03, 'square');
  }
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = noise(a, 0.7, k => (1 - k) * (0.6 + 0.4 * Math.sin(k * 90)));
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  g.gain.value = 0.05;
  src.connect(filter).connect(g).connect(a.destination);
  src.start();
}

/** A low rumble (InSight's marsquake pulse). */
export function playQuake() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(46, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 1.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + 2);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const ng = a.createGain();
  src.buffer = noise(a, 1.6, k => (1 - k) ** 2);
  filter.type = 'lowpass';
  filter.frequency.value = 140;
  ng.gain.value = 0.12;
  src.connect(filter).connect(ng).connect(a.destination);
  src.start(t);
}

/** A camera shutter click. */
export function playShutter() {
  const a = audio();
  if (!a) return;
  const click = (at: number, gain: number) => {
    const src = a.createBufferSource();
    const filter = a.createBiquadFilter();
    const g = a.createGain();
    src.buffer = noise(a, 0.035, k => 1 - k);
    filter.type = 'highpass';
    filter.frequency.value = 2400;
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(a.destination);
    src.start(a.currentTime + at);
  };
  click(0, 0.08);
  click(0.07, 0.05);
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
  g.gain.exponentialRampToValueAtTime(0.012, t + 0.15);
  g.gain.setValueAtTime(0.012, t + len - 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + len + 0.05);
  lfo.stop(t + len + 0.05);
}

/** A reflector answered. */
export function playEcho() {
  tone(1318.5, 0, 0.5, 0.06);
  tone(1975.5, 0.12, 0.7, 0.05);
  tone(2637, 0.24, 0.9, 0.035);
}
