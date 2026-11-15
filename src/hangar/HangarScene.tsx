// The hangar's 3D: the machines loaded from the same GLB cache as the sites, built into one
// arrangement, and shown either in the sandbox (orbit, a gridded floor, day or night light) or in
// WebXR on a real table (reticle, tap to place, shadows on the table, the room's own light).

import { Grid, OrbitControls, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  Vector3,
  type DirectionalLight,
  type Group,
  type HemisphereLight,
  type LightProbe,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MODEL_REGISTRY } from '../scene/models';
import { MarsEnvironment } from '../scene/MarsEnvironment';
import type { MachineId } from '../types';
import { arrange, prepareModel, type PreparedModel } from './build';
import { useHangar, type HangarLight } from './hangarStore';
import { freeArea, pickIds, viewFor, type V3 } from './layout';
import { lightEstimate, updateHit, xrRuntime } from './xr';

/** Ingenuity's rotors in the hangar, rad/s: slow enough to see the broken blade go round. */
const ROTOR_SPEED = 1.6;

const urlOf = (id: MachineId) => MODEL_REGISTRY[id].url ?? null;

// ---------------------------------------------------------------- loading and building

type OnScene = (url: string, scene: Object3D | null) => void;

function GltfSource({ url, onScene }: { url: string; onScene: OnScene }) {
  // The site's own loader settings, so the hangar shares its cache (meshopt, no CDN decoders).
  const { scene } = useGLTF(url, false, true);
  useEffect(() => onScene(url, scene), [url, scene, onScene]);
  return null;
}

/** A GLB that fails to load reports null, and its machine falls back to the procedural silhouette. */
class SourceBoundary extends Component<{ url: string; onScene: OnScene; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onScene(this.props.url, null);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Loads what the current pick needs and publishes the arrangement to the hangar store. The last
 * arrangement stays up while the next loads. Prepared models are kept for the visit (switching
 * back is instant) and freed when the hangar closes.
 */
function HangarModels() {
  const pick = useHangar(s => s.pick);
  const scale = useHangar(s => s.scale);
  const setArrangement = useHangar(s => s.setArrangement);
  const [scenes, setScenes] = useState<Record<string, Object3D | null>>({});
  const onScene = useCallback<OnScene>((url, scene) => setScenes(s => (url in s && s[url] === scene ? s : { ...s, [url]: scene })), []);
  const urls = useMemo(() => [...new Set(pickIds(pick).map(urlOf).filter((u): u is string => !!u))], [pick]);
  const ready = urls.every(u => u in scenes);
  const cache = useRef(new Map<string, PreparedModel>());

  useEffect(() => {
    if (!ready) return;
    const models = pickIds(pick).map(id => {
      const url = urlOf(id);
      const scene = url ? (scenes[url] ?? null) : null;
      const key = `${id}:${scene ? scene.uuid : 'silhouette'}`;
      let m = cache.current.get(key);
      if (!m) {
        m = prepareModel(id, scene);
        cache.current.set(key, m);
      }
      return m;
    });
    setArrangement(arrange(models, pick, scale));
  }, [ready, pick, scale, scenes, setArrangement]);

  // Free everything once the hangar has really closed (StrictMode re-mounts at once in dev).
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    const models = cache.current;
    return () => {
      alive.current = false;
      setTimeout(() => {
        if (alive.current) return;
        useHangar.getState().setArrangement(null);
        for (const m of models.values()) m.dispose();
        models.clear();
      }, 0);
    };
  }, []);

  return (
    <>
      {urls.map(url => (
        <SourceBoundary key={url} url={url} onScene={onScene}>
          <Suspense fallback={null}>
            <GltfSource url={url} onScene={onScene} />
          </Suspense>
        </SourceBoundary>
      ))}
    </>
  );
}

/** Ingenuity's coaxial rotors turn (the broken blade with them), from frame time, so a pause holds them. */
function RotorSpin() {
  const angle = useRef(0);
  useFrame((_, delta) => {
    const arr = useHangar.getState().arrangement;
    if (!arr) return;
    angle.current = (angle.current + Math.min(delta, 0.1) * ROTOR_SPEED) % (Math.PI * 2);
    for (const rig of arr.rigs) rig.setRotor(angle.current);
  });
  return null;
}

/** Fit a directional light's shadow camera round an arrangement of `size`, `dist` away. */
function fitShadow(light: DirectionalLight, size: V3, dist: number) {
  const [w, h, d] = size;
  const half = Math.max(w, d) / 2 + h * 0.6;
  const cam = light.shadow.camera;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = dist * 0.05;
  cam.far = dist * 2 + Math.max(w, h, d) * 2;
  cam.updateProjectionMatrix();
  const span = Math.max(w, h, d);
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = span * 0.004;
  light.shadow.needsUpdate = true;
}

