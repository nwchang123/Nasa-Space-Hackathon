// Flight 73's phantom. The real Ingenuity cannot fly again: its blades broke on flight 72. When the
// visitor lifts off from home, the real, broken helicopter stays on its sand ripple at Valinor
// Hills, and an imagined one, glowing amber-gold with whole blades, rises out of it and flies the
// route. Back home it settles onto the real one and fades into it as its rotors stop.
// phantomLook() is pure (unit-tested); phantomMaterial() is the hologram look.

import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three';
import { HOME } from '../flight/route';
import type { FlightState, Phase } from '../store';
import { MACHINE_IDS } from '../types';
import { smoothstep } from './layout';

/** The phantom fades in over the first part of the climb out of home, ms. */
export const PHANTOM_RISE_MS = 900;

export interface PhantomLook {
  /** How much of the flyer is the phantom, 0 (the real, broken Ingenuity) .. 1 (fully phantom). */
  phantom: number;
  /** The real Ingenuity is drawn separately at home (it stayed behind while the phantom flies). */
  realAtHome: boolean;
}

/**
 * Who the flying Ingenuity is right now. `elapsedMs` is time into the stage (stageElapsed);
 * `rotor` and `hover` come from the shot (the merge back home follows the rotor winding down).
 */
export function phantomLook(phase: Phase, f: FlightState, elapsedMs: number, rotor: number, hover: number): PhantomLook {
  if (phase !== 'flight' || f.stage === 'prologue') return { phantom: 0, realAtHome: false };
  if (f.stage === 'flying') {
    const phantom = f.from === HOME ? smoothstep(0, PHANTOM_RISE_MS, elapsedMs) : 1;
    return { phantom, realAtHome: phantom > 0 };
  }
  const homeNow = f.stage === 'epilogue' || MACHINE_IDS[f.leg] === HOME;
  if (!homeNow) return { phantom: 1, realAtHome: true };
  // Home again: the phantom touches down on the real one, then fades into it as its rotors stop.
  const phantom = hover > 0.001 ? 1 : smoothstep(0.04, 0.9, rotor);
  return { phantom, realAtHome: phantom > 0 };
}

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform vec3 rim;
  uniform float opacity;
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
    f = pow(f, 1.7);
    // Faint scan lines drifting up the screen, like a projection.
    float scan = 0.82 + 0.18 * sin(gl_FragCoord.y * 0.75 - time * 5.0);
    vec3 c = mix(color, rim, f) * (0.45 + 1.25 * f) * scan;
    gl_FragColor = vec4(c, opacity * (0.22 + 0.62 * f));
  }
`;

/** The phantom's hologram material: amber-gold, brighter at the edges, see-through, unlit. */
export function phantomMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      color: { value: new Color('#f2a93b') },
      rim: { value: new Color('#ffe7b0') },
      opacity: { value: 1 },
      time: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}
