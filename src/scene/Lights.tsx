// One sun and one sky light for the whole scene, so the set of lights never changes (no shader
// recompiles mid-flight). Over the globe they light Ingenuity with the real Sun; at a site they
// become that site's sky (the real Sun now, or the hour picked on the sun scrubber: live.siteSun,
// written by the Diorama): full sun by day, low and orange near sunset, gone at night with a dim,
// cool sky light so the machine still reads. At night the same light becomes a faint, cool key
// from high on the Sun's bearing (an artistic choice, like an eye adapted to the dark), so models
// keep their shape. The sun casts shadows only inside the diorama, and only the real Sun casts a
// full one: as it sets the shadow fades, so the night key never throws a hard black shadow across
// the sand. At night a soft fill from just beside the camera picks out Ingenuity's dark carbon
// rotors against the dark sky. Both lights are always present (intensity 0 when unused).
// So is Ingenuity's searchlight: a spotlight under its belly while the visitor flies it at a site,
// pointing down at the sand, or at the part it is scanning (live.scan). Strong at night, faint by day.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Object3D, SRGBColorSpace, Vector3, type DirectionalLight, type HemisphereLight, type SpotLight } from 'three';
import { smoothstep, SITE_SCALE } from './layout';
import { live } from './registry';
import { SITE_PRESETS } from './sites';

const GLOBE_SUN = new Color('#ffeedd');
const GLOBE_SKY = new Color('#a7b4c8');
const GLOBE_GROUND = new Color('#3a2418');
const tmp = new Color();
const NIGHT_KEY_COLOR = new Color('#9db2db');
/** Night key intensity (the day Sun is 3.2). */
const NIGHT_KEY = 0.6;
/** Low, raking, so ground texture and ripples read at night. */
const NIGHT_KEY_ELEV = 25 * (Math.PI / 180);
/** Shadow strength left once only the night key is lighting the site (1 = full shadow). */
const NIGHT_SHADOW = 0.12;
/** Night fill: from just above and to the side of the camera, so faces toward the viewer read. */
const FILL_COLOR = new Color('#c3cde0');
const FILL_NIGHT = 0.85;
const FILL_SIDE = 0.45;
const FILL_UP = 0.35;
const dir = new Vector3();
const flat = new Vector3();
const lifted = new Vector3();
const toCam = new Vector3();
const side = new Vector3();
/** Searchlight: warm white, intensity at night and by day (the Sun is 3.2), cone half-angle. */
const SEARCH_COLOR = new Color('#ffe6c2');
const SEARCH_NIGHT = 4.5;
const SEARCH_DAY = 0.9;
const SEARCH_ANGLE = 0.62;
/** The lamp sits this far above Ingenuity's feet, m. */
const BELLY_M = 0.16;
const down = new Vector3();

