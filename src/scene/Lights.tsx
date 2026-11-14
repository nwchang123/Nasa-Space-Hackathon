// One sun and one sky light for the whole scene, so the set of lights never changes (no shader
// recompiles mid-flight). Over the globe they light Ingenuity with the real Sun; at a site they
// become that site's sky: full sun by day, low and orange near sunset, gone at night with a dim,
// cool sky light so the machine still reads. The sun casts shadows only inside the diorama.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Object3D, SRGBColorSpace, type DirectionalLight, type HemisphereLight } from 'three';
import { SITE_SCALE } from './layout';
import { live } from './registry';
import { SITE_PRESETS } from './sites';

const GLOBE_SUN = new Color('#ffeedd');
const GLOBE_SKY = new Color('#a7b4c8');
const GLOBE_GROUND = new Color('#3a2418');
const tmp = new Color();

export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const lastBounds = useRef('');

  useFrame(() => {
    const s = sun.current;
    const h = hemi.current;
    if (!s || !h) return;
    const shot = live.shot;
    const look = live.siteLook;
    const w = shot.siteId && live.site.valid && look ? shot.blend : 0;

    if (w > 0 && look && shot.siteId) {
      // Sun over the site, from the real direction (the same one the sky dome uses).
      const p = live.site.point;
      target.position.copy(p);
      s.position.copy(p).addScaledVector(live.sun, 80 * SITE_SCALE);
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
      s.intensity = 2.6 * (1 - w) + look.sunIntensity * w;
      s.color.copy(GLOBE_SUN).lerp(tmp.setRGB(...look.sunColor, SRGBColorSpace), w);
      h.color.copy(GLOBE_SKY).lerp(tmp.setRGB(...look.ambientSky, SRGBColorSpace), w);
      h.groundColor.copy(GLOBE_GROUND).lerp(tmp.setRGB(...look.ambientGround, SRGBColorSpace), w);
      h.intensity = 0.9 * (1 - w) + look.ambientIntensity * w;
    } else {
      target.position.set(0, 0, 0);
      s.position.copy(live.sun).multiplyScalar(5);
      s.intensity = 2.6;
      s.color.copy(GLOBE_SUN);
      h.color.copy(GLOBE_SKY);
      h.groundColor.copy(GLOBE_GROUND);
      h.intensity = 0.9;
    }
    target.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight ref={sun} target={target} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <hemisphereLight ref={hemi} />
    </>
  );
}