// ---------------------------------------------------------------- the sandbox

interface Look {
  background: string;
  floor: string;
  cell: string;
  section: string;
  hemi: [string, string, number];
  key: { color: string; intensity: number; dir: V3 };
  fill: { color: string; intensity: number; dir: V3 };
}

/** Day: a bright studio with a warm sun. Night: moonlight from one side, a warm desk lamp from the other. */
export const LOOKS: Record<HangarLight, Look> = {
  day: {
    background: '#cfc6b8',
    floor: '#b3a48f',
    cell: '#9a8b76',
    section: '#6e604d',
    hemi: ['#fff6e8', '#6d5c48', 1.25],
    key: { color: '#fff0d6', intensity: 2.6, dir: [0.55, 1, 0.7] },
    fill: { color: '#cfe0ff', intensity: 0.35, dir: [-0.8, 0.5, -0.4] },
  },
  night: {
    background: '#06080c',
    floor: '#1a1714',
    cell: '#2a251f',
    section: '#43392d',
    hemi: ['#2a3b5e', '#040506', 0.32],
    key: { color: '#ffb36b', intensity: 2.1, dir: [0.95, 0.5, 0.75] },
    fill: { color: '#93acff', intensity: 0.5, dir: [-0.6, 1, -0.3] },
  },
};

function Framer() {
  const arr = useHangar(s => s.arrangement);
  const camera = useThree(s => s.camera) as PerspectiveCamera;
  const controls = useThree(s => s.controls) as OrbitControlsImpl | null;
  const width = useThree(s => s.size.width);
  const height = useThree(s => s.size.height);
  const frameKey = arr ? `${arr.pick}:${arr.scaleMode}` : '';

  // Centre the picture in the part of the screen the panels leave free (the orbit still turns
  // about the model). Cleared on unmount, so AR and a later visit start from a plain camera.
  useEffect(() => {
    const free = freeArea(width, height);
    camera.setViewOffset(width, height, -free.shiftX, free.shiftY, width, height);
    camera.updateProjectionMatrix();
  }, [camera, width, height]);
  useEffect(
    () => () => {
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    },
    [camera],
  );

  useEffect(() => {
    if (!arr) return;
    // A long row fits the width the panels leave free, not the whole canvas.
    const free = freeArea(width, height);
    const v = viewFor(arr.layout.size, camera.fov, (width / Math.max(1, height)) * free.widthShare);
    const back = free.zoomOut;
    for (let i = 0; i < 3; i++) v.position[i] = v.target[i] + (v.position[i] - v.target[i]) * back;
    camera.position.set(...v.position);
    camera.near = v.near;
    camera.far = v.far;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(...v.target);
      controls.minDistance = v.minDistance;
      controls.maxDistance = v.maxDistance;
      controls.update();
    } else {
      camera.lookAt(...v.target);
    }
    // Reframe only when what is shown changes (pick or scale), not on every rebuild of the same one.
  }, [frameKey, controls]);
  return null;
}

function Sandbox() {
  const arr = useHangar(s => s.arrangement);
  const light = useHangar(s => s.light);
  const scale = useHangar(s => s.scale);
  const look = LOOKS[light];
  const size: V3 = arr?.layout.size ?? [0.3, 0.3, 0.3];
  const span = Math.max(...size);
  const dist = span * 3;
  const key = useRef<DirectionalLight>(null);
  const keyPos = new Vector3(...look.key.dir).normalize().multiplyScalar(dist);
  const fillPos = new Vector3(...look.fill.dir).normalize().multiplyScalar(dist);

  useEffect(() => {
    if (key.current) fitShadow(key.current, size, dist);
  });

  const cell = scale === 'table' ? 0.1 : 1;
  return (
    <>
      <color attach="background" args={[look.background]} />
      <hemisphereLight args={look.hemi} />
      <directionalLight
        ref={key}
        position={keyPos}
        color={look.key.color}
        intensity={look.key.intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={fillPos} color={look.fill.color} intensity={look.fill.intensity} />
      {arr && <primitive object={arr.root} />}
      <mesh rotation-x={-Math.PI / 2} position-y={-span * 0.002} receiveShadow>
        <circleGeometry args={[Math.max(span * 3, cell * 6), 64]} />
        <meshStandardMaterial color={look.floor} roughness={0.95} metalness={0} />
      </mesh>
      <Grid
        position-y={span * 0.0005}
        args={[1, 1]}
        infiniteGrid
        cellSize={cell}
        sectionSize={cell * 10}
        cellThickness={0.6}
        sectionThickness={1.1}
        cellColor={look.cell}
        sectionColor={look.section}
        fadeDistance={Math.max(span * 6, cell * 40)}
        fadeStrength={1.5}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} rotateSpeed={0.6} maxPolarAngle={Math.PI / 2 - 0.04} />
      <Framer />
    </>
  );
}

