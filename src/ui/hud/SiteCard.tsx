// Bottom-left site telemetry card: what the machine is, where and when, its key facts, the 24 h
// local solar time scrubber (the scene relights the site for the picked hour), and the radio
// call from Earth with tonight's real light time.

import { useEffect, useMemo, useRef, useState } from 'react';
import { siteSky, siteSkyAtHour } from '../../astro';
import { MODEL_NOTES } from '../../data/modelNotes';
import { HOME } from '../../flight/route';
import { useApp } from '../../store';
import type { Machine } from '../../types';
import { formatDate, formatDistance, formatDuration, formatSolarTime, formatSpeedup, planCall, silenceLine, skyWords } from '../callPlan';
import { playSend, playSilence } from '../sound';

export function SiteCard({ machine, standing }: { machine: Machine; standing: boolean }) {
  const isHome = machine.id === HOME;
  const canCall = standing && !machine.noRadio && !isHome;
  return (
    <aside className="site-card hud-panel hud-panel-in" aria-labelledby="site-card-name">
      <p className="card-kind">{machine.kind}</p>
      <h2 id="site-card-name" className="card-name">
        {machine.name}
      </h2>
      <p className="card-site">
        {machine.site}
        <span className="dim tabular">
          {' '}
          · {Math.abs(machine.lat).toFixed(2)}°{machine.lat >= 0 ? 'N' : 'S'} {Math.abs(machine.lon).toFixed(2)}°{machine.lon >= 0 ? 'E' : 'W'}
          {machine.approxPosition ? ' (approx.)' : ''}
        </span>
      </p>
      <dl className="card-dates">
        <div>
          <dt>Arrived</dt>
          <dd>{formatDate(machine.arrived)}</dd>
        </div>
        <div>
          <dt>{machine.lastContactLabel ?? 'Last signal'}</dt>
          <dd>{formatDate(machine.lastContact)}</dd>
        </div>
      </dl>
      <ul className="chips">
        {machine.facts.map(f => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {MODEL_NOTES[machine.id] && <p className="model-note">{MODEL_NOTES[machine.id]}</p>}
      <SunScrubber machine={machine} />
      {canCall && <RadioCall machine={machine} />}
      {standing && machine.noRadio && (
        <p className="channel-note">It never had a radio of its own, so there is nobody to call. It can still tell you its story.</p>
      )}
      {isHome && (
        <p className="channel-note">
          Ingenuity can’t be called from Earth directly. It only ever talked to Perseverance, its base station, which relayed messages to and from
          Earth.
        </p>
      )}
      <p className="card-sources">
        <span>Sources</span>
        {machine.sources.map((s, i) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.label} aria-label={`Source: ${s.label}`}>
            [{i + 1}]
          </a>
        ))}
      </p>
    </aside>
  );
}

/** 00:00 ──●── 24:00. Live by default; dragging picks an hour of today's sol at this site. */
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
        <span className="scrub-label">Local solar time</span>
        {siteHour === null ? (
          <span className="live-pill">
            <span className="beacon" aria-hidden="true" /> Live now
          </span>
        ) : (
          <button type="button" className="icon-btn" onClick={() => setSiteHour(null)}>
            Reset to live
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
        {siteHour !== null && <span className="scrub-live-tick" style={{ left: `${(liveHour / 24) * 100}%` }} title="Now" aria-hidden="true" />}
      </div>
      <div className="scrub-scale" aria-hidden="true">
        <span>00:00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24:00</span>
      </div>
      <p className="scrub-read tabular" aria-live="off">
        {skyWords(el, hour)}
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
      </div>
    </div>
  );
}
