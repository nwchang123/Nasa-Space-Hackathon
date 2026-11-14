// 3D stage for Still Here: Flight 73. Mars lit by the real Sun for "now", the nine stops and the
// route, Ingenuity, and one site diorama at a time standing on the globe at its stop, all filmed
// as one continuous shot. Full-size R3F canvas behind the console UI.
// Contract: reads useApp(); writes only hover(id).

import { OrbitControls, PerformanceMonitor, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type { MachineId } from '../types';
import { CameraRig } from './CameraRig';
import { Diorama, FOG_OFF } from './Diorama';
import { Director } from './Director';
import { FadeQuad } from './FadeQuad';
import { Globe } from './Globe';
import { Ingenuity } from './Ingenuity';
import { Lights } from './Lights';
import { Starfield } from './Starfield';

function Scene() {
  // The one diorama mounted right now (the Director swaps it only once the old one is left behind).
  const [site, setSite] = useState<MachineId | null>(null);
  return (
    <>
      <Director onSite={setSite} />
      <CameraRig />
      {/* Enabled by the rig only in the flight log, once the camera has settled. */}
      <OrbitControls
        makeDefault
        enabled={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.6}
        minDistance={1.3}
        maxDistance={12}
      />
      <Starfield />
      <Lights />
      <Globe />
      {site && <Diorama key={site} stop={site} />}
      <Ingenuity />
      <FadeQuad />
    </>
  );
}

/** Add ?fps to the address to show a frame-rate meter (for checking on judges' kind of hardware). */
const SHOW_FPS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fps');
const fullDpr = () => Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

export default function Stage() {
  // Sharp on capable screens; drops to 1× when the frame rate falls, so slow laptops stay smooth.
  const [dpr, setDpr] = useState(fullDpr);
  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  return (
    <Canvas
      flat
      shadows
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 1.2, 13], fov: 40, near: 0.01, far: 80 }}
    >
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', FOG_OFF[0], FOG_OFF[1]]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(fullDpr())} flipflops={3} onFallback={() => setDpr(1)} />
      {SHOW_FPS && <Stats />}
      <Scene />
    </Canvas>
  );
}
