// Mars, lit by the real Sun for "now", with the nine stops and the route. The Director turns it
// (only while nothing is anchored to it); it hides once the camera stands inside a site diorama.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Quaternion, type Group } from 'three';
import { MACHINES } from '../data/machines';
import { latLonToVec3 } from '../geo';
import { createGlobeMaterial, MARS_LOOK } from './globeMaterial';
import { GLOBE_R, MARKER_LIFT } from './layout';
import { Marker } from './Marker';
import { groups, live } from './registry';
import { RouteLines } from './RouteLines';
import { useSurfaceMap } from './surfaceMaps';

const inv = new Quaternion();

export function Globe() {
  const group = useRef<Group>(null);
  const material = useMemo(() => createGlobeMaterial(MARS_LOOK), []);
  // NASA's Viking colour mosaic (src/scene/maps/mars.webp) when present; the painted map otherwise.
  const map = useSurfaceMap('mars');

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    groups.globe = group.current;
    return () => {
      groups.globe = null;
    };
  }, []);

  useEffect(() => {
    material.uniforms.map.value = map;
    material.uniforms.hasMap.value = map ? 1 : 0;
  }, [map, material]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    // Out of sight once the camera stands inside a site (the ground and sky cover it).
    g.visible = live.shot.blend < 0.985;

    const reveal = material.uniforms.reveal;
    if (material.uniforms.hasMap.value > 0 && reveal.value < 1) reveal.value = Math.min(1, reveal.value + delta * 1.4);

    // The shader wants the Sun in body-fixed coordinates: turn the world direction back.
    material.uniforms.sunDir.value.copy(live.sun).applyQuaternion(inv.copy(g.quaternion).invert());
  });

  return (
    <group ref={group}>
      <mesh material={material}>
        <sphereGeometry args={[GLOBE_R, 160, 80]} />
      </mesh>
      {MACHINES.map(m => {
        const n = latLonToVec3(m.lat, m.lon);
        const p = latLonToVec3(m.lat, m.lon, GLOBE_R * MARKER_LIFT);
        return <Marker key={m.id} machine={m} position={p} normal={n} tag={m.approxPosition ? 'approx. position' : undefined} />;
      })}
      <RouteLines />
    </group>
  );
}
