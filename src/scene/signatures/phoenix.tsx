// Phoenix: the arm digs a trench that shows whitish clumps of water ice, which vanish over four
// sols (time-lapse); meanwhile snow falls from above and vaporises before reaching the ground, as
// Phoenix's laser saw. Heights are compressed: the real clouds were about 4 km up.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
  type Group,
  type Object3D,
} from 'three';
import { PHOENIX_SHOULDER } from '../models';
import { SITE_SCALE, smoothstep } from '../layout';
import { useReducedMotion } from '../useReducedMotion';
import { findMachine, groundAt, SigTag, siteShown, sigNow, softDot, type SiteSignatureProps } from './common';
import { buttonProgress, easeInOut, phase } from './logic';

const SCOOP_MS = 8000;
/** The arm's lift axis: level, across the arm's reach (models.ts phoenixArm). */
const AXIS = new Vector3(0.988, 0, 0.152).normalize();
/** The scoop's tip relative to the shoulder at rest. */
const TIP = new Vector3(-0.2, -1.0, 1.35);
const REACH = new Vector3(TIP.x, 0, TIP.z).normalize();
const ACROSS = new Vector3(REACH.z, 0, -REACH.x);
const DIG = 0.04;
const RAISED = -0.24;

/** The arm's angle about AXIS (negative lifts) at progress p. */
function armAngle(p: number): number {
  if (p < 0.12) return -0.28 * easeInOut(phase(p, 0, 0.12));
  if (p < 0.24) return -0.28 + (DIG + 0.28) * easeInOut(phase(p, 0.12, 0.24));
  if (p < 0.4) return DIG + 0.018 * Math.sin(phase(p, 0.24, 0.4) * Math.PI * 4);
  return DIG + (RAISED - DIG) * easeInOut(phase(p, 0.4, 0.52));
}

const SNOW_N = 300;
const SNOW_R = 3.6;
const SNOW_TOP = 4.6;
const SNOW_GONE = 2.3;

type Stage = 'none' | 'ice' | 1 | 2 | 3 | 4 | 'gone';

