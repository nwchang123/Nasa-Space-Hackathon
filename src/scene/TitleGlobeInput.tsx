// Turn Mars on the title screen: drag (or swipe) sideways to spin it all the way round, up or down
// to look over a pole; a flick coasts and slows to a stop; double-click (double-tap) eases back to
// the title's own view (Jezero, lit by the real Sun). The camera never orbits freely here, so Mars
// stays framed in the right-hand column (the CameraRig): a drag turns the globe about its spin
// axis (live.yaw) and pitches the camera's elevation (live.titleDrag.el), so the Sun, the
// terminator, the night-side rim and the markers all stay locked to the planet. The wheel is left
// alone (the title layer scrolls on short screens). Active only on the title, once the shot rests
// on the globe; "Begin Flight 73" hands back to the Director, which turns Mars home for the dive.
//
// Conventions follow the site orbit (src/scene/SiteOrbitInput.tsx): the surface under the pointer
// moves with it, so dragging right turns Mars eastward toward the viewer's right (yaw grows), and
// dragging down raises the camera over the north pole (el grows), as in three.js OrbitControls.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { useApp } from '../store';
import { TITLE_EL_MAX } from './layout';
import { DIRECTOR_PRIORITY, live } from './registry';
import { useReducedMotion } from './useReducedMotion';

/** Pixels the pointer must travel before a press becomes a drag (a click stays a click). */
const DRAG_THRESHOLD_PX = 4;
/** A press counts as on Mars within this many of its on-screen radii from its centre. */
const GRAB_MARGIN = 1.2;
/** A flick's coast slows at this rate, 1/s (it carries on for about velocity / DAMP radians). */
const DAMP = 2.6;
/** Fastest coast, rad/s. */
const MAX_SPIN = 9;
/** Velocity smoothing while dragging, s (about the last three pointer moves). */
const VEL_SMOOTH_S = 0.05;
/** A release this long after the last move (or 2.5 typical gaps between moves, if longer) is a stop, not a flick, ms. */
const STILL_MS = 90;
/** Two taps within this long and this close are a double-tap (touch has no reliable dblclick), ms / px. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 28;
/** A double-click this soon after a drag belongs to the drag, not a reset, ms. */
const AFTER_DRAG_MS = 250;

const DEG = Math.PI / 180;
const centre = new Vector3();
const clampEl = (el: number) => Math.min(TITLE_EL_MAX, Math.max(-TITLE_EL_MAX, el));

/** Mars may be turned: the title, with the shot resting on the globe and the screen not faded out. */
function titleActive(): boolean {
  return useApp.getState().phase === 'title' && live.shot.blend === 0 && !live.shot.arc && live.black < 0.6;
}

interface Drag {
  id: number;
  /** Where the press began and where the pointer was last, client px; when, ms (event time). */
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  /** Typical time between pointer moves, ms (long on a slow device, where moves come once a frame). */
  gap: number;
  /** Turn (yaw, el) since the last velocity sample, radians. */
  accYaw: number;
  accEl: number;
  /** Past the threshold: Mars is being turned. */
  dragging: boolean;
}

