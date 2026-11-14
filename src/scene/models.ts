// The machines in the site dioramas, and Ingenuity. NASA 3D models (meshopt + WebP GLBs in
// public/models/) are used where NASA publishes one; each is normalised by its bounding box to the
// machine's real size. Pathfinder/Sojourner, Phoenix and Perseverance's backshell have no NASA
// model: they, and every model while it loads or if it fails, use procedural silhouettes built
// from primitives at roughly real size (metres, origin on the ground, front = +Z). Parts that
// share a finish are merged, so a silhouette costs a handful of draw calls.

import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  Object3D,
  type Material,
  type Side,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODEL_NOTES } from '../data/modelNotes';
import type { MachineId } from '../types';
import { realSizeScale, type RealSize, type Vec3 } from './layout';

// ---------------------------------------------------------------- model registry

/** GitHub Pages serves the app under a sub-path, so model URLs start from Vite's base. */
const modelUrl = (file: string) => `${import.meta.env.BASE_URL}models/${file}`;

export interface ModelEntry {
  /** NASA GLB, if one exists for this machine. */
  url?: string;
  /** Real-world size the model is scaled to (from its bounding box). */
  size?: RealSize;
  /** True when what is shown is not a faithful model of this machine at its site. */
  illustrative: boolean;
  /** Why, for a caption. */
  note?: string;
  /** Pose at the site, applied to the GLB and the silhouette alike: sunk into the sand, tilted. */
  pose?: { sink: number; tilt: Vec3 };
}

const VIKING: ModelEntry = { url: modelUrl('viking-lander.glb'), size: { height: 2.0 }, illustrative: false };

export const MODEL_REGISTRY: Record<MachineId, ModelEntry> = {
  'viking-1': VIKING,
  // Viking 2 came to rest tilted 8.5° (docs/FACT_CHECK.md, viking-2); the direction of the tilt is
  // illustrative. Lifted a little so the low footpad stays on the ground.
  'viking-2': { ...VIKING, pose: { sink: -0.2, tilt: [0.06, 0, 0.136] } },
  'pathfinder-sojourner': { illustrative: true, note: MODEL_NOTES['pathfinder-sojourner'] },
  spirit: {
    url: modelUrl('mer.glb'),
    size: { span: 2.3, height: 1.5 },
    illustrative: true,
    note: MODEL_NOTES.spirit,
    // Stuck at Troy from 2009: wheels dug into soft sand, the deck tilted.
    pose: { sink: 0.09, tilt: [0.07, 0, -0.1] },
  },
  opportunity: { url: modelUrl('mer.glb'), size: { span: 2.3, height: 1.5 }, illustrative: true, note: MODEL_NOTES.opportunity },
  phoenix: { illustrative: true, note: MODEL_NOTES.phoenix },
  insight: {
    url: modelUrl('insight.glb'),
    size: { span: 6.0 },
    illustrative: true,
    note: MODEL_NOTES.insight,
  },
  'mars2020-edl': { illustrative: true, note: MODEL_NOTES['mars2020-edl'] },
  ingenuity: { url: modelUrl('ingenuity.glb'), size: { span: 1.2 }, illustrative: false, note: MODEL_NOTES.ingenuity },
};

/** Wrap a loaded model so it stands on the ground (y = 0) at its real size. Shares geometry. */
export function normalizeModel(model: Object3D, size?: RealSize): Group {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const dims = box.getSize(new Vector3());
  const k = size ? realSizeScale({ x: dims.x, y: dims.y, z: dims.z }, size) : 1;
  const inner = new Group();
  inner.add(model);
  inner.position.y = -box.min.y;
  const outer = new Group();
  outer.add(inner);
  outer.scale.setScalar(k);
  return outer;
}

// ---------------------------------------------------------------- finishes and the kit

interface Finish {
  color: string;
  roughness: number;
  metalness: number;
  side?: Side;
}

