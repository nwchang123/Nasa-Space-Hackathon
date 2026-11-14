// The top HUD bar: the nine stops spread across the screen (pick any to fly straight there), then
// where we are, the distance flown, the UTC clock, the flight camera and the sound.

import { useMemo, useState } from 'react';
import { MACHINE_BY_ID } from '../../data/machines';
import { HOME, TOTAL_KM, flyDurationMs, hop } from '../../flight/route';
import { currentStop, standingAt, useApp, type FlightState } from '../../store';
import { MACHINE_IDS } from '../../types';
import { formatKm } from '../callPlan';
import { isMuted, setMuted } from '../sound';
import { prefersReducedMotion, useUtcClock } from '../useClock';

export function TopBar() {
  const flight = useApp(s => s.flight);
  const flownKm = useApp(s => s.flownKm);
  const camMode = useApp(s => s.camMode);
  const setCamMode = useApp(s => s.setCamMode);
  const utc = useUtcClock();
  const [muted, setMutedState] = useState(isMuted());

  return (
    <header className="hud-top hud-panel-in">
      <RouteStrip />
      <div className="hud-top-row">
        <div className="hud-where">
          <span className="beacon" aria-hidden="true" />
          <span className="hud-brand">Flight 73</span>
          <span className="hud-status">{statusLine(flight)}</span>
        </div>
        <div className="hud-tools">
          <span className="tabular dim hud-km">
            {formatKm(flownKm)} flown · route {formatKm(TOTAL_KM)}
          </span>
          <span className="tabular dim">{utc}</span>
          {flight.stage === 'flying' && (
            <div className="cam-toggle" role="group" aria-label="Flight camera">
              <button type="button" className="icon-btn" aria-pressed={camMode === 'chase'} onClick={() => setCamMode('chase')}>
                Orbit chase cam
              </button>
              <button type="button" className="icon-btn" aria-pressed={camMode === 'navcam'} onClick={() => setCamMode('navcam')}>
                Navcam B&amp;W view
              </button>
            </div>
          )}
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
                <span className="stop-name" aria-hidden="true">
                  {i + 1} · {home ? 'Home' : m.shortName}
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
