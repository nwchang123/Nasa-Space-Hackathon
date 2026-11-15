// Flying Ingenuity around a site. Once it has landed at a stop (any but home, where it is the
// real, broken one again) the visitor can take it up again:
// W/A/S/D or the arrow keys move it relative to the camera, a click on the ground sends it there.
// It lifts to a hover, tilts into its motion, climbs over the machine instead of flying into it,
// stays within the site, and settles back down after a while with nothing to do (siteFlight.ts).
// Flying close to a story hotspot reads that part of the story and nudges the camera toward it.
//
// Picking a hotspot or a signature action (store.focus, full strength) puts it on autopilot: it
// flies to just beside that part, turns its nose to it and hovers there, scanning it (live.scan:
// the beam, the searchlight). "Reset wide view" flies it back to its landing spot and lands it.
//
// Writes live.flyer (diorama-local metres) for Ingenuity, the camera and the lights; it stays in
// use while this diorama is, so leaving the stop takes off from wherever Ingenuity is. In the
// epilogue at home it flies back to its spot and lands first, so the phantom settles on the real one.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Matrix4, Vector3 } from 'three';
import { HOME } from '../flight/route';
import { currentStop, useApp, type AppState, type StorySection } from '../store';
import type { MachineId } from '../types';
import { live } from './registry';
import {
  ARRIVE_M,
  clampToSite,
  flyerAt,
  headingTo,
  LAND_AFTER_S,
  moveFromKeys,
  SITE_RADIUS_M,
  standoffBeside,
  stepFlyer,
  type FlyerState,
  type FlyWorld,
} from './freeFlight';
import { SITE_PRESETS, siteLayout } from './sites';
import type { Ground } from './terrain';
import { useReducedMotion } from './useReducedMotion';

/** After the Director (−5), before the camera (−2), so the camera follows this frame's position. */
const FLIGHT_PRIORITY = -3;
/** Flying this close to a hotspot (horizontally) reads it; leaving past REARM_M lets it fire again, m. */
const PROXIMITY_M = 2.5;
const REARM_M = 3.2;
/** How far the camera pushes in when Ingenuity flies near a hotspot (1 = full close-up). */
const NUDGE = 0.45;
/** The autopilot parks this far from the part it scans, m. */
const STANDOFF_M = 1.2;
/** A scanned part that has moved this far since the autopilot parked gets a new parking spot, m. */
const REPLAN_M = 0.6;
/** A press and release within this distance and time is a click (otherwise it was an orbit drag). */
const CLICK_PX = 5;
const CLICK_MS = 450;

type Mode = 'idle' | 'manual' | 'auto' | 'home';

const inv = new Matrix4();
const tmp = new Vector3();
const org = new Vector3();
const dir = new Vector3();
const partL = new Vector3();
const camL = new Vector3();

