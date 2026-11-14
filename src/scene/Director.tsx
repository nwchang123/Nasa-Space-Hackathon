// Runs first every frame: asks the Choreographer for the shot, applies the reduced-motion dip,
// turns the globe, and works out the world-space frames everyone else needs (the site diorama's
// placement on the globe, Ingenuity on its arc, Ingenuity at rest at home). Tells the stage which
// diorama to mount, and preloads the next stop's model as soon as a flight toward it begins.

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { marsSubSolar } from '../astro';
import { MACHINE_BY_ID } from '../data/machines';
import { HOME } from '../flight/route';
import { latLonToVec3 } from '../geo';
import { useApp } from '../store';
import type { MachineId } from '../types';
import { Choreographer, type Shot } from './choreo';
import { REPORT_DIR, TITLE_DIR, angleDelta, arcAltitude, legPoint, litYaw, siteFrame, SITE_SCALE, titleSunOffsetDeg } from './layout';
import { MODEL_REGISTRY } from './models';
import { DIRECTOR_PRIORITY, groups, live } from './registry';
import { useReducedMotion } from './useReducedMotion';

const FADE_OUT_S = 0.22;
const FADE_IN_S = 0.35;
const FIRST_FADE_IN_S = 0.9;
/** In the flight log the Sun sits this far to the camera's left, so Mars shows its day side. On
 * the title it may sit up to 75° to either side, to bring Ingenuity's spot (the start) into view. */
const LIT_OFFSET_DEG = -50;
const START = latLonToVec3(MACHINE_BY_ID[HOME].lat, MACHINE_BY_ID[HOME].lon);
/** …and the globe sways ±20° about that view (period ≈ 52 s) instead of turning into the night side. */
const SWAY_RAD = 0.35;
const SWAY_RATE = 0.12;
/** How quickly the globe settles onto the lit view, 1/s. */
const SETTLE_RATE = 1.4;

const sig = (s: Shot) => `${s.siteId ?? ''}|${s.blend > 0.5 ? 1 : 0}|${s.globeShot}`;

const m4 = new Matrix4();
const basis = new Matrix4();
const v = new Vector3();
const p0 = new Vector3();
const p1 = new Vector3();
const up = new Vector3();
const fwd = new Vector3(0, 0, -1);
const right = new Vector3();
const back = new Vector3();
const lean = new Quaternion();
const X = new Vector3(1, 0, 0);
const sunBody = new Vector3(1, 0, 0);

/** Frame of a stop on the globe, globe-local, in metres (scaled by SITE_SCALE). */
function localSiteMatrix(id: MachineId, out: Matrix4, scale: number): Matrix4 {
  const m = MACHINE_BY_ID[id];
  const f = siteFrame(m.lat, m.lon);
  out.makeBasis(v.set(...f.east), up.set(...f.up), back.set(...f.south));
  out.scale(p0.set(scale, scale, scale));
  out.setPosition(...f.origin);
  return out;
}

