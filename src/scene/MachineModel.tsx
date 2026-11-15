// A machine in its diorama: a credited NASA, adapted or authored GLB, with the procedural
// silhouette kept if loading fails. Native metre frames retain their pivots. Models are usually
// warm before their stop comes up (the Director preloads them). While loading the atmosphere stays
// in view; `onReady` lets the diorama fade in the real model without a stand-in swapping shapes.

import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import type { Object3D } from 'three';
import type { MachineId } from '../types';
import { buildParachute, buildPlaceholder, disposeObject, MODEL_REGISTRY, normalizeModel, type ModelEntry } from './models';
import { applyMissionFinish, cloneLitMaterials } from './missionFinish';
import { registerGroundContacts } from './grounding';

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
  const obj = useMemo(() => { const o = buildPlaceholder(id, false); registerGroundContacts(o); return o; }, [id]);
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

function NasaModel({ id, entry, onReady }: { id: MachineId; entry: ModelEntry & { url: string }; onReady?: () => void }) {
  // meshopt (bundled decoder), no Draco: nothing is fetched from a CDN.
  const { scene } = useGLTF(entry.url, false, true);
  const { obj, owned } = useMemo(() => {
    const c = scene.clone(true);
    const owned = cloneLitMaterials(c);
    const obj = normalizeModel(c, entry.size);
    if(id==='spirit'||id==='opportunity')applyMissionFinish(obj,id);
    registerGroundContacts(obj);
    return { obj, owned };
  }, [scene, entry, id]);
  const dispose = useMemo(() => () => owned.forEach(m => m.dispose()), [owned]);
  useDisposeWhenDetached(obj, dispose);
  useEffect(() => onReady?.(), [obj, onReady]);
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
export function MachineModel({ id, onReady }: { id: MachineId; onReady?: () => void }) {
  const entry = MODEL_REGISTRY[id];
  const pose = entry.pose;
  const silhouette = <Silhouette id={id} />;
  const body = entry.url ? (
    <KeepFallback fallback={silhouette}>
      <Suspense fallback={null}>
        <NasaModel id={id} entry={entry as ModelEntry & { url: string }} onReady={onReady} />
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
