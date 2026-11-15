// The 360° bearing ruler at a site: a 24 px compass scale sitting flush on the top edge of the
// stage dock (both stacked in the HUD's bottom console), the heading readout at its left. Its needle
// is the way the camera faces (live.camHeadingDeg, written by the CameraRig). Drag the ruler, click
// on it, or use the arrow keys (Page Up/Down: a compass point) to walk the camera round the machine
// (it writes the orbit goal, live.siteOrbitGoal); double-click goes back to the wide view. Amber
// diamonds show where a story hotspot on the side or back of the machine can be seen; turning near
// one lights it up and pings. At home (before lift-off and after landing back) it marks the broken
// blade's fragment.
//
// It reads the scene's live values in its own animation loop and writes the DOM directly, so it
// never re-renders React every frame.

import { useEffect, useRef, useState } from 'react';
import { Matrix4, Vector3 } from 'three';
import { HOME } from '../../flight/route';
import { BACK_SIDE_DEG, compassPoint, goalAzForHeading, headingDelta, headingToFace, wrap360 } from '../../scene/bearing';
import { live } from '../../scene/registry';
import { SITE_PRESETS } from '../../scene/sites';
import { currentStop, useApp } from '../../store';
import type { MachineId } from '../../types';
import { playLocate } from '../sound';
import './bearing.css';

const STORY_LABELS = ['Why I came', 'What I found', 'My last day', 'Still here'] as const;
/** A mark lights up while the camera faces within this many degrees of it. */
const NEAR_DEG = 14;
/** Arrow keys turn the camera by this much, degrees (Page Up/Down: a compass point). */
const KEY_STEP = 5;
const PAGE_STEP = 45;
/** The blade fragment lies 15 m west of Ingenuity at home: face west to see it beyond the helicopter. */
const FRAGMENT_HEADING = 270;
/** Marks closer than this, degrees, would print their numbers on top of each other: the left one of the pair turns its number to the left. */
const STAGGER_DEG = 12;

interface Mark {
  key: string;
  heading: number;
  num: string;
  label: string;
  /** Number on the left of the diamond: the left one of two close marks, clear of its neighbour. */
  alt?: boolean;
}

/**
 * Of two marks within STAGGER_DEG of each other, the left one turns its number to the left and the
 * right one keeps it on the right, so the two numbers point away from each other. (The ruler runs
 * 0°→360° left to right, so neighbours across north sit at its two ends and never collide.)
 */
function stagger(marks: Mark[]): Mark[] {
  const sorted = [...marks].sort((a, b) => a.heading - b.heading);
  let partner = false;
  sorted.forEach((m, i) => {
    const next = sorted[i + 1];
    m.alt = !partner && !!next && Math.abs(headingDelta(m.heading, next.heading)) < STAGGER_DEG;
    partner = m.alt;
  });
  return sorted;
}

const inv = new Matrix4();
const v = new Vector3();
const centre = new Vector3();

/** The stop whose diorama the bar is for, or null while it should be hidden. */
function barStop(): MachineId | null {
  const s = useApp.getState();
  if (s.phase !== 'flight' || (s as { scoutCam?: boolean }).scoutCam) return null;
  const f = s.flight;
  const stop = f.stage === 'site' ? currentStop(f) : f.stage === 'prologue' || f.stage === 'epilogue' ? HOME : null;
  if (!stop || live.shot.siteId !== stop || !live.site.valid || live.shot.blend < 0.95 || live.black > 0.3) return null;
  return Number.isFinite(live.camHeadingDeg) ? stop : null;
}

/** Side and back hotspots of the machine in view, as headings to face them (from live.targets). */
function measureMarks(stop: MachineId): Mark[] {
  const marks: Mark[] = [];
  if (stop === HOME) {
    marks.push({ key: 'fragment', heading: FRAGMENT_HEADING, num: 'Fragment', label: 'Blade fragment' });
    return marks;
  }
  inv.copy(live.site.matrix).invert();
  // The machine's centre, diorama-local: its measured box turned by its yaw, else the origin.
  const m = live.machine;
  if (m.valid && m.site === stop) {
    m.box.getCenter(centre);
    const c = Math.cos(m.yaw);
    const s = Math.sin(m.yaw);
    centre.set(centre.x * c + centre.z * s, 0, -centre.x * s + centre.z * c);
  } else centre.set(0, 0, 0);
  const composed = wrap360(SITE_PRESETS[stop].cameraAz + 180);
  for (let i = 0; i < 4; i++) {
    const w = live.targets.get(`hs:${i}`);
    if (!w) continue;
    v.copy(w).applyMatrix4(inv);
    const heading = headingToFace(v, centre);
    if (heading === null || Math.abs(headingDelta(composed, heading)) < BACK_SIDE_DEG) continue;
    marks.push({ key: `hs:${i}`, heading, num: String(i + 1).padStart(2, '0'), label: STORY_LABELS[i] });
  }
  return stagger(marks);
}