const FINISH = {
  white: { color: '#dcd8cf', roughness: 0.7, metalness: 0.05 },
  grey: { color: '#9a968f', roughness: 0.6, metalness: 0.3 },
  metal: { color: '#8c8a86', roughness: 0.45, metalness: 0.6 },
  dark: { color: '#2b2c2f', roughness: 0.55, metalness: 0.2 },
  foil: { color: '#c9a560', roughness: 0.35, metalness: 0.7 },
  cell: { color: '#1f2738', roughness: 0.35, metalness: 0.4 },
  airbag: { color: '#cdc6b8', roughness: 0.95, metalness: 0 },
  shell: { color: '#d6cfc1', roughness: 0.85, metalness: 0.05, side: DoubleSide },
  copper: { color: '#b98a55', roughness: 0.4, metalness: 0.6 },
} satisfies Record<string, Finish>;

type FinishName = keyof typeof FINISH;

const DUST = new Color('#a97b56');

/** A finish under a layer of Martian dust (0 = clean, 1 = buried in it). */
function dusty(name: FinishName, amount: number): Finish & { key: string } {
  const c = new Color(FINISH[name].color).lerp(DUST, amount);
  return { ...FINISH[name], color: `#${c.getHexString()}`, roughness: Math.min(1, FINISH[name].roughness + 0.4 * amount), key: `${name}~${amount}` };
}

const UP = new Vector3(0, 1, 0);
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpS = new Vector3();
const tmpP = new Vector3();

/** Collects primitives per finish, then merges each finish into one mesh. */
class Kit {
  private parts = new Map<string, { finish: Finish; geoms: BufferGeometry[] }>();

  add(finish: FinishName | (Finish & { key: string }), geom: BufferGeometry, at: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scl: Vec3 = [1, 1, 1]): this {
    tmpE.set(rot[0], rot[1], rot[2]);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(tmpP.set(at[0], at[1], at[2]), tmpQ, tmpS.set(scl[0], scl[1], scl[2]));
    return this.addMatrix(finish, geom, tmpM);
  }

  addMatrix(finish: FinishName | (Finish & { key: string }), geom: BufferGeometry, m: Matrix4): this {
    const key = typeof finish === 'string' ? finish : finish.key;
    const f = typeof finish === 'string' ? FINISH[finish] : finish;
    const g = geom.index ? geom.toNonIndexed() : geom;
    if (g !== geom) geom.dispose();
    g.applyMatrix4(m);
    let part = this.parts.get(key);
    if (!part) {
      part = { finish: f, geoms: [] };
      this.parts.set(key, part);
    }
    part.geoms.push(g);
    return this;
  }

  /** A strut of radius r from a to b. */
  between(finish: FinishName | (Finish & { key: string }), a: Vec3, b: Vec3, r: number, seg = 8): this {
    const va = new Vector3(...a);
    const d = new Vector3(...b).sub(va);
    const len = d.length();
    tmpQ.setFromUnitVectors(UP, d.normalize());
    tmpM.compose(va.addScaledVector(d, len / 2), tmpQ, tmpS.set(1, 1, 1));
    return this.addMatrix(finish, new CylinderGeometry(r, r, len, seg), tmpM);
  }

