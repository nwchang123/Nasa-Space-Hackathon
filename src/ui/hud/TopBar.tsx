// The top HUD bar, one slim row: the beacon and "Flight 73", the nine stops spread across the middle
// (pick any to fly straight there), then the distance flown, the UTC clock, the flight camera and
// the sound, the AR hangar (on the ground only), and the auto tour's switch (with "Resume" while the
// visitor has taken over). The controls are glyphs (icons.tsx), each named by aria-label and by
// a tooltip on hover or focus. Where we are is shown by the amber stop (and
// spelled out by the dock and site card), so the status line is for screen readers only.

import { useMemo, useState } from 'react';
import { MACHINE_BY_ID } from '../../data/machines';
import { HOME, TOTAL_KM, flyDurationMs, hop } from '../../flight/route';
import { HangarButton } from '../../hangar/HangarEntry';
import { currentStop, standingAt, useApp, type FlightState } from '../../store';
import { MACHINE_IDS } from '../../types';
import { formatKm } from '../callPlan';
import { isMuted, setMuted } from '../sound';
import { stopSpeaking } from '../voice';
import { prefersReducedMotion, useUtcClock } from '../useClock';
import { TourToggle } from './AutoTour';
import { ChaseGlyph, NavcamGlyph, RouteGlyph, SoundGlyph } from './icons';

export function TopBar() {
  const flight = useApp(s => s.flight);
  const flownKm = useApp(s => s.flownKm);
  const camMode = useApp(s => s.camMode);
  const setCamMode = useApp(s => s.setCamMode);
  const utc = useUtcClock();
  const [muted, setMutedState] = useState(isMuted());

  return (
    <header className="hud-top hud-panel-in">
      <div className="hud-where">
        <span className="beacon" aria-hidden="true" />
        <span className="hud-brand">Flight 73</span>
        <span className="sr-only">{statusLine(flight)}</span>
      </div>
      <RouteStrip />
      <div className="hud-tools">
        {/* While flying, the dock's odometer has the distance (and the camera toggle needs the room). */}
        {flight.stage !== 'flying' && (
          <span className="tabular dim hud-km hud-tip" data-tip={`${formatKm(flownKm)} flown of the ${formatKm(TOTAL_KM)} route`}>
            <RouteGlyph />
            {formatKm(flownKm)}
            <span className="sr-only"> flown</span>
          </span>
        )}
        <span className="tabular dim">{utc}</span>
        <span className="hud-sep" aria-hidden="true" />
        {flight.stage === 'flying' && (
          <div className="cam-toggle" role="group" aria-label="Flight camera">
            <button
              type="button"
              className="icon-btn glyph-btn hud-tip"
              aria-label="Orbit chase cam"
              data-tip="Chase cam"
              aria-pressed={camMode === 'chase'}
              onClick={() => setCamMode('chase')}
            >
              <ChaseGlyph />
            </button>
            <button
              type="button"
              className="icon-btn glyph-btn hud-tip"
              aria-label="Navcam black and white view"
              data-tip="Navcam · black and white"
              aria-pressed={camMode === 'navcam'}
              onClick={() => setCamMode('navcam')}
            >
              <NavcamGlyph />
            </button>
          </div>
        )}
        {/* While flying the camera toggle needs the room, and a leg is never left half flown. */}
        {flight.stage !== 'flying' && <HangarButton place="top" />}
        <TourToggle />
        <button
          type="button"
          className={`icon-btn glyph-btn hud-tip${muted ? ' muted' : ''}`}
          aria-label="Sound"
          data-tip={muted ? 'Sound off' : 'Sound on'}
          onClick={() => {
            const next = !muted;
            setMuted(next);
            if (next) stopSpeaking();
            setMutedState(next);
          }}
          aria-pressed={!muted}
        >
          <SoundGlyph muted={muted} />
        </button>
      </div>
    </header>
  );
}

function statusLine(f: FlightState): string {
  if (f.stage === 'prologue') return 'On the ground · Valinor Hills, Jezero crater';
  if (f.stage === 'epilogue') return 'Home · Valinor Hills';
  const to = MACHINE_BY_ID[MACHINE_IDS[f.leg]];
  if (f.stage === 'flying') {
    const h = hop(f.from, f.leg);
    const from = MACHINE_BY_ID[h.from];
    return `${h.onRoute ? `Leg ${f.leg + 1}` : 'Direct hop'} · ${from.shortName} → ${to.shortName}`;
  }
  return `Stop ${f.leg + 1} of ${MACHINE_IDS.length} · ${to.shortName}`;
}

/** One dot per stop, spread across the bar. While standing anywhere, pick a dot to fly straight there. */
function RouteStrip() {
  const flight = useApp(s => s.flight);
  const visited = useApp(s => s.visited);
  const hover = useApp(s => s.hover);
  const flyTo = useApp(s => s.flyTo);
  // Before lift-off and after landing, Ingenuity is at home.
  const here = flight.stage === 'prologue' || flight.stage === 'epilogue' ? HOME : currentStop(flight);
  const standing = standingAt(flight);
  const reduced = useMemo(prefersReducedMotion, []);
  return (
    <nav className="hud-route" aria-label="Route: pick any stop to fly straight there">
      <ol>
        {MACHINE_IDS.map((id, i) => {
          const m = MACHINE_BY_ID[id];
          const state = id === here ? (flight.stage === 'flying' ? 'next' : 'here') : visited[id] ? 'done' : 'todo';
          const home = id === HOME;
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
                <span className="dot" aria-hidden="true" />
                {/* On narrower windows only the stop we are at (or flying to) keeps its name; the
                    others show their number, and their name on hover or focus. */}
                <span className="stop-name" aria-hidden="true">
                  {i + 1}
                  <span className="stop-label"> · {home ? 'Home' : m.shortName}</span>
                </span>
                <span className="sr-only">
                  Stop {i + 1}, {m.name}, {state === 'done' ? 'visited' : state === 'here' ? 'here now' : state === 'next' ? 'flying there' : 'ahead'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
