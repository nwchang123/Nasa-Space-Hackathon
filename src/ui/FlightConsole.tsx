import { useEffect, useMemo, useRef, useState } from 'react';
import { siteSky } from '../astro';
import { EPILOGUE, FICTION_NOTE, LEG_SCRIPTS, PROLOGUE } from '../data/flight';
import { MACHINE_BY_ID } from '../data/machines';
import { MODEL_NOTES } from '../data/modelNotes';
import { HOME, LEGS, TOTAL_KM, compass, flyDurationMs, hop } from '../flight/route';
import { currentStop, standingAt, useApp } from '../store';
import { MACHINE_IDS, type Machine } from '../types';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatKm,
  formatSpeedup,
  planCall,
  silenceLine,
  skyWords,
} from './callPlan';
import { isMuted, playSend, playSilence, setMuted } from './sound';
import { Story } from './Story';
import { prefersReducedMotion, useUtcClock } from './useClock';

/** Ingenuity's 72 real flights covered 17.0 km in total (docs/FACT_CHECK.md, ingenuity). */
const REAL_FLIGHT_KM = 17.0;

export function FlightConsole() {
  const flight = useApp(s => s.flight);
  const utc = useUtcClock();
  const [muted, setMutedState] = useState(isMuted());
  const flownKm = useApp(s => s.flownKm);

  return (
    <aside className="console" aria-label="Flight 73 log">
      <header className="console-head">
        <div className="brand">
          <span className="beacon" aria-hidden="true" />
          Flight 73
        </div>
        <div className="head-right">
          <span className="tabular dim">{utc}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            aria-pressed={muted}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </header>

      <RouteStrip />

      <div className="console-body" key={`${flight.stage}-${flight.leg}`}>
        {flight.stage === 'prologue' && <Prologue />}
        {flight.stage === 'flying' && <Flying />}
        {flight.stage === 'site' && <Site />}
        {flight.stage === 'epilogue' && <Epilogue />}
      </div>

      <footer className="console-foot">
        <div className="progress">
          <div className="progress-bar">
            <span style={{ width: `${Math.min(1, flownKm / TOTAL_KM) * 100}%` }} />
          </div>
          <span className="tabular">
            {formatKm(flownKm)} flown · route {formatKm(TOTAL_KM)}
          </span>
        </div>
        <p className="fiction">{FICTION_NOTE}</p>
      </footer>
    </aside>
  );
}

/** One dot per stop. While standing anywhere, pick a dot to fly straight to that stop. */
function RouteStrip() {
  const flight = useApp(s => s.flight);
  const visited = useApp(s => s.visited);
  const hover = useApp(s => s.hover);
  const flyTo = useApp(s => s.flyTo);
  const here = currentStop(flight);
  const standing = standingAt(flight);
  const reduced = useMemo(prefersReducedMotion, []);
  return (
    <nav className="route-strip" aria-label="Route">
      <ol>
        {MACHINE_IDS.map((id, i) => {
          const m = MACHINE_BY_ID[id];
          const state = id === here ? (flight.stage === 'flying' ? 'next' : 'here') : visited[id] ? 'done' : 'todo';
          return (
            <li key={id} className={state} onMouseEnter={() => hover(id)} onMouseLeave={() => hover(null)}>
              <button
                type="button"
                className="hop"
                disabled={standing === null || standing === id}
                title={`${i + 1}. ${m.name}`}
                onClick={() => {
                  if (standing === null || standing === id) return;
                  flyTo(i, reduced ? 0 : flyDurationMs(hop(standing, i).distanceKm), standing);
                }}
              >
                <span className="sr-only">
                  Stop {i + 1}, {m.name}, {state === 'done' ? 'visited' : state === 'here' ? 'here now' : state === 'next' ? 'flying there' : 'ahead'}
                </span>
              </button>
              <span className="dot" aria-hidden="true" />
            </li>
          );
        })}
      </ol>
      <span className="route-label tabular">
        {flight.stage === 'prologue'
          ? 'On the ground · Valinor Hills'
          : flight.stage === 'epilogue'
            ? 'Home'
            : `Stop ${flight.leg + 1} of ${MACHINE_IDS.length} · ${MACHINE_BY_ID[MACHINE_IDS[flight.leg]].shortName}`}
      </span>
    </nav>
  );
}

