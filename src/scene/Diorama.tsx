// A site diorama, standing on the globe at its stop (placed by the Director's site matrix, in
// metres scaled by SITE_SCALE): procedural ground and rocks, the machine, a sky dome coloured for
// the site's real Sun right now, and the radio call effect. It fades in as the camera dives
// toward it and out as the camera climbs away. Only the current stop's diorama is mounted; it is
// built on mount and disposed on unmount. At home, two small callouts point out the damage from
// flight 72: the end of the broken blade on Ingenuity, and the piece that lies 15 m to the west.
// The sky follows the real Sun now, or the local solar hour picked on the HUD's sun scrubber
// (store.siteHour), with any signature effect on top (applySiteFx); live.siteSun carries that Sun
// to the Lights. At a stop, the machine carries its story hotspots, and the view can be orbited.

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { SphereGeometry, SRGBColorSpace, Vector3, type Fog, type Group, type Mesh, type Object3D } from 'three';
import { siteSky, siteSkyAtHour } from '../astro';
import { MACHINE_BY_ID } from '../data/machines';
import { HOME } from '../flight/route';
import { currentStop, useApp } from '../store';
import type { MachineId } from '../types';
import { dioramaSunDir, horizonDir, SITE_SCALE, smoothstep } from './layout';
import { Hotspots } from './Hotspots';
import { MachineModel } from './MachineModel';
import { buildBladeFragment, disposeObject } from './models';
import { live } from './registry';
import { FocusReticle, ScanBeam } from './FocusFx';
import { ScoutCamGrab } from './ScoutCamGrab';
import { SiteFlight } from './SiteFlight';
import { SiteOrbitInput } from './SiteOrbitInput';
import { SiteSignature } from './signatures';
import { applySiteFx } from './signatures/fx';
import { SitePing } from './SitePing';
import { applySky, createSkyMaterial } from './skyMaterial';
import { SITE_PRESETS, siteLayout, skyLook, type SkyLook } from './sites';
import { buildGround } from './terrain';
import { SITE_FADE, SITE_SKY_RADIUS_M } from './siteTransition';

/** Haze over the site, m. */
const FOG_NEAR_M = 25;
const FOG_FAR_M = 110;
/** Fog distances while no diorama is in view: beyond everything. */
export const FOG_OFF: [number, number] = [1000, 2000];
/** A model that finishes loading after the dive has begun fades in over this long, ms. */
const MODEL_IN_MS = 600;
/** A light haze for the middle of the dive, m: the patch of ground and the machine come up out of it. */
const FOG_DIVE_M: [number, number] = [260, 1400];

/**
 * How the site comes in with the dive (blend 0 = on the globe, 1 = landed) and goes out with the
 * climb. All of it rises together, so nothing shows bare: the haze thickens from the start; the
 * sky closes in as the camera enters it; the round ground and then the machine emerge through
 * that atmosphere. The same curves run backwards on departure.
 */
const logLerp = (a: number, b: number, k: number) => Math.exp(Math.log(a) * (1 - k) + Math.log(b) * k);

/** The site's sky before any signature effect, for the real "now" or a picked local solar hour. */
interface BaseSky {
  nowMs: number;
  hour: number | null;
  look: SkyLook;
  /** Unit vector toward the Sun, diorama-local. */
  sun: Vector3;
}

