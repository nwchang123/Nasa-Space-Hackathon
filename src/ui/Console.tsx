import { useEffect, useMemo, useRef, useState } from 'react';
import { siteSky } from '../astro';
import { MACHINES, MACHINE_BY_ID } from '../data/machines';
import { useApp, type Channel } from '../store';
import type { Machine, ViewId, World } from '../types';
import {
  type CallPlan,
  formatDate,
  formatDistance,
  formatDuration,
  formatSolarTime,
  formatSpeedup,
  laserHint,
  planCall,
  resultLine,
} from './callPlan';
import { isMuted, playEcho, playSend, playSilence, setMuted } from './sound';
import { Story } from './Story';
import { prefersReducedMotion, useUtcClock } from './useClock';

const WORLD_LABEL: Record<World, string> = { moon: 'Moon', mars: 'Mars', deep: 'Deep space' };
const TABS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'All' },
  { id: 'moon', label: 'Moon' },
  { id: 'mars', label: 'Mars' },
  { id: 'deep', label: 'Deep space' },
];

export function Console() {
  const view = useApp(s => s.view);
  const setView = useApp(s => s.setView);
  const selectedId = useApp(s => s.selectedId);
  const select = useApp(s => s.select);
  const called = useApp(s => s.called);
  const setPhase = useApp(s => s.setPhase);
  const utc = useUtcClock();
  const [muted, setMutedState] = useState(isMuted());
  const machine = selectedId ? MACHINE_BY_ID[selectedId] : null;
  const calledCount = Object.keys(called).length;
  const echoes = Object.values(called).filter(r => r === 'echo').length;

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    <aside className="console" aria-label="Roll call console">
      <header className="console-head">
        <div className="brand">
          <span className="beacon" aria-hidden="true" />
          Still Here <span className="dim">· DSN night shift</span>
        </div>
        <div className="head-right">
          <span className="tabular dim">{utc}</span>
          <button type="button" className="icon-btn" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Worlds">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={view === t.id && !machine ? 'tab active' : 'tab'}
            aria-current={view === t.id && !machine ? 'true' : undefined}
            onClick={() => {
              select(null);
              setView(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="console-body">
        {machine ? <MachineDetail machine={machine} onBack={() => select(null)} /> : <RollList view={view} />}
      </div>

      <footer className="console-foot">
        <div className="progress" aria-label={`${calledCount} of ${MACHINES.length} called`}>
          <div className="progress-bar">
            <span style={{ width: `${(calledCount / MACHINES.length) * 100}%` }} />
          </div>
          <span className="tabular">
            {calledCount}/{MACHINES.length} called
            {echoes > 0 && <span className="green"> · {echoes} answered</span>}
          </span>
        </div>
        <button type="button" className={calledCount === MACHINES.length ? 'primary small' : 'ghost small'} disabled={calledCount === 0} onClick={() => setPhase('report')}>
          {calledCount === MACHINES.length ? 'File the report' : 'End shift'}
        </button>
      </footer>
    </aside>
  );
}

function RollList({ view }: { view: ViewId }) {
  const select = useApp(s => s.select);
  const hover = useApp(s => s.hover);
  const called = useApp(s => s.called);
  const worlds: World[] = view === 'overview' ? ['moon', 'mars', 'deep'] : [view];
  const calledCount = Object.keys(called).length;

  return (
    <div className="roll">
      {calledCount === 0 && (
        <div className="briefing">
          <p>
            Eighteen machines are on tonight&rsquo;s list. Pick one on a globe or below, then call it. Your console has two
            channels: <b>radio</b>, which needs a working machine at the other end, and <b>laser</b>, which needs only a
            mirror.
          </p>
        </div>
      )}
      {worlds.map(w => (
        <section key={w} className="roll-group">
          <h3>
            {WORLD_LABEL[w]} <span className="dim tabular">{MACHINES.filter(m => m.world === w).length}</span>
          </h3>
          <ul>
            {MACHINES.filter(m => m.world === w).map(m => {
              const status = called[m.id];
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`roll-item ${status ?? 'uncalled'}`}
                    onClick={() => select(m.id)}
                    onMouseEnter={() => hover(m.id)}
                    onMouseLeave={() => hover(null)}
                    onFocus={() => hover(m.id)}
                    onBlur={() => hover(null)}
                  >
                    <span className="glyph" aria-hidden="true" />
                    <span className="roll-name">{m.shortName}</span>
                    <span className="roll-site">{m.site}</span>
                    <span className="roll-status">{status === 'echo' ? 'answered' : status === 'silent' ? 'silent' : m.lastContact.slice(0, 4)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SkyLine({ machine, nowMs }: { machine: Machine; nowMs: number }) {
  if (machine.world === 'deep' || machine.lat === undefined || machine.lon === undefined) return null;
  const sky = siteSky(machine.world, machine.lat, machine.lon, new Date(nowMs));
  const sun = sky.isDay ? `Sun ${Math.round(sky.elevationDeg)}° above the horizon` : `Sun ${Math.round(-sky.elevationDeg)}° below the horizon`;
  const when = machine.world === 'moon' ? (sky.isDay ? 'lunar day' : 'lunar night') : `local solar time ${formatSolarTime(sky.localSolarHours ?? 0)}`;
  return (
    <div className="live-row">
      <dt>Sky there now</dt>
      <dd>
        {sun} · {when}
      </dd>
    </div>
  );
}

function MachineDetail({ machine, onBack }: { machine: Machine; onBack: () => void }) {
  const nowMs = useApp(s => s.nowMs);
  const ping = useApp(s => s.ping);
  const called = useApp(s => s.called);
  const startPing = useApp(s => s.startPing);
  const resolvePing = useApp(s => s.resolvePing);
  const [lastPlan, setLastPlan] = useState<CallPlan | null>(null);
  const timer = useRef(0);
  const reduced = useMemo(prefersReducedMotion, []);

  const radioPlan = useMemo(() => planCall(machine, 'radio', new Date(nowMs)), [machine, nowMs]);
  const laserPlan = useMemo(() => planCall(machine, 'laser', new Date(nowMs)), [machine, nowMs]);
  const path = radioPlan.path;

  const active = ping && ping.id === machine.id ? ping : null;
  const inFlight = active !== null && active.result === null;
  const status = called[machine.id];
  const showStory = (active?.result != null) || (status !== undefined && !inFlight && active === null);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    setLastPlan(null);
  }, [machine.id]);

  const call = (channel: Channel) => {
    const plan = planCall(machine, channel, new Date());
    if (!plan.available || inFlight) return;
    setLastPlan(plan);
    playSend(channel);
    startPing({ id: machine.id, channel, startedAt: Date.now(), waitMs: plan.waitMs });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      resolvePing(plan.result);
      if (plan.result === 'echo') playEcho();
      else playSilence();
    }, plan.waitMs);
  };

  const hint = lastPlan && active?.result ? laserHint(machine, lastPlan, status === 'echo') : null;

  return (
    <article className="detail" aria-labelledby="machine-name">
      <button type="button" className="back" onClick={onBack} disabled={inFlight}>
        <span aria-hidden="true">←</span> Roll call
      </button>
      <p className="detail-kind">
        {machine.kind} · {WORLD_LABEL[machine.world]}
      </p>
      <h2 id="machine-name">{machine.name}</h2>
      <p className="detail-site">
        {machine.site}
        {machine.lat !== undefined && machine.lon !== undefined && (
          <span className="dim tabular">
            {' '}
            · {Math.abs(machine.lat).toFixed(2)}°{machine.lat >= 0 ? 'N' : 'S'} {Math.abs(machine.lon).toFixed(2)}°{machine.lon >= 0 ? 'E' : 'W'}
            {machine.approxPosition ? ' (approx.)' : ''}
          </span>
        )}
      </p>
      <dl className="dates">
        <div>
          <dt>Arrived</dt>
          <dd>{formatDate(machine.arrived)}</dd>
        </div>
        <div>
          <dt>Last signal</dt>
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

      <dl className="live">
        <SkyLine machine={machine} nowMs={nowMs} />
        <div className="live-row">
          <dt>Distance now</dt>
          <dd>
            {path.distanceKm === null ? 'No reliable estimate' : `${path.estimate ? '~' : ''}${formatDistance(path.distanceKm)}`}
          </dd>
        </div>
        <div className="live-row">
          <dt>Light round trip</dt>
          <dd>
            {path.roundTripS === null ? '—' : `${path.estimate ? '~' : ''}${formatDuration(path.roundTripS)}`}
            {radioPlan.speedup !== null && radioPlan.speedup > 1 && <span className="dim"> · console plays it {formatSpeedup(radioPlan.speedup)} faster</span>}
          </dd>
        </div>
        <p className="live-note">{path.note}</p>
      </dl>

      <div className="channels" role="group" aria-label="Call channels">
        <button type="button" className="call radio" onClick={() => call('radio')} disabled={inFlight}>
          <span className="call-label">Radio call</span>
          <span className="call-sub">needs a working machine</span>
        </button>
        <button
          type="button"
          className="call laser"
          onClick={() => call('laser')}
          disabled={inFlight || !laserPlan.available}
          title={laserPlan.unavailableReason}
        >
          <span className="call-label">Laser ranging</span>
          <span className="call-sub">{laserPlan.available ? 'needs only a mirror' : 'Moon only'}</span>
        </button>
      </div>
      {!laserPlan.available && !inFlight && !showStory && <p className="channel-note">{laserPlan.unavailableReason}</p>}

      {active && lastPlan && <SignalMeter plan={lastPlan} startedAt={active.startedAt} result={active.result} reduced={reduced} />}

      <div aria-live="polite">
        {active?.result && lastPlan && (
          <p className={`result ${active.result}`}>
            {resultLine(machine, lastPlan)}
            {active.result === 'echo' && lastPlan.path.distanceKm !== null && lastPlan.path.roundTripS !== null && (
              <>
                <br />
                <span className="tabular">
                  Round trip {formatDuration(lastPlan.path.roundTripS)} → distance {formatDistance(lastPlan.path.distanceKm)}.
                </span>
              </>
            )}
          </p>
        )}
        {hint && <p className="hint">{hint}</p>}
      </div>

      {showStory && <Story machine={machine} instant={reduced || (active === null && status !== undefined)} />}
    </article>
  );
}

function SignalMeter({ plan, startedAt, result, reduced }: { plan: CallPlan; startedAt: number; result: 'silent' | 'echo' | null; reduced: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (result !== null) {
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
  }, [plan.waitMs, startedAt, result]);

  const k = plan.waitMs > 0 ? elapsed / plan.waitMs : 1;
  const realS = plan.path.roundTripS !== null ? k * plan.path.roundTripS : null;
  const phase = k < 0.5 ? 'outbound' : 'return';

  return (
    <div className={`meter ${plan.channel} ${result ?? 'pending'}${reduced ? ' reduced' : ''}`}>
      <div className="meter-track" aria-hidden="true">
        <span className="meter-pulse" style={{ left: `${(k < 0.5 ? k * 2 : 2 - k * 2) * 100}%` }} />
        <span className="meter-end earth">Earth</span>
        <span className="meter-end target">Target</span>
      </div>
      <div className="meter-read tabular">
        {result === null ? (phase === 'outbound' ? 'Signal outbound' : 'Listening for a return') : 'Window closed'} ·{' '}
        {realS !== null ? `t+${formatDuration(realS)}` : 'distance unknown'}
        {plan.speedup !== null && plan.speedup > 1 && <span className="dim"> (×{formatSpeedup(plan.speedup).replace('×', '')})</span>}
      </div>
    </div>
  );
}
