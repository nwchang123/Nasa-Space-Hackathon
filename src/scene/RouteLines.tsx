// Flight 73's route on the globe. The planned route is a faint dashed line (already shown on the
// title screen, fainter still, as a preview of the whole flight); the hop being flown
// (a planned leg or a direct hop picked from the route strip) draws itself solid amber behind
// Ingenuity; hops already flown stay as faint solid lines. In the epilogue and the flight log the
// whole route glows. Everything fades away as the camera dives into a site. Constant pixel width
// (Line2), one draw call per line.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LEGS } from '../flight/route';
import { useApp } from '../store';
import { legPolyline, legSegments, smoothstep, type LegLike } from './layout';
import { PALETTE } from './markerState';
import { live } from './registry';
import { useReducedMotion } from './useReducedMotion';

interface RouteLine {
  line: Line2;
  geom: LineGeometry;
  mat: LineMaterial;
  segs: number;
}

function makeLine(leg: LegLike, dashed: boolean): RouteLine {
  const segs = legSegments(leg.distanceKm);
  const geom = new LineGeometry();
  geom.setPositions(legPolyline(leg, segs));
  const mat = new LineMaterial({
    color: PALETTE.amber,
    linewidth: 2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    worldUnits: false,
    dashed,
    dashSize: 0.014,
    gapSize: 0.01,
  });
  mat.fog = false;
  const line = new Line2(geom, mat);
  if (dashed) line.computeLineDistances();
  line.renderOrder = 5;
  line.visible = false;
  return { line, geom, mat, segs };
}

function dispose(l: RouteLine) {
  l.geom.dispose();
  l.mat.dispose();
}

const hopKey = (h: LegLike) => `${h.from}>${h.to}`;

export function RouteLines() {
  const reduced = useReducedMotion();
  const planned = useMemo(() => LEGS.map(leg => makeLine(leg, true)), []);
  const active = useRef<{ key: string; l: RouteLine } | null>(null);
  const flown = useRef(new Map<string, RouteLine>());
  const group = useRef<import('three').Group>(null);

  useEffect(
    () => () => {
      planned.forEach(dispose);
      if (active.current) dispose(active.current.l);
      flown.current.forEach(dispose);
    },
    [planned],
  );

  useFrame(state => {
    const g = group.current;
    if (!g) return;
    const s = useApp.getState();
    const f = s.flight;
    const shot = live.shot;
    const dpr = state.gl.getPixelRatio();
    const t = state.clock.elapsedTime;

    // A new Flight 73 starts with a clean slate.
    if (s.phase === 'title' || (s.phase === 'flight' && f.stage === 'prologue')) {
      flown.current.forEach(l => {
        g.remove(l.line);
        dispose(l);
      });
      flown.current.clear();
    }

    const all = s.phase === 'report' || (s.phase === 'flight' && f.stage === 'epilogue');
    const inFlight = s.phase === 'flight' && !all;
    const title = s.phase === 'title';
    const fade = 1 - smoothstep(0.3, 0.7, shot.blend);
    const pulse = all && !reduced ? 0.12 * Math.sin(t * 0.9) : 0;

    const style = (l: RouteLine, opacity: number, width: number) => {
      l.line.visible = opacity * fade > 0.005;
      l.mat.opacity = opacity * fade;
      l.mat.linewidth = width * dpr;
    };

    for (const l of planned) {
      if (all) style(l, 0.4 + pulse, 1.6);
      else if (inFlight) style(l, 0.22, 1.2);
      else if (title) style(l, 0.26 + (reduced ? 0 : 0.07 * Math.sin(t * 1.1)), 1.2);
      else l.line.visible = false;
    }

    // The hop in the air: drawn up to Ingenuity. Recorded as flown when it lands.
    const arc = shot.arc;
    if (arc) {
      const key = hopKey(arc);
      if (!active.current || active.current.key !== key) {
        if (active.current) {
          g.remove(active.current.l.line);
          dispose(active.current.l);
        }
        active.current = { key, l: makeLine(arc, false) };
        g.add(active.current.l.line);
      }
      const l = active.current.l;
      const drawn = Math.floor(arc.p * l.segs);
      l.geom.instanceCount = drawn;
      style(l, drawn > 0 ? 0.95 : 0, 2.4);
      if (arc.p >= 0.999 && !flown.current.has(key)) {
        const done = makeLine(arc, false);
        flown.current.set(key, done);
        g.add(done.line);
      }
    } else if (active.current) {
      active.current.l.line.visible = false;
    }

    flown.current.forEach((l, key) => {
      if (arc && active.current?.key === key) l.line.visible = false;
      else if (all) style(l, 0.55 + pulse, 1.8);
      else if (inFlight) style(l, 0.38, 1.5);
      else l.line.visible = false;
    });
  });

  return (
    <group ref={group}>
      {planned.map((l, i) => (
        <primitive key={i} object={l.line} />
      ))}
    </group>
  );
}