export function PhoenixScoop({ stop, ground, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const anchor = useRef<Group>(null);
  const arm = useRef<Object3D | null>(null);
  const shown = useRef({ trench: 0, snow: 0 });
  const [stage, setStage] = useState<Stage>('none');
  const stageRef = useRef<Stage>('none');
  const q = useMemo(() => new Quaternion(), []);

  // Where the scoop bites: the tip at the dig angle, pulled back a little toward the lander.
  const dig = useMemo(() => {
    const t = TIP.clone().applyAxisAngle(AXIS, DIG).add(new Vector3(...PHOENIX_SHOULDER)).addScaledVector(REACH, -0.1);
    t.y = groundAt(ground, lay, t.x, t.z);
    return t;
  }, [ground, lay]);

  const parts = useMemo(() => {
    // The trench: a dark, soft-edged patch along the arm's reach.
    const cols = [0, 0.85, 1, 0.85, 0];
    const rows = [0, 0.85, 1, 1, 0.85, 0];
    const pos: number[] = [];
    const col: number[] = [];
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < cols.length; i++) {
        const a = (i / (cols.length - 1) - 0.5) * 0.24;
        const b = (j / (rows.length - 1) - 0.5) * 0.42;
        const x = dig.x + ACROSS.x * a + REACH.x * b;
        const z = dig.z + ACROSS.z * a + REACH.z * b;
        pos.push(x, groundAt(ground, lay, x, z) + 0.006, z);
        col.push(0.2, 0.13, 0.09, cols[i] * rows[j]);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < rows.length - 1; j++) {
      for (let i = 0; i < cols.length - 1; i++) {
        const a = j * cols.length + i;
        const b = a + cols.length;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const tg = new BufferGeometry();
    tg.setAttribute('position', new Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new Float32BufferAttribute(col, 4));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    const trenchMat = new MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      opacity: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const trench = new Mesh(tg, trenchMat);
    trench.renderOrder = 1;

    // Ice clumps on the trench floor.
    const clumpGeom = new IcosahedronGeometry(0.022, 0);
    const clumpMat = new MeshStandardMaterial({ color: '#f1f3f5', emissive: '#ffffff', emissiveIntensity: 0.12, roughness: 0.6, transparent: true, opacity: 0 });
    const clumps = [
      [-0.05, -0.06, 1.1],
      [0.04, 0.02, 0.8],
      [-0.02, 0.09, 1.25],
      [0.06, -0.12, 0.7],
    ].map(([a, b, s]) => {
      const m = new Mesh(clumpGeom, clumpMat);
      const x = dig.x + ACROSS.x * a + REACH.x * b;
      const z = dig.z + ACROSS.z * a + REACH.z * b;
      m.position.set(x, groundAt(ground, lay, x, z) + 0.008, z);
      m.scale.set(s * 1.2, s * 0.6, s);
      m.userData.base = m.scale.clone();
      m.rotation.y = a * 20;
      return m;
    });

    // Snow above the lander, and the laser looking up at it.
    const sp = new Float32Array(SNOW_N * 3);
    const sc = new Float32Array(SNOW_N * 4);
    let seed = 2008;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < SNOW_N; i++) {
      const r = SNOW_R * Math.sqrt(rnd());
      const a = rnd() * Math.PI * 2;
      sp[i * 3] = r * Math.cos(a);
      sp[i * 3 + 1] = SNOW_GONE + rnd() * (SNOW_TOP - SNOW_GONE);
      sp[i * 3 + 2] = r * Math.sin(a);
      sc[i * 4] = sc[i * 4 + 1] = sc[i * 4 + 2] = 1;
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new Float32BufferAttribute(sp, 3));
    sg.setAttribute('color', new Float32BufferAttribute(sc, 4));
    const snow = new Points(
      sg,
      new PointsMaterial({ size: 0.13 * SITE_SCALE, map: softDot(), vertexColors: true, transparent: true, depthWrite: false, opacity: 0 }),
    );
    snow.frustumCulled = false;
    snow.visible = false;
    const lg = new BufferGeometry();
    lg.setAttribute('position', new Float32BufferAttribute([0, 1.3, -0.4, 0, SNOW_TOP + 0.6, -0.4], 3));
    const beam = new Line(lg, new LineBasicMaterial({ color: '#dfe7f2', transparent: true, opacity: 0, depthWrite: false }));
    beam.visible = false;
    return { trench, clumps, clumpGeom, clumpMat, snow, beam };
  }, [dig, ground, lay]);

  const reset = () => {
    arm.current?.quaternion.identity();
  };
  useEffect(
    () => () => {
      reset();
      parts.trench.geometry.dispose();
      (parts.trench.material as MeshStandardMaterial).dispose();
      parts.clumpGeom.dispose();
      parts.clumpMat.dispose();
      parts.snow.geometry.dispose();
      (parts.snow.material as PointsMaterial).dispose();
      parts.beam.geometry.dispose();
      (parts.beam.material as LineBasicMaterial).dispose();
    },
    [parts],
  );

  useFrame((state, dt) => {
    if (!arm.current) arm.current = findMachine(anchor.current)?.getObjectByName('phoenix-arm') ?? null;
    const at = sigNow('scoop');
    const now = Date.now();
    const p = buttonProgress(at, SCOOP_MS, now, reduced);
    // Timed visibility even with reduced motion (nothing moves then, things only appear).
    const t = buttonProgress(at, SCOOP_MS, now, false);
    const site = siteShown(stop);
    if (p === null || t === null) {
      reset();
      parts.trench.visible = false;
      parts.clumps.forEach(c => (c.visible = false));
      parts.snow.visible = parts.beam.visible = false;
      shown.current.trench = shown.current.snow = 0;
      if (stageRef.current !== 'none') setStage((stageRef.current = 'none'));
      return;
    }
    if (arm.current) arm.current.quaternion.copy(q.setFromAxisAngle(AXIS, armAngle(p)));

    const trenchOpacity = smoothstep(0.24, 0.4, p);
    (parts.trench.material as MeshStandardMaterial).opacity = trenchOpacity * 0.85;
    parts.trench.visible = trenchOpacity > 0;
    // Clumps appear as the trench opens and sublimate over "four sols" (time-lapse).
    const iceAlpha = smoothstep(0.3, 0.42, p) * (1 - smoothstep(0.6, 0.95, p));
    parts.clumpMat.opacity = iceAlpha;
    const shrink = 1 - 0.6 * smoothstep(0.6, 0.95, p);
    parts.clumps.forEach(c => {
      c.visible = iceAlpha > 0.01;
      c.scale.copy(c.userData.base as Vector3).multiplyScalar(shrink);
    });
    shown.current.trench = trenchOpacity * site;

    let next: Stage = 'none';
    if (p >= 0.95) next = 'gone';
    else if (p >= 0.6) next = (1 + Math.min(3, Math.floor(phase(p, 0.6, 0.95) * 4))) as Stage;
    else if (p >= 0.36) next = 'ice';
    if (next !== stageRef.current) setStage((stageRef.current = next));

    // Snow: in from above, gone before the ground.
    const snowOn = smoothstep(0, 0.06, t) * (1 - smoothstep(0.92, 1, t)) * site;
    shown.current.snow = snowOn;
    const sm = parts.snow.material as PointsMaterial;
    sm.opacity = snowOn;
    parts.snow.visible = snowOn > 0.003;
    const bm = parts.beam.material as LineBasicMaterial;
    bm.opacity = snowOn * 0.45;
    parts.beam.visible = parts.snow.visible;
    if (!parts.snow.visible) return;
    const pa = parts.snow.geometry.getAttribute('position') as Float32BufferAttribute;
    const ca = parts.snow.geometry.getAttribute('color') as Float32BufferAttribute;
    const P = pa.array as Float32Array;
    const C = ca.array as Float32Array;
    const fall = reduced ? 0 : 0.42 * Math.min(dt, 0.1);
    const time = state.clock.elapsedTime;
    for (let i = 0; i < SNOW_N; i++) {
      let y = P[i * 3 + 1] - fall * (0.8 + (i % 5) * 0.1);
      if (y < SNOW_GONE) y += SNOW_TOP - SNOW_GONE;
      P[i * 3 + 1] = y;
      if (!reduced) P[i * 3] += Math.sin(time * 0.8 + i) * 0.03 * fall;
      C[i * 4 + 3] = smoothstep(SNOW_GONE, SNOW_GONE + 1.1, y) * (1 - smoothstep(SNOW_TOP - 0.6, SNOW_TOP, y));
    }
    pa.needsUpdate = true;
    ca.needsUpdate = true;
  });

  const trenchLabel =
    stage === 'ice' ? 'Whitish clumps: water ice' : stage === 'gone' ? 'Gone after four sols' : typeof stage === 'number' ? `Sol +${stage}: clumps shrinking` : '';
  const labelAt = useMemo(() => dig.clone().add(new Vector3(0, 0.04, 0)), [dig]);
  return (
    <group ref={anchor} rotation-y={lay.machineYaw}>
      <primitive object={parts.trench} />
      {parts.clumps.map((c, i) => (
        <primitive key={i} object={c} />
      ))}
      <primitive object={parts.snow} />
      <primitive object={parts.beam} />
      <SigTag position={labelAt} show={() => (trenchLabel ? shown.current.trench : 0)} tone="white">
        {trenchLabel || 'Trench'}
        {stage === 'gone' && <small>the ice turned to vapour</small>}
      </SigTag>
      <SigTag position={[0, SNOW_GONE + 0.15, -0.4]} show={() => shown.current.snow} tone="faint">
        Snow vaporising before the ground
        <small>seen by Phoenix&apos;s laser · clouds ~4 km up, shown much lower</small>
      </SigTag>
    </group>
  );
}
