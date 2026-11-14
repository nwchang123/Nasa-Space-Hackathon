// The scene side of the scout camera (the viewfinder and buttons are in src/ui/hud/ScoutCam.tsx).
// While the viewfinder is up it works out which story hotspot is in frame, nearest its centre
// (live.scoutTarget). On "Capture" (store.snapshotRequest) it renders the frame and copies it into
// a small JPEG at once (no preserveDrawingBuffer needed), pins it to the store, and, if a hotspot
// was in frame, opens that part of the story with a gentle push in.

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { currentStop, useApp, type StorySection } from '../store';
import type { MachineId } from '../types';
import { live } from './registry';
import { pickTarget, VIEWFINDER_H, VIEWFINDER_W, type ScreenPoint } from './siteFocus';

/** Photo width, px. */
const THUMB_W = 160;
/** How far a photographed part pulls the camera in (1 = full close-up). */
const PHOTO_NUDGE = 0.45;

const v = new Vector3();

export function ScoutCamGrab({ stop }: { stop: MachineId }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const size = useThree(s => s.size);
  const seen = useRef(useApp.getState().snapshotRequest);

  useFrame(() => {
    const s = useApp.getState();
    const here = s.phase === 'flight' && s.flight.stage === 'site' && currentStop(s.flight) === stop && live.shot.siteId === stop;
    if (!here || !s.scoutCam) {
      if (live.scoutTarget !== null) live.scoutTarget = null;
      seen.current = s.snapshotRequest;
      return;
    }

    const pts: ScreenPoint[] = [];
    for (let i = 0; i < 4; i++) {
      const p = live.targets.get(`hs:${i}`);
      if (!p) continue;
      v.copy(p).project(camera);
      pts.push({ id: String(i), x: v.x, y: v.y, z: v.z });
    }
    const target = pickTarget(pts, VIEWFINDER_W, VIEWFINDER_H, size.width / Math.max(1, size.height));
    live.scoutTarget = target;

    if (s.snapshotRequest === seen.current) return;
    seen.current = s.snapshotRequest;
    // Render this frame now and copy it before the browser presents (and clears) the buffer.
    gl.render(scene, camera);
    const src = gl.domElement;
    const c = document.createElement('canvas');
    c.width = THUMB_W;
    c.height = Math.max(1, Math.round((THUMB_W * src.height) / Math.max(1, src.width)));
    const g = c.getContext('2d');
    if (!g) return;
    g.drawImage(src, 0, 0, c.width, c.height);
    const section = target === null ? null : (Number(target) as StorySection);
    s.addSnapshot({ at: Date.now(), url: c.toDataURL('image/jpeg', 0.7), section });
    if (section !== null) {
      useApp.setState({ story: section, focus: { kind: 'hotspot', id: String(section), strength: PHOTO_NUDGE, at: Date.now() } });
    }
  });

  return null;
}
