// Bottom-left site card, kept small so the site itself fills the screen. Always shown: the
// machine's name, where it is (the place, then its coordinates on a mono line of their own), the
// 24 h local solar time scale (the scene relights the site for the picked hour) and a compact radio
// call from Earth with tonight's real light time. Everything else (kind, dates, facts, model note,
// radio details, sources) sits in a "Specs & Dossier" fold, closed by default, that scrolls inside
// the card when open; the card never grows into Ingenuity's radio feed above it (--feed-h).

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { siteSky, siteSkyAtHour } from '../../astro';
import { MODEL_NOTES } from '../../data/modelNotes';
import { HOME } from '../../flight/route';
import { useApp } from '../../store';
import type { Machine } from '../../types';
import { formatDate, formatDistance, formatDuration, formatSolarTime, formatSpeedup, planCall, silenceLine, skyWords } from '../callPlan';
import { playSend, playSilence } from '../sound';

const NO_RADIO_SHORT = 'No radio of its own: nobody to call.';
const NO_RADIO_LONG = 'It never had a radio of its own, so there is nobody to call. It can still tell you its story.';
const HOME_SHORT = 'No direct line from Earth: it only talked to Perseverance.';
const HOME_LONG =
  'Ingenuity can’t be called from Earth directly. It only ever talked to Perseverance, its base station, which relayed messages to and from Earth.';

const coords = (m: Machine) =>
  `${Math.abs(m.lat).toFixed(2)}°${m.lat >= 0 ? 'N' : 'S'} ${Math.abs(m.lon).toFixed(2)}°${m.lon >= 0 ? 'E' : 'W'}${m.approxPosition ? ' (approx.)' : ''}`;

export function SiteCard({ machine, standing }: { machine: Machine; standing: boolean }) {
  const isHome = machine.id === HOME;
  const canCall = standing && !machine.noRadio && !isHome;
  const [open, setOpen] = useState(false);
  const dossierId = useId();
  return (
    <aside className={`site-card hud-panel hud-panel-in${open ? ' open' : ''}`} aria-labelledby="site-card-name">
      <div className="card-fixed">
        <h2 id="site-card-name" className="card-name">
          {machine.name}
        </h2>
        <p className="card-site">{machine.site}</p>
        <p className="card-coords tabular">{coords(machine)}</p>
        <SunScrubber machine={machine} />
        {canCall && <RadioCall machine={machine} />}
        {standing && machine.noRadio && <p className="card-line">{NO_RADIO_SHORT}</p>}
        {isHome && <p className="card-line">{HOME_SHORT}</p>}
        <button type="button" className="dossier-toggle" aria-expanded={open} aria-controls={dossierId} onClick={() => setOpen(o => !o)}>
          <span aria-hidden="true">{open ? '−' : '+'}</span> Specs &amp; Dossier
        </button>
      </div>
      <div id={dossierId} className="dossier" hidden={!open} role="region" aria-label={`${machine.shortName}: specs and dossier`}>
        <p className="card-kind">{machine.kind}</p>
        <dl className="card-dates">
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
        {MODEL_NOTES[machine.id] && <p className="model-note">{MODEL_NOTES[machine.id]}</p>}
        {canCall && <RadioDetails machine={machine} />}
        {standing && machine.noRadio && <p className="channel-note">{NO_RADIO_LONG}</p>}
        {isHome && <p className="channel-note">{HOME_LONG}</p>}
        <p className="card-sources">
          <span>Sources</span>
          {machine.sources.map((s, i) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.label} aria-label={`Source: ${s.label}`}>
              [{i + 1}]
            </a>
          ))}
        </p>
      </div>
    </aside>
  );
}

/** The radio path tonight, in full (the card's call button shows only the round trip). */
function RadioDetails({ machine }: { machine: Machine }) {
  const nowMs = useApp(s => s.nowMs);
  const plan = useMemo(() => planCall(machine, new Date(nowMs)), [machine, nowMs]);
  return (
    <dl className="live card-live">
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
  );
}

