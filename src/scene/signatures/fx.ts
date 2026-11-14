// Signature actions that change the site's sky and light (e.g. Opportunity's 2018 dust storm).
// The Diorama calls applySiteFx() every frame on the base look (real Sun, or the scrubber's hour)
// and uses the result for the sky dome, fog and Lights. Must not mutate `look`.

import type { MachineId } from '../../types';
import type { SkyLook } from '../sites';

export function applySiteFx(look: SkyLook, _stop: MachineId, _sig: Record<string, number>): SkyLook {
  return look;
}
