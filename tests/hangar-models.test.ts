// AR hangar render logic on the shipped models: every machine built from its GLB (or its
// procedural stand-in), stood on the table at y = 0, scaled to a 0.28 m figure or a 1.1 m row of
// all nine at true relative sizes; Ingenuity broken and spinning; the EDL with its parachute; and
// the USDZ that AR Quick Look opens (horizontal plane anchoring, parachute included).

import { Box3, BufferAttribute, BufferGeometry, DoubleSide, PlaneGeometry, SphereGeometry, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { arrange, hangarTilt, prepareModel, type PreparedModel } from '../src/hangar/build';
import { TABLE_ROW_M, TABLE_SINGLE_M } from '../src/hangar/layout';
import { decimateForExport } from '../src/hangar/decimate';
import { exportCopy, exportPlan, exportUsdz, quickLookHref, UsdzCache, USDZ_OPTIONS, withBackFaces } from '../src/hangar/usdz';
import { MODEL_REGISTRY } from '../src/scene/models';
import { MACHINE_IDS, type MachineId } from '../src/types';
import { loadGlb } from './glb-fixture';

const scenes = new Map<string, Object3D>();
const sceneOf = (id: MachineId) => scenes.get(MODEL_REGISTRY[id].url!.split('/').pop()!)!;

beforeAll(async () => {
  for (const id of MACHINE_IDS) {
    const file = MODEL_REGISTRY[id].url!.split('/').pop()!;
    if (!scenes.has(file)) scenes.set(file, (await loadGlb(file)).scene);
  }
});

const worldBox = (o: Object3D) => {
  o.updateMatrixWorld(true);
  return new Box3().setFromObject(o, true);
};
const visibleMeshes = (o: Object3D) => {
  const out: Mesh[] = [];
  o.traverseVisible(c => {
    if ((c as Mesh).isMesh) out.push(c as Mesh);
  });
  return out;
};

describe('hangar models from the shipped GLBs', () => {
  it('stands every machine on the table as a 0.28 m figure, footprint centred', () => {
    for (const id of MACHINE_IDS) {
      const m = prepareModel(id, sceneOf(id));
      const a = arrange([m], id, 'table');
      const b = worldBox(a.root);
      const s = b.getSize(new Vector3());
      expect(Math.max(s.x, s.y, s.z), id).toBeCloseTo(TABLE_SINGLE_M, 4);
      expect(Math.abs(b.min.y), id).toBeLessThan(1e-5);
      expect(Math.abs(b.min.x + b.max.x), id).toBeLessThan(1e-5);
      expect(Math.abs(b.min.z + b.max.z), id).toBeLessThan(1e-5);
      expect(m.fallback).toBe(false);
      m.dispose();
    }
  });

  it('keeps real size at 1:1, still standing on y = 0', () => {
    for (const id of ['viking-2', 'spirit', 'insight', 'ingenuity'] as MachineId[]) {
      const m = prepareModel(id, sceneOf(id));
      const real = new Box3().setFromObject(m.root, true).getSize(new Vector3());
      const b = worldBox(arrange([m], id, 'real').root);
      expect(b.getSize(new Vector3()).distanceTo(real), id).toBeLessThan(1e-6);
      expect(Math.abs(b.min.y), id).toBeLessThan(1e-6);
    }
  });

  it('keeps the site tilt (Viking 2 at 8.5°, Spirit dug in) but not the sink: the base is on the table', () => {
    expect(hangarTilt('viking-2')).toEqual(MODEL_REGISTRY['viking-2'].pose!.tilt);
    expect(hangarTilt('viking-1')).toEqual([0, 0, 0]);
    for (const id of ['viking-2', 'spirit'] as MachineId[]) {
      const m = prepareModel(id, sceneOf(id));
      const posed = m.root.getObjectByName('posed')!;
      expect(posed.rotation.toArray().slice(0, 3)).toEqual(MODEL_REGISTRY[id].pose!.tilt);
      expect(posed.position.y).toBe(0);
      expect(Math.abs(worldBox(arrange([m], id, 'table').root).min.y)).toBeLessThan(1e-5);
    }
  });

  it('lines all nine up 1.1 m wide, in route order, each base on the table, true relative sizes', () => {
    const models = MACHINE_IDS.map(id => prepareModel(id, sceneOf(id)));
    const a = arrange(models, 'row', 'table');
    const b = worldBox(a.root);
    expect(b.max.x - b.min.x).toBeCloseTo(TABLE_ROW_M, 4);
    expect(Math.abs(b.min.y)).toBeLessThan(1e-5);
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(1e-5);
    let lastRight = -Infinity;
    const fronts: number[] = [];
    for (const m of models) {
      const slot = a.root.getObjectByName(`slot_${m.id}`)!;
      const sb = worldBox(slot);
      expect(sb.min.x, m.id).toBeGreaterThan(lastRight);
      lastRight = sb.max.x;
      expect(Math.abs(sb.min.y), m.id).toBeLessThan(1e-5);
      fronts.push(sb.max.z);
      // One scale for all: shown width / real width is the row's scale.
      const real = m.extent.max[0] - m.extent.min[0];
      expect((sb.max.x - sb.min.x) / real, m.id).toBeCloseTo(a.layout.scale, 6);
    }
    for (const z of fronts) expect(z).toBeCloseTo(fronts[0], 5);
    expect(a.ids).toEqual([...MACHINE_IDS]);
    expect(a.layout.realSize[0]).toBeGreaterThan(50);
    expect(a.key).toBe(`row:table:${'g'.repeat(9)}`);
    for (const m of models) m.dispose();
  });

  it('brings the EDL parachute along, its canopy the site’s own geometry', () => {
    const m = prepareModel('mars2020-edl', sceneOf('mars2020-edl'));
    const a = arrange([m], 'mars2020-edl', 'table');
    const canopy = a.root.getObjectByName('parachute') as Mesh;
    expect(canopy?.isMesh).toBe(true);
    expect(canopy.geometry.getAttribute('position').count).toBe(97 * 23); // RingGeometry(0.5, 8, 96, 22)
    // The canopy (16 m across) is what makes the EDL stop so long.
    expect(m.extent.max[0] - m.extent.min[0]).toBeGreaterThan(15);
    m.dispose();
  });

  it('gives Ingenuity its broken blade and spinning rotors', () => {
    const m = prepareModel('ingenuity', sceneOf('ingenuity'));
    expect(m.rig).not.toBeNull();
    expect(m.rig!.brokenTip).not.toBeNull();
    const a = arrange([m], 'ingenuity', 'table');
    expect(a.rigs).toHaveLength(1);
    const lower = m.root.getObjectByName('rotors_02')!;
    const upper = m.root.getObjectByName('rotors_01')!;
    a.rigs[0].setRotor(0);
    const q0 = [lower.quaternion.clone(), upper.quaternion.clone()];
    a.rigs[0].setRotor(1.2);
    expect(lower.quaternion.angleTo(q0[0])).toBeCloseTo(1.2, 5);
    expect(upper.quaternion.angleTo(q0[1])).toBeCloseTo(1.2, 5);
    m.dispose();
  });

  it('lights every visible mesh with its own standard material and never touches the shared GLB', () => {
    const shared = new Set<Material>();
    for (const s of scenes.values()) s.traverse(o => (o as Mesh).isMesh && shared.add((o as Mesh).material as Material));
    const models = MACHINE_IDS.map(id => prepareModel(id, sceneOf(id)));
    for (const mesh of visibleMeshes(arrange(models, 'row', 'table').root)) {
      const mat = mesh.material as Material & { isMeshStandardMaterial?: boolean };
      expect(mat.isMeshStandardMaterial, mesh.name).toBe(true);
      expect(shared.has(mat)).toBe(false);
      expect(mesh.castShadow || mesh.name === 'parachute').toBe(true);
    }
    // The site cache keeps its own materials.
    for (const s of scenes.values()) s.traverse(o => (o as Mesh).isMesh && expect((((o as Mesh).material as Material).type)).toBe('MeshBasicMaterial'));
    for (const m of models) m.dispose();
  });

  it('falls back to the procedural silhouettes, still grounded and sized', () => {
    const models: PreparedModel[] = MACHINE_IDS.map(id => prepareModel(id, null));
    for (const m of models) {
      expect(m.fallback).toBe(true);
      const b = worldBox(arrange([m], m.id, 'table').root);
      expect(Math.max(...b.getSize(new Vector3()).toArray()), m.id).toBeCloseTo(TABLE_SINGLE_M, 4);
      expect(Math.abs(b.min.y), m.id).toBeLessThan(1e-5);
    }
    const a = arrange(models, 'row', 'table');
    expect(a.key).toBe(`row:table:${'p'.repeat(9)}`);
    expect(worldBox(a.root).max.x - worldBox(a.root).min.x).toBeCloseTo(TABLE_ROW_M, 4);
    for (const m of models) m.dispose();
  });
});

describe('AR Quick Look export', () => {
  const unzip = (bytes: Uint8Array) => unzipSync(bytes);

  it('anchors the USDZ to a horizontal plane, Quick Look compatible', () => {
    expect(USDZ_OPTIONS.ar.planeAnchoring.alignment).toBe('horizontal');
    expect(USDZ_OPTIONS.quickLookCompatible).toBe(true);
  });

  it('exports the EDL with its parachute at table scale, without changing what is shown', async () => {
    const m = prepareModel('mars2020-edl', sceneOf('mars2020-edl'));
    const a = arrange([m], 'mars2020-edl', 'table');
    const parentBefore = a.root.parent;
    const files = unzip(await exportUsdz(a.root, exportPlan(false, 'table')));
    const names = Object.keys(files);
    expect(names[0]).toBe('model.usda');
    const usda = strFromU8(files['model.usda']);
    expect(usda).toContain('token preliminary:anchoring:type = "plane"');
    expect(usda).toContain('token preliminary:planeAnchoring:alignment = "horizontal"');
    expect(usda).toMatch(/def Xform "hangar_mars2020edl"/);
    expect(usda).toMatch(/def Xform "parachuterig"/);
    expect(usda).toMatch(/"parachute"/);
    expect(names.filter(n => n.startsWith('geometries/')).length).toBeGreaterThan(2);
    // The table scale rides on the root transform.
    const s = a.layout.scale.toPrecision(5).slice(0, 6);
    expect(usda).toContain(s);
    expect(a.root.parent).toBe(parentBefore);
    m.dispose();
  }, 30_000);

  it('exports the whole row: nine slots, light enough for a phone', async () => {
    const models = MACHINE_IDS.map(id => prepareModel(id, sceneOf(id)));
    const a = arrange(models, 'row', 'table');
    const files = unzip(await exportUsdz(a.root, exportPlan(true, 'table')));
    const usda = strFromU8(files['model.usda']);
    for (const id of MACHINE_IDS) expect(usda).toContain(`"slot_${id.replace(/[^A-Za-z0-9_]/g, '')}"`);
    // Full detail is ~50 MB of geometry text here (more with UVs in a browser); clustered, a few.
    const geometry = Object.entries(files).filter(([k]) => k.startsWith('geometries/')).reduce((s, [, v]) => s + v.length, 0);
    expect(geometry).toBeLessThan(12_000_000);
    for (const m of models) m.dispose();
  }, 60_000);

  it('clusters only a copy: the shown meshes and the EDL canopy keep their own geometry', () => {
    const models = (['phoenix', 'mars2020-edl'] as MachineId[]).map(id => prepareModel(id, sceneOf(id)));
    const a = arrange(models, 'row', 'table');
    const meshes = (root: Object3D) => {
      const out: Mesh[] = [];
      root.traverse(o => (o as Mesh).isMesh && out.push(o as Mesh));
      return out;
    };
    const shown = meshes(a.root);
    const shownGeometry = shown.map(m => m.geometry);
    const copy = exportCopy(a.root, exportPlan(true, 'table'));
    const copied = meshes(copy.scene); // clone() keeps the order
    expect(copied).toHaveLength(shown.length);
    let verts = 0, vertsBefore = 0;
    copied.forEach((m, i) => {
      expect(m.name).toBe(shown[i].name);
      if (m.name === 'parachute') expect(m.geometry).toBe(shown[i].geometry);
      verts += m.geometry.getAttribute('position').count;
      vertsBefore += shown[i].geometry.getAttribute('position').count;
    });
    expect(shown.map(m => m.geometry)).toEqual(shownGeometry); // the shown meshes are untouched
    expect(shown.some((m, i) => m.geometry === shownGeometry[i] && copied[i].geometry !== m.geometry)).toBe(true);
    expect(verts).toBeLessThan(vertsBefore * 0.5);
    copy.dispose();
    for (const m of models) m.dispose();
  });

  it('turns off pinch-to-resize only at 1:1', () => {
    expect(quickLookHref('blob:x', 'table')).toBe('blob:x');
    expect(quickLookHref('blob:x', 'real')).toBe('blob:x#allowsContentScaling=0');
  });

  it('holds the Blob URL ready before the tap; a newer arrangement wins; old URLs are revoked', async () => {
    const made: string[] = [];
    const revoked: string[] = [];
    const cache = new UsdzCache({
      create: () => {
        made.push(`blob:${made.length}`);
        return made[made.length - 1];
      },
      revoke: url => revoked.push(url),
    });
    expect(cache.ready('a')).toBeNull();
    const a = await cache.prepare('a', async () => new Uint8Array(3));
    expect(a).toEqual({ key: 'a', url: 'blob:0', bytes: 3 });
    expect(cache.ready('a')?.url).toBe('blob:0'); // synchronous: usable in the tap itself
    // Asking again does not export again.
    let calls = 0;
    await cache.prepare('a', async () => {
      calls++;
      return new Uint8Array(1);
    });
    expect(calls).toBe(0);
    // A slow export overtaken by a newer pick is dropped.
    let release!: () => void;
    const slow = cache.prepare('b', () => new Promise<Uint8Array>(r => (release = () => r(new Uint8Array(5)))));
    const fast = await cache.prepare('c', async () => new Uint8Array(7));
    release();
    expect(await slow).toBeNull();
    expect(fast?.url).toBe('blob:1');
    expect(cache.ready('b')).toBeNull();
    expect(cache.ready('c')?.bytes).toBe(7);
    expect(revoked).toEqual(['blob:0']);
    cache.dispose();
    expect(revoked).toEqual(['blob:0', 'blob:1']);
    expect(cache.ready('c')).toBeNull();
  });
});

describe('clustering for the USDZ', () => {
  it('keeps the surface within a cell, with fewer vertices and the same attributes', () => {
    const sphere = new SphereGeometry(1, 128, 96);
    const posBefore = Float32Array.from(sphere.getAttribute('position').array as Float32Array);
    const d = decimateForExport(sphere, 0.1);
    expect(d).not.toBe(sphere);
    expect(Array.from(sphere.getAttribute('position').array)).toEqual(Array.from(posBefore)); // input untouched
    expect(Object.keys(d.attributes).sort()).toEqual(Object.keys(sphere.attributes).sort());
    expect(d.getAttribute('position').count).toBeLessThan(sphere.getAttribute('position').count / 4);
    const p = d.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(Math.abs(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) - 1)).toBeLessThan(0.1);
    const n = d.getAttribute('normal');
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
    expect(d.index!.count / 3).toBeGreaterThan(100);
  });

  it('keeps a UV seam welded and each side’s texture coordinates its own', () => {
    // Two charts (strips) meeting along x = 1: the seam vertices are duplicated with different UVs.
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const strip = (x0: number, u0: number) => {
      const base = pos.length / 3;
      for (let j = 0; j <= 40; j++) for (let i = 0; i <= 1; i++) {
        pos.push(x0 + i, j * 0.05, 0);
        uv.push(u0 + i * 0.1, j / 40);
      }
      for (let j = 0; j < 40; j++) idx.push(base + j * 2, base + j * 2 + 1, base + j * 2 + 2, base + j * 2 + 1, base + j * 2 + 3, base + j * 2 + 2);
    };
    strip(0, 0);
    strip(1, 0.8);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const d = decimateForExport(g, 0.2);
    const p = d.getAttribute('position'), t = d.getAttribute('uv');
    const seam = [] as { y: number; u: number }[];
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - 1) < 0.15) seam.push({ y: p.getY(i), u: t.getX(i) });
    // Both sides of the seam: identical positions, UVs from their own chart (0.1 and 0.8).
    const left = seam.filter(s => s.u < 0.5), right = seam.filter(s => s.u > 0.5);
    expect(left.length).toBeGreaterThan(3);
    expect(right.map(s => s.y).sort()).toEqual(left.map(s => s.y).sort());
    for (const s of left) expect(s.u).toBeCloseTo(0.1, 5);
    for (const s of right) expect(s.u).toBeCloseTo(0.8, 5);
  });

  it('leaves a mesh alone when the cell is finer than its detail', () => {
    const g = new PlaneGeometry(1, 1, 6, 6); // no coincident vertices to weld
    expect(decimateForExport(g, 1e-4)).toBe(g);
    expect(decimateForExport(g, 0)).toBe(g);
  });

  it('gives thin double-sided parts real back faces in the copy, and leaves the shown materials double-sided', () => {
    const panel = new PlaneGeometry(2, 1, 4, 2);
    const both = withBackFaces(panel);
    const n = panel.getAttribute('position').count;
    expect(both.getAttribute('position').count).toBe(2 * n);
    expect(both.index!.count).toBe(2 * panel.index!.count);
    expect(both.getAttribute('normal').getZ(0)).toBe(1);
    expect(both.getAttribute('normal').getZ(n)).toBe(-1);
    // The second copy winds the other way round.
    const [a, b, c] = [0, 1, 2].map(k => both.index!.getX(k));
    const [a2, b2, c2] = [0, 1, 2].map(k => both.index!.getX(panel.index!.count + k));
    expect([a2 - n, b2 - n, c2 - n]).toEqual([a, c, b]);

    const m = prepareModel('ingenuity', sceneOf('ingenuity'));
    const a1 = arrange([m], 'ingenuity', 'table');
    const sides = new Set<number>();
    a1.root.traverseVisible(o => (o as Mesh).isMesh && sides.add(((o as Mesh).material as Material).side));
    const copy = exportCopy(a1.root, exportPlan(false, 'table'));
    copy.scene.traverseVisible(o => (o as Mesh).isMesh && expect(((o as Mesh).material as Material).side).not.toBe(DoubleSide));
    const after = new Set<number>();
    a1.root.traverseVisible(o => (o as Mesh).isMesh && after.add(((o as Mesh).material as Material).side));
    expect(after).toEqual(sides);
    copy.dispose();
    m.dispose();
  });

  it('plans finer detail and sharper textures for one model than for the row', () => {
    expect(exportPlan(false, 'table').cell).toBeLessThan(exportPlan(true, 'table').cell);
    expect(exportPlan(false, 'table').maxTextureSize).toBeGreaterThan(exportPlan(true, 'table').maxTextureSize);
    expect(exportPlan(false, 'real').cell).toBeLessThan(exportPlan(true, 'real').cell);
  });
});
