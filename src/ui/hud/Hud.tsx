// The Flight 73 cockpit HUD over the full-screen 3D view: the route bar on top, the site card at
// bottom left, the stage dock at bottom centre. The HUD itself lets the pointer through to the
// scene (orbiting a site, 3D hotspots); only its panels take it.

import { useEffect } from 'react';
import { FICTION_NOTE } from '../../data/flight';
import { MACHINE_BY_ID } from '../../data/machines';
import { HOME } from '../../flight/route';
import { useApp } from '../../store';
import { MACHINE_IDS } from '../../types';
import { NavcamOverlay } from '../NavcamOverlay';
import { BearingBar } from './BearingBar';
import { Dock, FaultBanner } from './Dock';
import { FocusControls } from './FocusControls';
import { ScoutCam } from './ScoutCam';
import { SiteCard } from './SiteCard';
import { TopBar } from './TopBar';

export function Hud() {
  const stage = useApp(s => s.flight.stage);
  const leg = useApp(s => s.flight.leg);
  useBoostKeys();

  // The site card shows only on the ground: at home before lift-off, and at each stop. In flight
  // and in the epilogue (the camera back over the whole globe) the view stays clear.
  const cardId = stage === 'site' ? MACHINE_IDS[leg] : stage === 'prologue' ? HOME : null;
  return (
    <div className={`hud stage-${stage}${cardId ? ' with-card' : ''}`}>
      <NavcamOverlay />
      <ScoutCam />
      <FocusControls />
      <TopBar />
      <FaultBanner />
      {cardId && <SiteCard key={cardId} machine={MACHINE_BY_ID[cardId]} standing={stage === 'site'} />}
      <Dock />
      <BearingBar />
      <p className="hud-fine">{FICTION_NOTE}</p>
    </div>
  );
}

/** Hold Space to boost while flying. */
function useBoostKeys() {
  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e.target)) return;
      const s = useApp.getState();
      if (s.phase !== 'flight' || s.flight.stage !== 'flying') return;
      e.preventDefault();
      if (!s.boost) s.setBoost(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e.target)) return;
      const s = useApp.getState();
      if (s.boost) {
        e.preventDefault();
        s.setBoost(false);
      }
    };
    const release = () => {
      if (useApp.getState().boost) useApp.getState().setBoost(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      release();
    };
  }, []);
}
