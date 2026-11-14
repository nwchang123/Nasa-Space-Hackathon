// Perseverance's parachute: decode it ring by ring with a slider (the sweep is the slider). A bright
// sweep reads each ring of gores in turn and leaves it tinted, and its word appears: DARE, MIGHTY, THINGS, then JPL's coordinates on the
// outer band. The overlay drapes on the canopy's own surface (it shares its vertices).

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Mesh, ShaderMaterial, Vector3, type Group } from 'three';
import { useReducedMotion } from '../useReducedMotion';
import { findMachine, SigFocus, SigTag, siteShown, type SiteSignatureProps } from './common';
import { useSliderDrive } from './drive';
import { PARACHUTE_RINGS, ringsDecoded } from './logic';

/** The canopy model (models.ts backshellAndChute): RingGeometry(0.5, 8, 96, 22), bands every 2.1 m. */
const CHUTE = { inner: 0.5, outer: 8, theta: 96, phi: 22, band: 2.1, at: [-1.5, 0, -8.2] as const, yaw: 0.12, squash: 0.72 };
const RING_STEP = 0.2125;

const vertex = /* glsl */ `
attribute float aRad;
attribute float aTheta;
varying float vRad;
varying float vTheta;
void main() {
  vRad = aRad;
  vTheta = aTheta;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0, 0.02, 0.0), 1.0);
}
`;
const fragment = /* glsl */ `
uniform float uDone;
uniform float uSweep;
uniform float uFade;
uniform vec3 uColor;
varying float vRad;
varying float vTheta;
void main() {
  float band = min(3.0, floor(vRad / ${CHUTE.band.toFixed(1)}));
  float a = 0.0;
  if (band < uDone) a = 0.16;
  else if (band == uDone) {
    a = vTheta < uSweep ? 0.22 : 0.0;
    float d = uSweep - vTheta;
    a += 0.75 * exp(-d * d * 900.0);
  }
  gl_FragColor = vec4(uColor * a * uFade, 1.0);
}
`;

/**
 * Where each ring's word sits (canopy-local angle): DARE, MIGHTY, THINGS reading left to right at
 * their ring's mid-radius, the coordinates on the near rim, so the four never overlap on screen.
 */
const LABEL_ANGLE = [Math.PI, 1.07, 0.12, Math.PI / 2 + 0.45];

function labelSpot(i: number): Vector3 {
  const r0 = Math.max(CHUTE.inner, i * CHUTE.band);
  const r1 = i === 3 ? CHUTE.outer : (i + 1) * CHUTE.band;
  const r = (r0 + r1) / 2;
  const th = LABEL_ANGLE[i];
  const local = new Vector3(r * Math.cos(th), 0.45, r * Math.sin(th) * CHUTE.squash);
  // Into the machine's frame: the canopy is turned by CHUTE.yaw and moved to CHUTE.at.
  return local.applyAxisAngle(new Vector3(0, 1, 0), CHUTE.yaw).add(new Vector3(...CHUTE.at));
}

export function ParachuteDecode({ stop, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const anchor = useRef<Group>(null);
  const [overlay, setOverlay] = useState<Mesh | null>(null);
  const shown = useRef(0);
  const [done, setDone] = useState(0);
  const doneRef = useRef(0);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uDone: { value: 0 }, uSweep: { value: 0 }, uFade: { value: 0 }, uColor: { value: new Vector3(0.95, 0.62, 0.2) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
    [],
  );
  useEffect(
    () => () => {
      mat.dispose();
    },
    [mat],
  );
  useEffect(
    () => () => {
      if (!overlay) return;
      // The canopy's position and index are shared: detach them so only our own buffers go.
      const g = overlay.geometry;
      g.deleteAttribute('position');
      g.setIndex(null);
      g.dispose();
    },
    [overlay],
  );

  const spots = useMemo(() => PARACHUTE_RINGS.map((_, i) => labelSpot(i)), []);
  const drive = useSliderDrive('decode', reduced);

  useFrame((_, dt) => {
    // Read every frame (also while the overlay is still being built) so the smoothing stays current.
    const v = drive(dt);
    if (!overlay) {
      // Share the canopy's own (deformed) vertices, adding each vertex's ring radius and angle.
      const chute = findMachine(anchor.current)?.getObjectByName('parachute') as Mesh | undefined;
      if (chute?.geometry) {
        const g = new BufferGeometry();
        const pos = chute.geometry.getAttribute('position');
        g.setAttribute('position', pos);
        if (chute.geometry.index) g.setIndex(chute.geometry.index);
        const n = pos.count;
        const rad = new Float32Array(n);
        const th = new Float32Array(n);
        for (let v = 0; v < n; v++) {
          const j = Math.floor(v / (CHUTE.theta + 1));
          rad[v] = CHUTE.inner + (j * (CHUTE.outer - CHUTE.inner)) / CHUTE.phi;
          th[v] = (v % (CHUTE.theta + 1)) / CHUTE.theta;
        }
        g.setAttribute('aRad', new Float32BufferAttribute(rad, 1));
        g.setAttribute('aTheta', new Float32BufferAttribute(th, 1));
        const m = new Mesh(g, mat);
        m.position.set(...CHUTE.at);
        m.rotation.y = CHUTE.yaw;
        m.renderOrder = 3;
        m.visible = false;
        setOverlay(m);
      }
      return;
    }
    const p = v === null ? null : Math.min(1, Math.max(0, v));
    const site = siteShown(stop);
    if (p === null) {
      overlay.visible = false;
      shown.current = 0;
      if (doneRef.current !== 0) setDone((doneRef.current = 0));
      return;
    }
    const n = ringsDecoded(p);
    const sweep = n >= PARACHUTE_RINGS.length ? 1 : (p - n * RING_STEP) / RING_STEP;
    mat.uniforms.uDone.value = n;
    mat.uniforms.uSweep.value = Math.min(1, sweep);
    mat.uniforms.uFade.value = site;
    overlay.visible = site > 0.003 && p > 0.001;
    shown.current = site;
    if (n !== doneRef.current) setDone((doneRef.current = n));
  });

  return (
    <group ref={anchor} rotation-y={lay.machineYaw}>
      {overlay && <primitive object={overlay} />}
      <SigFocus sigKey="decode" position={spots[1]} />
      {PARACHUTE_RINGS.map((word, i) => (
        <SigTag key={word} position={spots[i]} show={() => (i < done ? shown.current : 0)} tone={i === 3 ? 'faint' : 'amber'}>
          {word}
          {i === 3 && <small>outer band: JPL&apos;s coordinates</small>}
        </SigTag>
      ))}
    </group>
  );
}
