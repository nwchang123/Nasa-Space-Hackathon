// One stop on the globe: glowing core + halo + pulse ring, an invisible hit sphere for the
// pointer, and a small HTML label while hovered. Fades out on the far side of the planet.

import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef } from 'react';
import { AdditiveBlending, Color, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Sprite, type SpriteMaterial } from 'three';
import { useApp } from '../store';
import type { Machine } from '../types';
import { markerStatus, markersInteractive, markerVisual } from './markerState';
import { live } from './registry';
import { glowTexture, ringTexture } from './sprites';
import { useReducedMotion } from './useReducedMotion';

export interface MarkerProps {
  machine: Machine;
  /** Position in the globe's local space. */
  position: [number, number, number];
  /** Outward surface normal in the globe's local space. */
  normal: [number, number, number];
  /** Small qualifier shown in the label, e.g. 'approx. position'. */
  tag?: string;
}

const tmpPos = new Vector3();
const tmpN = new Vector3();
const tmpV = new Vector3();
const tmpC = new Color();

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function Marker({ machine, position, normal, tag }: MarkerProps) {
  const id = machine.id;
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const halo = useRef<Sprite>(null);
  const ring = useRef<Sprite>(null);
  const hit = useRef<Mesh>(null);
  const label = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const showLabel = useApp(s => s.hoverId === id);
  const lastColor = useRef('');

  useFrame(state => {
    const g = group.current;
    if (!g || !core.current || !halo.current || !ring.current || !hit.current) return;
    const s = useApp.getState();
    const t = state.clock.elapsedTime;
    const blend = live.shot.blend;
    const interactive = markersInteractive(s.phase) && blend < 0.2 && live.black < 0.5;
    const status = markerStatus(id, s.phase, s.flight, s.visited);
    const v = markerVisual({
      status,
      hovered: s.hoverId === id,
      interactive,
      t,
      reduced,
    });

    g.getWorldPosition(tmpPos);
    const cam = state.camera.position;
    const dist = cam.distanceTo(tmpPos);
    let facing = 1;
    if (g.parent) {
      tmpN.set(normal[0], normal[1], normal[2]).transformDirection(g.parent.matrixWorld);
      tmpV.copy(cam).sub(tmpPos).normalize();
      facing = smooth(0.02, 0.2, tmpN.dot(tmpV));
    }
    // Markers float above the surface; they fade away as the camera dives into a site.
    facing *= 1 - smooth(0.25, 0.6, blend);

    const coreMat = core.current.material as MeshBasicMaterial;
    const haloMat = halo.current.material as SpriteMaterial;
    const ringMat = ring.current.material as SpriteMaterial;
    if (lastColor.current !== v.color) {
      lastColor.current = v.color;
      coreMat.color.set(v.color);
      ringMat.color.set(v.color);
    }
    tmpC.set(v.color).multiplyScalar(Math.min(2.4, v.intensity) * 0.7);
    haloMat.color.copy(tmpC);

    // Constant size on screen, a little smaller when the camera is down close in the chase view.
    const size = dist * (dist < 0.8 ? 0.75 : 1);
    core.current.visible = facing > 0.01;
    coreMat.opacity = facing * Math.min(1, 0.55 + 0.45 * v.intensity);
    core.current.scale.setScalar(size * 0.0052);

    halo.current.visible = facing > 0.01;
    haloMat.opacity = facing;
    halo.current.scale.setScalar(size * 0.032 * v.haloScale);

    let ringScale = 0;
    let ringOpacity = 0;
    if (v.ring === 'pulse') {
      if (reduced) {
        ringScale = 0.055;
        ringOpacity = 0.7;
      } else {
        const ph = (t * 0.7) % 1;
        ringScale = 0.026 + 0.07 * ph;
        ringOpacity = 0.95 * (1 - ph);
      }
    }
    ring.current.visible = ringOpacity * facing > 0.01;
    ringMat.opacity = ringOpacity * facing;
    ring.current.scale.setScalar(size * ringScale);

    // Nearby stops overlap (Ingenuity and the backshell are both in Jezero): the destination's hit
    // sphere is a little larger, so its nearer surface wins the pointer.
    hit.current.scale.setScalar(Math.max(dist * 0.026, 0.012) * (status === 'destination' ? 1.35 : 1));
    const active = interactive && facing > 0.35;
    hit.current.userData.active = active;
    if (!active && s.hoverId === id) {
      s.hover(null);
      document.body.style.cursor = '';
    }

    if (label.current) label.current.style.opacity = String(facing);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!hit.current?.userData.active) return;
    e.stopPropagation();
    useApp.getState().hover(id);
  };
  const onOut = () => {
    if (useApp.getState().hoverId === id) useApp.getState().hover(null);
    document.body.style.cursor = '';
  };

  return (
    <group ref={group} position={position}>
      <mesh ref={core} renderOrder={12}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <sprite ref={halo} renderOrder={11}>
        <spriteMaterial map={glowTexture()} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} toneMapped={false} fog={false} />
      </sprite>
      <sprite ref={ring} renderOrder={13}>
        <spriteMaterial map={ringTexture()} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
      </sprite>
      <mesh ref={hit} onPointerOver={onOver} onPointerOut={onOut}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {showLabel && (
        <Html center zIndexRange={[12, 0]} pointerEvents="none" className="marker-label">
          <div ref={label} className="marker-label-inner" style={{ transform: 'translateY(-22px)', whiteSpace: 'nowrap' }}>
            {machine.shortName}
            <span className="marker-label-year"> · {machine.arrived.slice(0, 4)}</span>
            {tag && <span className="marker-label-tag"> · {tag}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}
