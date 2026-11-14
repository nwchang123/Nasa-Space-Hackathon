import { Suspense, lazy } from 'react';
import { useApp } from './store';
import { Hud } from './ui/hud/Hud';
import { Report } from './ui/Report';
import { TitleScreen } from './ui/TitleScreen';
import { useLiveClock } from './ui/useClock';

const Stage = lazy(() => import('./scene/Stage'));

export default function App() {
  const phase = useApp(s => s.phase);
  useLiveClock();

  return (
    <div className="app" data-phase={phase}>
      <div className="stage" aria-hidden={phase === 'report'}>
        <Suspense fallback={<div className="stage-loading">Spinning up the rotors…</div>}>
          <Stage />
        </Suspense>
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {phase === 'title' && <TitleScreen />}
      {phase === 'flight' && <Hud />}
      {phase === 'report' && <Report />}
    </div>
  );
}