  build(name: string): Group {
    const group = new Group();
    group.name = name;
    for (const { finish, geoms } of this.parts.values()) {
      const merged = mergeGeometries(geoms, false);
      for (const g of geoms) g.dispose();
      if (!merged) continue;
      const material = new MeshStandardMaterial({ color: finish.color, roughness: finish.roughness, metalness: finish.metalness });
      if (finish.side !== undefined) material.side = finish.side;
      const mesh = new Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 16, open = false) => new CylinderGeometry(rt, rb, h, seg, 1, open);

/** Dispose every geometry and material under an object (procedural models only; GLB caches are shared). */
export function disposeObject(root: Object3D) {
  root.traverse(o => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach(x => x.dispose());
    else if (mat) mat.dispose();
  });
}

/** Small seeded random numbers, so every build of a model is identical. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------- Ingenuity

/** Rotor diameter, m. */
export const INGENUITY_ROTOR_M = 1.2;

export interface IngenuityRig {
  /** Feet on the ground at y = 0, rotor span INGENUITY_ROTOR_M. */
  root: Group;
  /** Turn the coaxial rotors to an angle (radians): the lower one way, the upper the other. */
  setRotor(angle: number): void;
  /** Translucent discs that stand in for the blur of fast-spinning blades. */
  blur: [Mesh, Mesh];
  /** An empty marker at the end of the broken blade's stub; it turns with the rotor (null if not broken). */
  brokenTip: Object3D | null;
  /** Free what this rig owns (never the shared GLB geometry or materials). */
  dispose(): void;
}

function tipMarker(parent: Object3D, at: Vector3): Object3D {
  const o = new Object3D();
  o.name = 'broken-tip';
  o.position.copy(at);
  parent.add(o);
  return o;
}

function blurDiscs(root: Group, heights: [number, number]): [Mesh, Mesh] {
  const disc = (y: number) => {
    const m = new Mesh(
      new CircleGeometry(INGENUITY_ROTOR_M / 2, 40).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#35302b', transparent: true, opacity: 0, depthWrite: false }),
    );
    m.position.y = y;
    m.visible = false;
    root.add(m);
    return m;
  };
  return [disc(heights[0]), disc(heights[1])];
}

/**
 * The procedural stand-in (shown while the NASA model loads): 0.49 m tall, two coaxial 1.2 m
 * rotors, the solar panel on the mast. With `broken`, one upper blade ends in a jagged stub.
 */
export function buildIngenuity(broken: boolean): IngenuityRig {
  const rotorY: [number, number] = [0.36, 0.43];
  const body = new Kit()
    .add('white', box(0.2, 0.14, 0.17), [0, 0.255, 0])
    .add('foil', box(0.205, 0.035, 0.175), [0, 0.2, 0])
    .between('dark', [0, 0.32, 0], [0, 0.5, 0], 0.013)
    .add('cell', box(0.42, 0.012, 0.165), [0, 0.502, 0])
    .between('grey', [0.07, 0.508, 0.05], [0.07, 0.56, 0.05], 0.004, 5);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      body.between('metal', [sx * 0.07, 0.19, sz * 0.06], [sx * 0.27, 0.012, sz * 0.23], 0.008, 6);
      body.add('metal', new SphereGeometry(0.018, 8, 6), [sx * 0.27, 0.012, sz * 0.23]);
    }
  }
  const root = body.build('ingenuity');

  const base = [0.6, 2.1];
  let brokenTip: Object3D | null = null;
  const rotors = rotorY.map((y, i) => {
    const kit = new Kit().add('dark', cyl(0.03, 0.03, 0.03, 12), [0, 0, 0]);
    kit.add('dark', box(0.58, 0.008, 0.075), [0.31, 0, 0], [0.08, 0, 0]);
    if (broken && i === 1) {
      // A stub about 60 % long, with a jagged, angled break.
      kit.add('dark', box(0.34, 0.008, 0.075), [-0.19, 0, 0], [-0.08, 0, 0]);
      kit.add('dark', box(0.06, 0.008, 0.05), [-0.375, 0, 0.012], [-0.08, 0.5, 0]);
    } else {
      kit.add('dark', box(0.58, 0.008, 0.075), [-0.31, 0, 0], [-0.08, 0, 0]);
    }
    const g = kit.build(`rotor-${i}`);
    g.position.y = y;
    g.rotation.y = base[i];
    root.add(g);
    if (broken && i === 1) brokenTip = tipMarker(g, new Vector3(-0.39, 0, 0));
    return g;
  });
  const blur = blurDiscs(root, rotorY);

  return {
    root,
    blur,
    brokenTip,
    setRotor(a) {
      rotors[0].rotation.y = base[0] + a;
      rotors[1].rotation.y = base[1] - a;
    },
    dispose: () => disposeObject(root),
  };
}

const AXIS_X = new Vector3(1, 0, 0);
const spinQ = new Quaternion();

/**
 * Ingenuity from NASA's model. The rotors are separate nodes ("rotors_02" lower, "rotors_01"
 * upper) under the root "bus", whose local +X is the mast. With `broken`, the upper rotor's
 * blade geometry is copied and one blade clipped to a ragged stub about 55 % long: in January
 * 2024 Ingenuity's blades were damaged on landing after flight 72.
 */
