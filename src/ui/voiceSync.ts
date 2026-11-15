// Keeps the radio bubble's typewriter in step with Ingenuity's recorded voice. Each clip comes with
// spans (scripts/voice/ingenuity_voice.py): [first char, end char, start s, end s] over the message
// text (its lines joined with "\n"), one per sentence, split again at the commas where the voice
// pauses. A span is typed out evenly while it is spoken, and the typing holds in the pauses.

/** [first character, end character (exclusive), start s, end s]. */
export type Span = readonly [number, number, number, number];

export interface VoiceClip {
  stop: string;
  /** Which message: the prologue (and its "imagine" half), a leg's lines, a direct hop, an arrival
   *  intro, an inheritance line, a story section (read by the auto tour), or the way home. */
  kind: 'prologue' | 'imagine' | 'leg' | 'hop' | 'intro' | 'inheritance' | 'story' | 'epilogue';
  /** Who says it: Ingenuity (the guide and the aircraft, a cool radio voice) or the narrator (a
   *  clear, warm voice for the other machines' stories, in their own words). */
  voice: 'ingenuity' | 'narrator';
  /** Path under the site's base URL. */
  file: string;
  /** The message as spoken: its lines joined with "\n". */
  text: string;
  /** Seconds. */
  duration: number;
  spans: Span[];
}

/** How many characters of the message show `t` seconds into its clip (all of them once the speech ends). */
export function charsAtTime(spans: readonly Span[], t: number, total: number): number {
  let shown = 0;
  for (const [c0, c1, t0, t1] of spans) {
    if (t < t0) return shown;
    if (t >= t1) {
      shown = c1;
      continue;
    }
    return Math.max(shown, Math.min(c1, c0 + Math.floor(((t - t0) / (t1 - t0)) * (c1 - c0))));
  }
  return total;
}
