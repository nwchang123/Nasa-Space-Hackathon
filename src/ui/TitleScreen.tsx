import { marsLocalSolarTime, signalPath } from '../astro';
import { FICTION_NOTE } from '../data/flight';
import { MACHINE_BY_ID } from '../data/machines';
import { LEGS, TOTAL_KM } from '../flight/route';
import { useApp } from '../store';
import { formatDuration, formatKm, formatSolarTime } from './callPlan';
import { useUtcClock } from './useClock';

/** Ingenuity's real total over its 72 flights (docs/FACT_CHECK.md). */
const REAL_FLOWN_KM = '17.0 km';

export function TitleScreen() {
  const startFlight = useApp(s => s.startFlight);
  // Ticks every second, which also keeps the light time and Jezero's clock below current.
  const utc = useUtcClock();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const roundTrip = signalPath('ingenuity', 'mars', now).roundTripS;
  const jezero = formatSolarTime(marsLocalSolarTime(now, MACHINE_BY_ID.ingenuity.lon));

  return (
    <section className="title-screen" aria-labelledby="title-heading">
      {/* margin-top: auto keeps the brief low; on a short window it scrolls instead of losing its top. */}
      <div className="title-brief">
        <p className="kicker reveal" style={{ animationDelay: '0.1s' }}>
          <span className="beacon" aria-hidden="true" />
          <span>
            Jezero crater, Mars <span aria-hidden="true">·</span> <span className="title-kicker-date">{today}</span>{' '}
            <span className="tabular">{utc}</span>
          </span>
        </p>
        <h1 id="title-heading" className="reveal" style={{ animationDelay: '0.35s' }}>
          Still&nbsp;Here
        </h1>
        <p className="subtitle reveal" style={{ animationDelay: '0.55s' }}>
          Flight 73
        </p>
        <p className="lede reveal" style={{ animationDelay: '0.75s' }}>
          Ingenuity flew 72 times on Mars.
        </p>
        <p className="title-body reveal" style={{ animationDelay: '1s' }}>
          In January 2024 the first aircraft on another world broke its rotor blades and never flew again. Flight 73 imagines one
          more trip: from Jezero to the NASA landers and rovers whose work on Mars is done, and back home.
        </p>
        <ul className="title-facts reveal" style={{ animationDelay: '1.25s' }} aria-label="Flight 73 at a glance">
          <li title={`Ingenuity's 72 real flights covered ${REAL_FLOWN_KM}.`}>
            <strong className="tabular">{formatKm(TOTAL_KM)}</strong>{' '}
            across {LEGS.length} stops
          </li>
          <li title="Light time from Earth to Mars and back, right now">
            <strong className="tabular">{roundTrip === null ? '—' : formatDuration(roundTrip)}</strong>{' '}
            for a radio call there and back
          </li>
          <li title="Local solar time at Jezero right now (Mars24). The globe is lit to match.">
            <strong className="tabular">{jezero}</strong>{' '}
            local solar time at Jezero
          </li>
        </ul>
        <div className="title-actions reveal" style={{ animationDelay: '1.5s' }}>
          <button type="button" className="primary title-begin" onClick={startFlight}>
            Begin Flight 73
          </button>
        </div>
        <p className="fine reveal" style={{ animationDelay: '1.7s' }}>
          {FICTION_NOTE} Some 3D models are simplified or illustrative.
        </p>
      </div>
    </section>
  );
}
