// What the site camera is locked on to: a slowly turning amber reticle around the focused part (a
// story hotspot or a signature action; smaller when Ingenuity merely flew past a hotspot), and the
// scanner beam from Ingenuity's belly to the part while the autopilot holds beside it (live.scan).
// Both live in world space (mounted outside the diorama's group) and follow their targets.

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DoubleSide,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import { SIGNATURES } from '../data/signatures';
import { currentStop, useApp } from '../store';
import type { MachineId } from '../types';
import { SITE_SCALE } from './layout';
import { live } from './registry';
import { useReducedMotion } from './useReducedMotion';
import './focus.css';

const LABELS = ['Why I came', 'What I found', 'My last day', 'Still here'];

function focusKey(): string | null {
  const f = useApp.getState().focus;
  return f ? (f.kind === 'hotspot' ? `hs:${f.id}` : `sig:${f.id}`) : null;
}

/** At this stop's story stage, the camera settled and the screen clear. */
function settled(stop: MachineId): boolean {
  const s = useApp.getState();
  if (s.phase !== 'flight' || s.flight.stage !== 'site' || currentStop(s.flight) !== stop) return false;
  return live.shot.siteId === stop && live.site.valid && live.shot.blend > 0.95 && live.black < 0.3;
}

export function FocusReticle({ stop }: { stop: MachineId }) {
  const group = useRef<Group>(null);
  const el = useRef<HTMLDivElement>(null);
  const focus = useApp(s => s.focus);

  useFrame(() => {
    const key = focusKey();
    const p = key ? live.targets.get(key) : undefined;
    const on = !!p && settled(stop);
    if (p && group.current) group.current.position.copy(p);
    // Every frame: a new focus remounts the element (key), which then locks on from larger.
    el.current?.classList.toggle('on', on);
  });

  const label =
    focus === null
      ? ''
      : focus.kind === 'hotspot'
        ? focus.id === 'call'
          ? 'Antenna'
          : `${String(Number(focus.id) + 1).padStart(2, '0')} ${LABELS[Number(focus.id)] ?? ''}`
        : (SIGNATURES[stop]?.find(d => d.key === focus.id)?.label ?? 'In action');
  return (
    <group ref={group}>
      <Html center zIndexRange={[3, 1]} pointerEvents="none" className="fx-reticle-wrap">
        <div
          ref={el}
          key={focus?.at ?? 0}
          className={`fx-reticle${focus && focus.strength < 0.9 ? ' nudge' : ''}`}
          aria-hidden="true"
        >
          <span className="fx-ring" />
          <span className="fx-ring fx-ring-in" />
          <span className="fx-tick t" />
          <span className="fx-tick r" />
          <span className="fx-tick b" />
          <span className="fx-tick l" />
          {focus && <span className="fx-lock">{focus.strength < 0.9 ? 'Scanning' : 'Target lock'} · {label}</span>}
        </div>
      </Html>
    </group>
  );
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Along the cone, uv.y runs 1 at the lamp → 0 at the part. Bright at both ends, scan bands running out.
const FRAG = /* glsl */ `
  uniform float opacity;
  uniform float time;
  uniform vec3 near;
  uniform vec3 far;
  varying vec2 vUv;
  void main() {
    float t = 1.0 - vUv.y;
    float bands = 0.55 + 0.45 * smoothstep(0.55, 1.0, sin((t * 14.0 - time * 3.2)));
    float edge = 0.35 + 0.65 * smoothstep(0.0, 0.18, t) ;
    float a = opacity * edge * bands * (0.16 + 0.22 * t);
    gl_FragColor = vec4(mix(near, far, t) * a, a);
  }
`;

const up = new Vector3();
const span = new Vector3();
const Y_DOWN = new Vector3(0, -1, 0);
const q = new Quaternion();

/** The scanner cone from Ingenuity's belly to the part it is scanning. */
export function ScanBeam({ stop }: { stop: MachineId }) {
  const mesh = useRef<Mesh>(null);
  const reduced = useReducedMotion();
  const k = useRef(0);
  // A unit cone: apex at the origin, opening along −Y to a radius-1 base at y = −1.
  const geometry = useMemo(() => new ConeGeometry(1, 1, 32, 1, true).translate(0, -0.5, 0), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          opacity: { value: 0 },
          time: { value: 0 },
          near: { value: new Color('#ffc46b') },
          far: { value: new Color('#7fe3ff') },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        fog: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const want = live.scan.k > 0 && live.flyer.site === stop && live.shot.siteId === stop ? 1 : 0;
    k.current = reduced ? want : k.current + (want - k.current) * (1 - Math.exp(-5 * Math.min(0.1, delta)));
    m.visible = k.current > 0.01;
    if (!m.visible) return;
    up.copy(live.site.up);
    m.position.copy(live.flyerWorld).addScaledVector(up, 0.12 * SITE_SCALE);
    span.copy(live.scan.point).sub(m.position);
    const len = span.length();
    if (len < 1e-9) {
      m.visible = false;
      return;
    }
    m.quaternion.copy(q.setFromUnitVectors(Y_DOWN, span.divideScalar(len)));
    const r = Math.min(0.45 * SITE_SCALE, len * 0.32);
    m.scale.set(r, len, r);
    material.uniforms.opacity.value = k.current;
    material.uniforms.time.value = reduced ? 0 : state.clock.elapsedTime;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} visible={false} frustumCulled={false} renderOrder={9} />;
}
