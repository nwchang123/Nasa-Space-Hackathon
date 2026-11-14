// Signature actions that change the site's sky and light (Opportunity's 2018 dust storm).
// The Diorama calls applySiteFx() every frame on the base look (real Sun, or the scrubber's hour)
// and uses the result for the sky dome, fog and Lights. Never mutates `look`.

import type { MachineId } from '../../types';
import type { SkyLook } from '../sites';
import { stormLook } from './logic';

export function applySiteFx(look: SkyLook, stop: MachineId, sig: Record<string, number>): SkyLook {
  if (stop === 'opportunity') return stormLook(look, sig.storm);
  return look;
}
