// The radio call at a site: faint amber rings spread from the machine's antenna while the
// signal is out (store.ping, for waitMs), then a brief dim static shimmer when nothing answers.
// With reduced motion the rings fade in place instead of spreading, and the static holds still.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, type Sprite, type SpriteMaterial } from 'three';
import { useApp } from '../store';
import type { MachineId } from '../types';
import type { Vec3 } from './layout';
import { PALETTE } from './markerState';
import { dotTexture, ringTexture } from './sprites';
import { useReducedMotion } from './useReducedMotion';

const RINGS = 3;
const SPECKS = 48;
/** How long the static lasts after the listening window closes, ms. */
const SHIMMER_MS = 1400;

/**
 * `size` scales the effect (metres, in the diorama's own units); `unit` is world units per metre,
 * needed for the static's point size, which is set in world units.
 */
export function SitePing({ stop, antenna, size, unit }: { stop: MachineId; antenna: Vec3; size: number; unit: number }) {
  const reduced = useReducedMotion();
  const rings = useRef<(Sprite | null)[]>([]);
  const staticFor = useRef({ startedAt: -1, from: 0 });

  const shimmer = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(SPECKS * 3), 3));
    const m = new PointsMaterial({
      map: dotTexture(),
      color: PALETTE.bone,
      size: 0.05 * size * unit,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const p = new Points(g, m);
    p.visible = false;
    p.frustumCulled = false;
    return p;
  }, [size, unit]);

  useEffect(
    () => () => {
      shimmer.geometry.dispose();
      (shimmer.material as PointsMaterial).dispose();
    },
    [shimmer],
  );

  useFrame(() => {
    const ping = useApp.getState().ping;
    const now = Date.now();
    const live = ping && ping.id === stop ? ping : null;
    const e = live ? now - live.startedAt : Infinity;
    const listening = live !== null && live.result === null && e < live.waitMs;

    rings.current.forEach((r, j) => {
      if (!r) return;
      const mat = r.material as SpriteMaterial;
      if (!listening) {
        r.visible = false;
        return;
      }
      const fadeIn = Math.min(1, e / 300);
      if (reduced) {
        // One steady ring breathing in and out; nothing moves.
        r.visible = j === 0;
        r.scale.setScalar(1.4 * size);
        mat.opacity = fadeIn * (0.35 + 0.3 * Math.sin(e * 0.004));
      } else {
        const ph = ((e / 1000) * 0.8 + j / RINGS) % 1;
        r.visible = true;
        r.scale.setScalar((0.3 + 3.2 * ph) * size);
        mat.opacity = 0.7 * (1 - ph) * fadeIn;
      }
    });

    // Static from the moment the window closes (time out, or the console reports silence).
    if (live && !listening && staticFor.current.startedAt !== live.startedAt) {
      staticFor.current = { startedAt: live.startedAt, from: now };
    }
    const since = live && staticFor.current.startedAt === live.startedAt ? now - staticFor.current.from : Infinity;
    const showStatic = since < SHIMMER_MS;
    shimmer.visible = showStatic;
    if (!showStatic) return;
    const k = 1 - since / SHIMMER_MS;
    (shimmer.material as PointsMaterial).opacity = 0.55 * k * k;
    const pos = shimmer.geometry.getAttribute('position') as Float32BufferAttribute;
    if (!reduced || since < 40) {
      for (let i = 0; i < SPECKS; i++) {
        const r = (0.15 + Math.random() * 0.75) * size;
        const a = Math.random() * Math.PI * 2;
        const b = (Math.random() - 0.5) * Math.PI;
        pos.setXYZ(i, antenna[0] + r * Math.cos(b) * Math.cos(a), antenna[1] + r * Math.sin(b), antenna[2] + r * Math.cos(b) * Math.sin(a));
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group>
      {Array.from({ length: RINGS }, (_, j) => (
        <sprite
          key={j}
          ref={el => {
            rings.current[j] = el;
          }}
          position={antenna}
          visible={false}
          renderOrder={20}
        >
          <spriteMaterial map={ringTexture()} color={PALETTE.amber} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
        </sprite>
      ))}
      <primitive object={shimmer} />
    </group>
  );
}
