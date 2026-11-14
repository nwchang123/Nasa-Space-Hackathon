// One sun and one sky light for the whole scene, so the set of lights never changes (no shader
// recompiles mid-flight). Over the globe they light Ingenuity with the real Sun; at a site they
// become that site's sky: full sun by day, low and orange near sunset, gone at night with a dim,
// cool sky light so the machine still reads. At night the same light becomes a faint, cool key
// from high on the Sun's bearing (an artistic choice, like an eye adapted to the dark), so models
// keep their shape. The sun casts shadows only inside the diorama, and only the real Sun casts a
// full one: as it sets the shadow fades, so the night key never throws a hard black shadow across
// the sand. At night a soft fill from just beside the camera picks out Ingenuity's dark carbon
// rotors against the dark sky. Both lights are always present (intensity 0 when unused).

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Object3D, SRGBColorSpace, Vector3, type DirectionalLight, type HemisphereLight } from 'three';
import { SITE_SCALE } from './layout';
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

export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const lastBounds = useRef('');

  useFrame(state => {
    const s = sun.current;
    const h = hemi.current;
    const f = fill.current;
    if (!s || !h || !f) return;
    const shot = live.shot;
    const look = live.siteLook;
    const w = shot.siteId && live.site.valid && look ? shot.blend : 0;

    if (w > 0 && look && shot.siteId) {
      // Sun over the site, from the real direction (the same one the sky dome uses).
      const p = live.site.point;
      target.position.copy(p);
      dir.copy(live.sun);
      if (look.nightKey > 0) {
        // The Sun's bearing, lifted to 25° above the site's horizon.
        const up = live.site.up;
        flat.copy(live.sun).addScaledVector(up, -live.sun.dot(up));
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
      <directionalLight ref={sun} target={target} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <directionalLight ref={fill} target={target} color={FILL_COLOR} intensity={0} />
      <hemisphereLight ref={hemi} />
    </>
  );
}
