// Viking 1: the first photograph from the surface, re-created from this scene and scanned in strip
// by strip as the visitor drags the slider (the scan line is the slider). Viking 2: the winter
// frost of 1979 settling on the ground and rocks.

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PerspectiveCamera, Vector3, WebGLRenderTarget, type Group, type MeshStandardMaterial, type Object3D, type Scene, type WebGLRenderer } from 'three';
import { sigOrPreset } from '../../data/signatures';
import { useApp } from '../../store';
import { SITE_SCALE } from '../layout';
import { live } from '../registry';
import { useReducedMotion } from '../useReducedMotion';
import { findMachine, rightFrontFoot, siteShown, sigNow, type SiteSignatureProps } from './common';
import { useSliderDrive } from './drive';

// ---------------------------------------------------------------- Viking 1

const PHOTO_W = 728;
const PHOTO_H = 280;
const PHOTO_FOV = 24;
/** The camera, high on the body, and where it looks, relative to the right-front footpad (m). */
const EYE_FROM_FOOT: [number, number, number] = [0.62, 1.4, -0.22];
const AIM_FROM_FOOT: [number, number, number] = [-0.02, -0.07, 0.62];

/**
 * Render the view from the lander's camera (machine-local, between the top of the body and the
 * front-right footpad) into a grey-scale picture: gamma, a contrast stretch, faint line-to-line
 * banding and grain, like a facsimile camera's scan.
 */
