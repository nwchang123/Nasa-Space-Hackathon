// Ingenuity's voice in the radio bubble: pre-recorded clips (scripts/voice/ingenuity_voice.py, a
// Kokoro voice made locally), loaded only when a stop needs them. A clip reports how far its speech
// has got, so the bubble types each line as it is heard (voiceSync.ts). A line with no clip (the
// prologue, the legs, the story sections and the way home have none) is read by the browser's own
// speech synthesis, which the bubble follows by its word events and an estimated pace. On by
// default, remembered in this browser, silent while the console sound is muted.

import clips from '../data/voiceClips.json';
import { isMuted, setVoiceSounding } from './sound';
import { charsAtTime, type VoiceClip } from './voiceSync';

const KEY = 'still-here:voiceover';
/** A clip that has not started this long after it was asked to is given up on, ms. */
const START_TIMEOUT_MS = 2500;
const VOLUME = 0.95;

const CLIPS = new Map((clips as unknown as VoiceClip[]).map(c => [c.text, c]));

type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

let enabled = stored();

const canPlayClips = () => typeof window !== 'undefined' && typeof Audio !== 'undefined';
const canSynthesize = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

export function voiceSupported(): boolean {
  return canPlayClips() || canSynthesize();
}

export function isVoiceOn(): boolean {
  return enabled && voiceSupported();
}

export function setVoice(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Private windows may refuse storage; the switch still works for this visit.
  }
  if (!on) stopSpeaking();
  for (const l of listeners) l(on);
}

export function onVoiceChange(l: Listener): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}

// ---------------------------------------------------------------- recorded clips

const elements = new Map<string, HTMLAudioElement>();
/** Which speech is using each element (a replay reuses it; an older speech must not pause the new one). */
const owners = new Map<HTMLAudioElement, Speech>();

function element(clip: VoiceClip): HTMLAudioElement {
  let a = elements.get(clip.file);
  if (!a) {
    a = new Audio();
    a.preload = 'auto';
    a.src = `${import.meta.env.BASE_URL}${clip.file}`;
    elements.set(clip.file, a);
  }
  return a;
}

/** Start loading the clips for these messages (each given as its lines), so they play on time. */
export function preloadVoice(messages: string[][]) {
  if (!isVoiceOn() || !canPlayClips()) return;
  for (const lines of messages) {
    const clip = CLIPS.get(lines.join('\n'));
    if (clip) element(clip).load();
  }
}

/** A message being spoken. */
export interface Speech {
  /** Characters of the message to show now; null once the speech has failed or been stopped (type on by the clock). */
  charsAt(): number | null;
  /** True once the clip or final utterance has finished playing; false while active; null if failed/stopped. */
  done(): boolean | null;
  stop(): void;
}

let current: Speech | null = null;

function playClip(clip: VoiceClip): Speech {
  const a = element(clip);
  const asked = performance.now();
  let state: 'loading' | 'playing' | 'ended' | 'failed' = 'loading';
  // The typing ticks step back while the voice is heard (sound.ts).
  const fail = () => {
    if (state === 'ended') return;
    if (state === 'playing') setVoiceSounding(false);
    state = 'failed';
    if (owners.get(a) === speech) a.pause();
  };
  const onPlaying = () => {
    if (state !== 'loading') return;
    state = 'playing';
    setVoiceSounding(true, clip.duration);
  };
  const onEnded = () => {
    if (state === 'playing') setVoiceSounding(false);
    if (state !== 'failed') state = 'ended';
  };
  a.addEventListener('playing', onPlaying);
  a.addEventListener('ended', onEnded);
  a.addEventListener('error', fail);
  a.volume = VOLUME;
  try {
    a.currentTime = 0;
  } catch {
    // Not seekable before its metadata loads; it starts from 0 anyway.
  }
  a.play().catch(fail);
  const timedOut = () => {
    if (state !== 'loading' || performance.now() - asked <= START_TIMEOUT_MS) return false;
    fail();
    return true;
  };
  const speech: Speech = {
    charsAt() {
      if (state === 'failed' || timedOut()) return null;
      if (state === 'ended') return clip.text.length;
      return charsAtTime(clip.spans, a.currentTime, clip.text.length);
    },
    done() {
      if (state === 'failed' || timedOut()) return null;
      return state === 'ended';
    },
    stop() {
      fail();
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', fail);
      if (owners.get(a) === speech) owners.delete(a);
      if (current === speech) current = null;
    },
  };
  owners.set(a, speech);
  return speech;
}

// ---------------------------------------------------------------- the browser's speech, as a fallback

/** Calm English voices first (names vary by system), then any English voice. */
const PREFERRED = [
  'Google UK English Female',
  'Microsoft Libby',
  'Microsoft Sonia',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Hazel',
  'Microsoft Zira',
  'Samantha',
  'Karen',
  'Moira',
  'Serena',
];

let synthVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!canSynthesize()) return null;
  const all = window.speechSynthesis.getVoices();
  if (all.length === 0) return null;
  for (const name of PREFERRED) {
    const v = all.find(x => x.name.startsWith(name));
    if (v) return v;
  }
  return all.find(x => /^en[-_]GB/i.test(x.lang)) ?? all.find(x => /^en/i.test(x.lang)) ?? null;
}

if (canSynthesize()) {
  synthVoice = pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    synthVoice = pickVoice();
  });
}

/** The browser's speech at rate 0.96 says about this many characters a second (an estimate the
 *  typing follows between word events, and the length of a line without a clip). */
const SYNTH_CPS = 14;
/** The pause between two lines (each its own utterance), s. */
const SYNTH_LINE_GAP_S = 0.35;

/**
 * Read lines aloud, one utterance each (long single utterances get cut off in some browsers). The
 * speech it returns follows the voice: line by line as each utterance starts, word by word where
 * the browser reports word boundaries, by the estimated pace in between.
 */
function synthesize(lines: string[]): Speech {
  const synth = window.speechSynthesis;
  synth.cancel();
  synthVoice ??= pickVoice();
  const text = lines.join('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const asked = performance.now();
  let state: 'loading' | 'speaking' | 'ended' | 'failed' = 'loading';
  let line = 0;
  let lineAt = 0;
  let word = -1;
  let wordAt = 0;
  const finish = (to: 'ended' | 'failed') => {
    if (state === 'ended' || state === 'failed') return;
    if (state === 'speaking') setVoiceSounding(false);
    state = to;
  };
  lines.forEach((l, i) => {
    const u = new SpeechSynthesisUtterance(l);
    if (synthVoice) u.voice = synthVoice;
    u.lang = synthVoice?.lang ?? 'en-GB';
    // Soft and unhurried, like a voice on a quiet radio channel.
    u.rate = 0.96;
    u.pitch = 1.08;
    u.volume = 0.9;
    u.onstart = () => {
      if (state === 'ended' || state === 'failed') return;
      if (state === 'loading') setVoiceSounding(true);
      state = 'speaking';
      line = i;
      lineAt = performance.now();
      word = -1;
    };
    u.onboundary = e => {
      if (line !== i || e.name === 'sentence') return;
      word = e.charIndex;
      wordAt = performance.now();
    };
    u.onend = () => {
      if (i === lines.length - 1) finish('ended');
    };
    u.onerror = () => finish('failed');
    synth.speak(u);
  });
  if (lines.length === 0) finish('ended');
  const timedOut = (now: number) => {
    if (state !== 'loading' || now - asked <= START_TIMEOUT_MS) return false;
    finish('failed');
    return true;
  };
  const speech: Speech = {
    charsAt() {
      if (state === 'failed') return null;
      if (state === 'ended') return text.length;
      const now = performance.now();
      if (timedOut(now)) return null;
      if (state === 'loading') return 0;
      const said = word >= 0 ? word + ((now - wordAt) / 1000) * SYNTH_CPS : ((now - lineAt) / 1000) * SYNTH_CPS;
      return starts[line] + Math.min(lines[line].length, Math.floor(said));
    },
    done() {
      if (state === 'failed' || timedOut(performance.now())) return null;
      return state === 'ended';
    },
    stop() {
      finish('failed');
      if (current === speech) {
        current = null;
        synth.cancel();
      }
    },
  };
  return speech;
}

/** How long a message (its lines) takes to say, ms: its clip's length, or an estimate for the browser's speech. */
export function speechMs(lines: string[]): number {
  const clip = CLIPS.get(lines.join('\n'));
  if (clip) return Math.round(clip.duration * 1000);
  const chars = lines.reduce((n, l) => n + l.length, 0);
  return Math.round(((chars / SYNTH_CPS + SYNTH_LINE_GAP_S * Math.max(0, lines.length - 1)) * 1000) / 0.96);
}

// ---------------------------------------------------------------- speaking

/**
 * Speak a message (its lines) if the voiceover is on and sound is not muted: its recorded clip, or
 * the browser's speech for a line without one (the prologue, the legs, the story sections, the way
 * home). Returns the speech to type along with, or null when the caller should go by its own clock
 * (voice off, muted, or no speech at all in this browser).
 */
export function speak(lines: string[]): Speech | null {
  stopSpeaking();
  if (!isVoiceOn() || isMuted()) return null;
  const clip = CLIPS.get(lines.join('\n'));
  if (clip && canPlayClips()) {
    current = playClip(clip);
    return current;
  }
  if (canSynthesize()) {
    current = synthesize(lines);
    return current;
  }
  return null;
}

export function stopSpeaking() {
  current?.stop();
  current = null;
  if (canSynthesize()) window.speechSynthesis.cancel();
}

/** True if the message (its lines) has a recorded clip. */
export function hasClip(lines: string[]): boolean {
  return CLIPS.has(lines.join('\n'));
}