export function BearingBar() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const markEls = useRef(new Map<string, HTMLElement>());
  const [stop, setStop] = useState<MachineId | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const drag = useRef<number | null>(null);
  const stopRef = useRef<MachineId | null>(null);
  const marksRef = useRef<Mark[]>([]);

  // The animation loop: visibility, the marks (measured now and then), the needle, lit marks, pings.
  useEffect(() => {
    let raf = 0;
    let frame = 0;
    let lastKey = '';
    let shownHeading = -1;
    const near = new Set<string>();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = barStop();
      if (s !== stopRef.current) {
        // A new stop (or none): forget the last one's marks and measure again straight away.
        stopRef.current = s;
        setStop(s);
        near.clear();
        lastKey = '';
        marksRef.current = [];
        setMarks([]);
        frame = 0;
      }
      const el = root.current;
      if (!s || !el) return;

      if (frame++ % 20 === 0) {
        const found = measureMarks(s);
        const key = found.map(m => `${m.key}@${Math.round(m.heading / 3)}${m.alt ? '^' : ''}`).join('|');
        if (key !== lastKey) {
          lastKey = key;
          marksRef.current = found;
          setMarks(found);
        }
      }

      const h = live.camHeadingDeg;
      const rounded = Math.round(h * 2) / 2;
      if (rounded !== shownHeading) {
        shownHeading = rounded;
        if (needle.current) needle.current.style.left = `${(wrap360(h) / 360) * 100}%`;
        if (readout.current) readout.current.textContent = `${String(Math.round(wrap360(h)) % 360).padStart(3, '0')}° ${compassPoint(h)}`;
        track.current?.setAttribute('aria-valuenow', String(Math.round(wrap360(h)) % 360));
        track.current?.setAttribute('aria-valuetext', `Facing ${Math.round(wrap360(h)) % 360} degrees, ${compassPoint(h)}`);
      }
      for (const m of marksRef.current) {
        const on = Math.abs(headingDelta(h, m.heading)) < NEAR_DEG;
        if (on && !near.has(m.key)) {
          near.add(m.key);
          playLocate();
        } else if (!on && near.has(m.key) && Math.abs(headingDelta(h, m.heading)) > NEAR_DEG + 4) near.delete(m.key);
        markEls.current.get(m.key)?.classList.toggle('brg-near', near.has(m.key));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Turn the camera to face `heading`. */
  const turnTo = (heading: number) => {
    if (!Number.isFinite(live.camHeadingDeg)) return;
    const goal = live.siteOrbitGoal;
    // From where the camera is heading now (with the orbit where it is now), so a held drag converges.
    goal.az = goalAzForHeading(live.siteOrbit.az, live.camHeadingDeg, heading);
  };
  const headingAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return null;
    return wrap360((Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 360) % 360);
  };

  if (!stop) return <div ref={root} className="brg" hidden />;
  return (
    <div ref={root} className="brg" role="group" aria-label="Look around: 360 degree bearing">
      <span ref={readout} className="brg-readout tabular" aria-hidden="true" />
      <div
        ref={track}
        className="brg-track"
        role="slider"
        tabIndex={0}
        aria-label="Camera heading"
        aria-valuemin={0}
        aria-valuemax={359}
        title="Look around: drag, or ← → · double-click: wide view"
        onPointerDown={e => {
          if (e.button !== 0) return;
          drag.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          const h = headingAt(e.clientX);
          if (h !== null) turnTo(h);
        }}
        onPointerMove={e => {
          if (drag.current !== e.pointerId) return;
          const h = headingAt(e.clientX);
          if (h !== null) turnTo(h);
        }}
        onPointerUp={e => {
          if (drag.current === e.pointerId) drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onDoubleClick={() => useApp.getState().resetView()}
        onKeyDown={e => {
          const h = live.camHeadingDeg;
          if (!Number.isFinite(h)) return;
          const step = e.key === 'ArrowRight' ? KEY_STEP : e.key === 'ArrowLeft' ? -KEY_STEP : e.key === 'PageUp' ? PAGE_STEP : e.key === 'PageDown' ? -PAGE_STEP : 0;
          if (step) {
            e.preventDefault();
            // Step from the goal, so held keys keep turning even before the camera catches up.
            const goalHeading = h - ((live.siteOrbitGoal.az - live.siteOrbit.az) * 180) / Math.PI;
            turnTo(goalHeading + step);
          } else if (e.key === 'Home' || e.key === 'Escape') {
            e.preventDefault();
            useApp.getState().resetView();
          }
        }}
      >
        {/* A tick every 15°, taller every 45°; N E S W N at the cardinal points. */}
        {Array.from({ length: 25 }, (_, i) => i * 15).map(d => (
          <span key={d} className={`brg-tick${d % 90 === 0 ? ' card' : d % 45 === 0 ? ' major' : ''}`} style={{ left: `${(d / 360) * 100}%` }} aria-hidden="true">
            {d % 90 === 0 && <i>{compassPoint(d % 360)}</i>}
          </span>
        ))}
        {marks.map(m => (
          <button
            key={m.key}
            type="button"
            tabIndex={-1}
            ref={el => {
              if (el) markEls.current.set(m.key, el);
              else markEls.current.delete(m.key);
            }}
            className={`brg-mark${m.alt ? ' brg-mark-alt' : ''}`}
            style={{ left: `${(m.heading / 360) * 100}%` }}
            title={`${m.key === 'fragment' ? '' : `${m.num} `}${m.label} · seen from behind`}
            aria-label={`Turn to ${m.label}`}
            onPointerDown={e => {
              e.stopPropagation();
              turnTo(m.heading);
            }}
          >
            <span className="brg-mark-dot" aria-hidden="true" />
            <span className="brg-mark-num">{m.num}</span>
          </button>
        ))}
        <span ref={needle} className="brg-needle" aria-hidden="true" />
      </div>
    </div>
  );
}
