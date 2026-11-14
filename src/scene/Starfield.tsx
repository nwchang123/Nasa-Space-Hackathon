// Sparse, faint starfield on a sphere that follows the camera, just inside the far plane (so the
// globe and the site dioramas always sit in front of it). Twinkle is off with prefers-reduced-motion.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, type PerspectiveCamera } from 'three';
import { useReducedMotion } from './useReducedMotion';

const COUNT = 2600;
const RADIUS = 400;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    float tw = 0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 0.9) + aPhase * 40.0);
    vAlpha = aBright * (1.0 - uTwinkle * 0.45 * tw);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, vAlpha * a);
  }
`;

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Starfield() {
  const reduced = useReducedMotion();
  const dpr = useThree(s => s.viewport.dpr);
  const ref = useRef<Points>(null);

  const { geometry, material } = useMemo(() => {
    const r = rand(42);
    const pos = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const bright = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const color = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const z = 2 * r() - 1;
      const a = r() * Math.PI * 2;
      const h = Math.sqrt(1 - z * z);
      pos[i * 3] = RADIUS * h * Math.cos(a);
      pos[i * 3 + 1] = RADIUS * z;
      pos[i * 3 + 2] = RADIUS * h * Math.sin(a);
      const m = Math.pow(r(), 3.2); // most stars faint, a few bright
      size[i] = 1.1 + m * 2.6;
      bright[i] = 0.12 + m * 0.75;
      phase[i] = r();
      const tint = r();
      const [cr, cg, cb] = tint < 0.15 ? [1, 0.86, 0.7] : tint < 0.35 ? [0.78, 0.86, 1] : [0.93, 0.93, 0.9];
      color[i * 3] = cr;
      color[i * 3 + 1] = cg;
      color[i * 3 + 2] = cb;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    g.setAttribute('aBright', new Float32BufferAttribute(bright, 1));
    g.setAttribute('aPhase', new Float32BufferAttribute(phase, 1));
    g.setAttribute('aColor', new Float32BufferAttribute(color, 3));
    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 }, uTwinkle: { value: 1 }, uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { geometry: g, material: mat };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.position.copy(state.camera.position);
      // Stay just inside the far plane, which the camera rig moves with the zoom.
      ref.current.scale.setScalar(((state.camera as PerspectiveCamera).far * 0.85) / RADIUS);
    }
    material.uniforms.uTime.value += delta;
    material.uniforms.uTwinkle.value = reduced ? 0 : 1;
    material.uniforms.uPixelRatio.value = dpr;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />;
}
