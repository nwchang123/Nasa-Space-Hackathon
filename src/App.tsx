import { Suspense, lazy } from 'react';
import { useApp } from './store';
import { Console } from './ui/Console';
import { Report } from './ui/Report';
import { Timelapse } from './ui/Timelapse';
import { TitleScreen } from './ui/TitleScreen';
import { useLiveClock } from './ui/useClock';

const Stage = lazy(() => import('./scene/Stage'));

export default function App() {
  const phase = useApp(s => s.phase);
  useLiveClock();

  return (
    <div className="app" data-phase={phase}>
      <div className="stage" aria-hidden={phase === 'report'}>
        <Suspense fallback={<div className="stage-loading">Acquiring signal…</div>}>
          <Stage />
        </Suspense>
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {phase === 'title' && <TitleScreen />}
      {phase === 'timelapse' && <Timelapse />}
      {phase === 'rollcall' && <Console />}
      {phase === 'report' && <Report />}
    </div>
  );
}
