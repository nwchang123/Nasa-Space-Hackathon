// Look around the machine at a site: drag on the 3D view to orbit, wheel to move in or out,
// double-click (or "Reset wide view", store.resetView) to go back to the composed shot. During a
// close-up the orbit turns about the focused part. Drags and the wheel write live.siteOrbitGoal (a
// HUD control may too); this eases live.siteOrbit toward it, so a drag or a reset never jumps, and
// the CameraRig applies that on top of the site pose. Active only at this stop's site stage once
// the camera has settled; leaving the stage eases it back to the composed shot.
//
// While a voice is speaking there (Ingenuity's or the narrator's), the camera also turns round the
// machine on its own, always at the same slow pace (siteOrbit.ts: TURN_PACE, 60 s for a full turn,
// so a line goes only part of the way round), gathering speed at the start and coming to rest as
// the line ends (turnAngle). The view stays wherever the turn left it. It makes way for
// the visitor: it stops at once on a drag, the wheel, the bearing bar or a reset and, a few seconds
// after the last one, picks up again at the line's pace to finish with the line; it coasts to a
// stop for a close-up on a part, holds while Ingenuity is being flown, and is off with reduced motion.
//
// Conventions: az = radians the camera turns about the site's up (right-hand rule, so positive
// is counter-clockwise seen from above); dragging right turns the camera clockwise, as if the
// machine were turned with the cursor. el = radians added to the camera's elevation (dragging
// down raises the camera, as in three.js OrbitControls). zoom multiplies the camera distance.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { HOME } from '../flight/route';
import { currentStop, useApp } from '../store';
import type { MachineId } from '../types';
import { voiceLine } from '../ui/sound';
import { live } from './registry';
import {
  AUTO_ORBIT_IDLE_MS,
  coastSpeed,
  TURN_PACE,
  makeTurn,
  orbitAfterDrag,
  orbitAfterWheel,
  turnAngle,
  turnSpeed,
  wholeTurns,
  type Turn,
} from './siteOrbit';
import { useReducedMotion } from './useReducedMotion';

/** How quickly the view follows the pointer, 1/s. */
const FOLLOW = 14;
/** No turn is started with less of the line left than this, s. */
const MIN_TURN_S = 1.5;

function orbitActive(stop: MachineId): boolean {
  const s = useApp.getState();
  if (s.phase !== 'flight') return false;
  const f = s.flight;
  // At a stop; or at home before lift-off and after landing back, to look round the broken blades.
  const here = (f.stage === 'site' && currentStop(f) === stop) || (stop === HOME && (f.stage === 'prologue' || f.stage === 'epilogue'));
  if (!here) return false;
  return live.shot.siteId === stop && live.site.valid && live.shot.blend > 0.95 && live.black < 0.3;
}

