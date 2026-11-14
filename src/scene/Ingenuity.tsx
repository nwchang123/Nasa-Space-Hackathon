// Ingenuity: one flyer for the whole flight. Its pose blends between the globe (riding its arc,
// a symbol 0.035 of the radius across, or resting at home) and the site diorama (at real size,
// hovering over or standing on its landing spot), with the same blend as the camera, so the dive
// into a site and the climb out of it are one continuous move. NASA's model (preloaded at start),
// with the procedural stand-in while it loads.
//
// The real Ingenuity's blade is broken, and it stays broken. Before take-off the visitor tries
// its rotors (the prologue's rotor test: spin-up, stall, judder, wind-down). At lift-off the real
// one stays at home, still and broken, and the flyer becomes Flight 73's phantom: amber-gold,
// whole blades (see phantom.ts). Back home the phantom settles onto the real one and fades into it.

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Quaternion, Vector3, type Group, type Material, type Mesh, type MeshBasicMaterial, type ShaderMaterial } from 'three';
import { HOME } from '../flight/route';
import { stageElapsed, useApp } from '../store';
import { blendAbout, GLOBE_R, smoothstep, SITE_SCALE, type Vec3 } from './layout';
import { buildIngenuity, INGENUITY_ROTOR_M, ingenuityFromGltf, MODEL_REGISTRY, type IngenuityRig } from './models';
import { phantomLook, phantomMaterial } from './phantom';
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
/** The rotor fault's shake, radians at full judder. */
const JUDDER_TILT = 0.03;

type Variant = 'real' | 'phantom';
/** A rig, with the phantom's material when it is the phantom. */
interface Rig extends IngenuityRig {
  phantom: ShaderMaterial | null;
}
type RigSink = (rig: Rig | null) => void;

/** Ingenuity's materials ignore the site fog: it is always close to the camera. */
function noFog(rig: IngenuityRig) {
  rig.root.traverse(o => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    if (!m) return;
    for (const x of Array.isArray(m) ? m : [m]) if ('fog' in x) (x as Material & { fog: boolean }).fog = false;
  });
}

/**
 * Dress a rig as the phantom: every surface in the hologram material (no shadows), the blur discs
 * tinted amber. `ownsMaterials`: the procedural rig's own materials can be freed; NASA's are shared.
 */
function asPhantom(rig: IngenuityRig, ownsMaterials: boolean): Rig {
  const mat = phantomMaterial();
  const blur = new Set<Mesh>(rig.blur);
  rig.root.traverse(o => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    m.receiveShadow = false;
    if (blur.has(m)) {
      (m.material as MeshBasicMaterial).color.set('#f2a93b');
      return;
    }
    if (ownsMaterials) for (const x of Array.isArray(m.material) ? m.material : [m.material]) x.dispose();
    m.material = mat;
  });
  return {
    ...rig,
    phantom: mat,
    dispose() {
      rig.dispose();
      mat.dispose();
    },
  };
}

function useRig(rig: Rig, sink: RigSink) {
  useLayoutEffect(() => {
    noFog(rig);
    sink(rig);
    return () => {
      sink(null);
      rig.dispose();
    };
  }, [rig, sink]);
}

function ProceduralRig({ variant, sink }: { variant: Variant; sink: RigSink }) {
  const rig = useMemo<Rig>(
    () => (variant === 'phantom' ? asPhantom(buildIngenuity(false), true) : { ...buildIngenuity(true), phantom: null }),
    [variant],
  );
  useRig(rig, sink);
  return <primitive object={rig.root} />;
}

function NasaRig({ url, variant, sink }: { url: string; variant: Variant; sink: RigSink }) {
  const { scene } = useGLTF(url, false, true);
  const rig = useMemo<Rig>(() => {
    const r = ingenuityFromGltf(scene, variant === 'real');
    if (variant === 'phantom') return asPhantom(r, false);
    r.root.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh && m.material !== undefined && !(m.material as MeshBasicMaterial).transparent) m.castShadow = true;
    });
    return { ...r, phantom: null };
  }, [scene, variant]);
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

/** NASA's model, or the procedural stand-in while it loads (or if it fails). */
function RigSlot({ variant, sink }: { variant: Variant; sink: RigSink }) {
  const procedural = <ProceduralRig variant={variant} sink={sink} />;
  if (!URL) return procedural;
  return (
    <KeepFallback fallback={procedural}>
      <Suspense fallback={procedural}>
        <NasaRig url={URL} variant={variant} sink={sink} />
      </Suspense>
    </KeepFallback>
  );
}

/** Turn a rig's rotors and set its blur discs for a rotor speed (0..1) and opacity. */
function spinRig(r: IngenuityRig, angle: number, speed: number, opacity: number) {
  r.setRotor(angle);
  const blur = smoothstep(0.35, 0.9, speed) * opacity;
  for (const b of r.blur) {
    b.visible = blur > 0.01;
    (b.material as MeshBasicMaterial).opacity = 0.32 * blur;
  }
}

const posA = new Vector3();
const quatA = new Quaternion();
const posB = new Vector3();
const quatB = new Quaternion();
const yawQ = new Quaternion();
const shakeQ = new Quaternion();
const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);