export function ingenuityFromGltf(scene: Object3D, broken: boolean): IngenuityRig {
  const model = scene.clone(true);
  const ownedGeometry: BufferGeometry[] = [];
  const rotorNodes = [model.getObjectByName('rotors_02'), model.getObjectByName('rotors_01')];

  const upper = rotorNodes[1];
  let brokenTip: Object3D | null = null;
  if (broken && upper) {
    const meshes: Mesh[] = [];
    upper.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh && (m.material as Material).name === 'blades') meshes.push(m);
    });
    for (const m of meshes) {
      const g = m.geometry.clone();
      const tip = clipOneBlade(g);
      ownedGeometry.push(g);
      m.geometry = g;
      if (tip && !brokenTip) brokenTip = tipMarker(m, tip);
    }
  }

  const root = new Group();
  root.name = 'ingenuity';
  root.add(normalizeModel(model, MODEL_REGISTRY.ingenuity.size));
  root.updateMatrixWorld(true);

  const base = rotorNodes.map(n => (n ? { q: n.quaternion.clone(), p: n.position.clone() } : null));
  const heights = rotorNodes.map((n, i) => (n ? root.worldToLocal(n.getWorldPosition(new Vector3())).y : i === 0 ? 0.36 : 0.43)) as [
    number,
    number,
  ];
  const blur = blurDiscs(root, heights);

  return {
    root,
    blur,
    brokenTip,
    setRotor(a) {
      rotorNodes.forEach((n, i) => {
        const b = base[i];
        if (!n || !b) return;
        const angle = i === 0 ? a : -a;
        spinQ.setFromAxisAngle(AXIS_X, angle);
        n.quaternion.copy(spinQ).multiply(b.q);
        n.position.copy(b.p).applyAxisAngle(AXIS_X, angle);
      });
    },
    dispose() {
      for (const g of ownedGeometry) g.dispose();
      for (const b of blur) {
        b.geometry.dispose();
        (b.material as Material).dispose();
      }
    },
  };
}

/**
 * Clip the blade on one side of a two-blade rotor mesh (blades run along its longest axis).
 * Returns the middle of the break, in the geometry's own space.
 */
function clipOneBlade(g: BufferGeometry): Vector3 | null {
  const pos = g.getAttribute('position');
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb) return null;
  const size = bb.getSize(new Vector3());
  const axes = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a));
  const long = axes[0];
  const chord = axes[1];
  const centre = (bb.min.getComponent(long) + bb.max.getComponent(long)) / 2;
  const half = size.getComponent(long) / 2;
  const chordMid = (bb.min.getComponent(chord) + bb.max.getComponent(chord)) / 2;
  const chordHalf = Math.max(1e-6, size.getComponent(chord) / 2);
  const get = (i: number, c: number) => (c === 0 ? pos.getX(i) : c === 1 ? pos.getY(i) : pos.getZ(i));
  const set = (i: number, c: number, v: number) => {
    if (c === 0) pos.setX(i, v);
    else if (c === 1) pos.setY(i, v);
    else pos.setZ(i, v);
  };
  for (let i = 0; i < pos.count; i++) {
    const u = (get(i, chord) - chordMid) / chordHalf;
    // A ragged, angled break rather than a clean cut.
    const cut = centre - half * (0.55 + 0.05 * u + 0.025 * Math.sin(u * 9));
    if (get(i, long) < cut) set(i, long, cut);
  }
  pos.needsUpdate = true;
  const tip = bb.getCenter(new Vector3());
  tip.setComponent(long, centre - half * 0.55);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return tip;
}

/** The piece of rotor blade that broke off, lying on the sand. */
export function buildBladeFragment(): Group {
  return new Kit().add('dark', box(0.22, 0.008, 0.07), [0, 0.006, 0], [0.04, 0.3, 0.02]).build('blade-fragment');
}

// ---------------------------------------------------------------- landers and rovers

