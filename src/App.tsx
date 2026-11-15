import { Suspense, lazy, useEffect, useState } from 'react';
import { useApp } from './store';
import { Hud } from './ui/hud/Hud';
import { Report } from './ui/Report';
import { TitleScreen } from './ui/TitleScreen';
import { useLiveClock } from './ui/useClock';
import './ui/tour.css';

const Stage = lazy(() => import('./scene/Stage'));
const Hangar = lazy(() => import('./hangar/Hangar'));

/** "Begin Flight 73": the title's words and buttons fade out over this long while the view turns, ms. */
const TITLE_EXIT_MS = 350;

export default function App() {
  const phase = useApp(s => s.phase);
  useLiveClock();
  // Someone who opens the hangar's link (a phone, from its QR code) never needs the globe: the
  // Stage mounts the first time any other phase shows, and then stays (paused under the hangar).
  const [stageOn, setStageOn] = useState(phase !== 'hangar');
  if (!stageOn && phase !== 'hangar') setStageOn(true);
  // The title stays up a moment after "Begin Flight 73", fading out, instead of vanishing at once.
  const [prevPhase, setPrevPhase] = useState(phase);
  const [titleLeaving, setTitleLeaving] = useState(false);
  if (prevPhase !== phase) {
    setPrevPhase(phase);
    setTitleLeaving(prevPhase === 'title' && phase === 'flight');
  }
  useEffect(() => {
    if (!titleLeaving) return;
    const t = window.setTimeout(() => setTitleLeaving(false), TITLE_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [titleLeaving]);

  return (
    <div className="app" data-phase={phase}>
      <div className="stage" aria-hidden={phase === 'report' || phase === 'hangar'}>
        {stageOn && (
          <Suspense fallback={<div className="stage-loading">Spinning up the rotors…</div>}>
            <Stage />
          </Suspense>
        )}
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {(phase === 'title' || titleLeaving) && <TitleScreen leaving={phase !== 'title'} />}
      {phase === 'flight' && <Hud />}
      {phase === 'report' && <Report />}
      {phase === 'hangar' && (
        <Suspense fallback={<div className="hangar-loading">Opening the hangar…</div>}>
          <Hangar />
        </Suspense>
      )}
    </div>
  );
}
