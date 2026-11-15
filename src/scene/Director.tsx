// Runs first every frame: asks the Choreographer for the shot, applies the reduced-motion dip,
// turns the globe, and works out the world-space frames everyone else needs (the site diorama's
// placement on the globe, Ingenuity on its arc, Ingenuity at rest at home). Tells the stage which
// diorama to mount, and warms the models likely to be needed next (the first stop before lift-off;
// at a stop the next one and both neighbours; the destination as soon as a flight toward it begins).
// While boost is held during a flight it banks extra flight time (store.addBoost), so the shot,
// the odometer and the arrival all speed up together, and Ingenuity leans further forward.

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { marsSubSolar } from '../astro';
import { MACHINE_BY_ID } from '../data/machines';
import { HOME } from '../flight/route';
import { latLonToVec3 } from '../geo';
import { BOOST_FACTOR, useApp } from '../store';
import { MACHINE_IDS, type MachineId } from '../types';
import { useThrottle } from '../ui/throttle';
import { Choreographer, type Shot } from './choreo';
import {
  REPORT_DIR,
  TITLE_DIR,
  TITLE_EL,
  angleDelta,
  arcAltitude,
  easeInOut,
  legPoint,
  litYaw,
  siteFrame,
  SITE_SCALE,
  titleSunOffsetDeg,
} from './layout';
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
/** …and back onto it after the visitor double-clicks Mars on the title, 1/s. */
const RESET_RATE = 2.4;
/**
 * "Begin Flight 73" with Mars turned by the visitor: it turns back to the title's own view (and the
 * camera to the title's elevation) over this long, ms, eased, while the opening descent (2800 ms)
 * begins, so the dive lands on Valinor Hills as it always does and never passes through Mars.
 */
