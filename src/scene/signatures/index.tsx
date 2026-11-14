// Scene side of each stop's signature action (definitions in src/data/signatures.ts). Mounted by
// the Diorama inside its group, so everything here is in the diorama's metres (y up, the machine
// at the origin, turned by lay.machineYaw). Reads the store's `sig` values; shows nothing until an
// action is used, and puts everything it moved back when the values are cleared or the site
// changes (the Diorama, and this with it, unmounts).

import type { SiteSignatureProps } from './common';
import { ParachuteDecode } from './edl';
import { IngenuityWake } from './ingenuity';
import { InsightQuake, LarriBeam } from './insight';
import { SpiritDrag, StormDust } from './mer';
import { SojournerRoll } from './pathfinder';
import { PhoenixScoop } from './phoenix';
import { VikingFrost, VikingScan } from './viking';

export type { SiteSignatureProps } from './common';

export function SiteSignature(props: SiteSignatureProps) {
  switch (props.stop) {
    case 'viking-1':
      return <VikingScan {...props} />;
    case 'viking-2':
      return <VikingFrost {...props} />;
    case 'pathfinder-sojourner':
      return <SojournerRoll {...props} />;
    case 'spirit':
      return <SpiritDrag {...props} />;
    case 'opportunity':
      return <StormDust {...props} />;
    case 'phoenix':
      return <PhoenixScoop {...props} />;
    case 'insight':
      return (
        <>
          <InsightQuake {...props} />
          <LarriBeam {...props} />
        </>
      );
    case 'mars2020-edl':
      return <ParachuteDecode {...props} />;
    case 'ingenuity':
      return <IngenuityWake {...props} />;
    default:
      return null;
  }
}
