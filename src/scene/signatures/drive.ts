// Hand-driven signature actions: a slider's value followed with a very short smoothing (so a drag
// never looks steppy, but the pose tracks the hand, not a timer), a hold control's state, and a
// small puff of dust or soil kicked up while a part moves. Used inside useFrame.

import { useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, type Vector3 } from 'three';
import { SITE_SCALE } from '../layout';
import { sigNow, softDot } from './common';

/** Smoothing time constant for slider-driven poses, s (≈ 70 ms: tight, but no stair-steps). */
const FOLLOW_S = 0.07;

/**
 * A slider's value, read every frame: null until the control is first used, then the store value
 * followed with a ~70 ms exponential smoothing (none with reduced motion). Call the returned
 * function once per frame with the frame's delta.
 */
export function useSliderDrive(key: string, reduced: boolean) {
  const cur = useRef<number | null>(null);
  return (dt: number): number | null => {
    const v = sigNow(key);
    if (v === undefined) {
      cur.current = null;
      return null;
    }
    const c = cur.current;
    let next = c === null || reduced ? v : c + (v - c) * (1 - Math.exp(-Math.min(dt, 0.1) / FOLLOW_S));
    if (Math.abs(next - v) < 1e-4) next = v;
    cur.current = next;
    return next;
  };
}

/** A hold control's state in the store (see src/data/signatures.ts, kind 'hold'). */
export interface HoldNow {
  /** Being held right now. */
  holding: boolean;
  /** Charge 0..1 (rising while held; kept at release), or undefined before first use. */
  charge: number | undefined;
  /** Date.now() of the latest release, or undefined. */
  fireAt: number | undefined;
}

export function holdNow(key: string): HoldNow {
  return { holding: sigNow(`${key}:hold`) === 1, charge: sigNow(key), fireAt: sigNow(`${key}:fire`) };
}

/**
 * A few dozen soft particles kicked up from a point and settling back: dust under a dragged
 * wheel, soil off a scoop. Diorama metres; emit() as the part moves, update() every frame.
 */
export class Puffs {
  readonly points: Points;
  private readonly life: Float32Array;
  private readonly vel: Float32Array;
  private next = 0;

  constructor(
    private readonly n: number,
    color: string,
    private readonly size = 0.05,
  ) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 4).fill(1), 4));
    this.life = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    const mat = new PointsMaterial({
      size: size * SITE_SCALE,
      map: softDot(),
      color,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    this.points = new Points(g, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Kick up `count` particles at `at`, spread `spread` m, rising up to `up` m/s. */
  emit(at: Vector3, count: number, spread: number, up: number) {
    const pos = this.points.geometry.getAttribute('position') as Float32BufferAttribute;
    const P = pos.array as Float32Array;
    for (let c = 0; c < count; c++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      P[i * 3] = at.x + (Math.random() - 0.5) * spread;
      P[i * 3 + 1] = at.y + Math.random() * spread * 0.3;
      P[i * 3 + 2] = at.z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = (Math.random() - 0.5) * up * 0.8;
      this.vel[i * 3 + 1] = up * (0.4 + 0.6 * Math.random());
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * up * 0.8;
      this.life[i] = 1;
    }
    pos.needsUpdate = true;
  }

  /** Move and fade; `opacity` is the site's fade (0..1). */
  update(dt: number, opacity: number) {
    const d = Math.min(dt, 0.1);
    const pos = this.points.geometry.getAttribute('position') as Float32BufferAttribute;
    const col = this.points.geometry.getAttribute('color') as Float32BufferAttribute;
    const P = pos.array as Float32Array;
    const C = col.array as Float32Array;
    let alive = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        C[i * 4 + 3] = 0;
        continue;
      }
      alive = true;
      // Thin air, low gravity: the dust rises a little, drifts and settles slowly.
      this.life[i] = Math.max(0, this.life[i] - d * 0.9);
      this.vel[i * 3 + 1] -= 1.2 * d;
      P[i * 3] += this.vel[i * 3] * d;
      P[i * 3 + 1] = Math.max(P[i * 3 + 1] + this.vel[i * 3 + 1] * d, P[i * 3 + 1] - 0.02);
      P[i * 3 + 2] += this.vel[i * 3 + 2] * d;
      C[i * 4 + 3] = this.life[i] * this.life[i] * 0.8;
    }
    pos.needsUpdate = col.needsUpdate = alive;
    const mat = this.points.material as PointsMaterial;
    mat.opacity = opacity;
    mat.size = this.size * SITE_SCALE;
    this.points.visible = alive && opacity > 0.003;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  }
}
