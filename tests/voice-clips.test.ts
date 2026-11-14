import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEG_SCRIPTS } from '../src/data/flight';
import clips from '../src/data/voiceClips.json';
import { charsAtTime, type Span, type VoiceClip } from '../src/ui/voiceSync';
import { MACHINE_IDS } from '../src/types';

const CLIPS = clips as unknown as VoiceClip[];
const byText = new Map(CLIPS.map(c => [c.text, c]));
/** Every message Ingenuity speaks in the radio bubble, as its lines. */
const messages = MACHINE_IDS.flatMap(id => [
  { id, kind: 'intro', lines: LEG_SCRIPTS[id].arrivalIntro },
  { id, kind: 'inheritance', lines: [LEG_SCRIPTS[id].inheritance] },
]);

describe("Ingenuity's voice clips", () => {
  it('has a clip for every line it speaks, as the line reads now', () => {
    // A failure here means a line in flight.ts changed: run scripts/voice/ingenuity_voice.py again.
    for (const m of messages) expect(byText.has(m.lines.join('\n')), `${m.id} ${m.kind}`).toBe(true);
    expect(CLIPS.length).toBe(messages.length);
  });

  it('ships every clip as a 16 kHz mono WAV of the stated length', () => {
    for (const c of CLIPS) {
      const path = join('public', c.file);
      expect(existsSync(path), c.file).toBe(true);
      const b = readFileSync(path);
      expect(b.toString('ascii', 0, 4)).toBe('RIFF');
      expect(b.readUInt16LE(22), `${c.file} channels`).toBe(1);
      expect(b.readUInt32LE(24), `${c.file} sample rate`).toBe(16000);
      const seconds = (b.length - 44) / 2 / 16000;
      expect(Math.abs(seconds - c.duration), c.file).toBeLessThan(0.01);
    }
  });

  it('times every character: spans in order, within the clip, covering each sentence', () => {
    for (const c of CLIPS) {
      let char = 0;
      let time = 0;
      for (const [c0, c1, t0, t1] of c.spans) {
        expect(c0, c.file).toBeGreaterThanOrEqual(char);
        // Between spans only spaces and line breaks go untimed.
        expect(c.text.slice(char, c0).trim(), c.file).toBe('');
        expect(c1, c.file).toBeGreaterThan(c0);
        expect(t0, c.file).toBeGreaterThanOrEqual(time);
        expect(t1, c.file).toBeGreaterThan(t0);
        expect(t1, c.file).toBeLessThanOrEqual(c.duration);
        // A plausible speaking pace for each phrase, in characters per second.
        const pace = (c1 - c0) / (t1 - t0);
        expect(pace, `${c.file} "${c.text.slice(c0, c1)}"`).toBeGreaterThan(6);
        expect(pace, `${c.file} "${c.text.slice(c0, c1)}"`).toBeLessThan(32);
        char = c1;
        time = t1;
      }
      expect(char, c.file).toBe(c.text.length);
    }
  });
});

describe('charsAtTime', () => {
  // "Hello, there.\nBye." spoken as "Hello," 0.1–0.5 s, " there." 0.7–1.1 s, "Bye." 1.5–1.9 s.
  const text = 'Hello, there.\nBye.';
  const spans: Span[] = [
    [0, 6, 0.1, 0.5],
    [6, 13, 0.7, 1.1],
    [14, 18, 1.5, 1.9],
  ];
  const at = (t: number) => charsAtTime(spans, t, text.length);

  it('shows nothing before the voice starts', () => {
    expect(at(0)).toBe(0);
    expect(at(0.09)).toBe(0);
  });

  it('types a phrase evenly while it is spoken', () => {
    expect(at(0.1)).toBe(0);
    expect(at(0.31)).toBe(3);
    expect(at(0.49)).toBe(5);
  });

  it('holds in the pauses, with the punctuation out', () => {
    expect(at(0.5)).toBe(6);
    expect(at(0.69)).toBe(6);
    expect(text.slice(0, at(1.3))).toBe('Hello, there.');
  });

  it('starts the next line with its break, and shows everything once the voice ends', () => {
    expect(text.slice(0, at(1.5))).toBe('Hello, there.\n');
    expect(at(1.9)).toBe(text.length);
    expect(at(30)).toBe(text.length);
  });

  it('never goes backwards as time runs on', () => {
    let last = 0;
    for (let t = 0; t < 2.5; t += 0.01) {
      const n = at(t);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });
});
