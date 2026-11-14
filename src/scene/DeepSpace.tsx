// Deep-space schematic: the inner solar system seen from above the ecliptic.
// Radial scale is compressed (r_scene = 2.2·√AU) and every orbit is flattened onto the ecliptic.
// Earth and Mars sit at their true positions for "now"; Ceres and Eros use the ephemeris if the
// astro module provides one, otherwise a marked illustrative spot on their orbit.

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Quaternion,
  Vector3,
  type Group,
  type Sprite,
  type SpriteMaterial,
} from 'three';
import { AU_KM, heliocentricAU, keplerTrailAngleDeg, signalPath } from '../astro';
import { MACHINE_BY_ID, MACHINES } from '../data/machines';
import { DEG } from '../geo';
import { useApp } from '../store';
import type { Machine, MachineId } from '../types';
import { DEEP_EDGE, DEEP_POS, eclipticLonToScene, eclipticToScene, type Vec3 } from './layout';
import { Marker } from './Marker';
import { PALETTE } from './markerState';
import { deepLocal, groups } from './registry';
import { glowTexture, ringTexture } from './sprites';
import { useReducedMotion } from './useReducedMotion';

/** Mean ecliptic elements: semi-major axis (AU), eccentricity, longitude of perihelion (deg). */
interface OrbitEl {
  a: number;
  e: number;
  varpi: number;
}
const EARTH: OrbitEl = { a: 1.00000261, e: 0.01671123, varpi: 102.93768 };
const MARS: OrbitEl = { a: 1.52371034, e: 0.0933941, varpi: 336.05637 };
const CERES: OrbitEl = { a: 2.7675, e: 0.0785, varpi: 153.9 }; // Ω 80.3° + ω 73.6°, i 10.6° flattened
const EROS: OrbitEl = { a: 1.458, e: 0.2229, varpi: 123.2 }; // Ω 304.3° + ω 178.9°, i 10.8° flattened

/** Illustrative true anomalies used only when no ephemeris is available. */
const ILLUSTRATIVE_NU = { ceres: 200, eros: 60 } as const;

function orbitPoint(o: OrbitEl, nuDeg: number): Vec3 {
  const nu = nuDeg * DEG;
  const r = (o.a * (1 - o.e * o.e)) / (1 + o.e * Math.cos(nu));
  const lon = (o.varpi + nuDeg) * DEG;
  return eclipticToScene(r * Math.cos(lon), r * Math.sin(lon));
}

function orbitLine(o: OrbitEl, color: string, opacity: number): LineLoop {
  const pts: number[] = [];
  for (let k = 0; k < 256; k++) pts.push(...orbitPoint(o, (k / 256) * 360));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return new LineLoop(g, new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }));
}

interface DeepPlacement {
  position: Vec3;
  tag?: string;
}

function placeMachine(m: Machine, date: Date, earthLonDeg: number): DeepPlacement {
  switch (m.deepAnchor) {
    case 'ceres': {
      const p = heliocentricAU('ceres', date);
      return p ? { position: eclipticToScene(p[0], p[1]) } : { position: orbitPoint(CERES, ILLUSTRATIVE_NU.ceres), tag: 'position illustrative' };
    }
    case 'eros': {
      const p = heliocentricAU('eros', date);
      return p ? { position: eclipticToScene(p[0], p[1]) } : { position: orbitPoint(EROS, ILLUSTRATIVE_NU.eros), tag: 'position illustrative' };
    }
    case 'earth-trailing':
      return { position: eclipticLonToScene(earthLonDeg - keplerTrailAngleDeg(date), 1.0), tag: 'estimated' };
    case 'outbound':
    default:
      return { position: eclipticLonToScene(m.headingEclipticLon ?? 0, 11), tag: m.deepAnchor === 'outbound' ? 'direction approx.' : undefined };
  }
}

function auLabel(m: Machine, date: Date): string {
  const path = signalPath(m.id as MachineId, 'deep', date);
  if (path.distanceKm === null) return m.shortName;
  const au = path.distanceKm / AU_KM;
  return `${m.shortName} → ${path.estimate ? '~' : ''}${Math.round(au)} AU`;
}

