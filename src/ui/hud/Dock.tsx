// The bottom-centre stage dock: one thing at a time (the prologue's rotor test, the leg being
// flown, one section of a machine's story behind four index tabs, the way home), with the main
// action always at its right. It never scrolls. It stands in the HUD's bottom console, with the
// 360° bearing ruler sitting on its top edge whenever that shows. Ingenuity's own lines (who it is,
// the legs, the way home) are spoken in its radio feed (src/scene/GuideBubble.tsx), not repeated
// here; the dock waits for the self-introduction before it offers the rotor test. With the auto
// tour on (AutoTour.tsx) it also shows the tour's marks: the section being read, the invitation to
// try the stop's action, the countdown to the next move.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { LEG_SCRIPTS, ROTOR_FAULT } from '../../data/flight';
import { MACHINE_BY_ID } from '../../data/machines';
import { LEGS, compass, hop } from '../../flight/route';
import { BOOST_FACTOR, STORY_KEYS, stageElapsed, useApp, type StorySection } from '../../store';
import { MACHINE_IDS } from '../../types';
import { formatKm } from '../callPlan';
import { OPENING_DESCENT_MS, testRotor } from '../../scene/choreo';
import { playFault } from '../sound';
import { RED_ZONE, useThrottle } from '../throttle';
import { ARRIVAL_HOLD_MS, INVITE_WAIT_MS, useFeed, useTour } from '../tour';
import { prefersReducedMotion } from '../useClock';
import { stopSpeaking } from '../voice';
import { flyOn, liftOff, pauseByHand, useCountdownLeft } from './AutoTour';
import { SignatureControls } from './Signature';
import './throttle.css';

/** The prologue's self-introduction is given up on (the rotor test offered anyway) this long after Begin, ms. */
const INTRO_GIVE_UP_MS = OPENING_DESCENT_MS + 45000;

/**
 * True once Ingenuity has said who it is at home (or the visitor skipped it, or it never came):
 * the rotor test waits for it, so the red-zone button never steals the opening.
 */
function useIntroHeard(): [boolean, () => void] {
  const step = useApp(s => s.prologue.step);
  const startedAt = useApp(s => s.flight.stageStartedAt);
  const heard = useFeed(f => f.key === 'prologue' && ((f.kind === 'intro' && f.done) || f.kind === 'imagine'));
  const [skipped, setSkipped] = useState(false);
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLate(true), Math.max(0, startedAt + INTRO_GIVE_UP_MS - Date.now()));
    return () => window.clearTimeout(t);
  }, [startedAt]);
  const skip = () => {
    stopSpeaking();
    setSkipped(true);
  };
  return [heard || skipped || late || step !== 'ready', skip];
}

/** "Next stop in 3 s · Pause": the auto tour's countdown, with a way to stop it. */
function TourCountdown({ what }: { what: string }) {
  const left = useCountdownLeft();
  if (left === null) return null;
  return (
    <p className="tour-count" aria-live="polite">
      <span className="tabular">
        {what} in {left} s
      </span>
      <span aria-hidden="true"> · </span>
      {/* A deliberate pause: the tour then waits for Resume instead of picking up by itself. */}
      <button type="button" className="text-btn tour-count-pause" onClick={pauseByHand}>
        Pause
      </button>
    </p>
  );
}

/** Ingenuity's 72 real flights covered 17.0 km in total (docs/FACT_CHECK.md, ingenuity). */
const REAL_FLIGHT_KM = 17.0;
/** Rotor test: from the fault to the turn to fiction, ms. */
export const FAULT_MS = 2400;
/**
 * The rotor test's throttle, held open by the visitor: how fast it opens while held and closes when
 * let go (per second), and how long a hold in the red zone lasts before the damaged blades fail, ms.
 */
const THROTTLE_RISE = 0.45;
const THROTTLE_FALL = 0.7;
const RED_HOLD_MS = 700;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

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

// ---------------------------------------------------------------- prologue

