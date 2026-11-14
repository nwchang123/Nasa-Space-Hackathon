// Ingenuity's voice in the radio bubble: pre-recorded clips (scripts/voice/ingenuity_voice.py, a
// Kokoro voice made locally), loaded only when a stop needs them. A clip reports how far its speech
// has got, so the bubble types each line as it is heard (voiceSync.ts). A line with no clip (say,
// edited after the clips were made) falls back to the browser's own speech synthesis, which the
// bubble does not try to follow. On by default, remembered in this browser, silent while the
// console sound is muted.

import clips from '../data/voiceClips.json';
import { isMuted } from './sound';
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
  stop(): void;
}

let current: Speech | null = null;

function playClip(clip: VoiceClip): Speech {
  const a = element(clip);
  const asked = performance.now();
  let state: 'loading' | 'playing' | 'ended' | 'failed' = 'loading';
  const fail = () => {
    if (state === 'ended') return;
    state = 'failed';
    if (owners.get(a) === speech) a.pause();
  };
  const onPlaying = () => {
    if (state === 'loading') state = 'playing';
  };
  const onEnded = () => {
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
  const speech: Speech = {
    charsAt() {
      if (state === 'failed') return null;
      if (state === 'ended') return clip.text.length;
      if (state === 'loading' && performance.now() - asked > START_TIMEOUT_MS) {
        fail();
        return null;
      }
      return charsAtTime(clip.spans, a.currentTime, clip.text.length);
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

/** Read lines aloud, one utterance each (long single utterances get cut off in some browsers). */
function synthesize(lines: string[]) {
  const synth = window.speechSynthesis;
  synth.cancel();
  synthVoice ??= pickVoice();
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line);
    if (synthVoice) u.voice = synthVoice;
    u.lang = synthVoice?.lang ?? 'en-GB';
    // Soft and unhurried, like a voice on a quiet radio channel.
    u.rate = 0.96;
    u.pitch = 1.08;
    u.volume = 0.9;
    synth.speak(u);
  }
}

// ---------------------------------------------------------------- speaking

/**
 * Speak a message (its lines) if the voiceover is on and sound is not muted. Returns the speech to
 * type along with, or null when the bubble should type by its own clock (voice off, muted, or only
 * the browser's speech available).
 */
export function speak(lines: string[]): Speech | null {
  stopSpeaking();
  if (!isVoiceOn() || isMuted()) return null;
  const clip = CLIPS.get(lines.join('\n'));
  if (clip && canPlayClips()) {
    current = playClip(clip);
    return current;
  }
  if (canSynthesize()) synthesize(lines);
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
