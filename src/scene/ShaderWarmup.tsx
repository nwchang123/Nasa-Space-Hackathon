// Shader warm-up: a site's ground, rocks, sky and machine are built hidden and only appear part-way
// through the dive toward it, and the ground and the machine switch material state as they fade in
// and once they are fully in (terrain: transparent → opaque with alpha hash; the machine: dithered
// with alpha hash → its own state). Left to itself the renderer compiles each of those programs the
// first time it draws them, which stalls the dive for up to most of a second at exactly the moments
// the shot is moving. Instead, whenever a material shows up that has not been warmed yet (a diorama
// mounted, a model finished loading, a signature effect), every material in the scene is compiled
// up front in both of those states, hidden objects included. With KHR_parallel_shader_compile the
// driver builds them in the background while the camera is still high above the site, so they are
// ready by the time they are drawn.

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { Camera, Material, Mesh, Object3D, Scene, WebGLRenderer } from 'three';

/** How often the scene is checked for materials not warmed yet, frames. */
const CHECK_EVERY = 2;

interface FadeState {
  transparent: boolean;
  alphaHash: boolean;
  depthWrite: boolean;
}

const stateOf = (m: Material): FadeState => ({ transparent: m.transparent, alphaHash: m.alphaHash, depthWrite: m.depthWrite });

/** Inside a site's machine (Diorama.tsx names its group 'machine'): it fades in dithered. */
function inMachine(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.name === 'machine') return true;
  return false;
}

/**
 * The other material state a fading material will switch to, or null. Terrain fades in transparent
 * without depth writes and settles opaque with alpha hash (src/scene/terrain.ts setFade). A machine
 * dithers with alpha hash while it fades in and then returns to its own state (Diorama.tsx
 * fadeMachine), so both alpha-hash states are needed.
 */
function otherState(mat: Material, machine: boolean): FadeState | null {
  if (machine) return { ...stateOf(mat), alphaHash: !mat.alphaHash };
  if (mat.transparent && !mat.depthWrite) return { transparent: false, alphaHash: true, depthWrite: true };
  if (!mat.transparent && mat.alphaHash && mat.depthWrite) return { transparent: true, alphaHash: false, depthWrite: false };
  return null;
}

function materialsOf(o: Object3D): Material[] {
  const m = (o as Mesh).material as Material | Material[] | undefined;
  return !m ? [] : Array.isArray(m) ? m : [m];
}

/** Compile every material in the scene (hidden objects too), in its current and its other fade state. */
export function warmShaders(gl: WebGLRenderer, scene: Scene, camera: Camera): void {
  const hidden: Object3D[] = [];
  scene.traverse(o => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  const flipped: { mat: Material; was: FadeState }[] = [];
  try {
    // compile() only submits the programs: with KHR_parallel_shader_compile three checks them on
    // first use, so this does not block while the driver builds them. (compileAsync's polling
    // trips over the materials re-flagged here, and its promise is not needed.)
    gl.compile(scene, camera);
    const seen = new Set<Material>();
    scene.traverse(o => {
      const machine = inMachine(o);
      for (const mat of materialsOf(o)) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        const next = otherState(mat, machine);
        if (!next) continue;
        flipped.push({ mat, was: stateOf(mat) });
        Object.assign(mat, next);
      }
    });
    if (flipped.length) gl.compile(scene, camera);
  } finally {
    for (const { mat, was } of flipped) {
      Object.assign(mat, was);
      // Back on its own program at the next draw: a cache hit, both are compiled now.
      mat.needsUpdate = true;
    }
    for (const o of hidden) o.visible = false;
  }
}

/** Warms the scene's shaders whenever a material appears that has not been warmed (see above). */
export function ShaderWarmup() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const frame = useRef(0);
  const warmed = useRef(new WeakSet<Material>());
  useFrame(() => {
    if (++frame.current % CHECK_EVERY !== 0) return;
    const fresh: Material[] = [];
    scene.traverse(o => {
      for (const mat of materialsOf(o)) if (!warmed.current.has(mat)) fresh.push(mat);
    });
    if (fresh.length === 0) return;
    warmShaders(gl, scene, camera);
    scene.traverse(o => {
      for (const mat of materialsOf(o)) warmed.current.add(mat);
    });
  });
  return null;
}
