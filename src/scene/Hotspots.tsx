// Story hotspots on the machine at a site: four numbered markers on parts the story talks about
// (01 Why I came · 02 What I found · 03 My last day · 04 Still here) and, where a radio call
// exists, one on the antenna. Clicking a number picks that story section (store.setStory); the
// antenna asks the HUD to place the call (store.requestCall). Shown only once the camera has
// settled at the site. Mounted inside the machine's group (its own frame, front = +Z), or at the
// diorama's centre at home, where 03 follows the end of Ingenuity's broken blade.
// Each frame it also publishes where the hotspots are (live.targets, world space) and the machine's
// bounding box (live.machine), for the close-up camera, the autopilot and the scout camera.

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Box3, Matrix4, Vector3, type Group, type Mesh, type Object3D } from 'three';
import { MACHINE_BY_ID } from '../data/machines';
import { HOME } from '../flight/route';
import { currentStop, useApp, type StorySection } from '../store';
import type { MachineId } from '../types';
import type { Vec3 } from './layout';
import { live } from './registry';
import { HOTSPOTS, SITE_PRESETS, type Spot } from './sites';
import './hotspots.css';

const LABELS = ['Why I came', 'What I found', 'My last day', 'Still here'] as const;
const SECTIONS: StorySection[] = [0, 1, 2, 3];

const inv = new Matrix4();
const rel = new Matrix4();
const part = new Box3();
const tmp = new Vector3();

/** Hotspots visible: at this stop's site stage, once the dive has settled and the screen is clear. */
function hotspotFade(stop: MachineId): number {
  const s = useApp.getState();
  if (s.phase !== 'flight' || s.flight.stage !== 'site' || currentStop(s.flight) !== stop) return 0;
  const shot = live.shot;
  if (shot.siteId !== stop || !live.site.valid) return 0;
  const settle = Math.min(1, Math.max(0, (shot.blend - 0.95) / 0.05));
  return settle * (1 - Math.min(1, live.black * 3));
}

/** Bounding box of the machine's meshes in `frame`'s own coordinates (skipping `skip`). */
function localBox(frame: Object3D, skip: Object3D, out: Box3): number {
  out.makeEmpty();
  frame.updateWorldMatrix(true, true);
  inv.copy(frame.matrixWorld).invert();
  let meshes = 0;
  frame.traverse(o => {
    if (o === skip) return;
    const m = o as Mesh;
    if (!m.isMesh || !m.geometry) return;
    let a: Object3D | null = m;
    while (a && a !== frame) {
      if (a === skip) return;
      a = a.parent;
    }
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    if (!m.geometry.boundingBox) return;
    part.copy(m.geometry.boundingBox).applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
    out.union(part);
    meshes++;
  });
  return meshes;
}

function place(spot: Spot, box: Box3, out: Vector3): boolean {
  if ('m' in spot) {
    out.set(...spot.m);
    return true;
  }
  if (box.isEmpty()) return false;
  const [fx, fy, fz] = spot.box;
  out.set(
    (box.min.x + box.max.x) / 2 + (fx * (box.max.x - box.min.x)) / 2,
    box.min.y + fy * (box.max.y - box.min.y),
    (box.min.z + box.max.z) / 2 + (fz * (box.max.z - box.min.z)) / 2,
  );
  return true;
}

