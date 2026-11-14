// Shared pieces for the signature effects: when an effect may show, labels in the scene, the
// machine's bounding box in its own frame, and a reduced-motion-aware clock.

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import { Box3, CanvasTexture, Matrix4, SRGBColorSpace, Vector3, type Group, type Mesh, type Object3D } from 'three';
import { useApp } from '../../store';
import type { MachineId } from '../../types';
import { smoothstep } from '../layout';
import { live } from '../registry';
import type { SiteLayout } from '../sites';
import type { Ground } from '../terrain';
import { buttonProgress } from './logic';
import './signatures.css';

export interface SiteSignatureProps {
  stop: MachineId;
  ground: Ground;
  lay: SiteLayout;
}

/** Machine-local (x, z) → diorama-local, for a machine turned by `yaw` about +Y. */
export function toDiorama(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [c * x + s * z, -s * x + c * z];
}

/** Ground height under a machine-local point. */
export function groundAt(ground: Ground, lay: SiteLayout, x: number, z: number): number {
  const [dx, dz] = toDiorama(x, z, lay.machineYaw);
  return ground.heightAt(dx, dz);
}

/**
 * A button effect's clock, read inside useFrame: progress 0..1 (null before the first press), and
 * `onPress` once per new press (only if it is fresh, so remounting does not replay a sound).
 */
export function useButtonClock(key: string, durationMs: number, reduced: boolean, onPress?: () => void) {
  const seen = useRef<number | undefined>(undefined);
  return () => {
    const at = sigNow(key);
    if (at !== seen.current) {
      seen.current = at;
      if (at !== undefined && Date.now() - at < 1500) onPress?.();
    }
    return buttonProgress(at, durationMs, Date.now(), reduced);
  };
}

let dot: CanvasTexture | null = null;
/** A soft round dot (generated once), for points and glints. */
export function softDot(): CanvasTexture {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  dot = new CanvasTexture(c);
  dot.colorSpace = SRGBColorSpace;
  return dot;
}

/** 0..1: how much an effect at `stop` may show (that diorama in use, camera there, screen clear). */
export function siteShown(stop: MachineId): number {
  const shot = live.shot;
  if (shot.siteId !== stop || !live.site.valid) return 0;
  return smoothstep(0.75, 1, shot.blend) * (1 - Math.min(1, live.black * 2));
}

/** A signature value from the store (undefined until its control is first used). */
export function useSig(key: string): number | undefined {
  return useApp(s => s.sig[key]);
}

/** Read a signature value without subscribing (inside useFrame). */
export function sigNow(key: string): number | undefined {
  return useApp.getState().sig[key];
}

const inv = new Matrix4();
const m = new Matrix4();
const tmpBox = new Box3();

/**
 * Bounding box of `root`'s meshes in `frame`'s local coordinates (e.g. the machine group's frame:
 * front = +Z, up = +Y). Empty box if nothing is loaded yet.
 */
export function localBox(root: Object3D, frame: Object3D, out = new Box3()): Box3 {
  out.makeEmpty();
  frame.updateWorldMatrix(true, true);
  inv.copy(frame.matrixWorld).invert();
  root.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    tmpBox.copy(bb).applyMatrix4(m);
    out.union(tmpBox);
  });
  return out;
}

/**
 * The machine's right-front foot (a wheel or footpad), in its own frame (right = −X, front = +Z):
 * the middle of the lowest vertices on the right half that are nearest the front. Null if
 * nothing is loaded.
 */
export function rightFrontFoot(machine: Object3D): Vector3 | null {
  const b = localBox(machine, machine);
  if (b.isEmpty()) return null;
  const c = b.getCenter(new Vector3());
  const low: number[] = [];
  const p = new Vector3();
  machine.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos) return;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 20000));
    for (let i = 0; i < pos.count; i += step) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (p.y < b.min.y + 0.15 && p.x < c.x) low.push(p.x, p.y, p.z);
    }
  });
  if (low.length === 0) return null;
  let maxZ = -Infinity;
  for (let i = 2; i < low.length; i += 3) maxZ = Math.max(maxZ, low[i]);
  const sum = new Vector3();
  let n = 0;
  for (let i = 0; i < low.length; i += 3) {
    if (low[i + 2] < maxZ - 0.25) continue;
    sum.x += low[i];
    sum.z += low[i + 2];
    n++;
  }
  return sum.divideScalar(n).setY(b.min.y);
}

/** Point at fractions of a box: x and z −1..1 about its centre, y 0..1 from its bottom. */
export function boxPoint(b: Box3, f: [number, number, number], out = new Vector3()): Vector3 {
  const c = b.getCenter(new Vector3());
  const s = b.getSize(new Vector3());
  return out.set(c.x + (f[0] * s.x) / 2, b.min.y + f[1] * s.y, c.z + (f[2] * s.z) / 2);
}

/** The diorama's machine group ("machine"), found from any object inside the diorama group. */
export function findMachine(from: Object3D | null): Object3D | null {
  let o: Object3D | null = from;
  while (o && o.parent && !o.getObjectByName('machine')) o = o.parent;
  return o ? (o.getObjectByName('machine') ?? null) : null;
}

/**
 * A callout in the scene, in the style of the site tags: a dot on the spot, a hairline up, a label.
 * `show` is read every frame (0..1).
 */
export function SigTag({
  position,
  show,
  tone = 'amber',
  children,
}: {
  position: [number, number, number] | Vector3;
  show: () => number;
  tone?: 'amber' | 'white' | 'faint';
  children: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const holder = useRef<Group>(null);
  const last = useRef(-1);
  useFrame(() => {
    // A Vector3 position may be moved by its owner after mount: follow it.
    if (!Array.isArray(position) && holder.current) holder.current.position.copy(position);
    const k = Math.round(Math.max(0, Math.min(1, show())) * 50) / 50;
    if (k === last.current || !el.current) return;
    last.current = k;
    el.current.style.opacity = String(k);
    el.current.style.visibility = k > 0 ? 'visible' : 'hidden';
  });
  const p: [number, number, number] = Array.isArray(position) ? position : [position.x, position.y, position.z];
  return (
    <group ref={holder} position={p}>
      <Html zIndexRange={[6, 0]} pointerEvents="none" className="sig-tag-wrap">
        <div ref={el} className={`sig-tag sig-tag-${tone}`} style={{ opacity: 0, visibility: 'hidden' }}>
          <span className="sig-tag-label">{children}</span>
          <span className="sig-tag-line" aria-hidden="true" />
          <span className="sig-tag-dot" aria-hidden="true" />
        </div>
      </Html>
    </group>
  );
}
