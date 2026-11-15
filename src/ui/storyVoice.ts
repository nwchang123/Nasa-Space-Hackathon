// A story section read aloud when the visitor picks it themselves (a story tab, "Next", a hotspot in
// the 3D view, a Scout Cam capture). The machine's own words, one sentence per line, as the auto
// tour reads them (AutoTour.tsx), so each finds its recorded clip: the narrator's voice, or
// Ingenuity's at its own stop.

import { MACHINE_BY_ID } from '../data/machines';
import { STORY_KEYS, type StorySection } from '../store';
import type { MachineId } from '../types';
import { sentences } from './tour';
import { speak, type Speech } from './voice';

/** The lines a story section is spoken as. */
export function storyLines(stop: MachineId, section: StorySection): string[] {
  return sentences(MACHINE_BY_ID[stop].story[STORY_KEYS[section]]);
}

/** Read a story section aloud (from the start, also when it is the section already shown). */
export function readStory(stop: MachineId, section: StorySection): Speech | null {
  return speak(storyLines(stop, section));
}
