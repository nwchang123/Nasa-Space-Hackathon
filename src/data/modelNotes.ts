// Captions for stops where the 3D scene shows a simplified or illustrative model. Shared by the
// scene's model registry and the site panel, and kept free of three.js so the console stays light.

import type { MachineId } from '../types';

const MER = 'Simplified NASA model of a Mars Exploration Rover.';
const NO_MODEL = 'Illustrative silhouette: NASA publishes no 3D model of this hardware.';

export const MODEL_NOTES: Partial<Record<MachineId, string>> = {
  'pathfinder-sojourner': NO_MODEL,
  spirit: MER,
  opportunity: MER,
  phoenix: NO_MODEL,
  insight: 'NASA model with the instruments on the deck; by February 2019 both stood on the ground.',
  'mars2020-edl': NO_MODEL,
  ingenuity: 'NASA model; the broken blade is drawn in for this story.',
};
