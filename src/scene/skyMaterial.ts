// The sky dome over a site diorama: horizon-to-zenith gradient, a halo around the Sun
// (butterscotch by day, blue at sunset), the Sun's disc, and transparency at night so the
// starfield behind it shows through.

import { BackSide, Color, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Vec3 } from './layout';
import type { SkyLook } from './sites';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 glow;
  uniform float glowStrength;
  uniform vec3 sunDir;
  uniform float sunUp;
  uniform float opacity;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(horizon, zenith, pow(h, 0.55));
    float c = max(dot(d, normalize(sunDir)), 0.0);
    col += glow * glowStrength * (0.75 * pow(c, 9.0) + 0.6 * pow(c, 90.0));
    // The Sun's disc, drawn about five times its real size (0.35°) so it reads on screen.
    col += vec3(1.0, 0.97, 0.92) * smoothstep(0.99975, 0.9999, c) * sunUp * step(0.0, d.y);
    gl_FragColor = vec4(col, opacity);
    #include <colorspace_fragment>
  }
`;

export function createSkyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      zenith: { value: new Color() },
      horizon: { value: new Color() },
      glow: { value: new Color() },
      glowStrength: { value: 0 },
      sunDir: { value: new Vector3(0, 1, 0) },
      sunUp: { value: 0 },
      opacity: { value: 1 },
    },
    side: BackSide,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

export function applySky(mat: ShaderMaterial, look: SkyLook, sunDir: Vec3) {
  const u = mat.uniforms;
  (u.zenith.value as Color).setRGB(...look.zenith, SRGBColorSpace);
  (u.horizon.value as Color).setRGB(...look.horizon, SRGBColorSpace);
  (u.glow.value as Color).setRGB(...look.glow, SRGBColorSpace);
  u.glowStrength.value = look.glowStrength;
  (u.sunDir.value as Vector3).set(...sunDir);
  u.sunUp.value = look.sunUp;
  u.opacity.value = look.domeOpacity;
}
