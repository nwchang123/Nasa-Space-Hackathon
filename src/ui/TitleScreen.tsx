import { marsLocalSolarTime, signalPath } from '../astro';
import { FICTION_NOTE } from '../data/flight';
import { MACHINE_BY_ID } from '../data/machines';
import { LEGS, TOTAL_KM } from '../flight/route';
import { HangarButton } from '../hangar/HangarEntry';
import { useApp } from '../store';
import { formatDuration, formatKm, formatSolarTime } from './callPlan';
import { useUtcClock } from './useClock';

/** Ingenuity's real total over its 72 flights (docs/FACT_CHECK.md). */
const REAL_FLOWN_KM = '17.0 km';

const home = MACHINE_BY_ID.ingenuity;
const homeCoords = `${Math.abs(home.lat).toFixed(1)}°${home.lat >= 0 ? 'N' : 'S'} ${Math.abs(home.lon).toFixed(1)}°${home.lon >= 0 ? 'E' : 'W'}`;

export function TitleScreen() {
  const startFlight = useApp(s => s.startFlight);
  // Ticks every second, which also keeps the light time and Jezero's solar clock current.
  const utc = useUtcClock();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const roundTrip = signalPath('ingenuity', 'mars', now).roundTripS;
  const jezero = formatSolarTime(marsLocalSolarTime(now, home.lon));

  return (
    <section className="title-screen" aria-labelledby="title-heading">
      <header className="title-slate reveal" style={{ animationDelay: '0.1s' }}>
        <span className="title-slate-loc">
          Jezero crater <span aria-hidden="true">·</span> {homeCoords} <span aria-hidden="true">·</span>{' '}
          <span className="title-slate-date">{today} </span>
          <span className="tabular">{utc}</span>
        </span>
        <span
          className="title-slate-astro tabular"
          title="Live solar time at Jezero (Mars24) and round-trip Earth–Mars radio light time right now"
        >
          Solar {jezero} <span aria-hidden="true">·</span> Light {roundTrip === null ? '—' : formatDuration(roundTrip)}
        </span>
      </header>

      {/* margin-top: auto anchors the opening slate low; on short viewports it scrolls instead of clipping. */}
      <div className="title-brief">
        <p className="title-eyebrow reveal" style={{ animationDelay: '0.25s' }}>
          Flight 73
        </p>
        <h1 id="title-heading" className="reveal" style={{ animationDelay: '0.45s' }}>
          Still&nbsp;Here
        </h1>
        <p className="lede reveal" style={{ animationDelay: '0.7s' }}>
          Ingenuity flew 72 times on Mars. This is the flight it never got to make.
        </p>
        <div className="title-actions reveal" style={{ animationDelay: '0.95s' }}>
          <button type="button" className="primary title-begin" onClick={startFlight}>
            Begin Flight 73
          </button>
          <HangarButton place="title" />
        </div>
      </div>

      <footer className="title-foot reveal" style={{ animationDelay: '1.15s' }}>
        <p className="fine">{FICTION_NOTE} Some 3D models are simplified or illustrative.</p>
        <p className="title-scale tabular" title={`Ingenuity's 72 real flights covered ${REAL_FLOWN_KM}.`}>
          {formatKm(TOTAL_KM)} <span aria-hidden="true">·</span> {LEGS.length} stops <span aria-hidden="true">·</span>{' '}
          {REAL_FLOWN_KM} real
        </p>
      </footer>
    </section>
  );
}
