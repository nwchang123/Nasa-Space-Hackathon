// The camera: one continuous shot. Each frame it builds the ideal pose from the Director's shot
// (a globe pose: title, chase, epilogue or flight log; a site pose: the diorama framing with a
// slow drift) and blends the two about the site with the shot's blend, so a dive from orbit to a
// machine and the climb back out are single eased moves. When the globe end itself changes (title
// → flight log, epilogue → flight log) it eases from wherever the camera is. Stage timing is
// driven by time (stageElapsed, which includes boost), never by per-frame lerp factors. Near and
// far planes follow the zoom. In the flight log OrbitControls take over as soon as the visitor drags.
//
// Version 3 (full-screen HUD): subjects sit centred left to right, a little above the middle,
// between the top bar and the bottom dock. At a site the visitor can orbit the machine
// (live.siteOrbit, written by the site's pointer input), and the offsets ease back to the composed
// shot on the way out. The prologue's rotor fault shakes the camera briefly. While flying, the
// camera can turn into Ingenuity's black-and-white downward navigation camera (store.camMode).

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MACHINE_BY_ID } from '../data/machines';
import { HOME, initialBearing, interpolate } from '../flight/route';
import { stageElapsed, useApp } from '../store';
import type { MachineId } from '../types';
import { EPILOGUE_HOLD_MS, type GlobeShot } from './choreo';
import {
  HUD_ANCHOR_Y,
  HUD_FILL_HEIGHT,
  REPORT_DIR,
  ROUTE_BASE,
  TITLE_DIR,
  angleDelta,
  blendPose,
  cameraGoal,
  chaseGoal,
  clampPolar,
  easeInOut,
  horizonDir,
  navcamPose,
  orbitOffset,
  type Pose,
  type Vec3,
} from './layout';
import { navcam } from './navcam';
import { CAMERA_PRIORITY, live } from './registry';
import { SITE_PRESETS, siteLayout } from './sites';
import { useReducedMotion } from './useReducedMotion';

/** When the globe end of the shot changes, the camera eases over this long, ms. */
const TRANSITION_MS = 1600;
const Y: Vec3 = [0, 1, 0];
/** The stage camera's field of view (framing is always worked out for this), degrees. */
const BASE_FOV = 40;
/** Navigation camera: a wide downward view. */
const NAV_FOV = 76;
/** How far below Ingenuity the navigation camera sits, globe units (Ingenuity is ~0.014 tall there). */
const NAV_BELOW = 0.0015;
/** Rates for the eased switches, 1/s. */
const NAV_RATE = 3;
const ORBIT_FOLLOW_RATE = 12;
const ORBIT_RETURN_RATE = 2.5;
/** The prologue's rotor fault: a short, small shake. */
const SHAKE_MS = 650;
const SHAKE_AMP = 0.0045;
const NAV_FILTER = 'grayscale(1) contrast(1.3) brightness(1.06)';

const tv = new Vector3();
const v3 = (v: Vector3): Vec3 => [v.x, v.y, v.z];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Frame-rate independent approach of `x` toward `goal` at `rate` per second. */
const approach = (x: number, goal: number, rate: number, dt: number) => goal + (x - goal) * Math.exp(-rate * dt);

function orbitPose(
  dir: Vec3,
  aspect: number,
  framing: { anchorX?: number; anchorY?: number; fillWidth?: number; fillHeight?: number; radius?: number },
): Pose {
  const g = cameraGoal({ center: [0, 0, 0], dir, radius: framing.radius ?? 1, aspect, fovDeg: BASE_FOV, ...framing });
  return { position: g.position, target: g.target, up: Y };
}

/** Globe framings during the flight (the HUD covers a top bar and a bottom dock). */
const HUD_FRAMING = { anchorX: 0.5, anchorY: HUD_ANCHOR_Y, fillHeight: HUD_FILL_HEIGHT };

