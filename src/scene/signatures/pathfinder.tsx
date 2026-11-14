// Pathfinder: the visitor rolls Sojourner down the lander's rear ramp and backs it up to Barnacle
// Bill, so the APXS on its rear touches the rock (sols 2-3, July 1997). The slider is the clock.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, Mesh, Vector3, type Group, type InstancedMesh, type Object3D } from 'three';
import { useReducedMotion } from '../useReducedMotion';
import { findMachine, groundAt, SigFocus, SigTag, siteShown, sigNow, type SiteSignatureProps } from './common';
import { ROVER_PATH, sojournerPath } from './logic';

// Shared with scripts/model-upgrade/build_assets.py: authored rear ramp, machine-local metres.
const RAMP_TOP = new Vector3(0.39, 0.135, 0.629);
const RAMP_FOOT = new Vector3(1.256, 0.045, 1.121);
/** Down the ramp, level. */
const DIR = new Vector3(0.866, 0, 0.5);
/** Sideways, away from Ingenuity's landing spot (which is on the other side of the ramp). */
const SIDE = new Vector3(0.5, 0, -0.866);
const RAMP_PITCH = Math.atan2(RAMP_TOP.y - RAMP_FOOT.y, RAMP_TOP.distanceTo(RAMP_FOOT));
const ROCK_R = 0.24;

const rockAt = (out = new Vector3()) => out.copy(RAMP_FOOT).addScaledVector(DIR, ROVER_PATH.rockS).addScaledVector(SIDE, ROVER_PATH.rockSide).setY(0);

export function SojournerRoll({ stop, ground, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const anchor = useRef<Group>(null);
  const rover = useRef<{ obj: Object3D; pos: Vector3; rot: Euler } | null>(null);
  const shown = useRef(0);
  const cur = useRef<number | null>(null);

  // Barnacle Bill: one of the site's own rock shapes, a bit larger than the scatter around it.
  const rock = useMemo(() => {
    const src = ground.rocks.children[0] as InstancedMesh | undefined;
    if (!src) return null;
    if (!src.geometry.boundingSphere) src.geometry.computeBoundingSphere();
    const r = src.geometry.boundingSphere?.radius ?? 1;
    const m = new Mesh(src.geometry, src.material);
    m.name = 'barnacle-bill';
    const p = rockAt();
    const k = ROCK_R / r;
    m.scale.set(k * 1.15, k * 0.8, k);
    m.rotation.y = 0.7;
    m.position.set(p.x, groundAt(ground, lay, p.x, p.z) - 0.05, p.z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }, [ground, lay]);

  const rampMid = useMemo(() => RAMP_TOP.clone().lerp(RAMP_FOOT, 0.5), []);
  const rockTop = useMemo(() => {
    const p = rockAt();
    return new Vector3(p.x, groundAt(ground, lay, p.x, p.z) + ROCK_R * 0.7, p.z);
  }, [ground, lay]);

  const restore = () => {
    const r = rover.current;
    if (!r) return;
    r.obj.position.copy(r.pos);
    r.obj.rotation.copy(r.rot);
  };
  useEffect(() => () => restore(), []);

  const pos = useMemo(() => new Vector3(), []);
  /** What the close-up follows: Sojourner itself (a little above its deck), down the ramp and on. */
  const roverFocus = useMemo(() => RAMP_TOP.clone(), []);
  useFrame((_, dt) => {
    const v = sigNow('roll');
    shown.current = v === undefined ? 0 : siteShown(stop);
    const loaded = findMachine(anchor.current)?.getObjectByName('sojourner');
    if (!loaded) return;
    // A slow GLB load may replace the fallback while the slider is already running.
    if (rover.current?.obj !== loaded) {
      restore();
      const obj = loaded;
      rover.current = { obj, pos: obj.position.clone(), rot: obj.rotation.clone() };
    }
    if (v === undefined) {
      if (cur.current !== null) restore();
      cur.current = null;
      return;
    }
    // Follow the slider smoothly (a drag does not teleport the rover), unless motion is reduced.
    const c = cur.current === null || reduced ? v : cur.current + (v - cur.current) * (1 - Math.exp(-dt * 7));
    cur.current = c;

    const at = sojournerPath(c);
    const obj = rover.current.obj;
    let yaw = Math.atan2(-DIR.z, DIR.x);
    let pitch = 0;
    if (at.leg === 'ramp') {
      pos.copy(RAMP_TOP).lerp(RAMP_FOOT, at.ramp);
      pitch = at.ramp < 0.97 ? -RAMP_PITCH : 0;
    } else {
      pos.copy(RAMP_FOOT).addScaledVector(DIR, at.s).addScaledVector(SIDE, at.lat);
      pos.y = groundAt(ground, lay, pos.x, pos.z);
      // Heading along the path's tangent (DIR + SIDE · slope); reversing keeps the heading.
      const hx = DIR.x + SIDE.x * at.slope;
      const hz = DIR.z + SIDE.z * at.slope;
      if (at.leg === 'drive') yaw = Math.atan2(-hz, hx);
    }
    obj.position.copy(pos);
    obj.rotation.set(0, yaw, pitch);
    roverFocus.copy(pos).y += 0.12;
  });

  return (
    <group ref={anchor} rotation-y={lay.machineYaw}>
      {rock && <primitive object={rock} />}
      <SigFocus sigKey="roll" position={roverFocus} />
      <SigTag position={rampMid} show={() => shown.current} tone="faint">
        Rear ramp
      </SigTag>
      <SigTag position={rockTop} show={() => shown.current}>
        Barnacle Bill
        <small>first rock analysed (APXS) · sol 3</small>
      </SigTag>
    </group>
  );
}