export function Hotspots({ stop }: { stop: MachineId }) {
  const group = useRef<Group>(null);
  const anchors = useRef<(Group | null)[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const story = useApp(s => s.story);
  const setStory = useApp(s => s.setStory);
  const setFocus = useApp(s => s.setFocus);
  const requestCall = useApp(s => s.requestCall);
  const machine = MACHINE_BY_ID[stop];
  const canCall = !machine.noRadio && stop !== HOME;
  const spots = HOTSPOTS[stop];
  const antenna: Vec3 = SITE_PRESETS[stop].antenna;
  const st = useRef({ frame: 0, meshes: -1, box: new Box3(), ready: false, shown: -1 });

  useEffect(
    () => () => {
      for (const key of ['hs:0', 'hs:1', 'hs:2', 'hs:3', 'hs:call']) live.targets.delete(key);
      if (live.machine.site === stop) live.machine.valid = false;
    },
    [stop],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = st.current;
    const fade = hotspotFade(stop);

    // Measure the model (NASA models arrive after a placeholder), then place the anchors. The box
    // is also published (live.machine) for the close-up camera and the free-flying Ingenuity: the
    // machine as it arrived, at rest (a signature action moving a part, Sojourner driving off,
    // does not stretch it over open ground).
    if (fade > 0 && g.parent && (s.frame++ % 20 === 0 || !s.ready)) {
      const n = localBox(g.parent, g, s.box);
      const m = live.machine;
      const changed = n !== s.meshes || !s.ready;
      if (changed || m.site !== stop) m.box.copy(s.box);
      m.site = stop;
      m.valid = stop !== HOME && n > 0 && !m.box.isEmpty();
      m.yaw = g.parent.rotation.y;
      if (changed) {
        s.meshes = n;
        let ok = true;
        spots.forEach((spot, i) => {
          const a = anchors.current[i];
          if (a && !place(spot, s.box, a.position)) ok = false;
        });
        const call = anchors.current[4];
        if (call) call.position.set(...antenna);
        s.ready = ok;
      }
    }
    // At home, 03 sits on the end of the broken blade, wherever the rotor stopped.
    if (stop === HOME && fade > 0) {
      const tip = live.brokenTip;
      const a = anchors.current[2];
      if (tip && a) {
        tip.updateWorldMatrix(true, false);
        tip.getWorldPosition(tmp);
        a.position.copy(g.worldToLocal(tmp));
      }
    }

    // Where each hotspot is, world space, for the close-up camera, the autopilot and the scout camera.
    if (fade > 0 && s.ready) {
      anchors.current.forEach((a, i) => {
        if (!a) return;
        const key = i === 4 ? 'hs:call' : `hs:${i}`;
        let v = live.targets.get(key);
        if (!v) live.targets.set(key, (v = new Vector3()));
        a.getWorldPosition(v);
      });
    }

    const k = s.ready ? Math.round(fade * 100) / 100 : 0;
    if (k === s.shown) return;
    s.shown = k;
    for (const b of buttons.current) {
      if (!b) continue;
      b.style.opacity = String(k);
      b.style.visibility = k > 0 ? 'visible' : 'hidden';
      b.style.pointerEvents = k > 0.6 ? 'auto' : 'none';
      b.tabIndex = k > 0.6 ? 0 : -1;
    }
  });

  return (
    <group ref={group}>
      {SECTIONS.map(i => (
        <group key={i} ref={el => void (anchors.current[i] = el)}>
          <Html zIndexRange={[4, 2]} pointerEvents="none" className="hs-wrap">
            <button
              type="button"
              ref={el => void (buttons.current[i] = el)}
              className={`hs${story === i ? ' on' : ''}`}
              style={{ opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}
              tabIndex={-1}
              aria-pressed={story === i}
              aria-label={`${String(i + 1).padStart(2, '0')} ${LABELS[i]}`}
              onClick={() => {
                // The close-up first (also when it is already the section shown), then the story.
                setFocus({ kind: 'hotspot', id: String(i), strength: 1 });
                setStory(i);
              }}
            >
              <span className="hs-dot" aria-hidden="true" />
              <span className="hs-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="hs-label">{LABELS[i]}</span>
            </button>
          </Html>
        </group>
      ))}
      {canCall && (
        <group ref={el => void (anchors.current[4] = el)}>
          <Html zIndexRange={[4, 2]} pointerEvents="none" className="hs-wrap">
            <button
              type="button"
              ref={el => void (buttons.current[4] = el)}
              className="hs hs-call"
              style={{ opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}
              tabIndex={-1}
              aria-label="Call from Earth"
              onClick={requestCall}
            >
              <span className="hs-dot" aria-hidden="true" />
              <span className="hs-num" aria-hidden="true">
                ((·))
              </span>
              <span className="hs-label">Call from Earth</span>
            </button>
          </Html>
        </group>
      )}
    </group>
  );
}