/** World → this diorama's metres (live.site.matrix includes SITE_SCALE). */
function toLocal(world: Vector3, out: Vector3): Vector3 {
  inv.copy(live.site.matrix).invert();
  return out.copy(world).applyMatrix4(inv);
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** At this stop's site stage (the story stage), whatever the camera is doing. */
function atStage(s: AppState, stop: MachineId): boolean {
  return s.phase === 'flight' && s.flight.stage === 'site' && currentStop(s.flight) === stop;
}

/**
 * The visitor may fly: at this stop, the camera settled, Ingenuity down from its arrival hover.
 * Never at home: there the phantom has settled back into the real, broken Ingenuity, which cannot
 * fly; it stays on its ripple, and a close-up only moves the camera. (Its hotspots are on its own
 * body, 03 on the blade tip: the autopilot would chase its own spinning rotor.)
 */
function canFly(stop: MachineId): boolean {
  if (stop === HOME) return false;
  if (!atStage(useApp.getState(), stop)) return false;
  const shot = live.shot;
  return shot.siteId === stop && live.site.valid && shot.blend > 0.95 && live.black < 0.3 && shot.hover < 0.05;
}

const KEY: Record<string, 'f' | 'b' | 'l' | 'r'> = {
  KeyW: 'f',
  ArrowUp: 'f',
  KeyS: 'b',
  ArrowDown: 'b',
  KeyA: 'l',
  ArrowLeft: 'l',
  KeyD: 'r',
  ArrowRight: 'r',
};

export function SiteFlight({ stop, ground }: { stop: MachineId; ground: Ground }) {
  const camera = useThree(s => s.camera);
  const gl = useThree(s => s.gl);
  const reduced = useReducedMotion();
  const lay = siteLayout(SITE_PRESETS[stop]);
  const spot: [number, number] = [lay.ingenuity[0], lay.ingenuity[2]];
  const baseYaw = lay.machineYaw + 0.5;
  const groundAtSpot = ground.heightAt(spot[0], spot[1]);

  const st = useRef<FlyerState>(flyerAt(spot[0], spot[1], baseYaw));
  const mode = useRef<Mode>('idle');
  const keys = useRef({ f: false, b: false, l: false, r: false });
  const click = useRef<[number, number] | null>(null);
  /** The focus the autopilot is serving (its `at`), whether it has been planned yet, and its hover height. */
  const auto = useRef<{ at: number; key: string; planned: boolean; alt?: number; planAt?: [number, number] } | null>(null);
  const near = useRef<number | null>(null);
  const lastClickAt = useRef(0);

  // ---- keyboard and click-to-fly
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: KeyboardEvent) => {
      const k = KEY[e.code];
      if (!k || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey || !canFly(stop)) return;
      e.preventDefault();
      keys.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = KEY[e.code];
      if (k) keys.current[k] = false;
    };
    const blur = () => {
      keys.current = { f: false, b: false, l: false, r: false };
    };
    let press: { x: number; y: number; t: number } | null = null;
    const pdown = (e: PointerEvent) => {
      press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const pup = (e: PointerEvent) => {
      const p = press;
      press = null;
      if (!p || e.button !== 0 || !canFly(stop)) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_PX || performance.now() - p.t > CLICK_MS) return;
      const r = el.getBoundingClientRect();
      const ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ndcY = -((e.clientY - r.top) / r.height) * 2 + 1;
      // The pointer's ray, in the diorama's metres, onto the ground (twice, to follow its height).
      camera.updateMatrixWorld();
      org.setFromMatrixPosition(camera.matrixWorld);
      dir.set(ndcX, ndcY, 0.5).unproject(camera);
      toLocal(org, org);
      toLocal(dir, dir).sub(org).normalize();
      if (dir.y > -0.02) return;
      let y = groundAtSpot;
      let hit: [number, number] | null = null;
      for (let i = 0; i < 3; i++) {
        const t = (y - org.y) / dir.y;
        if (t <= 0) return;
        const x = org.x + dir.x * t;
        const z = org.z + dir.z * t;
        hit = [x, z];
        y = ground.heightAt(x, z);
      }
      if (!hit) return;
      click.current = hit;
      lastClickAt.current = performance.now();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    el.addEventListener('pointerdown', pdown);
    el.addEventListener('pointerup', pup);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      el.removeEventListener('pointerdown', pdown);
      el.removeEventListener('pointerup', pup);
    };
  }, [gl, camera, stop, ground, groundAtSpot]);

  // ---- the story and the focus: a picked section gets a close-up; a close-up gets the autopilot;
  // "Reset wide view" sends Ingenuity home.
  useEffect(
    () =>
      useApp.subscribe((s, prev) => {
        if (!atStage(s, stop) || s.flight !== prev.flight) return;
        if (s.story !== prev.story) {
          const f = s.focus;
          if (!(f && f.kind === 'hotspot' && f.id === String(s.story))) s.setFocus({ kind: 'hotspot', id: String(s.story), strength: 1 });
        }
        if (s.focus !== prev.focus) {
          const f = s.focus;
          if (f && f.strength >= 0.9) {
            auto.current = { at: f.at, key: f.kind === 'hotspot' ? `hs:${f.id}` : `sig:${f.id}`, planned: false };
            mode.current = 'auto';
            // The close-up frames the part (and Ingenuity once it is there): stop following it.
            live.flyer.follow = 0;
          } else if (mode.current === 'auto') {
            // The close-up moved on (or a photo nudged it elsewhere): stop scanning, hover, then land.
            auto.current = null;
            mode.current = 'idle';
          }
        }
        if (s.viewResetAt !== prev.viewResetAt) {
          // A double-click resets the view too: drop the fly-to its two clicks just asked for.
          if (performance.now() - lastClickAt.current < 600) click.current = null;
          auto.current = null;
          mode.current = 'home';
          live.flyer.follow = 0;
          const f = st.current;
          st.current = { ...f, target: [spot[0], spot[1]], landOnArrival: true, face: baseYaw };
        }
      }),
    [stop, spot[0], spot[1], baseYaw],
  );

  useEffect(
    () => () => {
      const f = live.flyer;
      if (f.site === stop) {
        f.site = null;
        f.alt = f.vx = f.vz = f.rotor = f.follow = 0;
      }
      live.scan.k = 0;
    },
    [stop],
  );

  useFrame((_, delta) => {
    const shot = live.shot;
    if (shot.siteId !== stop || !live.site.valid) return;
    const s = useApp.getState();
    const dt = Math.min(0.1, delta);
    const flyOk = canFly(stop);
    const world: FlyWorld = { centre: [0, 0], radius: SITE_RADIUS_M, machine: null };
    const m = live.machine;
    if (m.valid && m.site === stop) {
      world.machine = { yaw: m.yaw, minX: m.box.min.x, maxX: m.box.max.x, minZ: m.box.min.z, maxZ: m.box.max.z, top: m.box.max.y };
    }
    let f = st.current;
    let hold = false;
    let holdAlt: number | undefined;
    let move: [number, number] | null = null;
    let scanK = 0;

    if (flyOk) {
      // Manual controls take over from the autopilot (and let go of a full close-up).
      const k = keys.current;
      const anyKey = k.f || k.b || k.l || k.r;
      if (anyKey || click.current) {
        if (mode.current !== 'manual') {
          mode.current = 'manual';
          auto.current = null;
          if (s.focus && s.focus.strength >= 0.9) s.setFocus(null);
          s.pauseTour();
        }
        live.flyer.follow = 1;
      }
      if (anyKey) {
        camera.getWorldDirection(tmp).add(camera.position);
        toLocal(camera.position, org);
        toLocal(tmp, dir).sub(org);
        move = moveFromKeys(k, [dir.x, dir.z]);
      }
      if (click.current) {
        const [x, z] = clampToSite(world, click.current[0], click.current[1]);
        f = { ...f, target: [x, z], landOnArrival: false, face: null };
        click.current = null;
      }

      // Autopilot: once the part's position is known, park beside it, nose toward it, and hover.
      const a = auto.current;
      if (mode.current === 'auto' && a) {
        const p = live.targets.get(a.key);
        if (p) {
          const part = toLocal(p, partL);
          // A part that moves (Sojourner driving off its ramp): plan again once it has gone a way.
          if (a.planned && a.planAt && Math.hypot(part.x - a.planAt[0], part.z - a.planAt[1]) > REPLAN_M) a.planned = false;
          if (!a.planned) {
            a.planned = true;
            a.planAt = [part.x, part.z];
            const cam = toLocal(camera.position, camL);
            const centre: [number, number] = world.machine
              ? [(m.box.min.x + m.box.max.x) / 2, (m.box.min.z + m.box.max.z) / 2]
              : [part.x, part.z];
            if (world.machine) {
              // The box centre is in the machine's frame: turn it into the diorama.
              const c = Math.cos(m.yaw);
              const sn = Math.sin(m.yaw);
              const [bx, bz] = centre;
              centre[0] = c * bx + sn * bz;
              centre[1] = -sn * bx + c * bz;
            }
            const [x, z] = clampToSite(world, ...standoffBeside([part.x, part.z], [cam.x, cam.z], centre, [f.x, f.z], STANDOFF_M, world.machine));
            f = { ...f, target: [x, z], landOnArrival: false, face: headingTo(part.x - x, part.z - z) };
            // Level with the part (a little above it), so the close-up holds both.
            a.alt = Math.min(2.2, Math.max(0.9, part.y - ground.heightAt(x, z) + 0.55));
          }
          hold = true;
          holdAlt = a.alt;
          // The scan beam comes on once it has arrived and turned to the part.
          const there = f.target === null || Math.hypot(f.target[0] - f.x, f.target[1] - f.z) < ARRIVE_M * 4;
          scanK = there && f.alt > 0.8 ? 1 : 0;
          live.scan.point.copy(p);
        }
      }

      // Flying past a hotspot by hand reads that part of the story and nudges the camera to it.
      if (mode.current === 'manual' && f.alt > 0.5) {
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < 4; i++) {
          const p = live.targets.get(`hs:${i}`);
          if (!p) continue;
          toLocal(p, tmp);
          const d = Math.hypot(tmp.x - f.x, tmp.z - f.z);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        if (near.current !== null && (best !== near.current || bestD > REARM_M)) near.current = null;
        if (best >= 0 && bestD < PROXIMITY_M && near.current !== best) {
          near.current = best;
          useApp.setState({ story: best as StorySection, focus: { kind: 'hotspot', id: String(best), strength: NUDGE, at: Date.now() } });
        }
      }
    } else if (s.phase === 'flight' && s.flight.stage === 'epilogue' && stop === HOME) {
      // Home for good: back onto the landing spot, so the phantom settles on the real one.
      if (mode.current !== 'home') {
        mode.current = 'home';
        const away = Math.hypot(f.x - spot[0], f.z - spot[1]) > 0.02;
        f = { ...f, target: away ? [spot[0], spot[1]] : null, landOnArrival: true, face: baseYaw, idle: away ? 0 : LAND_AFTER_S };
      }
      if (reduced) f = flyerAt(spot[0], spot[1], baseYaw);
    }

    // Step, unless the visitor cannot fly and nothing is on its way (e.g. climbing out of the stop:
    // then Ingenuity keeps the place it had, and the Director's climb takes it from there).
    const busy = flyOk || mode.current === 'home';
    if (busy) {
      if (reduced && f.target) {
        // Reduced motion: jump straight to the spot.
        f = { ...f, x: f.target[0], z: f.target[1], vx: 0, vz: 0, target: null, yaw: f.face ?? f.yaw };
      }
      f = stepFlyer(f, { move, hold, holdAlt }, dt, world);
    }
    st.current = f;

    const out = live.flyer;
    out.site = stop;
    out.x = f.x;
    out.z = f.z;
    out.alt = f.alt;
    out.ground = ground.heightAt(f.x, f.z) - groundAtSpot;
    out.vx = f.vx;
    out.vz = f.vz;
    out.rotor = f.rotor;
    out.yaw = f.yaw;
    live.scan.k = scanK;
  }, FLIGHT_PRIORITY);

  return null;
}