/** 00:00 ──|── 24:00 on a quiet day-and-night tint. Live by default; dragging picks an hour of today's sol at this site. */
function SunScrubber({ machine }: { machine: Machine }) {
  const nowMs = useApp(s => s.nowMs);
  const siteHour = useApp(s => s.siteHour);
  const setSiteHour = useApp(s => s.setSiteHour);
  const live = useMemo(() => siteSky('mars', machine.lat, machine.lon, new Date(nowMs)), [machine, nowMs]);
  const liveHour = live.localSolarHours ?? 12;
  const hour = siteHour ?? liveHour;
  const el = siteHour === null ? live.elevationDeg : siteSkyAtHour(machine.lat, machine.lon, siteHour, new Date(nowMs)).elevationDeg;

  return (
    <div className={`scrub${siteHour === null ? ' is-live' : ''}`}>
      <div className="scrub-head">
        <span className="scrub-label">
          Local solar time <span className="scrub-time tabular">{formatSolarTime(hour)}</span>
        </span>
        {siteHour === null ? (
          <span className="live-pill">
            <span className="live-dot" aria-hidden="true" /> Live
          </span>
        ) : (
          <button type="button" className="live-pill live-btn" onClick={() => setSiteHour(null)} title="Reset to live" aria-label="Reset to live">
            <span className="live-dot" aria-hidden="true" /> Live
          </button>
        )}
      </div>
      <div className="scrub-track">
        <input
          type="range"
          min={0}
          max={24}
          step={0.05}
          value={hour}
          onChange={e => setSiteHour(Number(e.target.value))}
          aria-label={`Local solar time at ${machine.shortName}`}
          aria-valuetext={`${formatSolarTime(hour)} local solar time${siteHour === null ? ', live' : ''}`}
        />
        {siteHour !== null && <span className="scrub-live-tick" style={{ left: `calc(5px + (100% - 10px) * ${liveHour / 24})` }} title="Now" aria-hidden="true" />}
      </div>
      <div className="scrub-scale" aria-hidden="true">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <p className="scrub-read" aria-live="off">
        {skyWords(el, undefined)}
      </p>
    </div>
  );
}

function RadioCall({ machine }: { machine: Machine }) {
  const nowMs = useApp(s => s.nowMs);
  const ping = useApp(s => s.ping);
  const startPing = useApp(s => s.startPing);
  const resolvePing = useApp(s => s.resolvePing);
  const callRequest = useApp(s => s.callRequest);
  const firstRequest = useRef(callRequest);
  const timer = useRef(0);
  const plan = useMemo(() => planCall(machine, new Date(nowMs)), [machine, nowMs]);
  const active = ping && ping.id === machine.id ? ping : null;
  const inFlight = active !== null && active.result === null;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const call = () => {
    const state = useApp.getState();
    if (state.ping && state.ping.id === machine.id && state.ping.result === null) return;
    const p = planCall(machine, new Date());
    playSend('radio');
    startPing({ id: machine.id, startedAt: Date.now(), waitMs: p.waitMs });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      resolvePing();
      playSilence();
    }, p.waitMs);
  };

  // The antenna hotspot in the scene asks for a call.
  const callRef = useRef(call);
  callRef.current = call;
  useEffect(() => {
    if (callRequest !== firstRequest.current && callRequest > 0) {
      firstRequest.current = callRequest;
      callRef.current();
    }
  }, [callRequest]);

  return (
    <section className="radio card-radio" aria-label="Radio call">
      <button type="button" className="call radio card-call" onClick={call} disabled={inFlight}>
        {/* [ CALL FROM EARTH · 21M 55S ]: on a narrow card the round trip wraps as one piece. */}
        <span className="call-label">
          <span className="call-br" aria-hidden="true">
            [
          </span>{' '}
          {active?.result ? 'Call again' : 'Call from Earth'}
        </span>{' '}
        <span className="call-tail">
          <span className="call-sep" aria-hidden="true">
            ·
          </span>{' '}
          <span className="call-sub tabular" title="Radio round trip tonight">
            {plan.path.roundTripS === null ? (
              'No estimate'
            ) : (
              <>
                {formatDuration(plan.path.roundTripS)}
                <span className="sr-only"> radio round trip</span>
              </>
            )}
          </span>{' '}
          <span className="call-br" aria-hidden="true">
            ]
          </span>
        </span>
      </button>
      {active && active.result === null && <SignalMeter plan={plan} startedAt={active.startedAt} />}
      <div aria-live="polite">{active?.result && <p className="result silent">{silenceLine(machine)}</p>}</div>
    </section>
  );
}

/** While the call is out: the pulse to Mars and back. Once the window closes, the result line takes its place. */
function SignalMeter({ plan, startedAt }: { plan: ReturnType<typeof planCall>; startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setElapsed(Math.min(plan.waitMs, Date.now() - startedAt));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [plan.waitMs, startedAt]);

  const k = plan.waitMs > 0 ? elapsed / plan.waitMs : 1;
  const realS = plan.path.roundTripS !== null ? k * plan.path.roundTripS : null;
  return (
    <div className="meter radio pending">
      <div className="meter-track" aria-hidden="true">
        <span className="meter-pulse" style={{ left: `${(k < 0.5 ? k * 2 : 2 - k * 2) * 100}%` }} />
        <span className="meter-end earth">Earth</span>
        <span className="meter-end target">Mars</span>
      </div>
      <div className="meter-read tabular">
        {k < 0.5 ? 'Signal on its way' : 'Listening for a reply'} · {realS !== null ? `t+${formatDuration(realS)}` : 'distance unknown'}
        {plan.speedup !== null && plan.speedup > 1 && <span className="dim"> · {formatSpeedup(plan.speedup)} faster</span>}
      </div>
    </div>
  );
}
