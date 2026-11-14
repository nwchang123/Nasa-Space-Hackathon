// InSight: pulse a marsquake (rings spreading from the seismometer, a faint shake, a rumble), and
// show LaRRI, the small laser reflector on the deck, with a dashed line where a laser would come
// from. Neither is a recorded event: they show what the instruments are for.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Group,
  type Object3D,
} from 'three';
import { playQuake } from '../../ui/sound';
import { smoothstep } from '../layout';
import { live } from '../registry';
import { useReducedMotion } from '../useReducedMotion';
import { findMachine, groundAt, SigTag, siteShown, sigNow, softDot, useButtonClock, type SiteSignatureProps } from './common';
import { buttonProgress, phase } from './logic';

const QUAKE_MS = 5000;
/**
 * Where the arm set the seismometer down, in front of the lander (machine-local, as the procedural
 * model places it; NASA's model shows it still on the deck, which the site card says).
 */
const SEIS = new Vector3(0.25, 0, 1.75);
/** The deck where LaRRI sits (the deck hotspot), before a ray finds the real deck top. */
const DECK_GUESS = new Vector3(-0.45, 1.05, -0.25);
const RINGS = 3;

export function InsightQuake({ stop, ground, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const anchor = useRef<Group>(null);
  const machine = useRef<Object3D | null>(null);
  const shown = useRef(0);
  const seisY = useMemo(() => groundAt(ground, lay, SEIS.x, SEIS.z), [ground, lay]);

  const parts = useMemo(() => {
    const geom = new RingGeometry(0.93, 1, 96).rotateX(-Math.PI / 2);
    const rings = Array.from({ length: RINGS }, () => {
      const m = new Mesh(
        geom,
        new MeshBasicMaterial({
          color: '#f2a93b',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      m.renderOrder = 2;
      m.visible = false;
      return m;
    });
    return { geom, rings };
  }, []);

  const settle = () => machine.current?.position.set(0, 0, 0);
  useEffect(
    () => () => {
      settle();
      parts.geom.dispose();
      parts.rings.forEach(r => (r.material as MeshBasicMaterial).dispose());
    },
    [parts],
  );

  const clock = useButtonClock('quake', QUAKE_MS, reduced, () => playQuake());
  useFrame(() => {
    if (!machine.current) machine.current = findMachine(anchor.current);
    const m = machine.current;
    const p = clock();
    const t = buttonProgress(sigNow('quake'), QUAKE_MS, Date.now(), false);
    const site = siteShown(stop);
    if (p === null || t === null || t >= 1) {
      parts.rings.forEach(r => (r.visible = false));
      if (m && m.position.lengthSq() > 0) settle();
      shown.current = 0;
      return;
    }
    shown.current = (1 - smoothstep(0.85, 1, t)) * site;
    parts.rings.forEach((r, i) => {
      const mat = r.material as MeshBasicMaterial;
      if (reduced) {
        // No motion: three still rings for the duration.
        r.scale.setScalar(1.2 * (i + 1));
        mat.opacity = 0.45 * (1 - smoothstep(0.85, 1, t));
      } else {
        const k = phase(t, i * 0.13, i * 0.13 + 0.6);
        const grow = 1 - (1 - k) * (1 - k);
        r.scale.setScalar(0.35 + 6.5 * grow);
        mat.opacity = k > 0 && k < 1 ? 0.75 * Math.pow(1 - k, 1.3) : 0;
      }
      r.visible = mat.opacity > 0.003;
    });
    if (m && !reduced) {
      const a = 0.006 * (1 - phase(t, 0, 0.45));
      if (a > 0) m.position.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a * 0.5, (Math.random() - 0.5) * a);
      else settle();
    }
  });

  return (
    <group ref={anchor} rotation-y={lay.machineYaw}>
      <group position={[SEIS.x, seisY + 0.015, SEIS.z]}>
        {parts.rings.map((r, i) => (
          <primitive key={i} object={r} />
        ))}
      </group>
      <SigTag position={[SEIS.x, seisY + 0.05, SEIS.z]} show={() => shown.current}>
        Marsquake (illustrative)
        <small>the seismometer listened from the ground in front</small>
      </SigTag>
    </group>
  );
}

export function LarriBeam({ stop, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const camera = useThree(s => s.camera);
  const anchor = useRef<Group>(null);
  const shown = useRef(0);
  const level = useRef(0);
  const deck = useMemo(() => DECK_GUESS.clone(), []);
  const found = useRef(false);

  const parts = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 40, 0], 3));
    const beam = new Line(g, new LineDashedMaterial({ color: '#8fb3c9', dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0, depthWrite: false }));
    beam.computeLineDistances();
    beam.visible = false;
    const glint = new Sprite(new SpriteMaterial({ map: softDot(), color: '#cfeaff', blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false }));
    glint.scale.setScalar(0.32);
    glint.visible = false;
    return { beam, glint };
  }, []);
  useEffect(
    () => () => {
      parts.beam.geometry.dispose();
      (parts.beam.material as LineDashedMaterial).dispose();
      parts.glint.material.dispose();
    },
    [parts],
  );

  useFrame((state, dt) => {
    const on = sigNow('larri') === 1;
    if (on && !found.current) {
      // Find the deck's top under the guess with a ray straight down (NASA's model or not).
      const m = findMachine(anchor.current);
      if (m) {
        found.current = true;
        const from = m.localToWorld(new Vector3(deck.x, 6, deck.z));
        const down = live.site.up.clone().negate();
        const ray = new Raycaster(from, down);
        ray.camera = camera;
        const hit = ray.intersectObject(m, true).find(h => (h.object as Mesh).isMesh);
        if (hit) {
          const p = m.worldToLocal(hit.point.clone());
          if (p.y > 0.4) deck.set(p.x, p.y, p.z);
        }
      }
    }
    const target = on ? 1 : 0;
    level.current = reduced ? target : level.current + (target - level.current) * (1 - Math.exp(-dt * 4));
    const k = level.current < 0.003 ? 0 : level.current;
    const site = siteShown(stop);
    shown.current = k * site;
    parts.beam.position.copy(deck);
    parts.glint.position.copy(deck).y += 0.04;
    const bm = parts.beam.material as LineDashedMaterial;
    bm.opacity = 0.55 * k;
    parts.beam.visible = k > 0;
    const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 3);
    parts.glint.material.opacity = k * pulse;
    parts.glint.visible = k > 0;
  });

  return (
    <group ref={anchor} rotation-y={lay.machineYaw}>
      <primitive object={parts.beam} />
      <primitive object={parts.glint} />
      <SigTag position={deck} show={() => shown.current} tone="faint">
        LaRRI · laser retroreflector
        <small>waiting for a laser from above</small>
      </SigTag>
    </group>
  );
}