function PrologueDock() {
  const prologue = useApp(s => s.prologue);
  const setPrologue = useApp(s => s.setPrologue);
  const reduced = useMemo(prefersReducedMotion, []);
  const throttle = useThrottle(s => s.throttle);
  const holding = useThrottle(s => s.holding);
  const setHolding = useThrottle(s => s.setHolding);
  const nudge = useTour(s => s.nudge);
  const [introHeard, skipIntro] = useIntroHeard();
  const introRef = useRef(introHeard);
  introRef.current = introHeard;
  const { step, at } = prologue;

  // After the fault, the turn to fiction. Timed from the step's start, so it survives a remount.
  useEffect(() => {
    if (step !== 'fault') return;
    const id = window.setTimeout(() => setPrologue('imagine'), Math.max(0, at + FAULT_MS - Date.now()));
    return () => window.clearTimeout(id);
  }, [step, at, setPrologue]);

  // A closed throttle for this prologue, and closed again once it is left.
  useEffect(() => {
    const close = () => {
      const t = useThrottle.getState();
      t.setHolding(false);
      t.setThrottle(0);
    };
    close();
    return close;
  }, []);

  // The throttle, time-based: it opens while held (slower near the top, wobbling once above 0.7)
  // and closes when let go. Any throttle is the 'spinning' step; held in the red zone, the damaged
  // blades fail.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    let base = useThrottle.getState().throttle;
    let redSince: number | null = null;
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const th = useThrottle.getState();
      const app = useApp.getState();
      const st = app.prologue.step;
      const open = th.holding && (st === 'ready' || st === 'spinning');
      if (open) base = Math.min(1, base + THROTTLE_RISE * (1 - 0.6 * smooth(0.6, 1, base)) * dt);
      else base = Math.max(0, base - THROTTLE_FALL * dt);
      const wobble = open ? 0.012 * smooth(0.7, 0.9, base) * Math.sin(now * 0.023) * Math.sin(now * 0.0071 + 1) : 0;
      const value = Math.min(1, Math.max(0, base + wobble));
      if (Math.abs(value - th.throttle) > 1e-4 || (value === 0 && th.throttle !== 0)) th.setThrottle(value);
      if (st === 'ready' && base > 0) app.setPrologue('spinning');
      else if (st === 'spinning' && base === 0) app.setPrologue('ready');
      if (open && base >= RED_ZONE) {
        redSince ??= now;
        if (now - redSince >= RED_HOLD_MS || base >= 1) {
          redSince = null;
          th.setHolding(false);
          app.setPrologue('fault');
          playFault();
        }
      } else redSince = null;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Hold Space to open the throttle (not while typing; key repeats ignored), let go to close it.
  useEffect(() => {
    if (reduced) return;
    const testing = () => {
      const s = useApp.getState();
      return s.phase === 'flight' && s.flight.stage === 'prologue' && (s.prologue.step === 'ready' || s.prologue.step === 'spinning');
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target) || !testing() || !introRef.current) return;
      e.preventDefault();
      if (!e.repeat) useThrottle.getState().setHolding(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !useThrottle.getState().holding) return;
      e.preventDefault();
      useThrottle.getState().setHolding(false);
    };
    const release = () => useThrottle.getState().setHolding(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      release();
    };
  }, [reduced]);

  const imagine = step === 'imagine';
  const fault = step === 'fault';
  const pct = Math.round(throttle * 100);
  const red = throttle >= RED_ZONE;

  let action;
  if (imagine) {
    action = (
      <>
        <button type="button" className="primary dock-primary imagine reveal" onClick={liftOff}>
          Imagine Flight 73 · Lift off <span aria-hidden="true">→</span>
        </button>
        <TourCountdown what="Lift-off" />
      </>
    );
  } else if (!introHeard) {
    // Ingenuity is still saying who it is: the rotor test waits.
    action = (
      <div className="tour-listen">
        <p className="tour-listen-note">
          <span className="tour-listen-wave" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Ingenuity is on the radio
        </p>
        <button type="button" className="text-btn" onClick={skipIntro}>
          Skip to the rotor test <span aria-hidden="true">›</span>
        </button>
      </div>
    );
  } else if (reduced) {
    // Reduced motion: one click, straight to the fault's outcome.
    action = (
      <button type="button" className="primary dock-primary spin" onClick={() => setPrologue('imagine')}>
        Spin up rotors · test flight
      </button>
    );
  } else {
    const release = () => setHolding(false);
    action = (
      <>
        <div
          className={`thr-gauge${red ? ' thr-in-red' : ''}${fault ? ' thr-fault' : ''}`}
          style={{ '--thr-red': `${RED_ZONE * 100}%` } as CSSProperties}
          role="meter"
          aria-label="Rotor throttle"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="thr-head">
            <span className="thr-title">Throttle</span>
            <span className="thr-rpm">
              RPM <b>{Math.round(testRotor(throttle) * 100)} %</b> of flight speed
            </span>
          </div>
          <div className="thr-track">
            <span className="thr-fill" style={{ width: `${throttle * 100}%` }} />
            <span className="thr-needle" style={{ left: `${throttle * 100}%` }} />
          </div>
          <p className="thr-red-label">RED ZONE — blades damaged on Flight 72</p>
        </div>
        <button
          type="button"
          className={`primary dock-primary spin thr-hold${holding ? ' thr-holding' : ''}${fault ? ' busy' : ''}${nudge && !holding ? ' tour-nudge' : ''}`}
          disabled={fault}
          aria-pressed={holding}
          onPointerDown={e => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* not capturable: releasing over the button still works */
            }
            setHolding(true);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.repeat) setHolding(true);
          }}
          onKeyUp={e => {
            if (e.key === 'Enter') release();
          }}
          onContextMenu={e => e.preventDefault()}
        >
          {fault ? 'Rotor fault' : holding ? `Holding… throttle ${pct} %` : 'Hold to spin up'}
        </button>
        <p className="thr-hint">{nudge ? 'Hold Space or the button, or wait: I will try it myself.' : 'Hold Space or the button. Let go to throttle back.'}</p>
      </>
    );
  }

  // Ingenuity's own lines (who it is, then the turn to Flight 73) are said once, in its radio feed
  // at the top left (GuideBubble.tsx, with a replay chip); the dock only names the task beside its
  // control, so the same sentences never stand on screen twice.
  return (
    <div className="dock-grid">
      <div className="dock-main">
        <p className="speaker">Ingenuity · Valinor Hills, Jezero crater</p>
        {imagine ? (
          <>
            <p className="fault-note">Rotor test failed · {ROTOR_FAULT}</p>
            <h2 className="leg-title dock-task reveal">One last flight</h2>
          </>
        ) : (
          // Dim while Ingenuity is still on the radio (the side column says so, with a skip).
          <h2 className={`leg-title dock-task${introHeard ? '' : ' dim'}`}>Rotor test</h2>
        )}
      </div>
      <div className="dock-side">
        {action}
        {introHeard && <p className="jump-hint">Short on time? Pick any stop on the route above to fly straight there.</p>}
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
  const reduced = useMemo(prefersReducedMotion, []);
  const [k, setK] = useState(flight.flyMs === 0 ? 1 : 0);

  // Progress and arrival follow stageElapsed(), so boost speeds the odometer and the scene alike.
  // With the auto tour on, the landing waits (a little) for Ingenuity's lines on the way to end.
  useEffect(() => {
    if (flight.flyMs === 0) {
      arrive();
      return;
    }
    let raf = 0;
    const linesPending = (s: ReturnType<typeof useApp.getState>, over: number) => {
      const f = useFeed.getState();
      return s.autoTour && !s.tourPaused && f.key.startsWith('flying:') && !(f.kind === 'intro' && f.done) && over < ARRIVAL_HOLD_MS;
    };
    const step = () => {
      const s = useApp.getState();
      const elapsed = stageElapsed(s);
      const t = Math.min(1, elapsed / flight.flyMs);
      setK(t);
      if (t < 1 || linesPending(s, elapsed - flight.flyMs)) raf = requestAnimationFrame(step);
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
  const story = useApp(s => s.story);
  const setStory = useApp(s => s.setStory);
  const pauseTour = useApp(s => s.pauseTour);
  const touring = useApp(s => s.autoTour && !s.tourPaused);
  const chapter = useTour(s => s.chapter);
  const invite = useTour(s => s.invite);
  const machine = MACHINE_BY_ID[MACHINE_IDS[flight.leg]];
  const script = LEG_SCRIPTS[machine.id];
  const reduced = useMemo(prefersReducedMotion, []);
  const last = flight.leg === MACHINE_IDS.length - 1;
  const next = last ? null : MACHINE_BY_ID[MACHINE_IDS[flight.leg + 1]];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // A section picked by the visitor takes over from the auto tour.
  const choose = (i: number) => {
    pauseTour();
    setStory(i as StorySection);
  };
  const pick = (i: number) => {
    const j = ((i % 4) + 4) % 4;
    choose(j);
    tabs.current[j]?.focus();
  };

  return (
    <div className="dock-grid">
      <div className="dock-main">
        <div className="story-tabs" role="tablist" aria-label={`${machine.shortName}'s story`}>
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
              className={`story-tab${story === i ? ' on' : ''}`}
              title={label}
              onClick={() => choose(i)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight') pick(i + 1);
                if (e.key === 'ArrowLeft') pick(i - 1);
              }}
            >
              <span className="story-tab-n">{String(i + 1).padStart(2, '0')}</span> <span className="story-tab-label">{label}</span>
              {/* The auto tour reading this section: a hairline that runs out as it goes. */}
              {touring && chapter?.i === i && story === i && (
                <span key={chapter.at} className="tour-tick" style={{ animationDuration: `${chapter.ms}ms` }} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        <div id="story-panel" role="tabpanel" aria-labelledby={`story-tab-${story}`} className={`story-panel${reduced ? ' instant' : ''}`} key={story}>
          <p className="story-text">
            {machine.story[STORY_KEYS[story]]}
            {story < 3 && (
              <button type="button" className="text-btn story-next" onClick={() => choose(story + 1)}>
                Next · {STORY_LABELS[story + 1]} <span aria-hidden="true">›</span>
              </button>
            )}
          </p>
          {/* Ingenuity answers after the machine's last section, "Still here", so the other three
              sections stay one block of text and the dock stays low. */}
          {story === 3 && (
            <p className="inherit-line">
              <span className="speaker">Ingenuity</span> {script.inheritance}
            </p>
          )}
        </div>
      </div>
      <div className="dock-side">
        <div className={`tour-invite${invite && touring ? ' on' : ''}`}>
          <SignatureControls stop={machine.id} />
          {invite && touring && <TourInvite />}
        </div>
        <button
          type="button"
          className="primary dock-primary"
          onClick={flyOn}
        >
          {next ? (
            <>
              Fly on to {next.shortName} <span aria-hidden="true">→</span>
            </>
          ) : (
            <>Settle down at home</>
          )}
        </button>
        <TourCountdown what={next ? 'Next stop' : 'Home'} />
      </div>
    </div>
  );
}

/**
 * The auto tour's invitation to try the stop's action once, with a way past it. A hairline runs out
 * over the wait (starting again while the visitor uses the controls); then the tour moves on.
 */
function TourInvite() {
  const skip = () => useTour.setState({ skipAt: Date.now() });
  const since = useTour(s => s.inviteAt);
  return (
    <p className="tour-invite-note">
      <span key={since} className="tour-tick tour-invite-tick" style={{ animationDuration: `${INVITE_WAIT_MS}ms` }} aria-hidden="true" />
      <span>Your turn</span>
      <button type="button" className="text-btn" onClick={skip}>
        Skip this step <span aria-hidden="true">›</span>
      </button>
    </p>
  );
}

// ---------------------------------------------------------------- epilogue

function EpilogueDock() {
  const setPhase = useApp(s => s.setPhase);
  const reduced = useMemo(prefersReducedMotion, []);
  const totalKm = useMemo(() => LEGS[LEGS.length - 1].cumulativeKm, []);
  // Ingenuity's closing lines are said in its radio feed; the dock keeps the tally.
  return (
    <div className="dock-grid">
      <div className="dock-main">
        <p className="speaker">Ingenuity · home again</p>
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
      </div>
      <div className="dock-side">
        <button
          type="button"
          className="primary dock-primary reveal"
          style={{ animationDelay: reduced ? '0s' : '5s' }}
          onClick={() => setPhase('report')}
        >
          Open the flight log <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