const LAUNCH_TURN_MS = 1200;
/** At most one model starts loading in the background per this long, ms (each is 0.3–2.5 MB). */
const WARM_GAP_MS = 1500;

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
/** Forward lean while cruising, radians; boost adds more. */
const LEAN = 0.22;
const BOOST_LEAN = 0.2;

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
  const boostK = useRef(0);
  const lastWarm = useRef(0);
  const lastPhase = useRef<string | null>(null);
  /** Turning a visitor-turned Mars back for the opening descent: from yaw0 by dYaw, from el0 to TITLE_EL. */
  const launch = useRef<{ at: number; yaw0: number; dYaw: number; el0: number } | null>(null);

  /** Start loading a stop's model if nobody has yet. True if this call started it. */
  const warm = (id: MachineId): boolean => {
    const url = MODEL_REGISTRY[id].url;
    if (!url || preloaded.current.has(url)) return false;
    preloaded.current.add(url);
    useGLTF.preload(url, false, true);
    return true;
  };

  useFrame((_, delta) => {
    let s = useApp.getState();
    const now = Date.now();
    const dt = Math.min(delta, 0.1);
    const boosting = s.boost && s.phase === 'flight' && s.flight.stage === 'flying';
    if (boosting) {
      s.addBoost(dt * 1000 * (BOOST_FACTOR - 1));
      s = useApp.getState();
    }
    boostK.current += ((boosting ? 1 : 0) - boostK.current) * (1 - Math.exp(-dt * 4));
    const shot = choreo.current.update(s.phase, s.flight, now, reduced, {
      boostMs: s.boostMs,
      prologue: { ...s.prologue, throttle: useThrottle.getState().throttle },
    });

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

    const sway = reduced ? 0 : SWAY_RAD * Math.sin((now / 1000) * SWAY_RATE);
    const sun: [number, number, number] = [sunBody.x, sunBody.y, sunBody.z];
    const titleGoal = () => litYaw(sun, TITLE_DIR, titleSunOffsetDeg(sun, START)) + sway;

    // The visitor may turn Mars on the title (src/scene/TitleGlobeInput.tsx). Leaving the title
    // lets go of it; "Begin Flight 73" with Mars turned first turns it back for the opening descent.
    const td = live.titleDrag;
    if (s.phase !== lastPhase.current) {
      const from = lastPhase.current;
      lastPhase.current = s.phase;
      if (from === 'title' && s.phase === 'flight' && (td.spun || td.reset || Math.abs(td.el - TITLE_EL) > 1e-3)) {
        launch.current = { at: now, yaw0: live.yaw, dYaw: angleDelta(live.yaw, titleGoal()), el0: td.el };
      }
      if (from === 'title' || s.phase === 'title') {
        td.spun = false;
        td.reset = false;
        td.vy = 0;
        td.velEl = 0;
      }
    }
    const L = launch.current;
    if (L && (s.phase !== 'flight' || s.flight.stage !== 'prologue')) launch.current = null;
    else if (L) {
      // (The diorama and Ingenuity follow the globe's matrix every frame, so turning it mid-dive is safe.)
      // Reduced motion: one step, taken under the dip to black (once the shot has switched).
      // On the opening's own clock where there is one (choreo.ts), like the dive it goes with.
      const k = reduced ? (cur.siteId ? 1 : 0) : easeInOut((cur.opening ?? now - L.at) / LAUNCH_TURN_MS);
      live.yaw = L.yaw0 + L.dYaw * k;
      td.el = L.el0 + (TITLE_EL - L.el0) * k;
      if (k >= 1) launch.current = null;
    }

    // The globe turns only when nothing is anchored to it. On the title and in the flight log it
    // settles on the day side (the Sun is real, so a fixed view could be all night) and sways there,
    // unless the visitor has turned Mars on the title: then it stays where they left it.
    const free = cur.blend === 0 && !cur.arc;
    const held = s.phase === 'title' && td.spun;
    if (L) {
      // Turning back for the opening descent (above).
    } else if (free && !held && (s.phase === 'title' || s.phase === 'report')) {
      const goal = s.phase === 'title' ? titleGoal() : litYaw(sun, REPORT_DIR, LIT_OFFSET_DEG) + sway;
      const d = angleDelta(live.yaw, goal);
      const rate = td.reset ? RESET_RATE : SETTLE_RATE;
      // Snap while the screen is still black at start-up; otherwise ease (no visible jump).
      live.yaw += !started.current || reduced ? d : d * (1 - Math.exp(-dt * rate));
      if (td.reset && Math.abs(d) < 2e-3 && Math.abs(td.el - TITLE_EL) < 2e-3) td.reset = false;
    } else if (free && !reduced && s.phase === 'flight' && s.flight.stage === 'epilogue') {
      live.yaw += dt * 0.035;
    }
    // The title camera's elevation goes back to its own once the visitor lets go of Mars.
    if (!held && !L && td.el !== TITLE_EL) {
      const e = TITLE_EL - td.el;
      td.el = reduced || Math.abs(e) < 1e-4 ? TITLE_EL : td.el + e * (1 - Math.exp(-dt * (td.reset ? RESET_RATE : SETTLE_RATE)));
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
      live.arc.quat.multiply(lean.setFromAxisAngle(X, -(LEAN + BOOST_LEAN * boostK.current) * Math.sin(Math.PI * arc.p)));
      live.arc.pos.set(...a).applyMatrix4(gm);
      if (globe) live.arc.quat.premultiply(globe.quaternion);
      live.arc.up.copy(up).transformDirection(gm);
      live.arc.forward.copy(fwd).transformDirection(gm);
      live.arc.alt = arcAltitude(arc.p, arc.distanceKm);
      live.arc.valid = true;

      // Fetch the destination's model while we fly, if it is not warm yet.
      warm(arc.to);
    } else live.arc.valid = false;

    // Begin on the title, before the first dive. During a flight warm the destination's next
    // neighbour too; at a stop warm both adjacent stops and the following route leg.
    if (now - lastWarm.current > WARM_GAP_MS && (s.phase === 'title' || s.phase === 'flight')) {
      const leg = s.phase === 'title' || s.flight.stage === 'prologue' ? -1 : s.flight.leg;
      for (const i of [leg, leg + 1, leg - 1, leg + 2]) {
        if (i >= 0 && i < MACHINE_IDS.length && warm(MACHINE_IDS[i])) {
          lastWarm.current = now;
          break;
        }
      }
    }

    if (cur.siteId !== mounted.current) {
      mounted.current = cur.siteId;
      onSite(cur.siteId);
    }
  }, DIRECTOR_PRIORITY);

  return null;
}