export function SiteOrbitInput({ stop }: { stop: MachineId }) {
  const gl = useThree(s => s.gl);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const active = useRef(false);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  /** The turn under way with the line being spoken (times in s on performance.now()), from goal angle `az0`. */
  const turn = useRef<{ line: number; plan: Turn; az0: number } | null>(null);
  /** A cut-short turn's speed as it coasts to a stop, rad/s. */
  const spin = useRef(0);
  /** performance.now() of the visitor's latest move of the view. */
  const lastInput = useRef(-Infinity);
  /** The orbit goal as this frame left it: any other change by the next frame was the visitor's. */
  const seen = useRef({ az: 0, el: 0, zoom: 1 });

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      if (!active.current || e.button !== 0) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable: the drag still works while the pointer stays on the canvas */
      }
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      Object.assign(live.siteOrbitGoal, orbitAfterDrag(live.siteOrbitGoal, e.clientX - d.x, e.clientY - d.y));
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (drag.current?.id !== e.pointerId) return;
      drag.current = null;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.cursor = active.current ? 'grab' : '';
    };
    const wheel = (e: WheelEvent) => {
      if (!active.current) return;
      e.preventDefault();
      Object.assign(live.siteOrbitGoal, orbitAfterWheel(live.siteOrbitGoal, e.deltaY));
    };
    // Double-click: the same as "Reset wide view" (no orbit, no close-up, Ingenuity flies home).
    const reset = () => {
      if (active.current) useApp.getState().resetView();
    };
    const unsub = useApp.subscribe((s, prev) => {
      if (s.viewResetAt !== prev.viewResetAt) Object.assign(live.siteOrbitGoal, { az: 0, el: 0, zoom: 1 });
    });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('dblclick', reset);
    return () => {
      unsub();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('dblclick', reset);
      if (active.current) el.style.cursor = '';
      // This diorama is gone: no orbit left behind for the next one.
      live.siteOrbit.az = 0;
      live.siteOrbit.el = 0;
      live.siteOrbit.zoom = 1;
      Object.assign(live.siteOrbitGoal, { az: 0, el: 0, zoom: 1 });
    };
  }, [gl]);

  useFrame((_, delta) => {
    const on = orbitActive(stop);
    const t = live.siteOrbitGoal;
    const now = performance.now();
    // Anything else that moved the goal since the last frame (a drag, the wheel, the bearing bar,
    // a reset) was the visitor: the turn stops at once and waits a while.
    const was = seen.current;
    if (drag.current || t.az !== was.az || t.el !== was.el || t.zoom !== was.zoom) {
      lastInput.current = now;
      spin.current = 0;
      turn.current = null;
    }
    if (on !== active.current) {
      active.current = on;
      if (!on) {
        // Leaving the stage (or the shot): back to the composed view.
        Object.assign(live.siteOrbitGoal, { az: 0, el: 0, zoom: 1 });
        drag.current = null;
      }
      gl.domElement.style.cursor = on ? 'grab' : '';
    }
    if (live.shot.siteId === stop) {
      const o = live.siteOrbit;
      const dt = Math.min(delta, 0.1);
      const sec = now / 1000;
      // The turn while a voice speaks: it moves the goal, so the view eases along with it.
      const line = voiceLine();
      const fl = live.flyer;
      const free =
        on &&
        !reducedRef.current &&
        line !== null &&
        line.seconds !== null &&
        now - lastInput.current > AUTO_ORBIT_IDLE_MS &&
        !useApp.getState().focus &&
        !(fl.site === stop && fl.follow > 0.05);
      const cur = turn.current;
      if (cur && (!free || cur.line !== line?.startedAt)) {
        // The line ended or changed, or the camera must hold: coast on from the turn's speed.
        spin.current = on ? turnSpeed(cur.plan, sec) : 0;
        turn.current = null;
      }
      if (!on) spin.current = 0;
      if (!turn.current && free && line?.seconds) {
        const start = line.startedAt / 1000;
        const end = start + line.seconds;
        // From the line's start when it has only just begun; later (after the visitor looked round,
        // or a close-up) from now. Either way at the one slow pace, coming to rest as the line ends.
        const from = sec - start < 0.5 ? start : sec;
        if (end - sec > MIN_TURN_S) turn.current = { line: line.startedAt, plan: makeTurn(from, end, TURN_PACE), az0: t.az };
      }
      if (spin.current !== 0) {
        spin.current = coastSpeed(spin.current, dt);
        if (turn.current) turn.current.az0 += spin.current * dt;
        else t.az += spin.current * dt;
      }
      if (turn.current) t.az = turn.current.az0 + turnAngle(turn.current.plan, sec);
      const k = 1 - Math.exp(-dt * FOLLOW);
      o.az += (t.az - o.az) * k;
      o.el += (t.el - o.el) * k;
      o.zoom += (t.zoom - o.zoom) * k;
      // Keep the angle within a turn of zero (the goal and the view shifted together, so nothing moves).
      const turns = wholeTurns(t.az);
      if (turns !== 0) {
        t.az -= turns;
        o.az -= turns;
        if (turn.current) turn.current.az0 -= turns;
      }
      if (!on && Math.abs(o.az) < 1e-4 && Math.abs(o.el) < 1e-4 && Math.abs(o.zoom - 1) < 1e-4) {
        o.az = 0;
        o.el = 0;
        o.zoom = 1;
      }
    }
    was.az = t.az;
    was.el = t.el;
    was.zoom = t.zoom;
  });

  return null;
}