export function Diorama({ stop }: { stop: MachineId }) {
  const scene = useThree(s => s.scene);
  const preset = SITE_PRESETS[stop];
  const lay = siteLayout(preset);
  const group = useRef<Group>(null);
  const dome = useRef<Mesh>(null);
  const machine = useRef<Group>(null);
  const machineFade = useRef({ k: -1 });
  // When the machine's model came in (it fades in over MODEL_IN_MS if that was late, not pops).
  const modelAt = useRef(0);
  const onModelReady = useCallback(() => {
    modelAt.current = performance.now();
    machineFade.current.k = -1;
  }, []);
  const base = useRef<BaseSky | null>(null);

  const ground = useMemo(() => buildGround(preset, lay), [preset, lay]);
  const skyMat = useMemo(() => createSkyMaterial(), []);
  const domeGeom = useMemo(() => new SphereGeometry(SITE_SKY_RADIUS_M, 48, 24), []);
  // At home, the piece of blade that broke off lies about 15 m away (to the west here).
  const fragment = useMemo(() => {
    if (stop !== HOME) return null;
    const f = buildBladeFragment();
    const d = horizonDir(270, 0);
    f.position.set(d[0] * 15, ground.heightAt(d[0] * 15, d[2] * 15), d[2] * 15);
    return f;
  }, [stop, ground]);

  useEffect(
    () => () => {
      ground.dispose();
      skyMat.dispose();
      domeGeom.dispose();
      if (fragment) disposeObject(fragment);
      const fog = scene.fog as Fog | null;
      if (fog) {
        fog.near = FOG_OFF[0];
        fog.far = FOG_OFF[1];
      }
      live.siteLook = null;
    },
    [ground, skyMat, domeGeom, fragment, scene],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const shot = live.shot;
    const active = shot.siteId === stop && live.site.valid;
    g.visible = active;
    if (!active) return;
    g.matrix.copy(live.site.matrix);
    g.matrixWorldNeedsUpdate = true;

    // The site's sky: the real Sun right now, or the hour picked on the sun scrubber (same
    // season). Recomputed only when the time or the hour changes; effects are applied every frame.
    const st = useApp.getState();
    const hour = st.siteHour;
    let b = base.current;
    if (!b || b.nowMs !== st.nowMs || b.hour !== hour) {
      const m = MACHINE_BY_ID[stop];
      const date = new Date(st.nowMs);
      const sky = hour === null ? siteSky('mars', m.lat, m.lon, date) : siteSkyAtHour(m.lat, m.lon, hour, date);
      b = base.current = {
        nowMs: st.nowMs,
        hour,
        look: skyLook(sky.elevationDeg),
        sun: new Vector3(...dioramaSunDir(sky.azimuthDeg, sky.elevationDeg)),
      };
    }
    const look = applySiteFx(b.look, stop, st.sig);
    live.siteLook = look;
    live.siteSun.copy(b.sun).applyQuaternion(live.site.quat).normalize();
    applySky(skyMat, look, [b.sun.x, b.sun.y, b.sun.z]);

    // Fade in with the dive (and out with the climb), all together: see SITE_FADE.
    const w = shot.blend;
    const fade = (r: readonly [number, number]) => smoothstep(r[0], r[1], w);
    const groundFade = fade(SITE_FADE.ground);
    ground.setFade(groundFade, fade(SITE_FADE.edge));
    ground.ground.visible = ground.rocks.visible = groundFade > 0.001;
    const domeFade = fade(SITE_FADE.dome);
    skyMat.uniforms.opacity.value = look.domeOpacity * domeFade;
    if (dome.current) dome.current.visible = domeFade > 0.001;
    const modelIn = modelAt.current ? smoothstep(0, MODEL_IN_MS, performance.now() - modelAt.current) : 1;
    if (machine.current) fadeMachine(machine.current, fade(SITE_FADE.machine) * modelIn, machineFade.current);

    const fog = scene.fog as Fog | null;
    if (fog) {
      const haze = fade(SITE_FADE.haze);
      const k = fade(SITE_FADE.fog);
      const near = logLerp(FOG_OFF[0], FOG_DIVE_M[0] * SITE_SCALE, haze);
      const far = logLerp(FOG_OFF[1], FOG_DIVE_M[1] * SITE_SCALE, haze);
      fog.near = logLerp(near, (look.fogNearM ?? FOG_NEAR_M) * SITE_SCALE, k);
      fog.far = logLerp(far, (look.fogFarM ?? FOG_FAR_M) * SITE_SCALE, k);
      fog.color.setRGB(...look.fog, SRGBColorSpace);
    }
  });

  return (
    <>
      <group ref={group} matrixAutoUpdate={false} visible={false}>
        <primitive object={ground.ground} />
        <primitive object={ground.rocks} />
        <mesh ref={dome} geometry={domeGeom} material={skyMat} renderOrder={-0.5} frustumCulled={false} visible={false} />
        {stop !== HOME && (
          <group rotation-y={lay.machineYaw} name="machine">
            <group ref={machine}>
              <MachineModel id={stop} onReady={onModelReady} />
            </group>
            <Hotspots stop={stop} />
          </group>
        )}
        {fragment && (
          <>
            <primitive object={fragment} />
            <SiteTag position={[fragment.position.x, fragment.position.y + 0.02, fragment.position.z]} faint>
              Blade fragment<span className="marker-label-tag"> · 15 m W</span>
            </SiteTag>
          </>
        )}
        <SitePing stop={stop} antenna={lay.antenna} size={1} unit={SITE_SCALE} />
        <SiteSignature stop={stop} ground={ground} lay={lay} />
        {stop === HOME && (
          <group position={lay.ingenuity}>
            <Hotspots stop={stop} />
          </group>
        )}
      </group>
      <SiteOrbitInput stop={stop} />
      <SiteFlight stop={stop} ground={ground} />
      <FocusReticle stop={stop} />
      <ScanBeam stop={stop} />
      <ScoutCamGrab stop={stop} />
      {stop === HOME && (
        <SiteTag follow>
          Broken rotor tip<span className="marker-label-tag"> · Flight 72</span>
        </SiteTag>
      )}
    </>
  );
}