export function Director({ onSite }: { onSite: (id: MachineId | null) => void }) {
  const reduced = useReducedMotion();
  const choreo = useRef(new Choreographer());
  const shown = useRef<Shot | null>(null);
  const mounted = useRef<MachineId | null>(null);
  const preloaded = useRef(new Set<string>());
  const sunKey = useRef(-1);
  const started = useRef(false);

  useFrame((_, delta) => {
    const s = useApp.getState();
    const now = Date.now();
    const dt = Math.min(delta, 0.1);
    const shot = choreo.current.update(s.phase, s.flight, now, reduced);

    // Reduced motion: every change of view is a step, covered by a short dip to black.
    if (!shown.current) shown.current = shot;
    if (reduced && sig(shot) !== sig(shown.current)) {
      live.black = Math.min(1, live.black + dt / FADE_OUT_S);
      if (live.black >= 1) shown.current = shot;
    } else {
      shown.current = shot;
      live.black = Math.max(0, live.black - dt / (started.current ? FADE_IN_S : FIRST_FADE_IN_S));
      if (live.black === 0) started.current = true;
    }
    const cur = shown.current;
    live.shot = cur;

    if (s.nowMs !== sunKey.current) {
      sunKey.current = s.nowMs;
      const sub = marsSubSolar(new Date(s.nowMs));
      sunBody.set(...latLonToVec3(sub.lat, sub.lon));
    }

    // The globe turns only when nothing is anchored to it. On the title and in the flight log it
    // settles on the day side (the Sun is real, so a fixed view could be all night) and sways there.
    const free = cur.blend === 0 && !cur.arc;
    if (free && (s.phase === 'title' || s.phase === 'report')) {
      const sway = reduced ? 0 : SWAY_RAD * Math.sin((now / 1000) * SWAY_RATE);
      const sun: [number, number, number] = [sunBody.x, sunBody.y, sunBody.z];
      const goal =
        (s.phase === 'title' ? litYaw(sun, TITLE_DIR, titleSunOffsetDeg(sun, START)) : litYaw(sun, REPORT_DIR, LIT_OFFSET_DEG)) + sway;
      const d = angleDelta(live.yaw, goal);
      // Snap while the screen is still black at start-up; otherwise ease (no visible jump).
      live.yaw += !started.current || reduced ? d : d * (1 - Math.exp(-dt * SETTLE_RATE));
    } else if (free && !reduced && s.phase === 'flight' && s.flight.stage === 'epilogue') {
      live.yaw += dt * 0.035;
    }
    const globe = groups.globe;
    if (globe) {
      globe.rotation.y = live.yaw;
      globe.updateMatrixWorld();
    }
    const gm = globe ? globe.matrixWorld : m4.identity();

    live.sun.copy(sunBody).transformDirection(gm);

    // The diorama's frame on the globe.
    if (cur.siteId) {
      localSiteMatrix(cur.siteId, live.site.matrix, SITE_SCALE).premultiply(gm);
      live.site.matrix.decompose(live.site.point, live.site.quat, v);
      live.site.up.set(0, 1, 0).applyQuaternion(live.site.quat);
      live.site.valid = true;
    } else live.site.valid = false;

    // Ingenuity at rest at home on the globe.
    localSiteMatrix(HOME, m4, 1).premultiply(gm);
    m4.decompose(live.rest.pos, live.rest.quat, v);

    // Ingenuity on its arc.
    const arc = cur.arc;
    if (arc) {
      const a = legPoint(arc, arc.p);
      p0.set(...legPoint(arc, Math.max(0, arc.p - 0.004)));
      p1.set(...legPoint(arc, Math.min(1, arc.p + 0.004)));
      up.set(...a).normalize();
      const d = p1.sub(p0);
      d.addScaledVector(up, -d.dot(up));
      if (d.lengthSq() > 1e-14) fwd.copy(d).normalize();
      else fwd.addScaledVector(up, -fwd.dot(up)).normalize();
      right.crossVectors(fwd, up).normalize();
      back.copy(fwd).negate();
      basis.makeBasis(right, up, back);
      live.arc.quat.setFromRotationMatrix(basis);
      // Lean into the flight: tip the top toward the direction of travel while cruising.
      live.arc.quat.multiply(lean.setFromAxisAngle(X, -0.22 * Math.sin(Math.PI * arc.p)));
      live.arc.pos.set(...a).applyMatrix4(gm);
      if (globe) live.arc.quat.premultiply(globe.quaternion);
      live.arc.up.copy(up).transformDirection(gm);
      live.arc.forward.copy(fwd).transformDirection(gm);
      live.arc.alt = arcAltitude(arc.p, arc.distanceKm);
      live.arc.valid = true;

      // Fetch the destination's model while we fly (the silhouette shows if it is not ready).
      const url = MODEL_REGISTRY[arc.to].url;
      if (url && !preloaded.current.has(url)) {
        preloaded.current.add(url);
        useGLTF.preload(url, false, true);
      }
    } else live.arc.valid = false;

    if (cur.siteId !== mounted.current) {
      mounted.current = cur.siteId;
      onSite(cur.siteId);
    }
  }, DIRECTOR_PRIORITY);

  return null;
}
