// The twin rovers. Spirit: the visitor drives it backwards with a slider, dragging the jammed
// right-front wheel, which scrapes up a bright trench of nearly pure silica (2006-2007); dust puffs
// from the wheel while it moves. Opportunity: dust in the air for the 2018
// storm (the sky and light themselves change through applySiteFx, fx.ts).

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Object3D,
} from 'three';
import { SITE_SCALE, smoothstep } from '../layout';
import { live } from '../registry';
import { useReducedMotion } from '../useReducedMotion';
import { playScrape } from '../../ui/sound';
import { boxPoint, findMachine, groundAt, localBox, rightFrontFoot, SigFocus, SigTag, siteShown, sigNow, softDot, type SiteSignatureProps } from './common';
import { Puffs, useSliderDrive } from './drive';
import { LAST_SIGNAL_TAU, STORM_TAU_MAX, STORM_TAU_MIN } from './logic';

// ---------------------------------------------------------------- Spirit

/** How far the re-enactment backs up at the slider's end (illustrative). */
const BACK_M = 0.7;
const TRENCH_W = 0.17;
const TRENCH_SEGS = 28;
const ACROSS = [0, 0.8, 1, 0.8, 0];

/**
 * A soft-edged strip on the ground from (x, z0) back toward −Z for `len` metres (machine-local,
 * turned frame), following the ground; columns fade out at the edges (vertex alpha).
 */
