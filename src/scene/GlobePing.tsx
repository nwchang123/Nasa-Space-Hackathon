// Call effects on a globe (all positions in the globe group's local, body-fixed space).
// Laser (Moon): a thin green beam from Earth's direction to the site; the return pulse only
// exists if the site carries a retroreflector. Radio: faint amber rings spreading from the site,
// then a brief dim static shimmer when nothing answers.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
  type Mesh,
  type MeshBasicMaterial,
  type Sprite,
  type SpriteMaterial,
} from 'three';
import { moonSubEarth } from '../astro';
import { MACHINE_BY_ID } from '../data/machines';
import { latLonToVec3 } from '../geo';
import { useApp } from '../store';
import { PALETTE } from './markerState';
import { dotTexture, glowTexture, ringTexture } from './sprites';
import { useReducedMotion } from './useReducedMotion';

const SHIMMER_N = 28;
const RINGS = 3;
const Z = new Vector3(0, 0, 1);

export function GlobePing({ world, radius }: { world: 'moon' | 'mars'; radius: number }) {
  const reduced = useReducedMotion();
  const pulse = useRef<Sprite>(null);
  const reticle = useRef<Sprite>(null);
  const flash = useRef<Sprite>(null);
  const rings = useRef<(Mesh | null)[]>([]);
  const earthKey = useRef(0);
  const earthDir = useRef(new Vector3(1, 0, 0));

  const beam = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
    const m = new LineBasicMaterial({ color: PALETTE.signal, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const l = new Line(g, m);
    l.frustumCulled = false;
    l.renderOrder = 14;
    return l;
  }, []);

  const shimmer = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(SHIMMER_N * 3), 3));
    const m = new PointsMaterial({
      color: PALETTE.bone,
      size: 3,
      sizeAttenuation: false,
      map: dotTexture(),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 14;
    return p;
  }, []);

  const site = useMemo(() => new Vector3(), []);
  const normal = useMemo(() => new Vector3(), []);
  const far = useMemo(() => new Vector3(), []);
  const head = useMemo(() => new Vector3(), []);
  const q = useMemo(() => new Quaternion(), []);
  const tangentA = useMemo(() => new Vector3(), []);
  const tangentB = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const ping = useApp.getState().ping;
    const m = ping ? MACHINE_BY_ID[ping.id] : undefined;
    const beamMat = beam.material as LineBasicMaterial;
    const shimmerMat = shimmer.material as PointsMaterial;
    const hideAll = () => {
      beamMat.opacity = 0;
      beam.visible = false;
      shimmer.visible = false;
      if (pulse.current) pulse.current.visible = false;
      if (reticle.current) reticle.current.visible = false;
      if (flash.current) flash.current.visible = false;
      for (const r of rings.current) if (r) r.visible = false;
    };
    if (!ping || !m || m.world !== world || m.lat === undefined || m.lon === undefined) {
      hideAll();
      return;
    }
    hideAll();

    const elapsed = Date.now() - ping.startedAt;
    const wait = Math.max(1, ping.waitMs);
    const p = elapsed / wait;
    const after = elapsed - wait;

    const [sx, sy, sz] = latLonToVec3(m.lat, m.lon, radius * 1.008);
    site.set(sx, sy, sz);
    normal.copy(site).normalize();

    if (ping.channel === 'laser') {
      if (earthKey.current !== ping.startedAt) {
        earthKey.current = ping.startedAt;
        const se = moonSubEarth(new Date(ping.startedAt));
        const [ex, ey, ez] = latLonToVec3(se.lat, se.lon);
        earthDir.current.set(ex, ey, ez);
      }
      far.copy(earthDir.current).multiplyScalar(radius * 40);
      const pos = beam.geometry.getAttribute('position') as Float32BufferAttribute;
      const echoes = m.reflector;

      if (p < 0.5) {
        const k = p / 0.5;
        head.lerpVectors(far, site, reduced ? 1 : k);
        pos.setXYZ(0, far.x, far.y, far.z);
        pos.setXYZ(1, head.x, head.y, head.z);
        beam.visible = true;
        beamMat.opacity = reduced ? 0.35 * k : 0.4;
        if (pulse.current && !reduced) {
          pulse.current.visible = true;
          pulse.current.position.copy(head);
          pulse.current.scale.setScalar(radius * 0.05);
          (pulse.current.material as SpriteMaterial).opacity = 0.9;
        }
        if (reticle.current) {
          reticle.current.visible = true;
          reticle.current.position.copy(site);
          reticle.current.scale.setScalar(radius * (reduced ? 0.12 : 0.42 - 0.32 * k));
          (reticle.current.material as SpriteMaterial).opacity = 0.55;
        }
      } else if (p < 1) {
        const k = (p - 0.5) / 0.5;
        beam.visible = true;
        if (echoes) {
          head.lerpVectors(site, far, reduced ? 1 : k);
          pos.setXYZ(0, site.x, site.y, site.z);
          pos.setXYZ(1, head.x, head.y, head.z);
          beamMat.opacity = 0.7;
          if (pulse.current && !reduced) {
            pulse.current.visible = true;
            pulse.current.position.copy(head);
            pulse.current.scale.setScalar(radius * 0.07);
            (pulse.current.material as SpriteMaterial).opacity = 1;
          }
        } else {
          pos.setXYZ(0, far.x, far.y, far.z);
          pos.setXYZ(1, site.x, site.y, site.z);
          beamMat.opacity = 0.35 * (1 - k);
        }
        if (reticle.current) {
          reticle.current.visible = true;
          reticle.current.position.copy(site);
          reticle.current.scale.setScalar(radius * 0.1);
          (reticle.current.material as SpriteMaterial).opacity = 0.5 * (1 - k * 0.5);
        }
      } else if (ping.result === 'echo' && after < 1600 && flash.current) {
        const k = after / 1600;
        flash.current.visible = true;
        flash.current.position.copy(site);
        flash.current.scale.setScalar(radius * (0.12 + (reduced ? 0.2 : 0.55 * k)));
        (flash.current.material as SpriteMaterial).opacity = 1 - k;
      }
      pos.needsUpdate = true;
      return;
    }

    // Radio
    if (p < 1) {
      q.setFromUnitVectors(Z, normal);
      for (let i = 0; i < RINGS; i++) {
        const r = rings.current[i];
        if (!r) continue;
        const mat = r.material as MeshBasicMaterial;
        if (reduced) {
          if (i > 0) continue;
          r.visible = true;
          r.scale.setScalar(radius * 0.14);
          mat.opacity = 0.25 + 0.2 * Math.sin(elapsed / 600);
        } else {
          const ph = ((elapsed / 1000) / 1.6 + i / RINGS) % 1;
          r.visible = true;
          r.scale.setScalar(radius * (0.03 + 0.32 * ph));
          mat.opacity = 0.5 * (1 - ph);
        }
        r.position.copy(normal).multiplyScalar(radius * 1.012);
        r.quaternion.copy(q);
      }
    } else if (ping.result !== 'echo' && after < 1100) {
      const k = after / 1100;
      tangentA.set(0, 1, 0).cross(normal);
      if (tangentA.lengthSq() < 1e-6) tangentA.set(1, 0, 0);
      tangentA.normalize();
      tangentB.copy(normal).cross(tangentA).normalize();
      const pos = shimmer.geometry.getAttribute('position') as Float32BufferAttribute;
      for (let i = 0; i < SHIMMER_N; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * radius * 0.09;
        head.copy(site).addScaledVector(tangentA, Math.cos(a) * d).addScaledVector(tangentB, Math.sin(a) * d);
        pos.setXYZ(i, head.x, head.y, head.z);
      }
      pos.needsUpdate = true;
      shimmer.visible = true;
      shimmerMat.opacity = (reduced ? 0.35 : 0.2 + 0.35 * Math.random()) * (1 - k);
    }
  });

  return (
    <>
      <primitive object={beam} />
      <primitive object={shimmer} />
      <sprite ref={pulse} visible={false} renderOrder={15}>
        <spriteMaterial map={glowTexture()} color={PALETTE.signal} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={reticle} visible={false} renderOrder={15}>
        <spriteMaterial map={ringTexture()} color={PALETTE.signal} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={flash} visible={false} renderOrder={15}>
        <spriteMaterial map={glowTexture()} color={PALETTE.signal} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>
      {Array.from({ length: RINGS }, (_, i) => (
        <mesh key={i} ref={el => { rings.current[i] = el; }} visible={false} renderOrder={14}>
          <ringGeometry args={[0.93, 1, 64]} />
          <meshBasicMaterial color={PALETTE.amber} transparent opacity={0} depthTest={false} depthWrite={false} side={2} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
