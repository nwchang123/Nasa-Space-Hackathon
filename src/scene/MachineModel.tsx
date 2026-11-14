// A machine in its diorama: a credited NASA, adapted or authored GLB, with the procedural
// silhouette shown while it loads and kept if it fails. Native metre frames retain their pivots.
// Models load when their stop comes up (the Director preloads them as the flight toward it starts).

import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { MeshStandardMaterial, type Material, type Mesh, type MeshBasicMaterial, type Object3D } from 'three';
import type { MachineId } from '../types';
import { buildParachute, buildPlaceholder, disposeObject, MODEL_REGISTRY, normalizeModel, type ModelEntry } from './models';

/**
 * Free GPU resources once `obj` has really left the scene. React StrictMode (dev) runs effect
 * cleanups once on mount while the object stays on screen; disposing then left the procedural
 * Pathfinder and Phoenix undrawn. So wait a tick and only dispose if it is detached.
 */
function useDisposeWhenDetached(obj: Object3D, dispose: () => void) {
  useEffect(
    () => () => {
      setTimeout(() => {
        if (!obj.parent) dispose();
      }, 0);
    },
    [obj, dispose],
  );
}

function Silhouette({ id }: { id: MachineId }) {
  const obj = useMemo(() => buildPlaceholder(id, false), [id]);
  const dispose = useMemo(() => () => disposeObject(obj), [obj]);
  useDisposeWhenDetached(obj, dispose);
  return <primitive object={obj} />;
}

function Parachute() {
  const obj = useMemo(() => buildParachute(), []);
  const dispose = useMemo(() => () => disposeObject(obj), [obj]);
  useDisposeWhenDetached(obj, dispose);
  return <primitive object={obj} />;
}

function NasaModel({ entry }: { entry: ModelEntry & { url: string } }) {
  // meshopt (bundled decoder), no Draco: nothing is fetched from a CDN.
  const { scene } = useGLTF(entry.url, false, true);
  const { obj, owned } = useMemo(() => {
    const c = scene.clone(true);
    const owned: Material[] = [];
    c.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Unlit (baked) materials would glow at night: give them real shading under the site's sun.
      const mat = m.material as MeshBasicMaterial;
      if (mat && mat.isMeshBasicMaterial) {
        const lit = new MeshStandardMaterial({
          map: mat.map,
          color: mat.color,
          transparent: mat.transparent,
          opacity: mat.opacity,
          alphaTest: mat.alphaTest,
          side: mat.side,
          roughness: 0.8,
          metalness: 0.1,
        });
        owned.push(lit);
        m.material = lit;
      }
    });
    return { obj: normalizeModel(c, entry.size), owned };
  }, [scene, entry]);
  const dispose = useMemo(() => () => owned.forEach(m => m.dispose()), [owned]);
  useDisposeWhenDetached(obj, dispose);
  return <primitive object={obj} />;
}

class KeepFallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The machine at its site, posed (Spirit sunk and tilted), front facing +Z. */
export function MachineModel({ id }: { id: MachineId }) {
  const entry = MODEL_REGISTRY[id];
  const pose = entry.pose;
  const silhouette = <Silhouette id={id} />;
  const body = entry.url ? (
    <KeepFallback fallback={silhouette}>
      <Suspense fallback={silhouette}>
        <NasaModel entry={entry as ModelEntry & { url: string }} />
      </Suspense>
    </KeepFallback>
  ) : (
    silhouette
  );
  const model = pose ? (
    <group position={[0, -pose.sink, 0]} rotation={pose.tilt}>
      {body}
    </group>
  ) : (
    body
  );
  return (
    <>
      {model}
      {id === 'mars2020-edl' && <Parachute />}
    </>
  );
}
