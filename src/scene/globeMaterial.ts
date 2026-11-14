// Globe shading: colour map × soft Lambert from a sun direction in BODY-FIXED coordinates.
// Normals are taken in object space, so the lighting stays true when the globe is rotated.
// With a MOLA height map, each fragment's normal is tilted by the local slope (finite differences),
// so craters, volcanoes and canyons are shaded by the real Sun. Relief is exaggerated (`bump`).

import { Color, ShaderMaterial, Vector2, Vector3, type Texture } from 'three';

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
  uniform sampler2D heightMap;
  uniform float hasHeight;
  uniform vec2 heightTexel;
  uniform float bump;
  varying vec2 vUv;
  varying vec3 vObjNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  // Surface normal tilted by the height map's slope. Tangents follow latLonToVec3: lon 0 → +X,
  // east → −Z, north → +Y; u grows eastward and v northward on the equirectangular map.
  vec3 reliefNormal(vec3 n0) {
    float hE = texture2D(heightMap, vUv + vec2(heightTexel.x, 0.0)).r;
    float hW = texture2D(heightMap, vUv - vec2(heightTexel.x, 0.0)).r;
    float hN = texture2D(heightMap, vUv + vec2(0.0, heightTexel.y)).r;
    float hS = texture2D(heightMap, vUv - vec2(0.0, heightTexel.y)).r;
    vec3 east = vec3(n0.z, 0.0, -n0.x);
    float cosLat = length(east);
    east = cosLat > 1e-4 ? east / cosLat : vec3(0.0, 0.0, -1.0);
    vec3 north = cross(n0, east);
    // Rise per unit of surface distance on a unit sphere (a longitude step shrinks by cos lat).
    float dE = (hE - hW) / (2.0 * heightTexel.x * 6.2831853 * max(cosLat, 0.08));
    float dN = (hN - hS) / (2.0 * heightTexel.y * 3.1415927);
    return normalize(n0 - bump * (dE * east + dN * north));
  }

  void main() {
    // A small negative mip bias keeps the mosaic crisp instead of soft (no visible shimmer at this scale).
    vec3 albedo = mix(placeholder, texture2D(map, vUv, -0.4).rgb, hasMap * reveal);
    vec3 n0 = normalize(vObjNormal);
    vec3 sd = normalize(sunDir);
    float ndl0 = dot(n0, sd);
    float ndl = hasHeight > 0.5 ? dot(reliefNormal(n0), sd) : ndl0;
    // Soft terminator over a few degrees, from the smooth sphere. Relief may nudge it by about 2°
    // at most, so peaks and crater rims catch the light just past it, but slopes deep in the night
    // side stay dark. Lifted falloff so the surface stays readable.
    float day = smoothstep(-0.035, 0.06, ndl0 + clamp(0.35 * (ndl - ndl0), -0.035, 0.035));
    float shade = mix(0.1, 1.0, pow(clamp(ndl, 0.0, 1.0), shadePow));
    vec3 col = albedo * (sunColor * day * shade + ambientColor);
    float fres = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0), 3.0);
    // Full rim on the day side; a faint one (12 %) on the night side, so the dark limb still
    // shows the planet's outline and night-side markers do not seem to float in space.
    col += rimColor * rimStrength * fres * mix(0.12, 1.0, smoothstep(-0.25, 0.35, ndl0));
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
      heightMap: { value: null as Texture | null },
      hasHeight: { value: 0 },
      heightTexel: { value: new Vector2(1 / 4096, 1 / 2048) },
      bump: { value: 0.12 },
    },
  });
}
