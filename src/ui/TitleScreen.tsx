import { signalPath } from '../astro';
import { FICTION_NOTE } from '../data/flight';
import { LEGS, TOTAL_KM } from '../flight/route';
import { useApp } from '../store';
import { formatDuration, formatKm } from './callPlan';
import { useUtcClock } from './useClock';

/** Ingenuity's real total over its 72 flights (docs/FACT_CHECK.md). */
const REAL_FLOWN_KM = '17.0 km';

export function TitleScreen() {
  const startFlight = useApp(s => s.startFlight);
  // Ticks every second, which also keeps the light time below current.
  const utc = useUtcClock();
  const today = new Date().toISOString().slice(0, 10);
  const roundTrip = signalPath('ingenuity', 'mars', new Date()).roundTripS;

  return (
    <section className="title-screen" aria-labelledby="title-heading">
      <p className="kicker reveal" style={{ animationDelay: '0.1s' }}>
        <span className="beacon" aria-hidden="true" />
        <span>
          Jezero crater, Mars <span aria-hidden="true">·</span> {today} <span className="tabular">{utc}</span>
        </span>
      </p>
      <h1 id="title-heading" className="reveal" style={{ animationDelay: '0.35s' }}>
        Still&nbsp;Here
      </h1>
      <p className="subtitle reveal" style={{ animationDelay: '0.55s' }}>
        Flight 73
      </p>
      <p className="lede reveal" style={{ animationDelay: '0.75s' }}>
        Ingenuity flew 72 times on Mars. This is the flight it never got to make.
      </p>
      <p className="title-body reveal" style={{ animationDelay: '1s' }}>
        In January 2024 the first aircraft on another world broke its rotor blades and never flew again. Imagine it lifting off
        one last time, to visit the NASA machines whose work on Mars is done, and then fly home.
      </p>
      <ul className="telemetry reveal" style={{ animationDelay: '1.25s' }} aria-label="Flight 73 at a glance">
        <li>
          <strong>{formatKm(TOTAL_KM)}</strong>
          <span>
            {LEGS.length - 1} stops · its 72 real flights: {REAL_FLOWN_KM}
          </span>
        </li>
        <li>
          <strong className="tabular">{roundTrip === null ? '—' : formatDuration(roundTrip)}</strong>
          <span>Earth–Mars radio round trip, right now</span>
        </li>
        <li>
          <strong>Live Sun</strong>
          <span>Lit by real-time Mars24 ephemeris</span>
        </li>
      </ul>
      <button type="button" className="primary reveal" style={{ animationDelay: '1.5s' }} onClick={startFlight}>
        Begin Flight 73 <span aria-hidden="true">→</span>
      </button>
      <p className="fine reveal" style={{ animationDelay: '1.7s' }}>
        {FICTION_NOTE} Some 3D models are simplified or illustrative.
      </p>
    </section>
  );
}