/** The diorama framing (subject centred, a little above the middle), in world space, turned by the visitor's orbit. */
function sitePose(
  id: MachineId,
  aspect: number,
  now: number,
  reduced: boolean,
  pullBack: number,
  orbit: { az: number; el: number; zoom: number },
): Pose {
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
    fovDeg: BASE_FOV,
    anchorX: 0.5,
    anchorY: HUD_ANCHOR_Y,
    fillWidth: 0.6,
    fillHeight: HUD_FILL_HEIGHT,
  });
  const m = live.site.matrix;
  const target = v3(tv.set(...g.target).applyMatrix4(m));
  let position = v3(tv.set(...g.position).applyMatrix4(m));
  if (orbit.az !== 0 || orbit.el !== 0 || orbit.zoom !== 1) {
    position = add(target, orbitOffset(sub(position, target), v3(live.site.up), orbit.az, orbit.el, orbit.zoom));
  }
  return { position, target, up: v3(live.site.up) };
}

export function CameraRig() {
  const camera = useThree(s => s.camera) as PerspectiveCamera;
  const controls = useThree(s => s.controls) as OrbitControlsImpl | null;
  const canvas = useThree(s => s.gl.domElement);
  const reduced = useReducedMotion();
  const lastChase = useRef<Pose | null>(null);
  const lastGlobe = useRef<GlobeShot | null>(null);
  const epilogueDir = useRef<Vec3>(TITLE_DIR);
  const trans = useRef<{ from: Pose; at: number } | null>(null);
  const current = useRef<Pose | null>(null);
  const userTook = useRef(false);
  const phaseKey = useRef('');
  const orbit = useRef({ az: 0, el: 0, zoom: 1 });
  const filterOn = useRef(false);

  useEffect(() => {
    if (!controls) return;
    const take = () => {
      userTook.current = true;
    };
    controls.addEventListener('start', take);
    return () => controls.removeEventListener('start', take);
  }, [controls]);

  useEffect(() => {
    canvas.style.transition = 'filter 0.35s ease';
    return () => {
      canvas.style.filter = '';
      canvas.style.transition = '';
    };
  }, [canvas]);

  useFrame((state, delta) => {
    const s = useApp.getState();
    const now = Date.now();
    const dt = Math.min(0.1, delta);
    const shot = live.shot;
    const aspect = state.size.width / Math.max(1, state.size.height);
    const f = s.flight;

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
          const g = chaseGoal({ pos: v3(a.pos), up: v3(a.up), forward: v3(a.forward), alt: a.alt, aspect, fovDeg: BASE_FOV });
          lastChase.current = { position: g.position, target: g.target, up: g.up };
        }
        globe = lastChase.current ?? orbitPose(TITLE_DIR, aspect, HUD_FRAMING);
        break;
      }
      case 'title':
        // The title text sits on the left (its column ends by ~54 % of the width): Mars large on
        // the right, from ~57 % to ~98 % of the width, so the two never touch.
        globe = orbitPose(TITLE_DIR, aspect, { anchorX: 0.775, anchorY: 0.5, fillWidth: 0.56 });
        break;
      case 'epilogue':
        globe = orbitPose(epilogueDir.current, aspect, { ...HUD_FRAMING, radius: 1.1 });
        break;
      case 'report':
        globe = orbitPose(REPORT_DIR, aspect, { radius: 1.05 });
        break;
    }

    // ---- the visitor's orbit at a site: follows live.siteOrbit while standing at a site (or at
    // home before take-off and after landing back), and eases back to the composed shot on the way out.
    const atSite =
      s.phase === 'flight' &&
      shot.blend > 0.95 &&
      (f.stage === 'site' || (shot.siteId === HOME && (f.stage === 'prologue' || f.stage === 'epilogue')));
    const o = orbit.current;
    if (atSite) {
      const goal = live.siteOrbit;
      o.az += angleDelta(o.az, goal.az) * (1 - Math.exp(-ORBIT_FOLLOW_RATE * dt));
      o.el = approach(o.el, goal.el, ORBIT_FOLLOW_RATE, dt);
      o.zoom = approach(o.zoom, goal.zoom, ORBIT_FOLLOW_RATE, dt);
    } else if (reduced) {
      o.az = 0;
      o.el = 0;
      o.zoom = 1;
    } else {
      o.az = approach(angleDelta(0, o.az), 0, ORBIT_RETURN_RATE, dt);
      o.el = approach(o.el, 0, ORBIT_RETURN_RATE, dt);
      o.zoom = approach(o.zoom, 1, ORBIT_RETURN_RATE, dt);
      if (Math.abs(o.az) < 1e-4 && Math.abs(o.el) < 1e-4 && Math.abs(o.zoom - 1) < 1e-4) {
        o.az = 0;
        o.el = 0;
        o.zoom = 1;
      }
    }

    // ---- the site end, blended in about the site
    let ideal = globe;
    if (shot.siteId && shot.blend > 0 && live.site.valid) {
      const epilogueT = s.phase === 'flight' && f.stage === 'epilogue' ? stageElapsed(s, now) : 0;
      const pullBack = 1 + 0.6 * easeInOut(epilogueT / EPILOGUE_HOLD_MS);
      const site = sitePose(shot.siteId, aspect, now, reduced, pullBack, o);
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

    // ---- Ingenuity's navigation camera, during the cruise only (the climb-out and the dive into
    // a site stay on the chase camera).
    const arc = shot.arc;
    const navWanted =
      s.camMode === 'navcam' && s.phase === 'flight' && f.stage === 'flying' && !!arc && live.arc.valid && shot.blend < 0.02;
    navcam.k = reduced ? (navWanted ? 1 : 0) : approach(navcam.k, navWanted ? 1 : 0, NAV_RATE, dt);
    if (navcam.k < 0.001) navcam.k = 0;
    if (navcam.k > 0 && arc && live.arc.valid) {
      const a = live.arc;
      const nav = navcamPose(v3(a.pos), v3(a.up), v3(a.forward), NAV_BELOW);
      pose = blendPose(pose, nav, easeInOut(navcam.k), v3(a.pos));
      const from = MACHINE_BY_ID[arc.from];
      const to = MACHINE_BY_ID[arc.to];
      const here = interpolate(from, to, arc.p);
      navcam.lat = here.lat;
      navcam.lon = here.lon;
      if (arc.p < 0.999) navcam.headingDeg = initialBearing(here, to);
      navcam.kmToGo = arc.distanceKm * (1 - arc.p);
      navcam.to = to.shortName;
    }
    const wantFilter = navcam.k > 0.5;
    if (wantFilter !== filterOn.current) {
      filterOn.current = wantFilter;
      canvas.style.filter = wantFilter ? NAV_FILTER : '';
    }
    const fov = BASE_FOV + (NAV_FOV - BASE_FOV) * easeInOut(navcam.k);

    // ---- the prologue's rotor fault: a short, small shake
    let shake: Vec3 | null = null;
    if (!reduced && s.phase === 'flight' && f.stage === 'prologue' && s.prologue.step === 'fault') {
      const since = now - s.prologue.at;
      if (since >= 0 && since < SHAKE_MS) {
        const view = sub(pose.target, pose.position);
        const d = Math.hypot(...view);
        const amp = SHAKE_AMP * d * (1 - since / SHAKE_MS) ** 1.5;
        const up = pose.up;
        const right: Vec3 = [view[1] * up[2] - view[2] * up[1], view[2] * up[0] - view[0] * up[2], view[0] * up[1] - view[1] * up[0]];
        const rl = Math.hypot(...right) || 1;
        const a1 = (amp * Math.sin(since * 0.093) * Math.cos(since * 0.021)) / rl;
        const a2 = amp * Math.sin(since * 0.071 + 1.3);
        shake = [right[0] * a1 + up[0] * a2, right[1] * a1 + up[1] * a2, right[2] * a1 + up[2] * a2];
      }
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
      const position = shake ? add(pose.position, shake) : pose.position;
      const target = shake ? add(pose.target, shake) : pose.target;
      camera.position.set(...position);
      camera.up.set(...pose.up);
      camera.lookAt(...target);
      if (controls) controls.target.set(...pose.target);
      current.current = pose;
    }

    // Near and far follow the zoom, from orbit (~4 units) down to a machine (~0.003); the
    // navigation camera also keeps the ground below it in view (it flies low over the surface).
    const cur = current.current;
    const dist = Math.hypot(cur.position[0] - cur.target[0], cur.position[1] - cur.target[1], cur.position[2] - cur.target[2]);
    let near = Math.min(0.05, Math.max(1e-5, dist * 0.02));
    if (navcam.k > 0 && live.arc.valid) near = Math.min(near, Math.max(1e-5, (live.arc.alt + ROUTE_BASE - 1) * 0.3));
    if (Math.abs(camera.near - near) > near * 0.01 || camera.far !== 80 || Math.abs(camera.fov - fov) > 0.01) {
      camera.near = near;
      camera.far = 80;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, CAMERA_PRIORITY);

  return null;
}