function shootFirstPhoto(gl: WebGLRenderer, scene: Scene, machine: Object3D): ImageData {
  const foot = rightFrontFoot(machine) ?? new Vector3(-1.2, 0, 0.8);
  const eye = foot.clone().add(new Vector3(...EYE_FROM_FOOT));
  const target = foot.clone().add(new Vector3(...AIM_FROM_FOOT));
  machine.localToWorld(eye);
  machine.localToWorld(target);

  const cam = new PerspectiveCamera(PHOTO_FOV, PHOTO_W / PHOTO_H, 0.05 * SITE_SCALE, 400 * SITE_SCALE);
  cam.position.copy(eye);
  cam.up.copy(live.site.up);
  cam.lookAt(target);
  cam.updateMatrixWorld();

  const rt = new WebGLRenderTarget(PHOTO_W, PHOTO_H);
  const prev = gl.getRenderTarget();
  gl.setRenderTarget(rt);
  gl.clear();
  gl.render(scene, cam);
  gl.setRenderTarget(prev);
  const px = new Uint8Array(PHOTO_W * PHOTO_H * 4);
  gl.readRenderTargetPixels(rt, 0, 0, PHOTO_W, PHOTO_H, px);
  rt.dispose();

  // Linear RGB → luminance → display gamma; rows come bottom-up.
  const n = PHOTO_W * PHOTO_H;
  const lum = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let y = 0; y < PHOTO_H; y++) {
    for (let x = 0; x < PHOTO_W; x++) {
      const i = ((PHOTO_H - 1 - y) * PHOTO_W + x) * 4;
      const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const v = Math.pow(Math.max(0, l), 1 / 2.2);
      lum[y * PHOTO_W + x] = v;
      hist[Math.min(255, Math.floor(v * 256))]++;
    }
  }
  // Stretch the 1st..99.5th percentile to the full range (a dim scene still reads).
  const pick = (q: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= q * n) return i / 255;
    }
    return 1;
  };
  const lo = pick(0.01);
  const hi = Math.max(lo + 0.05, pick(0.995));
  const img = new ImageData(PHOTO_W, PHOTO_H);
  let seed = 1976;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const band = Float32Array.from({ length: PHOTO_W }, () => (rnd() - 0.5) * 0.05);
  for (let y = 0; y < PHOTO_H; y++) {
    for (let x = 0; x < PHOTO_W; x++) {
      const k = y * PHOTO_W + x;
      let v = (lum[k] - lo) / (hi - lo);
      v = v + band[x] + (rnd() - 0.5) * 0.07;
      const g = Math.round(255 * Math.min(1, Math.max(0, v)));
      const o = k * 4;
      img.data[o] = g;
      img.data[o + 1] = g;
      img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  return img;
}

export function VikingScan({ stop }: SiteSignatureProps) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const reduced = useReducedMotion();
  const anchor = useRef<Group>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const run = useRef({ img: null as ImageData | null, cols: 0, raw: undefined as number | undefined, open: false });
  const [open, setOpen] = useState(false);
  const drive = useSliderDrive('scan', reduced);

  const show = (on: boolean) => {
    run.current.open = on;
    setOpen(on);
  };

  useFrame((_, dt) => {
    const r = run.current;
    const raw = useApp.getState().sig.scan;
    const p = drive(dt);
    // A new movement of the slider opens the photo (again, if it was closed).
    if (raw !== r.raw) {
      r.raw = raw;
      if (raw !== undefined && raw > 0 && !r.open) show(true);
      if (raw === undefined && r.open) show(false);
    }
    if (p === null || !r.open) return;
    const shown = siteShown(stop);
    if (panel.current) panel.current.style.opacity = String(shown);
    const g = canvas.current?.getContext('2d');
    if (!g) return;
    if (!r.img) {
      const machine = findMachine(anchor.current);
      if (shown < 0.5 || !machine) return;
      r.img = shootFirstPhoto(gl, scene, machine);
      r.cols = 0;
      g.fillStyle = '#0b0b0b';
      g.fillRect(0, 0, PHOTO_W, PHOTO_H);
    }
    // The scan line is the slider: strips in as it moves right, back to blank as it moves left.
    const cols = Math.round(Math.min(1, Math.max(0, p)) * PHOTO_W);
    if (cols > r.cols) g.putImageData(r.img, 0, 0, r.cols, 0, cols - r.cols, PHOTO_H);
    else if (cols < r.cols) {
      g.fillStyle = '#0b0b0b';
      g.fillRect(cols, 0, r.cols - cols, PHOTO_H);
    }
    r.cols = cols;
    if (line.current) {
      line.current.style.left = `${(cols / PHOTO_W) * 100}%`;
      line.current.style.opacity = cols > 0 && cols < PHOTO_W ? '1' : '0';
    }
  });

  return (
    <group ref={anchor}>
      {open && (
        <Html
          calculatePosition={(_o, _c, size) => [size.width / 2, Math.max(70, size.height * 0.1)]}
          zIndexRange={[5, 5]}
          className="sig-tag-wrap"
          wrapperClass="sig-photo-wrap"
        >
          <div ref={panel} className="sig-photo" style={{ opacity: 0 }} role="figure" aria-label="Viking 1's first photograph, re-created">
            <p className="sig-photo-head">
              <span>Viking 1 · first photo from the surface · re-created</span>
              <button type="button" aria-label="Close the photo" onClick={() => show(false)}>
                ×
              </button>
            </p>
            <div className="sig-photo-frame">
              <canvas
                ref={el => {
                  canvas.current = el;
                  // A fresh canvas (reopened): draw what is scanned so far on the next frame.
                  if (el) run.current.cols = 0;
                  const g = el?.getContext('2d');
                  if (g) {
                    g.fillStyle = '#0b0b0b';
                    g.fillRect(0, 0, PHOTO_W, PHOTO_H);
                  }
                }}
                width={PHOTO_W}
                height={PHOTO_H}
              />
              <div ref={line} className="sig-photo-scan" aria-hidden="true" />
            </div>
            <p className="sig-photo-foot">
              Rendered from this scene, scanned in strip by strip. The 1976 original: NASA/JPL, PIA00381.
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- Viking 2

const FROST_GLSL = /* glsl */ `
uniform float uFrost;
varying vec3 vFrostP;
varying float vFrostUp;
float frostHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float frostNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(frostHash(i), frostHash(i + vec2(1.0, 0.0)), f.x), mix(frostHash(i + vec2(0.0, 1.0)), frostHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * Frost on a ground or rock material: patchy white, strongest on faces that look up, mixed in by
 * the shared `u.value` (0..1). Returns a function that takes it out again.
 */
function addFrost(mat: MeshStandardMaterial, u: { value: number }): () => void {
  const prevCompile = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(mat, shader, renderer);
    shader.uniforms.uFrost = u;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFrostP;\nvarying float vFrostUp;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 frostP = vec4(transformed, 1.0);
        vec3 frostN = objectNormal;
        #ifdef USE_INSTANCING
          frostP = instanceMatrix * frostP;
          frostN = mat3(instanceMatrix) * frostN;
        #endif
        vFrostP = frostP.xyz;
        vFrostUp = normalize(frostN).y;`,
      );
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FROST_GLSL}`).replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      if (uFrost > 0.001) {
        float n = 0.6 * frostNoise(vFrostP.xz * 1.7) + 0.4 * frostNoise(vFrostP.xz * 7.0 + 3.1);
        float patchy = smoothstep(0.32, 0.72, n);
        float up = smoothstep(0.05, 0.8, vFrostUp);
        float w = uFrost * (0.25 + 0.75 * patchy) * mix(0.3, 1.0, up) * 0.64;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.76, 0.8), w);
      }`,
    );
  };
  // Keep the earlier patch's key in ours (the ground's soft edge), so the programs never mix up.
  mat.customProgramCacheKey = () => `${prevKey.call(mat)}|sig-frost`;
  mat.needsUpdate = true;
  return () => {
    mat.onBeforeCompile = prevCompile;
    mat.customProgramCacheKey = prevKey;
    mat.needsUpdate = true;
  };
}

export function VikingFrost({ ground }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const uniform = useMemo(() => ({ value: 0 }), []);
  const undo = useRef<(() => void)[] | null>(null);

  useEffect(
    () => () => {
      undo.current?.forEach(f => f());
      undo.current = null;
    },
    [ground],
  );

  useFrame((_, dt) => {
    // On from the start (its preset, src/data/signatures.ts) until the visitor turns it off: the
    // frost settles over the ground as the site comes into view. The shader is patched only once
    // it is wanted.
    const on = sigOrPreset('frost', sigNow('frost')) === 1;
    if (on && !undo.current) undo.current = ground.materials.map(m => addFrost(m, uniform));
    const target = on ? 1 : 0;
    uniform.value = reduced ? target : uniform.value + (target - uniform.value) * (1 - Math.exp(-dt * 2.2));
    if (Math.abs(uniform.value - target) < 0.002) uniform.value = target;
  });
  return null;
}
