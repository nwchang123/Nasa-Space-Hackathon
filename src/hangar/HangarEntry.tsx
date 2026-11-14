// The ways into the AR hangar: a button on the title screen and one in the flight's top bar. This
// small module loads with the app; the hangar itself (Hangar.tsx) is fetched only when opened.

import { useApp } from '../store';
import './entry.css';

export function HangarButton({ place }: { place: 'title' | 'top' }) {
  const openHangar = useApp(s => s.openHangar);
  if (place === 'title') {
    // The right segment of the title's control strip. The [09] count is decoration (aria-hidden),
    // so the accessible name stays exactly "AR hangar".
    return (
      <button
        type="button"
        className="ghost hangar-entry"
        onClick={openHangar}
        title="AR hangar: the nine NASA machines in 3D, and on your own table in AR"
      >
        AR hangar
        <span className="hangar-entry-count" aria-hidden="true">
          [09]
        </span>
      </button>
    );
  }
  return (
    <button type="button" className="icon-btn hangar-entry-top" onClick={openHangar} title="AR hangar: the nine machines on your own table">
      AR hangar
    </button>
  );
}
