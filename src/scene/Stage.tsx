// 3D stage: the Moon and Mars lit by the real Sun for "now", the machines on them, a deep-space
// schematic, and the call effects. Full-size R3F canvas behind the console UI.
// Contract: reads useApp(); writes only select(id) and hover(id).

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { useApp } from '../store';
import { CameraRig } from './CameraRig';
import { DeepSpace } from './DeepSpace';
import { Globe } from './Globe';
import { MARS_LOOK, MOON_LOOK } from './globeMaterial';
import { MARS_POS, MARS_R, MARS_YAW, MOON_POS, MOON_R, MOON_YAW } from './layout';
import { Starfield } from './Starfield';

function Controls() {
  const phase = useApp(s => s.phase);
  const enabled = phase === 'rollcall' || phase === 'report';
  return (
    <OrbitControls
      makeDefault
      enabled={enabled}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.45}
      zoomSpeed={0.6}
      minDistance={1.3}
      maxDistance={60}
    />
  );
}

export default function Stage() {
  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 1.2, 13], fov: 40, near: 0.02, far: 1200 }}
    >
      <color attach="background" args={['#05070a']} />
      <Starfield />
      <Globe world="moon" radius={MOON_R} position={MOON_POS} yaw={MOON_YAW} look={MOON_LOOK} />
      <Globe world="mars" radius={MARS_R} position={MARS_POS} yaw={MARS_YAW} look={MARS_LOOK} />
      <DeepSpace />
      <Controls />
      <CameraRig />
    </Canvas>
  );
}