// ---------------------------------------------------------------- WebXR on a real table

/** A flat ring with a dot, and the footprint the models will take, on the surface under the screen centre. */
function useReticle(size: V3) {
  const outline = useMemo(() => {
    const [w, , d] = size;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2], 3));
    return new LineLoop(g, new LineBasicMaterial({ color: '#f2a93b', transparent: true, opacity: 0.7 }));
  }, [size]);
  useEffect(
    () => () => {
      outline.geometry.dispose();
      (outline.material as LineBasicMaterial).dispose();
    },
    [outline],
  );
  return outline;
}

const DEFAULT_SUN: V3 = [0.35, 1, 0.25];
const tmpDir = new Vector3();

function ArStage() {
  const arr = useHangar(s => s.arrangement);
  const size: V3 = arr?.layout.size ?? [0.28, 0.2, 0.28];
  const span = Math.max(...size);
  const placed = useRef<Group>(null);
  const reticle = useRef<Group>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const probe = useRef<LightProbe>(null);
  const outline = useReticle(size);
  const dist = Math.max(span * 3, 0.6);

  useEffect(() => {
    if (sun.current && placed.current) sun.current.target = placed.current;
  }, []);
  useEffect(() => {
    if (sun.current) fitShadow(sun.current, size, dist);
  });

  useFrame((state, _delta, frame?: XRFrame) => {
    const g = placed.current, r = reticle.current, l = sun.current;
    if (!frame || !g || !r || !l) return;
    const xr = useHangar.getState().xr;
    const hit = updateHit(frame, state.gl.xr.getReferenceSpace(), state.camera.position);
    r.visible = xr === 'scanning' && !!hit;
    if (hit) {
      r.matrix.copy(hit);
      r.matrixWorldNeedsUpdate = true;
    }
    const anchor = xrRuntime()?.anchor;
    g.visible = xr === 'placed' && !!anchor;
    if (anchor) {
      g.position.copy(anchor.position);
      g.rotation.set(0, anchor.yaw, 0);
    }

    // The room's light when the phone estimates it; a soft overhead light otherwise.
    const est = lightEstimate(frame);
    if (est && probe.current && hemi.current) {
      probe.current.sh.fromArray(est.sphericalHarmonicsCoefficients);
      probe.current.intensity = 1;
      hemi.current.intensity = 0.15;
      const i = est.primaryLightIntensity;
      const k = Math.max(1, i.x, i.y, i.z);
      l.color.setRGB(i.x / k, i.y / k, i.z / k);
      l.intensity = k;
      tmpDir.set(est.primaryLightDirection.x, est.primaryLightDirection.y, est.primaryLightDirection.z);
      if (tmpDir.y < 0.2) tmpDir.y = 0.2; // a shadow cast from below the table would be nonsense
    } else {
      tmpDir.set(...DEFAULT_SUN);
    }
    l.position.copy(g.position).addScaledVector(tmpDir.normalize(), dist);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#7a6a58', 1.1]} />
      <lightProbe ref={probe} intensity={0} />
      <directionalLight ref={sun} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} />
      <group ref={reticle} matrixAutoUpdate={false} visible={false}>
        <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
          <ringGeometry args={[0.05, 0.064, 48]} />
          <meshBasicMaterial color="#f2a93b" transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
          <circleGeometry args={[0.009, 20]} />
          <meshBasicMaterial color="#f2a93b" transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <primitive object={outline} />
      </group>
      <group ref={placed} visible={false}>
        {arr && <primitive object={arr.root} />}
        {/* Invisible except for the shadows: the models darken the real table under them. */}
        <mesh rotation-x={-Math.PI / 2} position-y={0.0005} receiveShadow renderOrder={-1}>
          <planeGeometry args={[size[0] * 1.8 + span * 0.6, size[2] * 1.8 + span * 0.6]} />
          <shadowMaterial transparent opacity={0.32} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

export function HangarScene() {
  const inAr = useHangar(s => s.xr !== 'off');
  const light = useHangar(s => s.light);
  return (
    <>
      <MarsEnvironment light={light} />
      <HangarModels />
      <RotorSpin />
      {inAr ? <ArStage /> : <Sandbox />}
    </>
  );
}
