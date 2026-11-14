// Look around the machine at a site: drag on the 3D view to orbit, wheel to move in or out,
// double-click to go back to the composed shot. Writes live.siteOrbit (eased, so a drag or a
// reset never jumps); the CameraRig applies it on top of the site pose. Active only at this stop's
// site stage once the camera has settled; leaving the stage eases it back to the composed shot.
//
// Conventions: az = radians the camera turns about the site's up (right-hand rule, so positive
// is counter-clockwise seen from above); dragging right turns the camera clockwise, as if the
// machine were turned with the cursor. el = radians added to the camera's elevation (dragging
// down raises the camera, as in three.js OrbitControls). zoom multiplies the camera distance.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { currentStop, useApp } from '../store';
import type { MachineId } from '../types';
import { live } from './registry';
import { orbitAfterDrag, orbitAfterWheel } from './siteOrbit';

/** How quickly the view follows the pointer, 1/s. */
const FOLLOW = 14;

function orbitActive(stop: MachineId): boolean {
  const s = useApp.getState();
  if (s.phase !== 'flight' || s.flight.stage !== 'site' || currentStop(s.flight) !== stop) return false;
  return live.shot.siteId === stop && live.site.valid && live.shot.blend > 0.95 && live.black < 0.3;
}

export function SiteOrbitInput({ stop }: { stop: MachineId }) {
  const gl = useThree(s => s.gl);
  const target = useRef({ az: 0, el: 0, zoom: 1 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const active = useRef(false);

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
      target.current = orbitAfterDrag(target.current, e.clientX - d.x, e.clientY - d.y);
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
      target.current = orbitAfterWheel(target.current, e.deltaY);
    };
    const reset = () => {
      if (active.current) target.current = { az: 0, el: 0, zoom: 1 };
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('dblclick', reset);
    return () => {
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
    };
  }, [gl]);

  useFrame((_, delta) => {
    const on = orbitActive(stop);
    if (on !== active.current) {
      active.current = on;
      if (!on) {
        // Leaving the stage (or the shot): back to the composed view.
        target.current = { az: 0, el: 0, zoom: 1 };
        drag.current = null;
      }
      gl.domElement.style.cursor = on ? 'grab' : '';
    }
    if (live.shot.siteId !== stop) return;
    const o = live.siteOrbit;
    const t = target.current;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * FOLLOW);
    o.az += (t.az - o.az) * k;
    o.el += (t.el - o.el) * k;
    o.zoom += (t.zoom - o.zoom) * k;
    if (!on && Math.abs(o.az) < 1e-4 && Math.abs(o.el) < 1e-4 && Math.abs(o.zoom - 1) < 1e-4) {
      o.az = 0;
      o.el = 0;
      o.zoom = 1;
    }
  });

  return null;
}