export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const search = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const searchTarget = useMemo(() => new Object3D(), []);
  const lastBounds = useRef('');
  const aim = useRef(0);

  useFrame((state, delta) => {
    const s = sun.current;
    const h = hemi.current;
    const f = fill.current;
    const sl = search.current;
    if (!s || !h || !f || !sl) return;
    searchLight(sl, searchTarget, aim, Math.min(0.1, delta));
    const shot = live.shot;
    const look = live.siteLook;
    const w = shot.siteId && live.site.valid && look ? shot.blend : 0;

    if (w > 0 && look && shot.siteId) {
      // Sun over the site, from the direction the sky dome shows (real now, or the scrubbed hour).
      const p = live.site.point;
      target.position.copy(p);
      dir.copy(live.siteSun);
      if (look.nightKey > 0) {
        // The Sun's bearing, lifted to 25° above the site's horizon.
        const up = live.site.up;
        flat.copy(live.siteSun).addScaledVector(up, -live.siteSun.dot(up));
        if (flat.lengthSq() < 1e-10) flat.set(1, 0, 0).addScaledVector(up, -up.x);
        flat.normalize();
        lifted.copy(flat).multiplyScalar(Math.cos(NIGHT_KEY_ELEV)).addScaledVector(up, Math.sin(NIGHT_KEY_ELEV));
        dir.lerp(lifted, look.nightKey).normalize();
      }
      s.position.copy(p).addScaledVector(dir, 80 * SITE_SCALE);
      const preset = SITE_PRESETS[shot.siteId];
      const key = shot.siteId;
      if (key !== lastBounds.current) {
        lastBounds.current = key;
        const r = (Math.max(-preset.frame.left, preset.frame.right) + 6) * SITE_SCALE;
        const cam = s.shadow.camera;
        cam.left = -r;
        cam.right = r;
        cam.top = r;
        cam.bottom = -r;
        cam.near = 0;
        cam.far = 200 * SITE_SCALE;
        cam.updateProjectionMatrix();
        s.shadow.normalBias = 0.02 * SITE_SCALE;
      }
      const nightKey = NIGHT_KEY * look.nightKey;
      const total = Math.max(1e-6, look.sunIntensity + nightKey);
      s.intensity = 2.6 * (1 - w) + (look.sunIntensity + nightKey) * w;
      tmp.setRGB(...look.sunColor, SRGBColorSpace).lerp(NIGHT_KEY_COLOR, nightKey / total);
      s.color.copy(GLOBE_SUN).lerp(tmp, w);
      h.color.copy(GLOBE_SKY).lerp(tmp.setRGB(...look.ambientSky, SRGBColorSpace), w);
      h.groundColor.copy(GLOBE_GROUND).lerp(tmp.setRGB(...look.ambientGround, SRGBColorSpace), w);
      h.intensity = 0.9 * (1 - w) + look.ambientIntensity * w;
      // Shadow strength follows the real Sun's share of the light: full by day, a faint trace once
      // the Sun is below the horizon. (A uniform, so no shader recompile, unlike toggling castShadow.)
      const sunShare = look.sunIntensity / total;
      s.shadow.intensity = 1 - (1 - NIGHT_SHADOW) * (1 - sunShare) * w;

      // Night fill from beside the camera, aimed at the site.
      toCam.copy(state.camera.position).sub(p);
      const d = toCam.length();
      if (d > 1e-9) {
        toCam.divideScalar(d);
        side.crossVectors(live.site.up, toCam);
        if (side.lengthSq() < 1e-10) side.set(1, 0, 0);
        side.normalize();
        toCam.addScaledVector(side, FILL_SIDE).addScaledVector(live.site.up, FILL_UP).normalize();
      } else {
        toCam.copy(live.site.up);
      }
      f.position.copy(p).addScaledVector(toCam, 50 * SITE_SCALE);
      f.intensity = FILL_NIGHT * look.nightKey * w;
    } else {
      target.position.set(0, 0, 0);
      s.position.copy(live.sun).multiplyScalar(5);
      s.intensity = 2.6;
      s.color.copy(GLOBE_SUN);
      s.shadow.intensity = 1;
      h.color.copy(GLOBE_SKY);
      h.groundColor.copy(GLOBE_GROUND);
      h.intensity = 0.9;
      f.intensity = 0;
    }
    target.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={target} />
      <primitive object={searchTarget} />
      <directionalLight ref={sun} target={target} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <directionalLight ref={fill} target={target} color={FILL_COLOR} intensity={0} />
      <spotLight ref={search} target={searchTarget} color={SEARCH_COLOR} intensity={0} angle={SEARCH_ANGLE} penumbra={0.6} decay={0} distance={0} />
      <hemisphereLight ref={hemi} />
    </>
  );
}

/** Ingenuity's searchlight: on while it flies at a site, aimed down or (scanning) at the part. */
function searchLight(sl: SpotLight, target: Object3D, aim: { current: number }, dt: number) {
  const shot = live.shot;
  const fl = live.flyer;
  const look = live.siteLook;
  if (!shot.siteId || !live.site.valid || !look || fl.site !== shot.siteId) {
    sl.intensity = 0;
    aim.current = 0;
    return;
  }
  const up = live.site.up;
  sl.position.copy(live.flyerWorld).addScaledVector(up, BELLY_M * SITE_SCALE);
  aim.current += ((live.scan.k > 0 ? 1 : 0) - aim.current) * (1 - Math.exp(-4 * dt));
  down.copy(sl.position).addScaledVector(up, -SITE_SCALE);
  target.position.copy(down).lerp(live.scan.point, smoothstep(0, 1, aim.current));
  target.updateMatrixWorld();
  const airborne = Math.max(smoothstep(0.15, 0.9, fl.alt), aim.current);
  const night = look.nightKey;
  sl.intensity = airborne * (SEARCH_DAY + (SEARCH_NIGHT - SEARCH_DAY) * night) * smoothstep(0.9, 1, shot.blend);
}
