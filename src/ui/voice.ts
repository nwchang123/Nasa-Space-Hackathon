// Optional voiceover for Ingenuity's radio bubble: the browser's own speech synthesis (Web Speech
// API). Off by default, remembered in this browser, silent while the console sound is muted.
// Nothing is downloaded; which voice speaks depends on the visitor's system.

import { isMuted } from './sound';

const KEY = 'still-here:voiceover';

type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let enabled = stored();

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
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

/** Calm English voices first (names vary by system), then any English voice. */
const PREFERRED = [
  'Google UK English Female',
  'Microsoft Libby',
  'Microsoft Sonia',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Hazel',
  'Samantha',
  'Karen',
  'Moira',
  'Serena',
];

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voiceSupported()) return null;
  const all = window.speechSynthesis.getVoices();
  if (all.length === 0) return null;
  for (const name of PREFERRED) {
    const v = all.find(x => x.name.startsWith(name));
    if (v) return v;
  }
  return all.find(x => /^en[-_]GB/i.test(x.lang)) ?? all.find(x => /^en/i.test(x.lang)) ?? null;
}

if (voiceSupported()) {
  voice = pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    voice = pickVoice();
  });
}

/** Read lines aloud, one utterance each (long single utterances get cut off in some browsers). */
export function speak(lines: string[]) {
  if (!isVoiceOn() || isMuted()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  voice ??= pickVoice();
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-GB';
    // Soft and unhurried, like a voice on a quiet radio channel.
    u.rate = 0.96;
    u.pitch = 1.08;
    u.volume = 0.9;
    synth.speak(u);
  }
}

export function stopSpeaking() {
  if (voiceSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return voiceSupported() && window.speechSynthesis.speaking;
}
