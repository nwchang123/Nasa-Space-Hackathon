// A full-screen black quad drawn in clip space (so it is always glued to the camera), on top of
// everything. Fades the stage in at load, and covers the reduced-motion view changes.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { ShaderMaterial, type Mesh } from 'three';
import { live } from './registry';

export function FadeQuad() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uAlpha: { value: 1 } },
        vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `uniform float uAlpha; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha); }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    material.uniforms.uAlpha.value = live.black;
    if (mesh.current) mesh.current.visible = live.black > 0.002;
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={1000}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