function Lines({ lines, start = 0.2, step = 1.1, instant }: { lines: string[]; start?: number; step?: number; instant: boolean }) {
  return (
    <div className={`voice${instant ? ' instant' : ''}`}>
      {lines.map((line, i) => (
        <p key={i} className="voice-line" style={{ animationDelay: instant ? '0s' : `${start + i * step}s` }}>
          {line}
        </p>
      ))}
    </div>
  );
}

function HomeSky() {
  const nowMs = useApp(s => s.nowMs);
  const home = MACHINE_BY_ID[HOME];
  const sky = siteSky('mars', home.lat, home.lon, new Date(nowMs));
  return (
    <p className="sky-now">
      <span className="label">At Valinor Hills now</span> {skyWords(sky.elevationDeg, sky.localSolarHours)}
    </p>
  );
}

function Prologue() {
  const flyTo = useApp(s => s.flyTo);
  const reduced = useMemo(prefersReducedMotion, []);
  return (
    <div className="stage-panel">
      <p className="speaker">Ingenuity · Valinor Hills, Jezero crater</p>
      <Lines lines={PROLOGUE} instant={reduced} />
      <HomeSky />
      <button
        type="button"
        className="primary reveal"
        style={{ animationDelay: reduced ? '0s' : `${0.4 + PROLOGUE.length * 1.1}s` }}
        onClick={() => flyTo(0, reduced ? 0 : flyDurationMs(LEGS[0].distanceKm))}
      >
        Lift off <span aria-hidden="true">→</span>
      </button>
      <p className="jump-hint reveal" style={{ animationDelay: reduced ? '0s' : `${0.6 + PROLOGUE.length * 1.1}s` }}>
        Short on time? Pick any dot on the route above to fly straight to that stop.
      </p>
    </div>
  );
}

