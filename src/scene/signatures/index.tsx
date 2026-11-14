// Scene side of each stop's signature action (definitions in src/data/signatures.ts). Mounted by
// the Diorama inside its group, so everything here is in the diorama's metres (y up, the machine
// at the origin, turned by lay.machineYaw). Reads the store's `sig` values; renders nothing until
// an action is used.

import type { Ground } from '../terrain';
import type { SiteLayout } from '../sites';
import type { MachineId } from '../../types';

export interface SiteSignatureProps {
  stop: MachineId;
  ground: Ground;
  lay: SiteLayout;
}

export function SiteSignature(_props: SiteSignatureProps) {
  return null;
}
