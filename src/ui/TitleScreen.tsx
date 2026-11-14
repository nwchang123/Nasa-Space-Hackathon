import { useEffect } from 'react';
import { useApp } from '../store';
import { useUtcClock } from './useClock';

export function TitleScreen() {
  const setPhase = useApp(s => s.setPhase);
  const setView = useApp(s => s.setView);
  const utc = useUtcClock();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => setView('overview'), [setView]);

  return (
    <section className="title-screen" aria-labelledby="title-heading">
      <p className="kicker reveal" style={{ animationDelay: '0.1s' }}>
        Deep Space Network <span aria-hidden="true">·</span> Night shift <span aria-hidden="true">·</span> {today}{' '}
        <span className="tabular">{utc}</span>
      </p>
      <h1 id="title-heading" className="reveal" style={{ animationDelay: '0.35s' }}>
        Still&nbsp;Here
      </h1>
      <p className="lede reveal" style={{ animationDelay: '0.7s' }}>
        A roll call for the machines we left behind.
      </p>
      <p className="title-body reveal" style={{ animationDelay: '1s' }}>
        Since the 1960s, NASA has left landers, rovers and probes on the Moon, on Mars and drifting through deep space.
        Most of them went quiet long ago. Tonight you are on the night shift with a list of eighteen names. Call each one,
        and listen to what comes back.
      </p>
      <ul className="live-notes reveal" style={{ animationDelay: '1.25s' }}>
        <li>The Moon and Mars on this screen are lit the way the Sun lights them right now.</li>
        <li>Every call is timed by tonight&rsquo;s real distance for light to travel.</li>
      </ul>
      <button type="button" className="primary reveal" style={{ animationDelay: '1.5s' }} onClick={() => setPhase('timelapse')}>
        Begin the shift <span aria-hidden="true">→</span>
      </button>
      <p className="fine reveal" style={{ animationDelay: '1.7s' }}>
        A learning simulation. Dates, places and stories come from NASA mission records. Surface maps are illustrative.
      </p>
    </section>
  );
}
