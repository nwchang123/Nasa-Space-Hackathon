// The bottom-centre stage dock: one thing at a time (the prologue's rotor test, the leg being
// flown, one section of a machine's story, the way home), with the main action always at its
// right. It never scrolls.

import { useEffect, useMemo, useRef, useState } from 'react';
import { EPILOGUE, LEG_SCRIPTS, PROLOGUE, PROLOGUE_TEST_AT, ROTOR_FAULT } from '../../data/flight';
import { MACHINE_BY_ID } from '../../data/machines';
import { LEGS, compass, flyDurationMs, hop } from '../../flight/route';
import { BOOST_FACTOR, STORY_KEYS, stageElapsed, useApp, type StorySection } from '../../store';
import { MACHINE_IDS } from '../../types';
import { formatKm } from '../callPlan';
import { playFault, playSpinUp } from '../sound';
import { prefersReducedMotion } from '../useClock';
import { SignatureControls } from './Signature';

/** Ingenuity's 72 real flights covered 17.0 km in total (docs/FACT_CHECK.md, ingenuity). */
const REAL_FLIGHT_KM = 17.0;
/** Rotor test: spin-up until the stall, then the fault until the turn to fiction, ms. */
export const SPIN_UP_MS = 1400;
export const FAULT_MS = 2400;

const STORY_LABELS = ['Why I came', 'What I found', 'My last day', 'Still here'] as const;

export function Dock() {
  const stage = useApp(s => s.flight.stage);
  const leg = useApp(s => s.flight.leg);
  return (
    <section className={`dock hud-panel hud-panel-in dock-${stage}`} key={`${stage}-${leg}`} aria-label="Flight 73">
      {stage === 'prologue' && <PrologueDock />}
      {stage === 'flying' && <FlyingDock />}
      {stage === 'site' && <SiteDock />}
      {stage === 'epilogue' && <EpilogueDock />}
    </section>
  );
}

