// The camera: one continuous shot. Each frame it builds the ideal pose from the Director's shot
// (a globe pose: title, chase, epilogue or flight log; a site pose: the diorama framing with a
// slow drift) and blends the two about the site with the shot's blend, so a dive from orbit to a
// machine and the climb back out are single eased moves. When the globe end itself changes (title
// → flight log, epilogue → flight log) it eases from wherever the camera is. Everything is driven
// by time, never by per-frame lerp factors. Near and far planes follow the zoom. In the flight
// log OrbitControls take over as soon as the visitor drags.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useApp } from '../store';
import type { MachineId } from '../types';
import { EPILOGUE_HOLD_MS, type GlobeShot } from './choreo';
import { REPORT_DIR, TITLE_DIR, blendPose, cameraGoal, chaseGoal, clampPolar, easeInOut, horizonDir, type Pose, type Vec3 } from './layout';
import { CAMERA_PRIORITY, live } from './registry';
import { SITE_PRESETS, siteLayout } from './sites';
import { useReducedMotion } from './useReducedMotion';
/** When the globe end of the shot changes, the camera eases over this long, ms. */
const TRANSITION_MS = 1600;
const Y: Vec3 = [0, 1, 0];

const tv = new Vector3();
const v3 = (v: Vector3): Vec3 => [v.x, v.y, v.z];

function orbitPose(dir: Vec3, aspect: number, fov: number, framing: { anchorX?: number; anchorY?: number; fillWidth?: number; radius?: number }): Pose {
  const g = cameraGoal({ center: [0, 0, 0], dir, radius: framing.radius ?? 1, aspect, fovDeg: fov, ...framing });
  return { position: g.position, target: g.target, up: Y };
}

/** The diorama framing (subject ~34 % from the left on wide screens, top 45 % on tall ones), in world space. */
function sitePose(id: MachineId, aspect: number, fov: number, now: number, reduced: boolean, pullBack: number): Pose {
  const p = SITE_PRESETS[id];
  const lay = siteLayout(p);
  // A slow drift around the subject, ±12° over about two minutes, so the scene stays alive.
  const drift = reduced ? 0 : 12 * Math.sin((now / 1000) * 0.05);
  const g = cameraGoal({
    center: lay.frameCenter,
    dir: horizonDir(p.cameraAz + drift, p.cameraElev),
    halfWidth: lay.halfWidth * pullBack,
    halfHeight: lay.halfHeight * pullBack,
    aspect,
    fovDeg: fov,
    anchorX: 0.34,
    fillWidth: 0.6,
  });
  const m = live.site.matrix;
  return {
    position: v3(tv.set(...g.position).applyMatrix4(m)),
    target: v3(tv.set(...g.target).applyMatrix4(m)),
    up: v3(live.site.up),
  };
}

export function CameraRig() {
  const camera = useThree(s => s.camera) as PerspectiveCamera;
  const controls = useThree(s => s.controls) as OrbitControlsImpl | null;
  const reduced = useReducedMotion();
  const lastChase = useRef<Pose | null>(null);
  const lastGlobe = useRef<GlobeShot | null>(null);
  const epilogueDir = useRef<Vec3>(TITLE_DIR);
  const trans = useRef<{ from: Pose; at: number } | null>(null);
  const current = useRef<Pose | null>(null);
  const userTook = useRef(false);
  const phaseKey = useRef('');

  useEffect(() => {
    if (!controls) return;
    const take = () => {
      userTook.current = true;
    };
    controls.addEventListener('start', take);
    return () => controls.removeEventListener('start', take);
  }, [controls]);

  useFrame(state => {
    const s = useApp.getState();
    const now = Date.now();
    const shot = live.shot;
    const aspect = state.size.width / Math.max(1, state.size.height);
    const fov = camera.fov;

    if (s.phase !== phaseKey.current) {
      phaseKey.current = s.phase;
      userTook.current = false;
    }

    // ---- the globe end of the shot
    if (shot.globeShot !== lastGlobe.current) {
      if (shot.globeShot === 'epilogue') {
        const h = live.rest.pos;
        epilogueDir.current = clampPolar([h.x, h.y + 0.35 * h.length(), h.z]);
      }
      if (lastGlobe.current !== null && current.current && !reduced) trans.current = { from: current.current, at: now };
      lastGlobe.current = shot.globeShot;
    }
    let globe: Pose;
    switch (shot.globeShot) {
      case 'chase': {
        if (live.arc.valid) {
          const a = live.arc;
          const g = chaseGoal({ pos: v3(a.pos), up: v3(a.up), forward: v3(a.forward), alt: a.alt, aspect, fovDeg: fov });
          lastChase.current = { position: g.position, target: g.target, up: g.up };
        }
        globe = lastChase.current ?? orbitPose(TITLE_DIR, aspect, fov, {});
        break;
      }
      case 'title':
        // The title text sits on the left (its column ends by ~54 % of the width): Mars large on
        // the right, from ~57 % to ~98 % of the width, so the two never touch.
        globe = orbitPose(TITLE_DIR, aspect, fov, { anchorX: 0.775, anchorY: 0.5, fillWidth: 0.56 });
        break;
      case 'epilogue':
        globe = orbitPose(epilogueDir.current, aspect, fov, { radius: 1.1 });
        break;
      case 'report':
        globe = orbitPose(REPORT_DIR, aspect, fov, { radius: 1.05 });
        break;
    }

    // ---- the site end, blended in about the site
    let ideal = globe;
    if (shot.siteId && shot.blend > 0 && live.site.valid) {
      const epilogueT = s.phase === 'flight' && s.flight.stage === 'epilogue' ? now - s.flight.stageStartedAt : 0;
      const pullBack = 1 + 0.6 * easeInOut(epilogueT / EPILOGUE_HOLD_MS);
      const site = sitePose(shot.siteId, aspect, fov, now, reduced, pullBack);
      ideal = blendPose(globe, site, shot.blend, v3(live.site.point));
    }

    // ---- ease from wherever the camera was when the globe end changed
    let pose = ideal;
    const t = trans.current;
    if (t) {
      const k = (now - t.at) / TRANSITION_MS;
      if (k >= 1) trans.current = null;
      else pose = blendPose(t.from, ideal, easeInOut(k), ideal.target);
    }

    // ---- hand over to the visitor in the flight log
    const settled = s.phase === 'report' && shot.blend === 0 && !trans.current;
    if (controls) {
      controls.enabled = settled;
      controls.enablePan = false;
    }
    if (settled && userTook.current && controls) {
      current.current = { position: v3(camera.position), target: v3(controls.target), up: Y };
    } else {
      camera.position.set(...pose.position);
      camera.up.set(...pose.up);
      camera.lookAt(...pose.target);
      if (controls) controls.target.set(...pose.target);
      current.current = pose;
    }

    // Near and far follow the zoom, from orbit (~4 units) down to a machine (~0.003).
    const cur = current.current;
    const dist = Math.hypot(cur.position[0] - cur.target[0], cur.position[1] - cur.target[1], cur.position[2] - cur.target[2]);
    const near = Math.min(0.05, Math.max(1e-5, dist * 0.02));
    if (Math.abs(camera.near - near) > near * 0.01 || camera.far !== 80) {
      camera.near = near;
      camera.far = 80;
      camera.updateProjectionMatrix();
    }
  }, CAMERA_PRIORITY);

  return null;
}
