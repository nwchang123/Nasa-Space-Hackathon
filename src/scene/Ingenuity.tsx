// Ingenuity: one object for the whole flight. Its pose blends between the globe (riding its arc,
// a symbol 0.035 of the radius across, or resting at home) and the site diorama (at real size,
// hovering over or standing on its landing spot), with the same blend as the camera, so the dive
// into a site and the climb out of it are one continuous move. NASA's model (preloaded at start),
// with the procedural stand-in while it loads. Its blade stays broken throughout: the flight is
// imagined, the damage is real.

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Quaternion, Vector3, type Group, type Material, type Mesh, type MeshBasicMaterial } from 'three';
import { blendAbout, GLOBE_R, smoothstep, SITE_SCALE, type Vec3 } from './layout';
import { buildIngenuity, INGENUITY_ROTOR_M, ingenuityFromGltf, MODEL_REGISTRY, type IngenuityRig } from './models';
import { live } from './registry';
import { SITE_PRESETS, siteLayout } from './sites';
import { useReducedMotion } from './useReducedMotion';

const URL = MODEL_REGISTRY.ingenuity.url;
if (URL) useGLTF.preload(URL, false, true);

/** Rotor span on the globe, as a fraction of the radius: a symbol (to scale it would be 0.00035). */
const GLOBE_SPAN = 0.035;
const GLOBE_SCALE = (GLOBE_SPAN * GLOBE_R) / INGENUITY_ROTOR_M;
/** Full rotor speed on screen, rad/s (the real 2,400+ rpm would only strobe). */
const SPIN = 38;

type RigSink = (rig: IngenuityRig | null) => void;

/** Ingenuity's materials ignore the site fog: it is always close to the camera. */
function noFog(rig: IngenuityRig) {
  rig.root.traverse(o => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    if (!m) return;
    for (const x of Array.isArray(m) ? m : [m]) if ('fog' in x) (x as Material & { fog: boolean }).fog = false;
  });
}

function useRig(rig: IngenuityRig, sink: RigSink) {
  useLayoutEffect(() => {
    noFog(rig);
    sink(rig);
    return () => {
      sink(null);
      rig.dispose();
    };
  }, [rig, sink]);
}

function ProceduralRig({ sink }: { sink: RigSink }) {
  const rig = useMemo(() => buildIngenuity(true), []);
  useRig(rig, sink);
  return <primitive object={rig.root} />;
}

function NasaRig({ url, sink }: { url: string; sink: RigSink }) {
  const { scene } = useGLTF(url, false, true);
  const rig = useMemo(() => {
    const r = ingenuityFromGltf(scene, true);
    r.root.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh && m.material !== undefined && !(m.material as MeshBasicMaterial).transparent) m.castShadow = true;
    });
    return r;
  }, [scene]);
  useRig(rig, sink);
  return <primitive object={rig.root} />;
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

const posA = new Vector3();
const quatA = new Quaternion();
const posB = new Vector3();
const quatB = new Quaternion();
const yawQ = new Quaternion();
const Y = new Vector3(0, 1, 0);

export function Ingenuity() {
  const group = useRef<Group>(null);
  const rig = useRef<IngenuityRig | null>(null);
  const angle = useRef(0);
  const reduced = useReducedMotion();
  const sink = useMemo<RigSink>(() => r => (rig.current = r), []);
  useEffect(() => () => void (rig.current = null), []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const shot = live.shot;
    g.visible = shot.ingenuity;
    if (!shot.ingenuity) return;

    // Globe end: on its arc, or resting at home.
    let scaleA = GLOBE_SCALE;
    if (shot.arc && live.arc.valid) {
      posA.copy(live.arc.pos);
      quatA.copy(live.arc.quat);
    } else {
      posA.copy(live.rest.pos);
      quatA.copy(live.rest.quat);
    }

    // Site end: hovering over / standing on its spot, at real size.
    let w = 0;
    if (shot.siteId && shot.blend > 0 && live.site.valid) {
      w = shot.blend;
      const lay = siteLayout(SITE_PRESETS[shot.siteId]);
      posB.set(lay.ingenuity[0], shot.hover, lay.ingenuity[2]).applyMatrix4(live.site.matrix);
      quatB.copy(live.site.quat).multiply(yawQ.setFromAxisAngle(Y, lay.machineYaw + 0.5));
      const pivot: Vec3 = [live.site.point.x, live.site.point.y, live.site.point.z];
      g.position.set(...blendAbout([posA.x, posA.y, posA.z], [posB.x, posB.y, posB.z], w, pivot));
      g.quaternion.slerpQuaternions(quatA, quatB, smoothstep(0, 1, w));
      scaleA = Math.exp(Math.log(GLOBE_SCALE) * (1 - w) + Math.log(SITE_SCALE) * w);
    } else {
      g.position.copy(posA);
      g.quaternion.copy(quatA);
    }
    g.scale.setScalar(scaleA);

    const r = rig.current;
    if (!r) return;
    const speed = reduced ? 0 : shot.rotor;
    angle.current += SPIN * speed * delta;
    r.setRotor(angle.current);
    const blur = reduced ? 0 : smoothstep(0.35, 0.9, speed);
    for (const b of r.blur) {
      b.visible = blur > 0.01;
      (b.material as MeshBasicMaterial).opacity = 0.32 * blur;
    }
  });

  const procedural = <ProceduralRig sink={sink} />;
  return (
    <group ref={group} visible={false}>
      {URL ? (
        <KeepFallback fallback={procedural}>
          <Suspense fallback={procedural}>
            <NasaRig url={URL} sink={sink} />
          </Suspense>
        </KeepFallback>
      ) : (
        procedural
      )}
    </group>
  );
}