function Lines({ lines, start = 0.2, step = 0.4, instant, big = false }: { lines: string[]; start?: number; step?: number; instant: boolean; big?: boolean }) {
  return (
    <div className={`voice${instant ? ' instant' : ''}${big ? ' big' : ''}`}>
      {lines.map((line, i) => (
        <p key={line} className="voice-line" style={{ animationDelay: instant ? '0s' : `${start + i * step}s` }}>
          {line}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- prologue

function PrologueDock() {
  const prologue = useApp(s => s.prologue);
  const setPrologue = useApp(s => s.setPrologue);
  const flyTo = useApp(s => s.flyTo);
  const reduced = useMemo(prefersReducedMotion, []);
  const { step, at } = prologue;

  // The test runs on its own once started: stall, fault, then the turn to fiction. Timed from the
  // step's start, so it survives a remount.
  useEffect(() => {
    if (step === 'spinning') {
      const id = window.setTimeout(() => {
        setPrologue('fault');
        playFault();
      }, Math.max(0, at + SPIN_UP_MS - Date.now()));
      return () => window.clearTimeout(id);
    }
    if (step === 'fault') {
      const id = window.setTimeout(() => setPrologue('imagine'), Math.max(0, at + FAULT_MS - Date.now()));
      return () => window.clearTimeout(id);
    }
  }, [step, at, setPrologue]);

  const spinUp = () => {
    if (reduced) {
      setPrologue('imagine');
      return;
    }
    setPrologue('spinning');
    playSpinUp(SPIN_UP_MS);
  };

  const before = PROLOGUE.slice(0, PROLOGUE_TEST_AT);
  const after = PROLOGUE.slice(PROLOGUE_TEST_AT);
  const imagine = step === 'imagine';

  return (
    <div className="dock-grid">
      <div className="dock-main">
        <p className="speaker">Ingenuity · Valinor Hills, Jezero crater</p>
        {imagine ? (
          <>
            <p className="fault-note">Rotor test failed · {ROTOR_FAULT}</p>
            <Lines lines={after} start={0.1} step={0.9} instant={reduced} big />
          </>
        ) : (
          <Lines lines={before} instant={reduced} />
        )}
      </div>
      <div className="dock-side">
        {imagine ? (
          <button type="button" className="primary dock-primary imagine reveal" onClick={() => flyTo(0, reduced ? 0 : flyDurationMs(LEGS[0].distanceKm))}>
            Imagine Flight 73 · Lift off <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            type="button"
            className={`primary dock-primary spin${step !== 'ready' ? ' busy' : ''}`}
            onClick={spinUp}
            disabled={step !== 'ready'}
            aria-live="polite"
          >
            {step === 'ready' ? 'Spin up rotors · test flight' : step === 'spinning' ? 'Spinning up…' : 'Rotor fault'}
          </button>
        )}
        <p className="jump-hint">Short on time? Pick any stop on the route above to fly straight there.</p>
      </div>
    </div>
  );
}

/** The amber-red alarm while the rotor test stalls. */
export function FaultBanner() {
  const step = useApp(s => s.prologue.step);
  const stage = useApp(s => s.flight.stage);
  if (stage !== 'prologue' || step !== 'fault') return null;
  return (
    <div className="fault-bar" role="alert">
      <span aria-hidden="true">!</span> {ROTOR_FAULT} <span aria-hidden="true">!</span>
    </div>
  );
}

// ---------------------------------------------------------------- flying

const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

function FlyingDock() {
  const flight = useApp(s => s.flight);
  const arrive = useApp(s => s.arrive);
  const flownKm = useApp(s => s.flownKm);
  const boost = useApp(s => s.boost);
  const setBoost = useApp(s => s.setBoost);
  const leg = hop(flight.from, flight.leg);
  const to = MACHINE_BY_ID[leg.to];
  const from = MACHINE_BY_ID[leg.from];
  // The scripted lines name the planned leg's geometry, so a direct hop gets a plain line instead.
  const lines = leg.onRoute ? LEG_SCRIPTS[leg.to].enRoute : [`Off the planned route: straight from ${from.shortName} to ${to.shortName}.`];
  const reduced = useMemo(prefersReducedMotion, []);
  const [k, setK] = useState(flight.flyMs === 0 ? 1 : 0);

  // Progress and arrival follow stageElapsed(), so boost speeds the odometer and the scene alike.
  useEffect(() => {
    if (flight.flyMs === 0) {
      arrive();
      return;
    }
    let raf = 0;
    const step = () => {
      const t = Math.min(1, stageElapsed(useApp.getState()) / flight.flyMs);
      setK(t);
      if (t < 1) raf = requestAnimationFrame(step);
      else arrive();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [flight.flyMs, flight.stageStartedAt, arrive]);

  const legKm = leg.distanceKm * easeInOut(k);

  return (
    <div className="dock-grid">
      <div className="dock-main">
        <p className="speaker">
          {leg.onRoute ? `Leg ${flight.leg + 1}` : 'Direct hop'} · heading {compass(leg.bearingDeg)}
        </p>
        <h2 className="leg-title">
          <span className="dim">to</span> {to.name}
        </h2>
        <p className="leg-site">{to.site}</p>
        <Lines lines={lines} start={0.3} step={1.6} instant={reduced} />
      </div>
      <div className="dock-side">
        <div className={`odometer tabular${boost ? ' boosting' : ''}`} aria-live="off">
          <span className="odo-big">{formatKm(legKm)}</span>
          <span className="odo-sub">
            of {formatKm(leg.distanceKm)} · Flight 73 so far {formatKm(flownKm + legKm)}
          </span>
        </div>
        {!reduced && (
          <button
            type="button"
            className={`ghost boost-btn${boost ? ' on' : ''}`}
            aria-pressed={boost}
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setBoost(true);
            }}
            onPointerUp={() => setBoost(false)}
            onPointerCancel={() => setBoost(false)}
            onLostPointerCapture={() => setBoost(false)}
            onKeyDown={e => {
              if (e.key === 'Enter') setBoost(true);
            }}
            onKeyUp={e => {
              if (e.key === 'Enter') setBoost(false);
            }}
          >
            {boost ? `Boost ×${BOOST_FACTOR}` : 'Hold Space / click to boost'}
          </button>
        )}
        <button type="button" className="text-btn skip-btn" onClick={arrive}>
          Skip to {to.shortName} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- site

function SiteDock() {
  const flight = useApp(s => s.flight);
  const flyTo = useApp(s => s.flyTo);
  const toEpilogue = useApp(s => s.toEpilogue);
  const story = useApp(s => s.story);
  const setStory = useApp(s => s.setStory);
  const machine = MACHINE_BY_ID[MACHINE_IDS[flight.leg]];
  const script = LEG_SCRIPTS[machine.id];
  const reduced = useMemo(prefersReducedMotion, []);
  const last = flight.leg === MACHINE_IDS.length - 1;
  const next = last ? null : MACHINE_BY_ID[MACHINE_IDS[flight.leg + 1]];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (i: number) => {
    const j = ((i % 4) + 4) % 4;
    setStory(j as StorySection);
    tabs.current[j]?.focus();
  };

  return (
    <div className="dock-grid">
      <div className="dock-main">
        <div className="capsules" role="tablist" aria-label={`${machine.shortName}'s story`}>
          {STORY_LABELS.map((label, i) => (
            <button
              key={label}
              ref={el => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`story-tab-${i}`}
              aria-selected={story === i}
              aria-controls="story-panel"
              tabIndex={story === i ? 0 : -1}
              className={`capsule${story === i ? ' on' : ''}`}
              onClick={() => setStory(i as StorySection)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight') pick(i + 1);
                if (e.key === 'ArrowLeft') pick(i - 1);
              }}
            >
              <span className="capsule-n">{String(i + 1).padStart(2, '0')}</span> {label}
            </button>
          ))}
        </div>
        <div id="story-panel" role="tabpanel" aria-labelledby={`story-tab-${story}`} className={`story-panel${reduced ? ' instant' : ''}`} key={story}>
          <p className="story-text">{machine.story[STORY_KEYS[story]]}</p>
          {story < 3 && (
            <button type="button" className="text-btn story-next" onClick={() => setStory((story + 1) as StorySection)}>
              Next · {STORY_LABELS[story + 1]} <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
        <p className="inherit-line">
          <span className="speaker">Ingenuity</span> {script.inheritance}
        </p>
      </div>
      <div className="dock-side">
        <SignatureControls stop={machine.id} />
        <button
          type="button"
          className="primary dock-primary"
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- epilogue

function EpilogueDock() {
  const setPhase = useApp(s => s.setPhase);
  const reduced = useMemo(prefersReducedMotion, []);
  const totalKm = useMemo(() => LEGS[LEGS.length - 1].cumulativeKm, []);
  return (
    <div className="dock-grid">
      <div className="dock-main">
        <p className="speaker">Ingenuity · home again</p>
        <Lines lines={EPILOGUE} step={0.9} instant={reduced} />
      </div>
      <div className="dock-side">
        <div className="epilogue-stats">
          <div>
            <strong className="tabular">{formatKm(totalKm)}</strong>
            <span>Flight 73, imagined</span>
          </div>
          <div>
            <strong className="tabular">{REAL_FLIGHT_KM.toFixed(1)} km</strong>
            <span>72 real flights</span>
          </div>
        </div>
        <button
          type="button"
          className="primary dock-primary reveal"
          style={{ animationDelay: reduced ? '0s' : `${0.6 + EPILOGUE.length * 0.9}s` }}
          onClick={() => setPhase('report')}
        >
          Open the flight log <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
