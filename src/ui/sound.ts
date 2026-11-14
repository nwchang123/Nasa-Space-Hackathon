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

/** A reflector answered. */
export function playEcho() {
  tone(1318.5, 0, 0.5, 0.06);
  tone(1975.5, 0.12, 0.7, 0.05);
  tone(2637, 0.24, 0.9, 0.035);
}