export function TitleGlobeInput() {
  const gl = useThree(s => s.gl);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const drag = useRef<Drag | null>(null);
  const active = useRef(false);
  /** Mars on screen (canvas px): centre and radius, measured every frame. */
  const disc = useRef({ x: 0, y: 0, r: 1 });
  /** The pointer over the canvas (canvas px), or null when it is elsewhere. */
  const hoverAt = useRef<{ x: number; y: number } | null>(null);
  /** The cursor this component last set on the canvas ('' = left to the page). */
  const cursor = useRef('');
  const lastTap = useRef({ t: -1e9, x: 0, y: 0 });
  const lastDragEnd = useRef(-1e9);

  useEffect(() => {
    const el = gl.domElement;
    const local = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMars = (p: { x: number; y: number }) => {
      const d = disc.current;
      return Math.hypot(p.x - d.x, p.y - d.y) <= d.r * GRAB_MARGIN;
    };
    const reset = () => {
      const td = live.titleDrag;
      td.spun = false;
      td.reset = true;
      td.vy = 0;
      td.velEl = 0;
    };

    const down = (e: PointerEvent) => {
      if (!active.current || drag.current || !e.isPrimary || e.button !== 0) return;
      if (!onMars(local(e))) return;
      drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), gap: 0, accYaw: 0, accEl: 0, dragging: false };
      // A press on Mars stops a coasting spin where it is (as a hand on a globe would).
      live.titleDrag.vy = 0;
      live.titleDrag.velEl = 0;
    };
    const move = (e: PointerEvent) => {
      hoverAt.current = local(e);
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      if (!d.dragging) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_THRESHOLD_PX) return;
        d.dragging = true;
        const td = live.titleDrag;
        td.spun = true;
        td.reset = false;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable: the drag still works while the pointer stays on the canvas */
        }
        document.body.dataset.marsSpun = '';
      }
      // One radius of pointer travel turns Mars by one radian: the surface at its centre stays under the pointer.
      const perPx = 1 / Math.max(40, disc.current.r);
      const dYaw = (e.clientX - d.x) * perPx;
      const td = live.titleDrag;
      const el0 = td.el;
      td.el = clampEl(td.el + (e.clientY - d.y) * perPx);
      live.yaw += dYaw;
      d.x = e.clientX;
      d.y = e.clientY;
      // Velocity for the coast, smoothed; moves that arrive together (one frame) count as one.
      d.accYaw += dYaw;
      d.accEl += td.el - el0;
      const now = performance.now();
      const ms = now - d.t;
      if (ms < 8) return;
      d.gap = d.gap ? d.gap + (ms - d.gap) * 0.3 : ms;
      const dt = ms / 1000;
      const w = 1 - Math.exp(-dt / VEL_SMOOTH_S);
      td.vy += (d.accYaw / dt - td.vy) * w;
      td.velEl += (d.accEl / dt - td.velEl) * w;
      d.accYaw = 0;
      d.accEl = 0;
      d.t = now;
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const td = live.titleDrag;
      const now = performance.now();
      if (d.dragging) {
        lastDragEnd.current = now;
        // Let go while still moving: coast (never with reduced motion); held still first: stop.
        const flick = e.type === 'pointerup' && !reducedRef.current && now - d.t <= Math.max(STILL_MS, 2.5 * d.gap);
        td.vy = flick ? Math.max(-MAX_SPIN, Math.min(MAX_SPIN, td.vy)) : 0;
        td.velEl = flick ? Math.max(-MAX_SPIN, Math.min(MAX_SPIN, td.velEl)) : 0;
        return;
      }
      td.vy = 0;
      td.velEl = 0;
      // A tap: two in quick succession on a touch screen reset the view (mice get dblclick).
      if (e.type === 'pointerup' && e.pointerType === 'touch') {
        const t = lastTap.current;
        if (now - t.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - t.x, e.clientY - t.y) < DOUBLE_TAP_PX) {
          lastTap.current = { t: -1e9, x: 0, y: 0 };
          if (active.current) reset();
        } else lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }
    };
    const leave = () => {
      hoverAt.current = null;
    };
    const dbl = (e: MouseEvent) => {
      if (!active.current || performance.now() - lastDragEnd.current < AFTER_DRAG_MS) return;
      if (onMars(local(e))) reset();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('dblclick', dbl);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('dblclick', dbl);
      if (cursor.current) el.style.cursor = '';
      cursor.current = '';
    };
  }, [gl]);

  // Before the Director, so a coast turns the globe in the same frame it is drawn.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const td = live.titleDrag;
    const on = titleActive();
    active.current = on;

    // Mars on screen: its centre projected, and its apparent radius (it is radius 1 at the origin).
    const cam = state.camera as PerspectiveCamera;
    const dist = cam.position.length();
    centre.set(0, 0, 0).project(cam);
    disc.current.x = ((centre.x + 1) / 2) * state.size.width;
    disc.current.y = ((1 - centre.y) / 2) * state.size.height;
    disc.current.r = state.size.height / 2 / (Math.sqrt(Math.max(1e-6, dist * dist - 1)) * Math.tan((cam.fov * DEG) / 2));

    const d = drag.current;
    if (!on && d) {
      // The title is gone mid-drag ("Begin Flight 73" by keyboard, a reset): let go of Mars.
      drag.current = null;
      if (gl.domElement.hasPointerCapture?.(d.id)) gl.domElement.releasePointerCapture(d.id);
    }

    // The coast after a flick, slowing exponentially.
    if (on && !drag.current?.dragging && td.spun && (td.vy !== 0 || td.velEl !== 0)) {
      const k = Math.exp(-DAMP * dt);
      live.yaw += td.vy * dt;
      td.vy = Math.abs(td.vy) < 0.005 ? 0 : td.vy * k;
      const raw = td.el + td.velEl * dt;
      td.el = clampEl(raw);
      // Stops dead at the pitch limit rather than pressing against it.
      td.velEl = td.el !== raw || Math.abs(td.velEl) < 0.005 ? 0 : td.velEl * k;
    }

    // Cursor: an open hand over Mars, a closed one while turning it; a hovered marker keeps its pointer.
    let want = '';
    if (on) {
      if (drag.current?.dragging) want = 'grabbing';
      else if (document.body.style.cursor !== 'pointer') {
        const h = hoverAt.current;
        const r = disc.current;
        if (h && Math.hypot(h.x - r.x, h.y - r.y) <= r.r * GRAB_MARGIN) want = 'grab';
      }
    }
    if (want !== cursor.current) {
      cursor.current = want;
      gl.domElement.style.cursor = want;
    }
  }, DIRECTOR_PRIORITY - 1);

  return null;
}
