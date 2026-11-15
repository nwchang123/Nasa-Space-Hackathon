// The hangar's models as plain three.js objects, so the same group is shown in the sandbox,
// placed in WebXR and exported to USDZ for AR Quick Look. Built from the site registry: NASA or
// authored GLBs at real size (normalizeModel), the site's tilt (registry pose), Ingenuity's broken
// rig (ingenuityFromGltf) and the EDL parachute (buildParachute), with the procedural silhouettes
// if a GLB fails. No DOM needed: unit tests build every model from the shipped files.

import { Box3, Group, type Material, type Object3D } from 'three';
import { applyMissionFinish, cloneLitMaterials } from '../scene/missionFinish';
import {
  buildIngenuity,
  buildParachute,
  buildPlaceholder,
  disposeObject,
  ingenuityFromGltf,
  MODEL_REGISTRY,
  normalizeModel,
  type IngenuityRig,
} from '../scene/models';
import type { MachineId } from '../types';
import { layoutFor, type Extent, type HangarPick, type HangarScale, type Layout, type V3 } from './layout';

export interface PreparedModel {
  id: MachineId;
  /** Real size, posed as at its site (tilt only: on a table the base stands on the surface). */
  root: Group;
  /** root's bounds in its own frame, real metres. */
  extent: Extent;
  /** Ingenuity's rotors, to spin. */
  rig: IngenuityRig | null;
  /** True when the GLB failed and the procedural silhouette stands in. */
  fallback: boolean;
  dispose(): void;
}

/** Instance-owned lit materials also export through USDZ (AR Quick Look). */
function ownMaterials(root: Object3D, skip: ReadonlySet<Object3D>, owned: Material[]) {
  owned.push(...cloneLitMaterials(root,skip));
}

/** The site pose's tilt, without the sink: here the machine stands on a table, not in sand. */
export function hangarTilt(id: MachineId): V3 {
  const tilt = MODEL_REGISTRY[id].pose?.tilt;
  return tilt ? [tilt[0], tilt[1], tilt[2]] : [0, 0, 0];
}

/**
 * One machine at real size. `scene` is its loaded GLB scene (shared with the site cache; cloned,
 * never changed) or null for the procedural silhouette. Ingenuity keeps its broken blade.
 */
export function prepareModel(id: MachineId, scene: Object3D | null): PreparedModel {
  const entry = MODEL_REGISTRY[id];
  const owned: Material[] = [];
  const cleanups: Array<() => void> = [];
  let rig: IngenuityRig | null = null;
  let body: Object3D;

  if (id === 'ingenuity') {
    const r = scene ? ingenuityFromGltf(scene, true) : buildIngenuity(true);
    if (scene) ownMaterials(r.root, new Set<Object3D>(r.blur), owned);
    cleanups.push(() => r.dispose());
    rig = r;
    body = r.root;
  } else if (scene) {
    const model = scene.clone(true);
    ownMaterials(model, new Set(), owned);
    body = normalizeModel(model, entry.size);
  } else {
    const silhouette = buildPlaceholder(id, false);
    cleanups.push(() => disposeObject(silhouette));
    body = silhouette;
  }

  if(id==='spirit'||id==='opportunity'||id==='ingenuity')applyMissionFinish(body,id);
  const posed = new Group();
  posed.name = 'posed';
  posed.rotation.set(...hangarTilt(id));
  posed.add(body);

  const root = new Group();
  root.name = id;
  root.add(posed);
  if (id === 'mars2020-edl') {
    // The EDL stop is the backshell and its 21.5 m parachute: the canopy always comes along.
    const chute = buildParachute();
    cleanups.push(() => disposeObject(chute));
    root.add(chute);
  }

  root.updateMatrixWorld(true);
  // Exact (vertex) bounds: a tilted lander's loose box would leave it floating above the table.
  const box = new Box3().setFromObject(root, true);
  return {
    id,
    root,
    extent: { min: box.min.toArray() as V3, max: box.max.toArray() as V3 },
    rig,
    fallback: !scene,
    dispose() {
      for (const m of owned) m.dispose();
      for (const c of cleanups) c();
    },
  };
}

export interface Arrangement {
  /** Changes whenever what is shown changes (pick, scale or a fallback); keys the USDZ cache. */
  key: string;
  pick: HangarPick;
  scaleMode: HangarScale;
  /** Base on y = 0, centred on the origin, front facing +Z. */
  root: Group;
  layout: Layout;
  ids: MachineId[];
  rigs: IngenuityRig[];
}

/**
 * Stand prepared models in their layout under one scaled group. Moves each model's root into the
 * new group (a model is shown in one arrangement at a time).
 */
export function arrange(models: PreparedModel[], pick: HangarPick, scaleMode: HangarScale): Arrangement {
  const layout = layoutFor(
    models.map(m => m.extent),
    scaleMode,
  );
  const root = new Group();
  root.name = pick === 'row' ? 'hangar_row' : `hangar_${pick}`;
  root.scale.setScalar(layout.scale);
  models.forEach((m, i) => {
    const slot = new Group();
    slot.name = `slot_${m.id}`;
    slot.position.fromArray(layout.offsets[i]);
    slot.add(m.root);
    root.add(slot);
  });
  root.updateMatrixWorld(true);
  const fallbacks = models.map(m => (m.fallback ? 'p' : 'g')).join('');
  return {
    key: `${pick}:${scaleMode}:${fallbacks}`,
    pick,
    scaleMode,
    root,
    layout,
    ids: models.map(m => m.id),
    rigs: models.flatMap(m => (m.rig ? [m.rig] : [])),
  };
}