export function DeepSpace() {
  const group = useRef<Group>(null);
  const nowMs = useApp(s => s.nowMs);
  const showLabels = useApp(s => s.view === 'deep');
  const machines = useMemo(() => MACHINES.filter(m => m.world === 'deep'), []);

  useEffect(() => {
    groups.deep = group.current;
    return () => {
      groups.deep = null;
    };
  }, []);

  const orbits = useMemo(
    () => [
      orbitLine(EARTH, '#4d6378', 0.85),
      orbitLine(MARS, '#5a4a44', 0.85),
      orbitLine(EROS, PALETTE.dim, 0.9),
      orbitLine(CERES, PALETTE.dim, 0.9),
    ],
    [],
  );
  useEffect(
    () => () =>
      orbits.forEach(o => {
        o.geometry.dispose();
        (o.material as LineBasicMaterial).dispose();
      }),
    [orbits],
  );

  const layout = useMemo(() => {
    const date = new Date(nowMs);
    const e = heliocentricAU('earth', date) ?? [1, 0, 0];
    const m = heliocentricAU('mars', date) ?? [1.52, 0, 0];
    const earthLon = Math.atan2(e[1], e[0]) / DEG;
    const placements = new Map<string, DeepPlacement>();
    for (const machine of machines) placements.set(machine.id, placeMachine(machine, date, earthLon));
    const labels = new Map<string, string>();
    for (const machine of machines) if (machine.deepAnchor === 'outbound') labels.set(machine.id, auLabel(machine, date));
    return { earth: eclipticToScene(e[0], e[1]), mars: eclipticToScene(m[0], m[1]), placements, labels };
  }, [nowMs, machines]);

  useEffect(() => {
    for (const [id, p] of layout.placements) deepLocal.set(id, new Vector3(...p.position));
  }, [layout]);

  // Dashed tracks from the Sun to the outbound probes, and their arrowheads.
  const outbound = useMemo(() => machines.filter(m => m.deepAnchor === 'outbound'), [machines]);
  const tracks = useMemo(
    () =>
      outbound.map(m => {
        const p = eclipticLonToScene(m.headingEclipticLon ?? 0, 11);
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, ...p], 3));
        const line = new Line(g, new LineDashedMaterial({ color: PALETTE.ghost, dashSize: 0.14, gapSize: 0.12, transparent: true, opacity: 0.35, toneMapped: false }));
        line.computeLineDistances();
        const dir = new Vector3(...p).normalize();
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
        const tip = dir.clone().multiplyScalar(DEEP_EDGE + 0.32);
        return { id: m.id, line, q, tip };
      }),
    [outbound],
  );
  useEffect(
    () => () =>
      tracks.forEach(t => {
        t.line.geometry.dispose();
        (t.line.material as LineDashedMaterial).dispose();
      }),
    [tracks],
  );

  return (
    <group ref={group} position={DEEP_POS}>
      {/* Sun */}
      <mesh>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshBasicMaterial color="#fff1c9" toneMapped={false} />
      </mesh>
      <sprite scale={2.4} renderOrder={2}>
        <spriteMaterial map={glowTexture()} color="#ffcf7a" transparent opacity={0.75} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>

      {orbits.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      {tracks.map(t => (
        <group key={t.id}>
          <primitive object={t.line} />
          <mesh position={t.tip} quaternion={t.q}>
            <coneGeometry args={[0.07, 0.24, 12]} />
            <meshBasicMaterial color={PALETTE.ghost} transparent opacity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Earth and Mars, true positions now */}
      <mesh position={layout.earth}>
        <sphereGeometry args={[0.075, 20, 14]} />
        <meshBasicMaterial color="#79a9d6" toneMapped={false} />
      </mesh>
      <mesh position={layout.mars}>
        <sphereGeometry args={[0.06, 20, 14]} />
        <meshBasicMaterial color="#c8643c" toneMapped={false} />
      </mesh>

      {machines.map(m => {
        const p = layout.placements.get(m.id);
        if (!p) return null;
        return <Marker key={m.id} machine={m} position={p.position} normal={null} tag={p.tag} />;
      })}

      {showLabels && (
        <>
          <Html position={[0, 0.32, 0]} center zIndexRange={[11, 0]} pointerEvents="none" className="marker-label orbit-label">Sun</Html>
          <Html position={[layout.earth[0], 0.25, layout.earth[2]]} center zIndexRange={[11, 0]} pointerEvents="none" className="marker-label orbit-label">Earth · now</Html>
          <Html position={[layout.mars[0], 0.25, layout.mars[2]]} center zIndexRange={[11, 0]} pointerEvents="none" className="marker-label orbit-label">Mars · now</Html>
          <Html position={orbitPoint(CERES, 300)} center zIndexRange={[11, 0]} pointerEvents="none" className="marker-label orbit-label">Ceres orbit</Html>
          <Html position={orbitPoint(EROS, 250)} center zIndexRange={[11, 0]} pointerEvents="none" className="marker-label orbit-label">Eros orbit</Html>
          {tracks.map(t => (
            <Html key={t.id} position={[t.tip.x * 1.06, 0.3, t.tip.z * 1.06]} center zIndexRange={[11, 0]} pointerEvents="none" className="marker-label orbit-label">
              {layout.labels.get(t.id) ?? MACHINE_BY_ID[t.id]?.shortName}
            </Html>
          ))}
        </>
      )}

      <DeepPing earth={layout.earth} placements={layout.placements} />
    </group>
  );
}

/** Radio call into deep space: a dot crosses from Earth to the machine, rings spread there. */
function DeepPing({ earth, placements }: { earth: Vec3; placements: Map<string, DeepPlacement> }) {
  const reduced = useReducedMotion();
  const dot = useRef<Sprite>(null);
  const ringA = useRef<Sprite>(null);
  const ringB = useRef<Sprite>(null);
  const from = useMemo(() => new Vector3(), []);
  const to = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const ping = useApp.getState().ping;
    const m = ping ? MACHINE_BY_ID[ping.id] : undefined;
    const place = m && m.world === 'deep' ? placements.get(m.id) : undefined;
    const sprites = [dot.current, ringA.current, ringB.current];
    for (const s of sprites) if (s) s.visible = false;
    if (!ping || !m || !place || !dot.current || !ringA.current || !ringB.current) return;

    const elapsed = Date.now() - ping.startedAt;
    const wait = Math.max(1, ping.waitMs);
    const p = elapsed / wait;
    from.set(...earth);
    to.set(...place.position);

    if (p < 1) {
      // Out and back: the dot reaches the machine at half time, then nothing returns.
      const k = Math.min(1, p / 0.5);
      if (!reduced) {
        dot.current.visible = p < 0.5;
        dot.current.position.lerpVectors(from, to, k);
        dot.current.scale.setScalar(0.22);
        (dot.current.material as SpriteMaterial).opacity = 0.9;
      }
      const rings = [ringA.current, ringB.current];
      rings.forEach((r, i) => {
        r.position.copy(reduced ? to : p < 0.5 ? from : to);
        const mat = r.material as SpriteMaterial;
        if (reduced) {
          if (i > 0) return;
          r.visible = true;
          r.scale.setScalar(0.5);
          mat.opacity = 0.25 + 0.2 * Math.sin(elapsed / 600);
          return;
        }
        const ph = ((elapsed / 1000) / 1.4 + i / 2) % 1;
        r.visible = true;
        r.scale.setScalar(0.15 + 0.9 * ph);
        mat.opacity = 0.5 * (1 - ph);
      });
    } else if (ping.result !== 'echo') {
      const after = elapsed - wait;
      if (after < 1100) {
        ringA.current.visible = true;
        ringA.current.position.copy(to);
        ringA.current.scale.setScalar(0.45);
        (ringA.current.material as SpriteMaterial).opacity = (reduced ? 0.3 : 0.15 + 0.3 * Math.random()) * (1 - after / 1100);
      }
    }
  });

  return (
    <>
      <sprite ref={dot} visible={false} renderOrder={15}>
        <spriteMaterial map={glowTexture()} color={PALETTE.amber} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={ringA} visible={false} renderOrder={15}>
        <spriteMaterial map={ringTexture()} color={PALETTE.amber} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={ringB} visible={false} renderOrder={15}>
        <spriteMaterial map={ringTexture()} color={PALETTE.amber} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
    </>
  );
}
