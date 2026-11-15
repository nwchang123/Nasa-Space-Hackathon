// Site tools at the top right, under the route bar, at each stop: one segmented strip. Back to the
// wide view (the close-up, the orbit and the camera following Ingenuity all let go, and Ingenuity
// flies home and lands), the scout camera switch (key C, Esc to close) with its capture button while
// it is on, and a "?" that opens how to fly Ingenuity and look around (closed by default, so the sky
// stays clear; Esc closes it too).

import { useEffect, useId, useState } from 'react';
import { live } from '../../scene/registry';
import { HOME } from '../../flight/route';
import { currentStop, useApp } from '../../store';
import { playShutter } from '../sound';
import { notifyScoutMiss } from './ScoutCam';
import './sitetools.css';

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * Take a scout photo: the shutter now, the frame grabbed by the scene on its next frame. With no
 * hotspot in the viewfinder there is nothing to capture: the viewfinder only says so.
 */
export function captureScoutPhoto() {
  if (live.scoutTarget === null) {
    notifyScoutMiss();
    return;
  }
  playShutter();
  useApp.getState().requestSnapshot();
}

export function FocusControls() {
  const atSite = useApp(s => s.phase === 'flight' && s.flight.stage === 'site');
  // Home: the real, broken Ingenuity cannot fly (SiteFlight), so the help leaves flying out.
  const atHome = useApp(s => currentStop(s.flight) === HOME);
  const focused = useApp(s => s.focus !== null);
  const scoutCam = useApp(s => s.scoutCam);
  const setScoutCam = useApp(s => s.setScoutCam);
  const resetView = useApp(s => s.resetView);
  const [help, setHelp] = useState(false);
  const helpId = useId();

  // C: scout camera on and off; Escape: off, and the help closes.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useApp.getState();
      if (s.phase !== 'flight' || s.flight.stage !== 'site') return;
      if (e.code === 'KeyC') s.setScoutCam(!s.scoutCam);
      else if (e.code === 'Escape') {
        if (s.scoutCam) s.setScoutCam(false);
        setHelp(false);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  if (!atSite) return null;
  return (
    <div className="site-tools hud-panel-in">
      <div className="tool-strip" role="group" aria-label="View">
        <button type="button" className={`tool-btn${focused ? ' armed' : ''}`} onClick={resetView}>
          Reset wide view
        </button>
        <button type="button" className={`tool-btn${scoutCam ? ' on' : ''}`} aria-pressed={scoutCam} onClick={() => setScoutCam(!scoutCam)}>
          Scout cam <kbd>C</kbd>
        </button>
        {scoutCam && (
          <button type="button" className="tool-btn capture" onClick={captureScoutPhoto}>
            Capture
          </button>
        )}
        <button
          type="button"
          className={`tool-btn tool-help-btn${help ? ' on' : ''}`}
          aria-expanded={help}
          aria-controls={helpId}
          aria-label="How to fly and look around"
          title="How to fly and look around"
          onClick={() => setHelp(h => !h)}
        >
          ?
        </button>
      </div>
      <dl id={helpId} className="tool-help" hidden={!help}>
        {!atHome && (
          <>
            <div>
              <dt>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </dt>
              <dd>Fly Ingenuity</dd>
            </div>
            <div>
              <dt>Click ground</dt>
              <dd>Fly there</dd>
            </div>
          </>
        )}
        <div>
          <dt>Drag</dt>
          <dd>Look around</dd>
        </div>
        <div>
          <dt>Double-click</dt>
          <dd>Wide view</dd>
        </div>
        <div>
          <dt>
            Ruler · <kbd>←</kbd>
            <kbd>→</kbd>
          </dt>
          <dd>Turn round the machine</dd>
        </div>
        <div>
          <dt>
            <kbd>C</kbd> · <kbd>Esc</kbd>
          </dt>
          <dd>Scout cam on · off</dd>
        </div>
      </dl>
    </div>
  );
}
