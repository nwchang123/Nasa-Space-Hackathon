// A site diorama, standing on the globe at its stop (placed by the Director's site matrix, in
// metres scaled by SITE_SCALE): procedural ground and rocks, the machine, a sky dome coloured for
// the site's real Sun right now, and the radio call effect. It fades in as the camera dives
// toward it and out as the camera climbs away. Only the current stop's diorama is mounted; it is
// built on mount and disposed on unmount. At home, two small callouts point out the damage from
// flight 72: the end of the broken blade on Ingenuity, and the piece that lies 15 m to the west.

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { SphereGeometry, SRGBColorSpace, type Fog, type Group, type Mesh } from 'three';
import { siteSky } from '../astro';
import { MACHINE_BY_ID } from '../data/machines';
import { HOME } from '../flight/route';
import { useApp } from '../store';
import type { MachineId } from '../types';
import { dioramaSunDir, horizonDir, SITE_SCALE, smoothstep } from './layout';
import { MachineModel } from './MachineModel';
import { buildBladeFragment, disposeObject } from './models';
import { live } from './registry';
import { SitePing } from './SitePing';
import { applySky, createSkyMaterial } from './skyMaterial';
import { SITE_PRESETS, siteLayout, skyLook } from './sites';
import { buildGround } from './terrain';

/** Sky dome radius, m. */
const DOME_R = 140;
/** Haze over the site, m. */
const FOG_NEAR_M = 25;
const FOG_FAR_M = 110;
/** Fog distances while no diorama is in view: beyond everything. */
export const FOG_OFF: [number, number] = [1000, 2000];

const logLerp = (a: number, b: number, k: number) => Math.exp(Math.log(a) * (1 - k) + Math.log(b) * k);

export function Diorama({ stop }: { stop: MachineId }) {
  const scene = useThree(s => s.scene);
  const preset = SITE_PRESETS[stop];
  const lay = siteLayout(preset);
  const group = useRef<Group>(null);
  const dome = useRef<Mesh>(null);
  const lookKey = useRef(-1);

  const ground = useMemo(() => buildGround(preset, lay), [preset, lay]);
  const skyMat = useMemo(() => createSkyMaterial(), []);
  const domeGeom = useMemo(() => new SphereGeometry(DOME_R, 48, 24), []);
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

    // The site's real sky right now.
    const nowMs = useApp.getState().nowMs;
    if (nowMs !== lookKey.current || !live.siteLook) {
      lookKey.current = nowMs;
      const m = MACHINE_BY_ID[stop];
      const sky = siteSky('mars', m.lat, m.lon, new Date(nowMs));
      live.siteLook = skyLook(sky.elevationDeg);
      applySky(skyMat, live.siteLook, dioramaSunDir(sky.azimuthDeg, sky.elevationDeg));
    }
    const look = live.siteLook;

    // Fade in with the dive: ground first, then the sky closes in around the camera.
    const w = shot.blend;
    const groundFade = smoothstep(0.02, 0.5, w);
    for (const mat of ground.materials) mat.opacity = groundFade;
    ground.ground.visible = ground.rocks.visible = groundFade > 0.001;
    const domeFade = smoothstep(0.55, 0.95, w);
    skyMat.uniforms.opacity.value = look.domeOpacity * domeFade;
    if (dome.current) dome.current.visible = domeFade > 0.001;

    const fog = scene.fog as Fog | null;
    if (fog) {
      const k = smoothstep(0.45, 0.95, w);
      fog.near = logLerp(FOG_OFF[0], FOG_NEAR_M * SITE_SCALE, k);
      fog.far = logLerp(FOG_OFF[1], FOG_FAR_M * SITE_SCALE, k);
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
          <group rotation-y={lay.machineYaw}>
            <MachineModel id={stop} />
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
      </group>
      {stop === HOME && (
        <SiteTag follow>
          Broken rotor tip<span className="marker-label-tag"> · Flight 72</span>
        </SiteTag>
      )}
    </>
  );
}

/**
 * How much the home callouts show: once the camera has settled at home (not while Ingenuity is
 * still landing, its rotor turning, or the screen is fading).
 */
function homeTagFade(): number {
  const shot = live.shot;
  if (shot.siteId !== HOME || !live.site.valid) return 0;
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
