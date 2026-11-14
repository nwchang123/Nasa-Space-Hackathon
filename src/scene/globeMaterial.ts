// Globe shading: colour map × soft Lambert from a sun direction in BODY-FIXED coordinates.
// Normals are taken in object space, so the lighting stays true when the globe is rotated.

import { Color, ShaderMaterial, Vector3, type Texture } from 'three';

export interface GlobeLook {
  sunColor: string;
  sunIntensity: number;
  /** Night-side light: earthshine on the Moon, dusty sky glow on Mars. */
  ambientColor: string;
  ambient: number;
  /** <1 flattens the falloff (the Moon looks "flat" at full phase). */
  shadePow: number;
  rimColor: string;
  rimStrength: number;
  /** Shown until the surface map is ready. */
  placeholder: string;
}

export const MOON_LOOK: GlobeLook = {
  sunColor: '#fff7ea',
  sunIntensity: 1.22,
  ambientColor: '#6f88a6',
  ambient: 0.055,
  shadePow: 0.62,
  rimColor: '#9fb6cc',
  rimStrength: 0.05,
  placeholder: '#8d8b86',
};

export const MARS_LOOK: GlobeLook = {
  sunColor: '#ffeedd',
  sunIntensity: 1.15,
  ambientColor: '#7c4a30',
  ambient: 0.05,
  shadePow: 0.9,
  rimColor: '#f0a06a',
  rimStrength: 0.55,
  placeholder: '#a8603a',
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vObjNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vObjNormal = normalize(normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float hasMap;
  uniform vec3 placeholder;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform vec3 ambientColor;
  uniform float shadePow;
  uniform vec3 rimColor;
  uniform float rimStrength;
  uniform float reveal;
  varying vec2 vUv;
  varying vec3 vObjNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    // A small negative mip bias keeps the mosaic crisp instead of soft (no visible shimmer at this scale).
    vec3 albedo = mix(placeholder, texture2D(map, vUv, -0.4).rgb, hasMap * reveal);
    float ndl = dot(normalize(vObjNormal), normalize(sunDir));
    // Soft terminator over a few degrees, lifted falloff so the surface stays readable near it.
    float day = smoothstep(-0.035, 0.06, ndl);
    float shade = mix(0.14, 1.0, pow(clamp(ndl, 0.0, 1.0), shadePow));
    vec3 col = albedo * (sunColor * day * shade + ambientColor);
    float fres = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0), 3.0);
    col += rimColor * rimStrength * fres * smoothstep(-0.25, 0.35, ndl);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createGlobeMaterial(look: GlobeLook): ShaderMaterial {
  const sun = new Color(look.sunColor).multiplyScalar(look.sunIntensity);
  const amb = new Color(look.ambientColor).multiplyScalar(look.ambient);
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      map: { value: null as Texture | null },
      hasMap: { value: 0 },
      reveal: { value: 0 },
      placeholder: { value: new Color(look.placeholder) },
      sunDir: { value: new Vector3(1, 0, 0) },
      sunColor: { value: sun },
      ambientColor: { value: amb },
      shadePow: { value: look.shadePow },
      rimColor: { value: new Color(look.rimColor) },
      rimStrength: { value: look.rimStrength },
    },
  });
}