function vikingLander(): Group {
  const k = new Kit()
    .add('white', cyl(0.75, 0.75, 0.45, 6), [0, 0.85, 0])
    .add('foil', cyl(0.72, 0.72, 0.06, 6), [0, 0.6, 0])
    .add('grey', box(0.32, 0.28, 0.38), [0.35, 1.2, -0.15])
    .add('grey', box(0.32, 0.28, 0.38), [-0.3, 1.2, -0.3])
    .between('white', [-0.35, 1.07, 0.25], [-0.35, 1.78, 0.25], 0.035)
    .add('white', new SphereGeometry(0.42, 20, 6, 0, Math.PI * 2, 0, 0.6), [-0.35, 1.72, 0.25], [-0.7, 0, 0])
    .between('grey', [0.45, 1.07, 0.3], [0.45, 1.42, 0.3], 0.07, 10)
    .add('dark', box(0.13, 0.17, 0.13), [0.45, 1.5, 0.3])
    .between('grey', [-0.05, 1.07, 0.5], [-0.05, 1.42, 0.5], 0.07, 10)
    .add('dark', box(0.13, 0.17, 0.13), [-0.05, 1.5, 0.5])
    .between('metal', [0.6, 1.0, -0.35], [0.95, 1.55, -0.7], 0.02, 6)
    .add('grey', box(0.14, 0.08, 0.1), [0.95, 1.57, -0.7])
    .between('metal', [0.15, 0.95, 0.62], [0.55, 0.18, 1.9], 0.035, 8)
    .add('metal', box(0.14, 0.07, 0.2), [0.56, 0.12, 1.98]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const foot: Vec3 = [1.25 * Math.sin(a), 0.07, 1.25 * Math.cos(a)];
    k.between('metal', [0.62 * Math.sin(a), 0.72, 0.62 * Math.cos(a)], foot, 0.045);
    k.between('metal', [0.5 * Math.sin(a + 0.5), 0.66, 0.5 * Math.cos(a + 0.5)], foot, 0.022);
    k.between('metal', [0.5 * Math.sin(a - 0.5), 0.66, 0.5 * Math.cos(a - 0.5)], foot, 0.022);
    k.add('metal', cyl(0.17, 0.19, 0.06, 14), [foot[0], 0.03, foot[2]]);
  }
  return k.build('viking');
}

function sojourner(): Group {
  const k = new Kit()
    .add('white', box(0.48, 0.16, 0.36), [0, 0.22, 0])
    .add(dusty('cell', 0.45), box(0.62, 0.02, 0.46), [0, 0.31, 0])
    .between('grey', [0.15, 0.32, -0.12], [0.15, 0.55, -0.12], 0.006, 5);
  for (const x of [-0.24, 0, 0.24]) {
    for (const z of [-0.2, 0.2]) {
      k.add('metal', cyl(0.065, 0.065, 0.07, 14), [x, 0.065, z], [Math.PI / 2, 0, 0]);
    }
  }
  for (const z of [-0.2, 0.2]) k.add('grey', box(0.5, 0.025, 0.02), [0, 0.15, z], [0, 0, 0.08]);
  return k.build('sojourner');
}