function Flying() {
  const flight = useApp(s => s.flight);
  const arrive = useApp(s => s.arrive);
  const flownKm = useApp(s => s.flownKm);
  const leg = hop(flight.from, flight.leg);
  const to = MACHINE_BY_ID[leg.to];
  const from = MACHINE_BY_ID[leg.from];
  // The scripted lines name the planned leg's geometry, so a direct hop gets a plain line instead.
  const lines = leg.onRoute ? LEG_SCRIPTS[leg.to].enRoute : [`Off the planned route: straight from ${from.shortName} to ${to.shortName}.`];
  const reduced = useMemo(prefersReducedMotion, []);
  const [k, setK] = useState(flight.flyMs === 0 ? 1 : 0);

  useEffect(() => {
    if (flight.flyMs === 0) {
      arrive();
      return;
    }
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - flight.stageStartedAt) / flight.flyMs);
      setK(t);
      if (t < 1) raf = requestAnimationFrame(step);
      else arrive();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [flight.flyMs, flight.stageStartedAt, arrive]);

  const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const legKm = leg.distanceKm * eased;

  return (
    <div className="stage-panel">
      <p className="speaker">
        {leg.onRoute ? `Leg ${flight.leg + 1}` : 'Direct hop'} · heading {compass(leg.bearingDeg)}
      </p>
      <h2 className="leg-title">
        <span className="dim">to</span> {to.name}
      </h2>
      <p className="leg-site">{to.site}</p>
      <div className="odometer tabular" aria-live="off">
        <span className="odo-big">{formatKm(legKm)}</span>
        <span className="odo-sub">
          of {formatKm(leg.distanceKm)} · Flight 73 so far {formatKm(flownKm + legKm)}
        </span>
      </div>
      <Lines lines={lines} start={0.3} step={1.6} instant={reduced} />
      <button type="button" className="ghost small" onClick={arrive}>
        Skip to {to.shortName} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

function Site() {
  const flight = useApp(s => s.flight);
  const flyTo = useApp(s => s.flyTo);
  const toEpilogue = useApp(s => s.toEpilogue);
  const ping = useApp(s => s.ping);
  const called = useApp(s => s.called);
  const machine = MACHINE_BY_ID[MACHINE_IDS[flight.leg]];
  const script = LEG_SCRIPTS[machine.id];
  const reduced = useMemo(prefersReducedMotion, []);
  const isHome = machine.id === HOME;
  const canCall = !machine.noRadio && !isHome;
  const [readAnyway, setReadAnyway] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  const answered = ping?.id === machine.id && ping.result !== null;
  const showStory = !canCall || answered || called[machine.id] === true || readAnyway;
  const last = flight.leg === MACHINE_IDS.length - 1;
  const next = last ? null : MACHINE_BY_ID[MACHINE_IDS[flight.leg + 1]];

  useEffect(() => {
    if (answered) storyRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [answered, reduced]);

  return (
    <article className="detail" aria-labelledby="machine-name">
      <MachineHeader machine={machine} />
      {canCall && <RadioCall machine={machine} />}
      {canCall && !showStory && (
        <button type="button" className="text-btn" onClick={() => setReadAnyway(true)}>
          Read its story without calling
        </button>
      )}
      {machine.noRadio && <p className="channel-note">It never had a radio of its own, so there is nobody to call. It can still tell you its story.</p>}

      <div ref={storyRef} className="result-anchor">
        {showStory && (
          <>
            <Story machine={machine} instant={reduced} />
            <blockquote className="inheritance" style={{ animationDelay: reduced ? '0s' : '5.2s' }}>
              <span className="speaker">Ingenuity</span>
              {script.inheritance}
            </blockquote>
            <button
              type="button"
              className="primary next-btn"
              style={{ animationDelay: reduced ? '0s' : '5.8s' }}
              onClick={() => (next ? flyTo(flight.leg + 1, reduced ? 0 : flyDurationMs(LEGS[flight.leg + 1].distanceKm)) : toEpilogue())}
            >
              {next ? (
                <>
                  Fly on to {next.shortName} <span aria-hidden="true">→</span>
                </>
              ) : (
                <>Settle down at home</>
              )}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function MachineHeader({ machine }: { machine: Machine }) {
  const nowMs = useApp(s => s.nowMs);
  const sky = siteSky('mars', machine.lat, machine.lon, new Date(nowMs));
  return (
    <>
      <p className="detail-kind">{machine.kind}</p>
      <h2 id="machine-name">{machine.name}</h2>
      <p className="detail-site">
        {machine.site}
        <span className="dim tabular">
          {' '}
          · {Math.abs(machine.lat).toFixed(2)}°{machine.lat >= 0 ? 'N' : 'S'} {Math.abs(machine.lon).toFixed(2)}°{machine.lon >= 0 ? 'E' : 'W'}
          {machine.approxPosition ? ' (approx.)' : ''}
        </span>
      </p>
      <dl className="dates">
        <div>
          <dt>Arrived</dt>
          <dd>{formatDate(machine.arrived)}</dd>
        </div>
        <div>
          <dt>{machine.lastContactLabel ?? 'Last signal'}</dt>
          <dd>{formatDate(machine.lastContact)}</dd>
        </div>
        <div>
          <dt>Planned</dt>
          <dd>{machine.plannedLife}</dd>
        </div>
        <div>
          <dt>Lasted</dt>
          <dd>{machine.actualLife}</dd>
        </div>
      </dl>
      <ul className="chips">
        {machine.facts.map(f => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="sky-now">
        <span className="label">Here, right now</span> {skyWords(sky.elevationDeg, sky.localSolarHours)}
      </p>
      {MODEL_NOTES[machine.id] && <p className="model-note">{MODEL_NOTES[machine.id]}</p>}
    </>
  );
}

function RadioCall({ machine }: { machine: Machine }) {
  const nowMs = useApp(s => s.nowMs);
  const ping = useApp(s => s.ping);
  const startPing = useApp(s => s.startPing);
  const resolvePing = useApp(s => s.resolvePing);
  const timer = useRef(0);
  const plan = useMemo(() => planCall(machine, new Date(nowMs)), [machine, nowMs]);
  const active = ping && ping.id === machine.id ? ping : null;
  const inFlight = active !== null && active.result === null;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const call = () => {
    if (inFlight) return;
    const p = planCall(machine, new Date());
    playSend('radio');
    startPing({ id: machine.id, startedAt: Date.now(), waitMs: p.waitMs });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      resolvePing();
      playSilence();
    }, p.waitMs);
  };

  return (
    <section className="radio" aria-label="Radio call">
      <dl className="live">
        <div className="live-row">
          <dt>Earth to Mars now</dt>
          <dd>{plan.path.distanceKm === null ? 'No reliable estimate' : formatDistance(plan.path.distanceKm)}</dd>
        </div>
        <div className="live-row">
          <dt>Radio round trip</dt>
          <dd>
            {plan.path.roundTripS === null ? '—' : formatDuration(plan.path.roundTripS)}
            {plan.speedup !== null && plan.speedup > 1 && <span className="dim"> · played {formatSpeedup(plan.speedup)} faster</span>}
          </dd>
        </div>
        <p className="live-note">{plan.path.note}</p>
      </dl>
      <button type="button" className="call radio" onClick={call} disabled={inFlight}>
        <span className="call-label">{active?.result ? 'Call again' : 'Call it from Earth'}</span>
        <span className="call-sub">Deep Space Network radio</span>
      </button>
      {active && <SignalMeter plan={plan} startedAt={active.startedAt} done={active.result !== null} />}
      <div aria-live="polite">{active?.result && <p className="result silent">{silenceLine(machine)}</p>}</div>
    </section>
  );
}

function SignalMeter({ plan, startedAt, done }: { plan: ReturnType<typeof planCall>; startedAt: number; done: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (done) {
      setElapsed(plan.waitMs);
      return;
    }
    let raf = 0;
    const step = () => {
      setElapsed(Math.min(plan.waitMs, Date.now() - startedAt));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [plan.waitMs, startedAt, done]);

  const k = plan.waitMs > 0 ? elapsed / plan.waitMs : 1;
  const realS = plan.path.roundTripS !== null ? k * plan.path.roundTripS : null;
  return (
    <div className={`meter radio ${done ? 'silent' : 'pending'}`}>
      <div className="meter-track" aria-hidden="true">
        <span className="meter-pulse" style={{ left: `${(k < 0.5 ? k * 2 : 2 - k * 2) * 100}%` }} />
        <span className="meter-end earth">Earth</span>
        <span className="meter-end target">Mars</span>
      </div>
      <div className="meter-read tabular">
        {done ? 'Window closed' : k < 0.5 ? 'Signal on its way' : 'Listening for a reply'} · {realS !== null ? `t+${formatDuration(realS)}` : 'distance unknown'}
      </div>
    </div>
  );
}

function Epilogue() {
  const setPhase = useApp(s => s.setPhase);
  const reduced = useMemo(prefersReducedMotion, []);
  return (
    <div className="stage-panel">
      <p className="speaker">Ingenuity · home again</p>
      <Lines lines={EPILOGUE} instant={reduced} />
      <div className="epilogue-stats reveal" style={{ animationDelay: reduced ? '0s' : `${0.4 + EPILOGUE.length * 1.1}s` }}>
        <div>
          <strong className="tabular">{formatKm(TOTAL_KM)}</strong>
          <span>Flight 73, imagined</span>
        </div>
        <div>
          <strong className="tabular">{REAL_FLIGHT_KM.toFixed(1)} km</strong>
          <span>72 real flights</span>
        </div>
      </div>
      <HomeSky />
      <button
        type="button"
        className="primary reveal"
        style={{ animationDelay: reduced ? '0s' : `${0.8 + EPILOGUE.length * 1.1}s` }}
        onClick={() => setPhase('report')}
      >
        Open the flight log <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
