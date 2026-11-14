// Captions for stops where the 3D scene shows a simplified or illustrative model. Shared by the
// scene's model registry and the site panel, and kept free of three.js so the console stays light.

import type { MachineId } from '../types';

const MER = 'Detailed NASA Spirit/Opportunity model; dust and the resting pose are illustrative.';

export const MODEL_NOTES: Partial<Record<MachineId, string>> = {
  'pathfinder-sojourner': 'Blender reconstruction of Pathfinder and Sojourner; illustrative details and landing-site pose.',
  spirit: MER,
  opportunity: MER,
  phoenix: 'Phoenix reconstruction adapted from NASA’s InSight platform; instruments, arm and surface finish rebuilt in Blender.',
  insight: 'NASA model with the instruments on the deck; by February 2019 both stood on the ground.',
  'mars2020-edl': 'Blender reconstruction of the damaged backshell; the illustrative canopy retains the interactive code overlay.',
  ingenuity: 'NASA model; the broken blade is drawn in for this story.',
};