function trenchGeometry(x: number, z0: number, len: number, height: (x: number, z: number) => number): BufferGeometry {
  const cols = ACROSS.length;
  const pos: number[] = [];
  const col: number[] = [];
  for (let j = 0; j <= TRENCH_SEGS; j++) {
    const z = z0 - (len * j) / TRENCH_SEGS;
    for (let i = 0; i < cols; i++) {
      const px = x + (i / (cols - 1) - 0.5) * TRENCH_W;
      pos.push(px, height(px, z) + 0.012, z);
      const w = 0.9 + 0.1 * Math.sin(j * 1.7 + i);
      col.push(0.96 * w, 0.95 * w, 0.9 * w, ACROSS[i]);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < TRENCH_SEGS; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + cols;
      // Counter-clockwise seen from above (rows run toward −Z, columns toward +X).
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function SpiritDrag({ stop, ground, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const anchor = useRef<Group>(null);
  const machine = useRef<Object3D | null>(null);
  const shown = useRef(0);
  const label = useMemo(() => new Vector3(), []);
  const wheelAt = useMemo(() => new Vector3(), []);
  const puffAt = useMemo(() => new Vector3(), []);
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
        emissive: '#ffffff',
        emissiveIntensity: 0.07,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  );
  const trench = useMemo(() => {
    const m = new Mesh(new BufferGeometry(), mat);
    m.visible = false;
    m.renderOrder = 1;
    return m;
  }, [mat]);
  const puffs = useMemo(() => new Puffs(70, '#c99a74', 0.06), []);
  const built = useRef(false);
  const contactSource = useRef<Object3D | null>(null);
  const last = useRef<{ back: number; sound: number }>({ back: 0, sound: 0 });
  const drive = useSliderDrive('drag', reduced);

  const park = () => {
    machine.current?.position.set(0, 0, 0);
  };
  useEffect(
    () => () => {
      park();
      trench.geometry.dispose();
      mat.dispose();
      puffs.dispose();
    },
    [trench, mat, puffs],
  );

  useFrame((_, dt) => {
    const p = drive(dt);
    if (!machine.current) machine.current = findMachine(anchor.current);
    const m = machine.current;
    if (!m) return;
    const loaded = m.getObjectByName('mer-right-front-contact') ?? m.getObjectByName('mer') ?? null;
    if (loaded !== contactSource.current) {
      contactSource.current = loaded;
      park();
      built.current = false;
    }
    const site = siteShown(stop);
    puffs.update(dt, site);
    if (p === null) {
      if (built.current) park();
      built.current = false;
      trench.visible = false;
      shown.current = 0;
      return;
    }
    if (!built.current) {
      // First use: with Spirit where it stands, find its right-front wheel (right = −X, front = +Z
      // in the machine's frame) and lay out the trench behind it.
      park();
      built.current = true;
      const b = localBox(m, m);
      const wheel = rightFrontFoot(m) ?? boxPoint(b, [-0.54, 0, 0.6]);
      wheelAt.copy(wheel);
      trench.geometry.dispose();
      trench.geometry = trenchGeometry(wheel.x, wheel.z, BACK_M, (x, z) => groundAt(ground, lay, x, z));
      label.set(wheel.x, groundAt(ground, lay, wheel.x, wheel.z - BACK_M * 0.5), wheel.z - BACK_M * 0.5);
      last.current.back = 0;
    }
    // The slider is the distance driven backwards: the rover, and the trench behind its wheel.
    const k = Math.min(1, Math.max(0, p));
    const back = BACK_M * k;
    const yaw = lay.machineYaw;
    m.position.set(-Math.sin(yaw) * back, 0, -Math.cos(yaw) * back);
    const rows = Math.ceil(k * TRENCH_SEGS);
    trench.visible = rows > 0;
    trench.geometry.setDrawRange(0, rows * (ACROSS.length - 1) * 6);
    shown.current = smoothstep(0.55, 0.75, k) * site;

    // Dust off the dragged wheel while it moves, and its grinding, in step with the hand.
    const moved = Math.abs(back - last.current.back);
    last.current.back = back;
    if (moved > 1e-4 && site > 0.5) {
      if (!reduced) {
        puffAt.set(wheelAt.x, groundAt(ground, lay, wheelAt.x, wheelAt.z - back) + 0.03, wheelAt.z - back);
        puffs.emit(puffAt, Math.min(6, 1 + Math.round(moved * 400)), 0.12, 0.35);
      }
      const now = performance.now();
      if (now - last.current.sound > 420) {
        last.current.sound = now;
        playScrape(450);
      }
    }
  });

  return (
    <group ref={anchor} rotation-y={lay.machineYaw}>
      <primitive object={trench} />
      <primitive object={puffs.points} />
      <SigFocus sigKey="drag" position={label} />
      <SigTag position={label} show={() => shown.current} tone="white">
        Nearly pure silica
        <small>scraped up by the dragged wheel · 2007</small>
      </SigTag>
    </group>
  );
}

// ---------------------------------------------------------------- Opportunity

const DUST_N = 420;
const DUST_BOX = 9;
const DUST_TOP = 4.5;

export function StormDust({ stop, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const anchor = useRef<Group>(null);
  const lastTag = useRef(0);
  const tagAt = useMemo(() => new Vector3(0, 1.75, 0), []);
  const boxDone = useRef(false);
  const points = useMemo(() => {
    const pos = new Float32Array(DUST_N * 3);
    let seed = 2018;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < DUST_N; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * DUST_BOX;
      pos[i * 3 + 1] = 0.05 + rnd() ** 1.6 * DUST_TOP;
      pos[i * 3 + 2] = (rnd() * 2 - 1) * DUST_BOX;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    const mat = new PointsMaterial({
      size: 0.07 * SITE_SCALE,
      map: softDot(),
      transparent: true,
      depthWrite: false,
      opacity: 0,
      sizeAttenuation: true,
    });
    const pts = new Points(g, mat);
    pts.frustumCulled = false;
    pts.visible = false;
    return pts;
  }, []);
  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as PointsMaterial).dispose();
    },
    [points],
  );

  useFrame((state, dt) => {
    const tau = sigNow('storm');
    const k = tau === undefined ? 0 : Math.min(1, Math.max(0, (tau - STORM_TAU_MIN) / (STORM_TAU_MAX - STORM_TAU_MIN)));
    const shown = siteShown(stop);
    const mat = points.material as PointsMaterial;
    mat.opacity = shown * smoothstep(0, 0.3, k) * 0.85;
    points.visible = mat.opacity > 0.003;
    lastTag.current = tau !== undefined && tau >= LAST_SIGNAL_TAU - 0.05 ? shown : 0;
    if (lastTag.current > 0 && !boxDone.current) {
      const m = findMachine(anchor.current);
      if (m) {
        const b = localBox(m, m);
        if (!b.isEmpty()) tagAt.copy(boxPoint(b, [0, 1.05, 0]));
        boxDone.current = true;
      }
    }
    if (!points.visible) return;
    // The dust takes the sky's colour, a little brighter (it scatters the light that is left).
    const look = live.siteLook;
    if (look) mat.color.setRGB(Math.min(1, look.horizon[0] * 1.7), Math.min(1, look.horizon[1] * 1.7), Math.min(1, look.horizon[2] * 1.7), SRGBColorSpace);
    mat.size = (0.05 + 0.05 * k) * SITE_SCALE;
    if (reduced) return;
    // Blown along the ground, faster as the storm grows; a little vertical churn.
    const pos = points.geometry.getAttribute('position') as Float32BufferAttribute;
    const arr = pos.array as Float32Array;
    const v = (0.5 + 3 * k) * Math.min(dt, 0.1);
    const t = state.clock.elapsedTime;
    for (let i = 0; i < DUST_N; i++) {
      let x = arr[i * 3] + v * (1 + (i % 7) * 0.08);
      if (x > DUST_BOX) x -= 2 * DUST_BOX;
      arr[i * 3] = x;
      arr[i * 3 + 1] += Math.sin(t * 1.3 + i) * 0.12 * v;
      arr[i * 3 + 2] += Math.cos(t * 0.7 + i * 1.7) * 0.25 * v;
    }
    pos.needsUpdate = true;
  });

  return (
    <group ref={anchor} rotation-y={lay.machineYaw}>
      <primitive object={points} />
      <SigFocus sigKey="storm" position={tagAt} />
      <SigTag position={tagAt} show={() => lastTag.current} tone="white">
        Last signal · 10 June 2018
      </SigTag>
    </group>
  );
}
