// A globe (Moon or Mars) lit by the real Sun direction for "now", with its machines.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { marsSubSolar, moonSubSolar } from '../astro';
import { MACHINES } from '../data/machines';
import { dateToYear, latLonToVec3 } from '../geo';
import { useApp } from '../store';
import { createGlobeMaterial, type GlobeLook } from './globeMaterial';
import { GlobePing } from './GlobePing';
import { MARKER_LIFT, timelapseSunOffsetDeg, type Vec3 } from './layout';
import { Marker } from './Marker';
import { groups } from './registry';
import { useSurfaceMap } from './surfaceMaps';
import { useReducedMotion } from './useReducedMotion';

export interface GlobeProps {
  world: 'moon' | 'mars';
  radius: number;
  position: Vec3;
  /** Base yaw so the chosen hemisphere faces the overview camera. */
  yaw: number;
  look: GlobeLook;
}

function wrapPi(a: number): number {
  const t = (((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return t - Math.PI;
}

export function Globe({ world, radius, position, yaw, look }: GlobeProps) {
  const group = useRef<Group>(null);
  const material = useMemo(() => createGlobeMaterial(look), [look]);
  const map = useSurfaceMap(world);
  const reduced = useReducedMotion();
  const spin = useRef(0);
  const lightKey = useRef('');

  const machines = useMemo(
    () => MACHINES.filter(m => m.world === world && m.lat !== undefined && m.lon !== undefined),
    [world],
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    groups[world] = group.current;
    return () => {
      groups[world] = null;
    };
  }, [world]);

  useEffect(() => {
    material.uniforms.map.value = map;
    material.uniforms.hasMap.value = map ? 1 : 0;
  }, [map, material]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const s = useApp.getState();

    // Fade the surface map in once it is ready.
    const reveal = material.uniforms.reveal;
    if (material.uniforms.hasMap.value > 0 && reveal.value < 1) reveal.value = Math.min(1, reveal.value + delta * 1.4);

    // Idle spin on the title screen only; otherwise ease back to the base orientation.
    if (s.phase === 'title' && !reduced) spin.current += delta * 0.045;
    else if (spin.current !== 0) {
      spin.current = wrapPi(spin.current) * Math.exp(-delta * 2.2);
      if (Math.abs(spin.current) < 1e-4) spin.current = 0;
    }
    g.rotation.y = yaw + spin.current;

    // Sun direction in body-fixed coordinates: real "now", or a slow sweep during the time-lapse.
    const key = `${s.nowMs}|${s.timelapseYear ?? ''}`;
    if (key !== lightKey.current) {
      lightKey.current = key;
      const date = new Date(s.nowMs);
      const sub = world === 'moon' ? moonSubSolar(date) : marsSubSolar(date);
      const offset = s.timelapseYear !== null ? timelapseSunOffsetDeg(s.timelapseYear, dateToYear(date)) : 0;
      const [x, y, z] = latLonToVec3(sub.lat, sub.lon + offset);
      material.uniforms.sunDir.value.set(x, y, z);
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh material={material}>
        <sphereGeometry args={[radius, 160, 80]} />
      </mesh>
      {machines.map(m => {
        const n = latLonToVec3(m.lat!, m.lon!);
        const p = latLonToVec3(m.lat!, m.lon!, radius * MARKER_LIFT);
        return <Marker key={m.id} machine={m} position={p} normal={n} tag={m.approxPosition ? 'approx. position' : undefined} />;
      })}
      <GlobePing world={world} radius={radius} />
    </group>
  );
}
