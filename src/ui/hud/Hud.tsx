// The Flight 73 cockpit HUD over the full-screen 3D view, kept to the edges so the diorama in the
// middle stays clear: the route bar along the top; under it Ingenuity's radio feed at the left and
// the site tools at the right; along the bottom the site card (left), the console (the 360° bearing
// ruler sitting on the stage dock, centre) and the scout photos (right), all on one baseline, with
// the fine print in its own strip below. The HUD itself lets the pointer through to the scene
// (orbiting a site, 3D hotspots); only its panels take it.

import { useEffect, useState } from 'react';
import { FICTION_NOTE } from '../../data/flight';
import { MACHINE_BY_ID } from '../../data/machines';
import { HOME } from '../../flight/route';
import { GuideBubble } from '../../scene/GuideBubble';
import { live } from '../../scene/registry';
import { useApp } from '../../store';
import { MACHINE_IDS, type MachineId } from '../../types';
import { NavcamOverlay } from '../NavcamOverlay';
import { AutoTour } from './AutoTour';
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
  // and in the epilogue (the camera back over the whole globe) the view stays clear. It also waits
  // for the picture: never a new stop's text while the camera is still climbing out of the last one.
  const stageCard = stage === 'site' ? MACHINE_IDS[leg] : stage === 'prologue' ? HOME : null;
  const cardId = useSceneReached(stageCard);
  // The opening descent after "Begin Flight 73" is a clean shot: no dock, card or hints until the
  // camera has all but landed at home, then the HUD fades in (the bearing ruler stays in the console).
  const landedHome = useSceneReached(stage === 'prologue' ? HOME : null, OPENING_HUD_BLEND);
  const descending = stage === 'prologue' && landedHome !== HOME;
  // Scout photos pinned at the bottom right: the console keeps clear of their column.
  const roll = useApp(s => s.flight.stage === 'site' && s.snapshots.length > 0);
  return (
    <div className={`hud stage-${stage}${cardId ? ' with-card' : ''}${roll ? ' with-roll' : ''}${descending ? ' hud-descending' : ''}`}>
      <AutoTour />
      <NavcamOverlay />
      <ScoutCam />
      <GuideBubble />
      <FocusControls />
      <TopBar />
      <FaultBanner />
      {cardId && <SiteCard key={cardId} machine={MACHINE_BY_ID[cardId]} standing={stage === 'site'} />}
      <div className="hud-console">
        <BearingBar />
        <Dock />
      </div>
      <p className="hud-fine">{FICTION_NOTE}</p>
    </div>
  );
}

/** The card shows a stop once the camera is this far into the dive toward it (shot blend, 0..1). */
const CARD_BLEND = 0.6;

/**
 * `id` once the 3D view has reached it: the old site has been left behind (the choreographer's
 * leaving climb is over) and the camera is well into the dive toward this one. Null until then,
 * and as soon as `id` changes. Polled each animation frame from the scene's live shot; it
 * re-renders only when the answer changes, and stays true for that stop once reached.
 */
function useSceneReached(id: MachineId | null, blend = CARD_BLEND): MachineId | null {
  const [reached, setReached] = useState<MachineId | null>(null);
  useEffect(() => {
    setReached(null);
    if (!id) return;
    let raf = 0;
    const loop = () => {
      const shot = live.shot;
      if (shot.siteId === id && shot.blend >= blend) {
        setReached(id);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [id, blend]);
  return reached === id ? id : null;
}

/** The opening descent shows the landing alone: the HUD fades in once the camera is this far down (shot blend). */
const OPENING_HUD_BLEND = 0.9;

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