/**
 * Fade the machine in with the dive (and out with the climb) to `k` of its own opacity. Each
 * material dithers (alpha hash), so the model never needs transparency sorting against itself,
 * and casts no shadow until it is fully there; at 1 everything is back as it was. The machine
 * owns its materials (MachineModel clones them), so the shared model cache is never touched.
 * Applied again whenever `k` changes, which also catches a model that loaded mid-fade.
 */
function fadeMachine(obj: Object3D, k: number, last: { k: number }) {
  const kk = k >= 0.999 ? 1 : k <= 0.001 ? 0 : Math.round(k * 200) / 200;
  if (kk === last.k) return;
  last.k = kk;
  obj.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const u = mesh.userData as { fadeCast?: boolean };
    if (u.fadeCast === undefined) u.fadeCast = mesh.castShadow;
    mesh.castShadow = kk >= 1 ? u.fadeCast : false;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const d = mat.userData as { fadeOpacity?: number; fadeHash?: boolean };
      if (d.fadeOpacity === undefined) {
        d.fadeOpacity = mat.opacity;
        d.fadeHash = mat.alphaHash;
      }
      const hash = kk < 1 || !!d.fadeHash;
      if (mat.alphaHash !== hash) {
        mat.alphaHash = hash;
        mat.needsUpdate = true;
      }
      mat.opacity = d.fadeOpacity * kk;
    }
  });
}

/**
 * How much the home callouts show: once the camera has settled at home (not while Ingenuity is
 * still landing, its rotor turning, or the screen is fading).
 */
function homeTagFade(): number {
  const shot = live.shot;
  if (shot.siteId !== HOME || !live.site.valid) return 0;
  // At the last stop the story hotspots take over (03 sits on the broken blade).
  const s = useApp.getState();
  if (s.phase === 'flight' && s.flight.stage === 'site' && currentStop(s.flight) === HOME) return 0;
  return (
    smoothstep(0.85, 1, shot.blend) *
    (1 - smoothstep(0.02, 0.15, shot.rotor)) *
    (1 - smoothstep(0.03, 0.12, shot.hover)) *
    (1 - Math.min(1, live.black * 2))
  );
}

/**
 * A small callout in the scene: a dot on the spot, a hairline up, and a label in the marker style.
 * With `follow` it tracks the end of Ingenuity's broken blade (world space); otherwise it sits at
 * `position` in the diorama's metres.
 */
function SiteTag({
  position,
  follow = false,
  faint = false,
  children,
}: {
  position?: [number, number, number];
  follow?: boolean;
  faint?: boolean;
  children: ReactNode;
}) {
  const anchor = useRef<Group>(null);
  const el = useRef<HTMLDivElement>(null);
  const shown = useRef(-1);

  useFrame(() => {
    const a = anchor.current;
    let k = homeTagFade();
    if (follow) {
      const tip = live.brokenTip;
      if (!tip || !live.shot.ingenuity) k = 0;
      else if (a && k > 0) {
        tip.updateWorldMatrix(true, false);
        tip.getWorldPosition(a.position);
      }
    }
    k = Math.round(k * 100) / 100;
    if (k === shown.current || !el.current) return;
    shown.current = k;
    el.current.style.opacity = String(k * (faint ? 0.7 : 1));
    el.current.style.visibility = k > 0 ? 'visible' : 'hidden';
  });

  return (
    <group ref={anchor} position={position}>
      <Html zIndexRange={[4, 0]} pointerEvents="none" className="site-tag-wrap">
        <div ref={el} className={`site-tag${faint ? ' faint' : ''}`} style={{ opacity: 0, visibility: 'hidden' }}>
          <span className="site-tag-dot" aria-hidden="true" />
          <span className="site-tag-line" aria-hidden="true" />
          <span className="marker-label-inner site-tag-label">{children}</span>
        </div>
      </Html>
    </group>
  );
}
