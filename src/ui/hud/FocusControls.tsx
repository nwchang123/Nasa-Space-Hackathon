// Site tools at the right edge of the screen, at each stop: back to the wide view (the close-up,
// the orbit and the camera following Ingenuity all let go, and Ingenuity flies home and lands),
// the scout camera switch (key C) with its capture button, and how to fly Ingenuity.

import { useEffect } from 'react';
import { live } from '../../scene/registry';
import { useApp } from '../../store';
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
  const focused = useApp(s => s.focus !== null);
  const scoutCam = useApp(s => s.scoutCam);
  const setScoutCam = useApp(s => s.setScoutCam);
  const resetView = useApp(s => s.resetView);

  // C: scout camera on and off; Escape: off.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useApp.getState();
      if (s.phase !== 'flight' || s.flight.stage !== 'site') return;
      if (e.code === 'KeyC') s.setScoutCam(!s.scoutCam);
      else if (e.code === 'Escape' && s.scoutCam) s.setScoutCam(false);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  if (!atSite) return null;
  return (
    <div className="site-tools hud-panel-in">
      <button type="button" className={`tool-btn${focused ? ' live' : ''}`} onClick={resetView}>
        <span aria-hidden="true">↩</span> Reset wide view
      </button>
      <button type="button" className={`tool-btn${scoutCam ? ' on' : ''}`} aria-pressed={scoutCam} onClick={() => setScoutCam(!scoutCam)}>
        <span aria-hidden="true">📷</span> Scout cam <kbd>C</kbd>
      </button>
      {scoutCam && (
        <button type="button" className="tool-btn capture" onClick={captureScoutPhoto}>
          <span aria-hidden="true">📸</span> Capture target
        </button>
      )}
      <p className="tool-hint">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> / click ground to fly
        </span>
        <span>drag to look · double-click: wide view</span>
      </p>
    </div>
  );
}
