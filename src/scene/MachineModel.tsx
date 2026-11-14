// A machine in its diorama: NASA's model when there is one (normalised to real size by its
// bounding box), with the procedural silhouette shown while it loads and kept if it fails.
// Models load when their stop comes up (the Director preloads them as the flight toward it starts).

import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { MeshStandardMaterial, type Material, type Mesh, type MeshBasicMaterial } from 'three';
import type { MachineId } from '../types';
import { buildPlaceholder, disposeObject, MODEL_REGISTRY, normalizeModel, type ModelEntry } from './models';

function Silhouette({ id }: { id: MachineId }) {
  const obj = useMemo(() => buildPlaceholder(id), [id]);
  useEffect(() => () => disposeObject(obj), [obj]);
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
  useEffect(() => () => owned.forEach(m => m.dispose()), [owned]);
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
  return pose ? (
    <group position={[0, -pose.sink, 0]} rotation={pose.tilt}>
      {body}
    </group>
  ) : (
    body
  );
}
