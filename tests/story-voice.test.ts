import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/ui/voice', () => ({ speak: vi.fn(() => null) }));

import clips from '../src/data/voiceClips.json';
import { STORY_KEYS, type StorySection } from '../src/store';
import { readStory, storyLines } from '../src/ui/storyVoice';
import { speak } from '../src/ui/voice';
import type { VoiceClip } from '../src/ui/voiceSync';
import { MACHINE_IDS } from '../src/types';

const byText = new Map((clips as unknown as VoiceClip[]).map(c => [c.text, c]));

describe('a story section picked by the visitor', () => {
  it('is read from its recorded clip: the narrator, or Ingenuity at its own stop', () => {
    for (const id of MACHINE_IDS) {
      for (let i = 0; i < STORY_KEYS.length; i++) {
        const clip = byText.get(storyLines(id, i as StorySection).join('\n'));
        expect(clip, `${id} ${STORY_KEYS[i]}`).toBeDefined();
        expect(clip?.kind).toBe('story');
        expect(clip?.voice, `${id} ${STORY_KEYS[i]}`).toBe(id === 'ingenuity' ? 'ingenuity' : 'narrator');
      }
    }
  });

  it('speaks those lines', () => {
    readStory('viking-2', 2);
    expect(speak).toHaveBeenLastCalledWith(storyLines('viking-2', 2));
    expect(storyLines('viking-2', 2)[0]).toMatch(/^My orbiter went first/);
  });
});
