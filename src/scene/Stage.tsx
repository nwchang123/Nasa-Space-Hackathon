// 3D stage. STUB: replaced by the scene module.
// Contract: default export <Stage />, a full-size R3F <Canvas> that reads useApp() and
// writes only useApp.getState().select(id) / hover(id).

import { Canvas } from '@react-three/fiber';

export default function Stage() {
  return (
    <Canvas camera={{ position: [0, 0.4, 9], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={['#05070a']} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 2, 5]} intensity={2} />
      <mesh position={[-2.4, 0, 0]}>
        <sphereGeometry args={[1, 64, 32]} />
        <meshStandardMaterial color="#9a9a96" />
      </mesh>
      <mesh position={[2.4, 0, 0]}>
        <sphereGeometry args={[0.9, 64, 32]} />
        <meshStandardMaterial color="#b4643c" />
      </mesh>
    </Canvas>
  );
}
