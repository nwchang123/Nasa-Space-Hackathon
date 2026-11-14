// Moves the camera to the framing for the current view / selected machine, then hands control
// to OrbitControls as soon as the user drags (until the next view or selection change).

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
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
    return cameraGoal({ center: [tmpCenter.x, tmpCenter.y, tmpCenter.z], dir, radius, aspect, fovDeg: fov });
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

  // Overview: both globes side by side.
  return cameraGoal({ center: [0, 0, 0], dir: OVERVIEW_DIR, halfWidth: 3.55, halfHeight: 1.15, aspect, fovDeg: fov });
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
    const key = `${s.phase === 'title' || s.phase === 'timelapse' ? 'overview' : s.view}|${s.selectedId ?? ''}`;
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
