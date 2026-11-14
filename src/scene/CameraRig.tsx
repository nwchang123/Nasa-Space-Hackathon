// Moves the camera to the framing for the current view / selected machine, then hands control
// to OrbitControls as soon as the user drags (until the next view or selection change).

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { moonSubEarth } from '../astro';
import { MACHINE_BY_ID } from '../data/machines';
import { latLonToVec3 } from '../geo';
import { useApp, type AppState } from '../store';
import { cameraGoal, clampPolar, DEEP_POS, MARKER_LIFT, MARS_POS, MARS_R, MOON_POS, MOON_R, type CameraGoal, type Vec3 } from './layout';
import { deepLocal, groups } from './registry';

const OVERVIEW_DIR: Vec3 = clampPolar([0, 0.1, 1]);
const GLOBE_DIR: Vec3 = clampPolar([0, 0.16, 1]);
const DEEP_DIR: Vec3 = clampPolar([0, 1, 0.8]);
const DEEP_HALF = 7.9;

const tmp = new Vector3();
const tmpCenter = new Vector3();
const tmpEarth = new Vector3();
const sideA = new Vector3();
const sideB = new Vector3();
const UP = new Vector3(0, 1, 0);
/** How long after the return the side view holds before easing back, ms. */
const LASER_HOLD_MS = 2200;

/** True while a laser call to the selected Moon site is in flight (or just returned). */
function laserCinematic(s: AppState): boolean {
  const p = s.ping;
  if (!p || p.channel !== 'laser' || p.id !== s.selectedId || s.view !== 'moon') return false;
  return Date.now() - p.startedAt < p.waitMs + LASER_HOLD_MS;
}

function goalFor(s: AppState, aspect: number, fov: number): CameraGoal {
  const view = s.phase === 'title' || s.phase === 'timelapse' ? 'overview' : s.view;
  const selected = s.selectedId ? MACHINE_BY_ID[s.selectedId] : undefined;

  if (view === 'moon' || view === 'mars') {
    const radius = view === 'moon' ? MOON_R : MARS_R;
    const g = groups[view];
    if (g) g.getWorldPosition(tmpCenter);
    else tmpCenter.set(...(view === 'moon' ? MOON_POS : MARS_POS));
    let dir: Vec3 = GLOBE_DIR;
    if (selected && selected.world === view && selected.lat !== undefined && selected.lon !== undefined && g) {
      const [x, y, z] = latLonToVec3(selected.lat, selected.lon, radius * MARKER_LIFT);
      tmp.set(x, y, z);
      g.localToWorld(tmp);
      tmp.sub(tmpCenter);
      dir = clampPolar([tmp.x, tmp.y, tmp.z]);
    }
    let frameRadius = radius;
    if (view === 'moon' && g && s.ping && laserCinematic(s)) {
      // The beam arrives from Earth, almost along the default view. Rise ~50° above the site
      // (a sideways swing would put Mars between the camera and the Moon) so the beam, which
      // comes in near the lunar equator plane, is seen at a steep angle.
      const se = moonSubEarth(new Date(s.ping.startedAt));
      tmpEarth.set(...latLonToVec3(se.lat, se.lon)).transformDirection(g.matrixWorld);
      sideA.set(dir[0], 0, dir[2]);
      if (sideA.lengthSq() < 1e-6) sideA.set(tmpEarth.x, 0, tmpEarth.z);
      sideA.normalize().multiplyScalar(Math.cos(0.9));
      sideB.copy(UP).multiplyScalar(Math.sin(0.9));
      sideA.add(sideB);
      dir = clampPolar([sideA.x, sideA.y, sideA.z]);
      frameRadius = radius * 1.35;
    }
    return cameraGoal({ center: [tmpCenter.x, tmpCenter.y, tmpCenter.z], dir, radius: frameRadius, aspect, fovDeg: fov });
  }

  if (view === 'deep') {
    const g = groups.deep;
    if (g) g.getWorldPosition(tmpCenter);
    else tmpCenter.set(...DEEP_POS);
    // Lean the framing a quarter of the way toward a selected deep-space machine.
    if (selected && selected.world === 'deep' && g) {
      const local = deepLocal.get(selected.id);
      if (local) {
        tmp.copy(local);
        g.localToWorld(tmp);
        tmpCenter.lerp(tmp, 0.25);
      }
    }
    return cameraGoal({ center: [tmpCenter.x, tmpCenter.y, tmpCenter.z], dir: DEEP_DIR, halfWidth: DEEP_HALF, halfHeight: DEEP_HALF * 0.8, aspect, fovDeg: fov });
  }

  // Overview: both globes side by side. The title text sits on the left, so the title frames the
  // globes on the right; the time-lapse text sits along the bottom, so it frames them centred and high.
  const framing =
    s.phase === 'title'
      ? { anchorX: 0.72, anchorY: 0.47, fillWidth: 0.57 }
      : s.phase === 'timelapse'
        ? { anchorX: 0.56, anchorY: 0.38, fillWidth: 0.72 }
        : {};
  return cameraGoal({ center: [0, 0, 0], dir: OVERVIEW_DIR, halfWidth: 3.55, halfHeight: 1.15, aspect, fovDeg: fov, ...framing });
}

export function CameraRig() {
  const camera = useThree(s => s.camera) as PerspectiveCamera;
  const controls = useThree(s => s.controls) as OrbitControlsImpl | null;
  const active = useRef(true);
  const lastKey = useRef('');
  const goalPos = useRef(new Vector3());
  const goalTarget = useRef(new Vector3());
  const first = useRef(true);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      active.current = false;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame((state, delta) => {
    const s = useApp.getState();
    const key = `${s.phase === 'title' || s.phase === 'timelapse' ? s.phase : s.view}|${s.selectedId ?? ''}|${laserCinematic(s) ? 'laser' : ''}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      active.current = true;
    }
    if (!active.current) return;

    const aspect = state.size.width / Math.max(1, state.size.height);
    const goal = goalFor(s, aspect, camera.fov);
    goalPos.current.set(...goal.position);
    goalTarget.current.set(...goal.target);

    if (first.current) {
      // Start a little farther out so the opening view drifts in.
      first.current = false;
      camera.position.copy(goalPos.current).multiplyScalar(1.35);
      if (controls) controls.target.copy(goalTarget.current);
    }

    const k = 1 - Math.exp(-delta * 2.4);
    camera.position.lerp(goalPos.current, k);
    if (controls) {
      controls.target.lerp(goalTarget.current, k);
    } else {
      camera.lookAt(goalTarget.current);
    }
  });

  return null;
}
