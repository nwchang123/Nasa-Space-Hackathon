// The scout camera at a site: a viewfinder over the 3D view (frame corners, a crosshair that turns
// amber when a story hotspot is in frame, and what that is), a white flash on capture, and the
// photos taken here pinned beside the dock. A photo of a hotspot opens that part of the story; a
// click on a pinned photo brings its close-up back. The frame itself is grabbed by the scene
// (src/scene/ScoutCamGrab.tsx); live.scoutTarget says what is in frame.

import { useEffect, useState } from 'react';
import { live } from '../../scene/registry';
import { VIEWFINDER_H, VIEWFINDER_W } from '../../scene/siteFocus';
import { currentStop, useApp, type StorySection } from '../../store';
import { readStory } from '../storyVoice';
import './sitetools.css';

const LABELS = ['Why I came', 'What I found', 'My last day', 'Still here'];
const sectionName = (i: number) => `${String(i + 1).padStart(2, '0')} ${LABELS[i]}`;
/** How long the viewfinder says "nothing to capture" after an empty capture, ms. */
const MISS_MS = 1800;

const missListeners = new Set<() => void>();
/** A capture with no hotspot in frame: no photo is taken; the viewfinder says so. */
export function notifyScoutMiss() {
  for (const f of missListeners) f();
}

export function ScoutCam() {
  const on = useApp(s => s.scoutCam && s.phase === 'flight' && s.flight.stage === 'site');
  const atSite = useApp(s => s.phase === 'flight' && s.flight.stage === 'site');
  const snapshots = useApp(s => s.snapshots);
  const request = useApp(s => s.snapshotRequest);
  const [target, setTarget] = useState<string | null>(null);
  const [flashAt, setFlashAt] = useState(0);
  const [missAt, setMissAt] = useState(0);

  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setTarget(live.scoutTarget), 120);
    return () => window.clearInterval(id);
  }, [on]);

  useEffect(() => {
    let timer = 0;
    const miss = () => {
      setMissAt(Date.now());
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMissAt(0), MISS_MS);
    };
    missListeners.add(miss);
    return () => {
      missListeners.delete(miss);
      window.clearTimeout(timer);
    };
  }, []);
  const missed = missAt > 0 && target === null;

  // Flash on every capture taken with the viewfinder up.
  useEffect(() => {
    if (request && useApp.getState().scoutCam) setFlashAt(request);
  }, [request]);

  const open = (section: StorySection) => {
    const s = useApp.getState();
    s.setFocus({ kind: 'hotspot', id: String(section), strength: 1 });
    s.setStory(section);
    const stop = currentStop(s.flight);
    if (stop) readStory(stop, section);
  };

  return (
    <>
      {on && (
        <div className="scout-view" aria-hidden="true">
          <div className={`scout-frame${target !== null ? ' locked' : ''}`} style={{ width: `${VIEWFINDER_W * 100}%`, height: `${VIEWFINDER_H * 100}%` }}>
            <span className="sc-corner tl" />
            <span className="sc-corner tr" />
            <span className="sc-corner bl" />
            <span className="sc-corner br" />
            <span className="sc-cross" />
            <span className="sc-rec">
              <i /> Scout cam
            </span>
            <span key={missed ? missAt : 0} className={`sc-target${missed ? ' miss' : ''}`}>
              {target !== null
                ? `In frame · ${sectionName(Number(target))}`
                : missed
                  ? 'Nothing to capture · aim at a numbered point'
                  : 'No hotspot in frame'}
            </span>
          </div>
        </div>
      )}
      {flashAt > 0 && <div key={flashAt} className="scout-flash" aria-hidden="true" />}
      {atSite && snapshots.length > 0 && (
        <ol className="scout-roll" aria-label="Scout photos">
          {snapshots.map(p => (
            <li key={p.at}>
              {p.section !== null ? (
                <button type="button" onClick={() => open(p.section as StorySection)} title={`Open ${sectionName(p.section)}`}>
                  <img src={p.url} alt="" />
                  <span>{sectionName(p.section)}</span>
                </button>
              ) : (
                <div className="scout-shot">
                  <img src={p.url} alt="" />
                  <span>No target</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
