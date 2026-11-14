import { FICTION_NOTE } from '../data/flight';
import { LEGS, TOTAL_KM } from '../flight/route';
import { useApp } from '../store';
import { formatKm } from './callPlan';
import { useUtcClock } from './useClock';

export function TitleScreen() {
  const startFlight = useApp(s => s.startFlight);
  const utc = useUtcClock();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="title-screen" aria-labelledby="title-heading">
      <p className="kicker reveal" style={{ animationDelay: '0.1s' }}>
        Jezero crater, Mars <span aria-hidden="true">·</span> {today} <span className="tabular">{utc}</span>
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
        one last time, to visit every NASA machine that reached Mars before it: {LEGS.length - 1} stops, {formatKm(TOTAL_KM)},
        then home.
      </p>
      <ul className="live-notes reveal" style={{ animationDelay: '1.25s' }}>
        <li>Mars on this screen is lit the way the Sun lights it right now.</li>
        <li>Every place shows its real local time, and every radio call waits on tonight&rsquo;s real distance to Mars.</li>
      </ul>
      <button type="button" className="primary reveal" style={{ animationDelay: '1.5s' }} onClick={startFlight}>
        Begin Flight 73 <span aria-hidden="true">→</span>
      </button>
      <p className="fine reveal" style={{ animationDelay: '1.7s' }}>
        {FICTION_NOTE} Surface maps and some models are illustrative.
      </p>
    </section>
  );
}