/** Mars Pathfinder's lander with its petals open and airbags deflated, and Sojourner nearby. */
function pathfinder(): Group {
  const k = new Kit()
    .add('foil', cyl(0.62, 0.62, 0.36, 3), [0, 0.3, 0])
    .between('grey', [0, 0.48, 0], [0, 1.02, 0], 0.03)
    .add('dark', box(0.24, 0.12, 0.13), [0, 1.08, 0])
    .between('grey', [0.3, 0.48, -0.2], [0.3, 0.62, -0.2], 0.02)
    .add('white', cyl(0.15, 0.12, 0.04, 14), [0.3, 0.66, -0.2], [0.5, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    // An open petal: a flat triangle of solar cells hinged at the base.
    k.add(dusty('cell', 0.4), cyl(0.95, 0.95, 0.04, 3), [0.78 * Math.sin(a), 0.1, 0.78 * Math.cos(a)], [0, a + Math.PI, 0]);
    // Deflated airbags bunched against the petal edges.
    for (const s of [-1, 1]) {
      const b = a + s * 0.62;
      k.add('airbag', new SphereGeometry(0.36, 12, 8), [1.15 * Math.sin(b), 0.12, 1.15 * Math.cos(b)], [0, b, 0], [1.1, 0.35, 0.8]);
    }
  }
  k.add('metal', box(0.5, 0.02, 1.0), [0.95 * Math.sin(Math.PI / 3), 0.08, 0.95 * Math.cos(Math.PI / 3) + 0.4], [0.18, Math.PI / 3, 0]);
  const g = k.build('pathfinder');
  const rover = sojourner();
  rover.position.set(-2.6, 0, 0.5);
  rover.rotation.y = 1.1;
  g.add(rover);
  return g;
}

/** A Mars Exploration Rover, dusty. (Spirit's stuck pose comes from the registry.) */
function merRover(dust: number): Group {
  const panel = dusty('cell', dust);
  const k = new Kit()
    .add('white', box(0.9, 0.32, 1.1), [0, 0.55, 0])
    .add(panel, box(1.15, 0.03, 1.25), [0, 0.74, 0])
    .add(panel, box(0.6, 0.03, 0.85), [-0.88, 0.74, -0.1])
    .add(panel, box(0.6, 0.03, 0.85), [0.88, 0.74, -0.1])
    .add(panel, box(0.9, 0.03, 0.45), [0, 0.74, -0.85])
    .between('white', [0.3, 0.76, 0.42], [0.3, 1.42, 0.42], 0.035)
    .add('grey', box(0.32, 0.09, 0.1), [0.3, 1.48, 0.42])
    .add('dark', box(0.06, 0.04, 0.02), [0.2, 1.48, 0.475])
    .add('dark', box(0.06, 0.04, 0.02), [0.4, 1.48, 0.475])
    .between('white', [-0.3, 0.76, 0.1], [-0.3, 0.9, 0.1], 0.02)
    .add('white', cyl(0.14, 0.14, 0.03, 18), [-0.3, 0.94, 0.1], [0.5, 0, 0])
    .between('grey', [-0.15, 0.76, -0.3], [-0.15, 1.2, -0.3], 0.006, 5)
    .add('white', box(0.06, 0.06, 0.5), [0, 0.42, 0.66]);
  for (const x of [-0.62, 0.62]) {
    k.add('metal', box(0.04, 0.04, 1.2), [x, 0.36, 0], [0.06, 0, 0]);
    for (const z of [-0.55, 0, 0.55]) {
      k.add('metal', cyl(0.13, 0.13, 0.16, 16), [x, 0.13, z], [0, 0, Math.PI / 2]);
      k.add('metal', box(0.04, 0.22, 0.04), [x, 0.26, z]);
    }
  }
  return k.build('mer');
}

/** Phoenix or InSight: a deck on three legs between two round solar arrays. */
function roundPanelLander(kind: 'phoenix' | 'insight'): Group {
  const insight = kind === 'insight';
  const deckR = insight ? 0.78 : 0.75;
  const panelR = insight ? 1.1 : 1.0;
  const dust = insight ? 0.9 : 0.35;
  const k = new Kit()
    .add('white', cyl(deckR, deckR, 0.22, 10), [0, 0.95, 0])
    .add('foil', cyl(deckR * 0.96, deckR * 0.9, 0.12, 10), [0, 0.78, 0]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const foot: Vec3 = [(deckR + 0.35) * Math.sin(a), 0.05, (deckR + 0.35) * Math.cos(a)];
    k.between('metal', [deckR * 0.8 * Math.sin(a), 0.85, deckR * 0.8 * Math.cos(a)], foot, 0.04);
    k.add('metal', cyl(0.14, 0.16, 0.05, 12), [foot[0], 0.025, foot[2]]);
  }
  const cells = dusty('cell', dust);
  for (const s of [-1, 1]) {
    const x = s * (deckR + panelR + 0.04);
    if (!insight && s === 1) {
      // Phoenix's arrays were built for one Martian summer. Orbital images from 2010 suggest the
      // winter's CO2 ice broke them; here one array sags, cracked (illustrative).
      k.add(cells, new CylinderGeometry(panelR, panelR, 0.035, 10, 1, false, 0, Math.PI * 1.55), [x - 0.1, 0.72, 0], [0, 0, -0.42]);
    } else {
      k.add(cells, cyl(panelR, panelR, 0.035, 10), [x, 0.98, 0]);
    }
    k.between('metal', [s * deckR, 0.95, 0], [x, 0.95, 0], 0.025, 6);
  }
  if (insight) {
    // SEIS under its domed wind and thermal shield, the heat-flow probe, and the arm.
    k.add('copper', new SphereGeometry(0.36, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), [0.25, 0, 1.75]);
    k.add('foil', box(0.26, 0.3, 0.3), [-0.95, 0.15, 1.55]);
    k.between('dark', [0.1, 0.85, deckR * 0.9], [0.25, 0.02, 1.4], 0.01, 5);
    k.between('white', [-0.2, 1.06, deckR * 0.9], [-0.35, 1.55, 1.25], 0.04);
    k.between('white', [-0.35, 1.55, 1.25], [-0.5, 1.2, 1.75], 0.035);
    k.add('dark', box(0.12, 0.1, 0.12), [-0.5, 1.13, 1.78]);
    k.between('grey', [0.35, 1.06, -0.3], [0.35, 1.22, -0.3], 0.03);
  } else {
    // The camera mast and the weather mast. The digging arm is built apart (below) so it can move.
    k.between('white', [0.35, 1.06, 0.3], [0.35, 1.95, 0.3], 0.03);
    k.add('grey', box(0.2, 0.16, 0.16), [0.35, 2.03, 0.3]);
    k.between('grey', [0.55, 1.06, -0.4], [0.55, 1.95, -0.4], 0.012, 5);
    k.between('grey', [0, 1.06, -0.4], [0, 1.28, -0.4], 0.035);
  }
  const g = k.build(kind);
  if (!insight) g.add(phoenixArm());
  return g;
}

/** Where Phoenix's robotic arm meets the deck (its shoulder), lander-local. */
export const PHOENIX_SHOULDER: Vec3 = [-0.3, 1.06, 0.6];

/**
 * Phoenix's robotic arm reaching to the ground, as its own group ("phoenix-arm") pivoting at the
 * shoulder, so the scoop can be animated. "phoenix-scoop" marks the scoop's tip.
 */
function phoenixArm(): Group {
  const [sx, sy, sz] = PHOENIX_SHOULDER;
  const at = (p: Vec3): Vec3 => [p[0] - sx, p[1] - sy, p[2] - sz];
  const arm = new Kit()
    .between('white', at([-0.3, 1.06, 0.6]), at([-0.4, 1.5, 1.3]), 0.04)
    .between('white', at([-0.4, 1.5, 1.3]), at([-0.5, 0.15, 1.9]), 0.035)
    .add('metal', box(0.12, 0.08, 0.16), at([-0.5, 0.1, 1.95]))
    .build('phoenix-arm');
  arm.position.set(sx, sy, sz);
  const tip = new Object3D();
  tip.name = 'phoenix-scoop';
  tip.position.set(...at([-0.5, 0.06, 1.95]));
  arm.add(tip);
  return arm;
}

let goreMap: CanvasTexture | null = null;

/**
 * The canopy's gore pattern as a texture on the ring's own UVs (RingGeometry maps the flat ring
 * across the unit square), with the same rule as the vertex colours: 80 gores, bands every 2.1 m.
 * Each pixel takes the colour at its own point, so the gore edges stay crisp; mipmaps keep them
 * clean from afar. Built once and shared.
 */
function goreTexture(outer: number, orange: Color, white: Color): CanvasTexture | null {
  if (goreMap) return goreMap;
  // No DOM (unit tests): the canopy keeps its vertex colours.
  if (typeof document === 'undefined') return null;
  const N = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(N, N);
  const rgb = (c: Color) => [(c.getHex() >> 16) & 255, (c.getHex() >> 8) & 255, c.getHex() & 255];
  const [o, w] = [rgb(orange), rgb(white)];
  for (let r = 0; r < N; r++) {
    // Canvas row 0 is the top of the texture (v = 1).
    const yRing = (2 * (1 - (r + 0.5) / N) - 1) * outer;
    for (let c = 0; c < N; c++) {
      const x = (2 * ((c + 0.5) / N) - 1) * outer;
      const z = -yRing; // the ring is turned flat with rotateX(-90°): its +Y becomes -Z
      const th = Math.atan2(z, x);
      const gore = Math.floor(((th + Math.PI) / (Math.PI * 2)) * 80);
      const band = Math.min(3, Math.floor(Math.hypot(x, z) / 2.1));
      const px = (gore * 7 + band * 3) % 5 < 2 ? o : w;
      const i = (r * N + c) * 4;
      img.data[i] = px[0];
      img.data[i + 1] = px[1];
      img.data[i + 2] = px[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  goreMap = new CanvasTexture(canvas);
  goreMap.colorSpace = SRGBColorSpace;
  goreMap.anisotropy = 8;
  return goreMap;
}

/** Perseverance's backshell, upright and dented, with the 21.5 m parachute spread out behind it. */
function backshellAndChute(): Group {
  const r = rng(2021);
  const shellGeom = new CylinderGeometry(0.85, 2.25, 1.35, 40, 6, true);
  const pos = shellGeom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    // Dents from a 126 km/h impact.
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const dent = 1 - 0.06 * Math.max(0, Math.sin(x * 2.1 + z * 1.3)) * (0.6 - y / 1.35);
    pos.setXYZ(i, x * dent, y, z * dent);
  }
  const k = new Kit()
    .add('shell', shellGeom, [0, 0.55, 0], [0.12, 0, -0.16])
    .add('dark', cyl(2.27, 2.3, 0.08, 40, true), [0.11, -0.1, -0.08], [0.12, 0, -0.16])
    .add('shell', cyl(0.85, 0.85, 0.12, 32), [-0.11, 1.26, -0.09], [0.12, 0, -0.16])
    .add('grey', cyl(0.5, 0.55, 0.3, 24), [-0.14, 1.45, -0.11], [0.12, 0, -0.16]);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = 2.7 + r() * 2.5;
    k.add(i % 2 ? 'shell' : 'dark', box(0.15 + r() * 0.35, 0.03, 0.1 + r() * 0.25), [d * Math.sin(a), 0.02, d * Math.cos(a)], [0, r() * 3, 0.1]);
  }
  const g = k.build('backshell');

  // The canopy: gores of orange and white, folded and dusty. Real diameter 21.5 m; here it lies
  // partly bunched up, about 16 m across.
  const chuteR = 8;
  const geom = new RingGeometry(0.5, chuteR, 96, 22).rotateX(-Math.PI / 2);
  const p = geom.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const orange = new Color('#c9562d').lerp(DUST, 0.3);
  const white = new Color('#e6dfd2').lerp(DUST, 0.3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const rad = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    const rim = rad * (1 + 0.07 * Math.sin(th * 5 + 1.3) + 0.04 * Math.sin(th * 11));
    const fold = 0.07 * Math.abs(Math.sin(th * 14 + rad * 0.55)) + 0.3 * Math.exp(-((x - 2) ** 2 + (z - 1) ** 2) / 5);
    const nx = (rim / Math.max(rad, 1e-6)) * x;
    const nz = (rim / Math.max(rad, 1e-6)) * z * 0.72;
    p.setXYZ(i, nx, 0.03 + fold * (1 - 0.6 * (rad / chuteR)), nz);
    const gore = Math.floor(((th + Math.PI) / (Math.PI * 2)) * 80);
    const band = Math.min(3, Math.floor(rad / 2.1));
    const c = (gore * 7 + band * 3) % 5 < 2 ? orange : white;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  // The gores are drawn from a texture, not the vertex colours: 80 gores on a 96-segment ring cannot
  // be coloured per vertex without their edges smearing into zigzags. The geometry (and its colour
  // attribute) stays exactly as it was, for the decode overlay and the story anchors.
  const gores = goreTexture(chuteR, orange, white);
  const chute = new Mesh(
    geom,
    new MeshStandardMaterial({ map: gores, vertexColors: gores === null, roughness: 0.92, metalness: 0, side: DoubleSide }),
  );
  chute.name = 'parachute';
  chute.position.set(-1.5, 0, -8.2);
  chute.rotation.y = 0.12;
  chute.receiveShadow = true;
  g.add(chute);

  // Suspension lines from the backshell to the near edge of the canopy.
  const lines: number[] = [];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (i / 13 - 0.5) * 1.6;
    lines.push(-0.1 + 0.4 * Math.cos(a * 3), 1.45, -0.1, -1.5 + chuteR * 0.9 * Math.cos(a), 0.05, -8.2 + chuteR * 0.65 * Math.sin(a) + 1.2);
  }
  const lg = new BufferGeometry();
  lg.setAttribute('position', new Float32BufferAttribute(lines, 3));
  g.add(new LineSegments(lg, new LineBasicMaterial({ color: '#d8cfbd', transparent: true, opacity: 0.45 })));
  return g;
}

/** A procedural stand-in for a machine, at real size. Ingenuity's home has no other machine. */
export function buildPlaceholder(id: MachineId): Group {
  switch (id) {
    case 'viking-1':
    case 'viking-2':
      return vikingLander();
    case 'pathfinder-sojourner':
      return pathfinder();
    case 'spirit':
      return merRover(0.55);
    case 'opportunity':
      return merRover(0.85);
    case 'phoenix':
      return roundPanelLander('phoenix');
    case 'insight':
      return roundPanelLander('insight');
    case 'mars2020-edl':
      return backshellAndChute();
    case 'ingenuity':
      return new Group();
  }
}