export function Ingenuity() {
  const flyer = useRef<Group>(null);
  const home = useRef<Group>(null);
  const flyerReal = useRef<Rig | null>(null);
  const flyerPhantom = useRef<Rig | null>(null);
  const homeReal = useRef<Rig | null>(null);
  const angle = useRef(0);
  /** The real one's rotor angle when the phantom left it (it stays like that at home). */
  const realAngle = useRef(0);
  const wasPhantom = useRef(false);
  const reduced = useReducedMotion();

  const sinkReal = useMemo<RigSink>(() => r => void (flyerReal.current = r), []);
  const sinkPhantom = useMemo<RigSink>(() => r => void (flyerPhantom.current = r), []);
  const sinkHome = useMemo<RigSink>(() => r => void (homeReal.current = r), []);
  useEffect(
    () => () => {
      live.brokenTip = null;
    },
    [],
  );

  useFrame((state, delta) => {
    const g = flyer.current;
    const h = home.current;
    if (!g || !h) return;
    const shot = live.shot;
    const s = useApp.getState();
    const look = phantomLook(s.phase, s.flight, stageElapsed(s), shot.rotor, shot.hover);
    const phantomK = reduced ? (look.phantom > 0.5 ? 1 : 0) : look.phantom;
    const isPhantom = phantomK > 0.001;

    // Leaving home: the real one keeps the rotor angle it had. Back home: the flyer takes it again.
    if (isPhantom && !wasPhantom.current) realAngle.current = angle.current;
    if (!isPhantom && wasPhantom.current) angle.current = realAngle.current;
    wasPhantom.current = isPhantom;

    // ---- the flyer
    g.visible = shot.ingenuity;
    if (shot.ingenuity) {
      // Globe end: on its arc, or resting at home.
      let scale = GLOBE_SCALE;
      if (shot.arc && live.arc.valid) {
        posA.copy(live.arc.pos);
        quatA.copy(live.arc.quat);
      } else {
        posA.copy(live.rest.pos);
        quatA.copy(live.rest.quat);
      }
      // Site end: hovering over / standing on its spot, at real size.
      if (shot.siteId && shot.blend > 0 && live.site.valid) {
        const w = shot.blend;
        const lay = siteLayout(SITE_PRESETS[shot.siteId]);
        posB.set(lay.ingenuity[0], shot.hover, lay.ingenuity[2]).applyMatrix4(live.site.matrix);
        quatB.copy(live.site.quat).multiply(yawQ.setFromAxisAngle(Y, lay.machineYaw + 0.5));
        const pivot: Vec3 = [live.site.point.x, live.site.point.y, live.site.point.z];
        g.position.set(...blendAbout([posA.x, posA.y, posA.z], [posB.x, posB.y, posB.z], w, pivot));
        g.quaternion.slerpQuaternions(quatA, quatB, smoothstep(0, 1, w));
        scale = Math.exp(Math.log(GLOBE_SCALE) * (1 - w) + Math.log(SITE_SCALE) * w);
      } else {
        g.position.copy(posA);
        g.quaternion.copy(quatA);
      }
      // The rotor fault: Ingenuity shakes on its legs.
      const judder = reduced ? 0 : (shot.judder ?? 0);
      if (judder > 0.001) {
        const t = state.clock.elapsedTime;
        shakeQ.setFromAxisAngle(X, JUDDER_TILT * judder * Math.sin(t * 61) * Math.sin(t * 7.3));
        g.quaternion.multiply(shakeQ);
        shakeQ.setFromAxisAngle(Z, JUDDER_TILT * 0.8 * judder * Math.sin(t * 47 + 1.1));
        g.quaternion.multiply(shakeQ);
      }
      g.scale.setScalar(scale);

      const speed = reduced ? 0 : shot.rotor;
      angle.current += SPIN * speed * delta;
      const real = flyerReal.current;
      const ph = flyerPhantom.current;
      if (real) {
        real.root.visible = !isPhantom;
        if (!isPhantom) spinRig(real, angle.current, speed, 1);
      }
      if (ph) {
        ph.root.visible = isPhantom;
        if (isPhantom) {
          spinRig(ph, angle.current, speed, phantomK);
          if (ph.phantom) {
            ph.phantom.uniforms.opacity.value = phantomK;
            ph.phantom.uniforms.time.value = state.clock.elapsedTime;
          }
        }
      }
    }

    // ---- the real one, left at home while the phantom flies
    const homeShown = look.realAtHome && isPhantom && shot.siteId === HOME && shot.blend > 0 && live.site.valid;
    h.visible = homeShown;
    const hr = homeReal.current;
    if (homeShown) {
      const lay = siteLayout(SITE_PRESETS[HOME]);
      h.position.set(lay.ingenuity[0], 0, lay.ingenuity[2]).applyMatrix4(live.site.matrix);
      h.quaternion.copy(live.site.quat).multiply(yawQ.setFromAxisAngle(Y, lay.machineYaw + 0.5));
      h.scale.setScalar(SITE_SCALE);
      if (hr) spinRig(hr, realAngle.current, 0, 1);
    }

    // The "Broken rotor tip" callout follows whichever real Ingenuity is on screen.
    if (homeShown) live.brokenTip = hr?.brokenTip ?? null;
    else if (shot.ingenuity && !isPhantom) live.brokenTip = flyerReal.current?.brokenTip ?? null;
    else live.brokenTip = null;
  });

  return (
    <>
      <group ref={flyer} visible={false}>
        <RigSlot variant="real" sink={sinkReal} />
        <RigSlot variant="phantom" sink={sinkPhantom} />
      </group>
      <group ref={home} visible={false}>
        <RigSlot variant="real" sink={sinkHome} />
      </group>
    </>
  );
}
