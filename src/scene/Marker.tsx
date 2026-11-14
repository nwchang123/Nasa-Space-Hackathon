// One machine on the map: glowing core + halo + state ring, an invisible hit sphere for the
// pointer, and a small HTML label for the hovered / selected machine.

import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Sprite, type SpriteMaterial } from 'three';
import { yearFraction } from '../geo';
import { useApp } from '../store';
import type { Machine } from '../types';
import { markerVisual } from './markerState';
import { glowTexture, ringTexture } from './sprites';
import { useReducedMotion } from './useReducedMotion';

export interface MarkerProps {
  machine: Machine;
  /** Position in the parent group's local space. */
  position: [number, number, number];
  /** Outward surface normal in the parent's local space (globes); null in deep space. */
  normal: [number, number, number] | null;
  /** Small qualifier shown in the label, e.g. 'estimated'. */
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
  const showLabel = useApp(s => s.hoverId === id || s.selectedId === id);
  const years = useMemo(() => ({ arrived: yearFraction(machine.arrived), last: yearFraction(machine.lastContact) }), [machine]);
  const lastColor = useRef('');

  useFrame(state => {
    const g = group.current;
    if (!g || !core.current || !halo.current || !ring.current || !hit.current) return;
    const s = useApp.getState();
    const t = state.clock.elapsedTime;
    const v = markerVisual({
      phase: s.phase,
      timelapseYear: s.timelapseYear,
      arrivedYear: years.arrived,
      lastContactYear: years.last,
      selected: s.selectedId === id,
      hovered: s.hoverId === id,
      called: s.called[id],
      t,
      reduced,
    });

    g.getWorldPosition(tmpPos);
    const cam = state.camera.position;
    const dist = cam.distanceTo(tmpPos);
    let facing = 1;
    if (normal && g.parent) {
      tmpN.set(normal[0], normal[1], normal[2]).transformDirection(g.parent.matrixWorld);
      tmpV.copy(cam).sub(tmpPos).normalize();
      facing = smooth(0.02, 0.2, tmpN.dot(tmpV));
    }
    const vis = v.visible ? facing : 0;

    const coreMat = core.current.material as MeshBasicMaterial;
    const haloMat = halo.current.material as SpriteMaterial;
    const ringMat = ring.current.material as SpriteMaterial;
    if (lastColor.current !== v.color) {
      lastColor.current = v.color;
      coreMat.color.set(v.color);
      ringMat.color.set(v.color);
    }
    tmpC.set(v.color).multiplyScalar(Math.min(2.6, v.intensity) * 0.7);
    haloMat.color.copy(tmpC);

    core.current.visible = vis > 0.01;
    coreMat.opacity = vis * Math.min(1, 0.55 + 0.45 * v.intensity);
    core.current.scale.setScalar(dist * 0.0052);

    halo.current.visible = vis > 0.01;
    haloMat.opacity = vis;
    halo.current.scale.setScalar(dist * 0.032 * v.haloScale);

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
    } else if (v.ring === 'check') {
      ringScale = 0.036;
      ringOpacity = 0.4;
    } else if (v.ring === 'echo') {
      ringScale = 0.046;
      ringOpacity = 0.75;
    }
    ring.current.visible = ringOpacity * vis > 0.01;
    ringMat.opacity = ringOpacity * vis;
    ring.current.scale.setScalar(dist * ringScale);

    hit.current.scale.setScalar(Math.max(dist * 0.026, 0.03));
    const active = v.interactive && vis > 0.35;
    hit.current.userData.active = active;
    if (!active && s.hoverId === id) {
      s.hover(null);
      document.body.style.cursor = '';
    }

    if (label.current) label.current.style.opacity = String(vis);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!hit.current?.userData.active) return;
    e.stopPropagation();
    useApp.getState().hover(id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    if (useApp.getState().hoverId === id) useApp.getState().hover(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!hit.current?.userData.active) return;
    e.stopPropagation();
    useApp.getState().select(id);
  };

  return (
    <group ref={group} position={position}>
      <mesh ref={core} renderOrder={12}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <sprite ref={halo} renderOrder={11}>
        <spriteMaterial map={glowTexture()} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={ring} renderOrder={13}>
        <spriteMaterial map={ringTexture()} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      <mesh ref={hit} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {showLabel && (
        <Html center zIndexRange={[12, 0]} pointerEvents="none" className="marker-label">
          <div ref={label} className="marker-label-inner" style={{ transform: 'translateY(-22px)', whiteSpace: 'nowrap' }}>
            {machine.shortName}
            {tag && <span className="marker-label-tag"> · {tag}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}
