"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
function Carga() {
  const grupo = useRef<THREE.Group>(null),
    mesh = useRef<THREE.InstancedMesh>(null),
    o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (!mesh.current || !grupo.current) return;
    grupo.current.rotation.y = Math.sin(clock.elapsedTime * 0.15) * 0.2;
    const f = (clock.elapsedTime % 7) / 5;
    for (let i = 0; i < 40; i++) {
      const t = Math.min(1, Math.max(0, f * 40 - i));
      o.position.set(
        -2.25 + (i % 10) * 0.5 + (1 - t) * 7,
        0.22 + Math.floor(i / 20) * 0.45,
        -0.3 + (Math.floor(i / 10) % 2) * 0.6,
      );
      o.scale.setScalar(t);
      o.updateMatrix();
      mesh.current.setMatrixAt(i, o.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={grupo}>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[5.3, 0.08, 1.8]} />
        <meshStandardMaterial color="#E5E7EB" />
      </mesh>
      <mesh position={[-2.65, 0.6, 0]}>
        <boxGeometry args={[0.08, 1.3, 1.8]} />
        <meshStandardMaterial color="#0F2A44" transparent opacity={0.4} />
      </mesh>
      <instancedMesh ref={mesh} args={[undefined, undefined, 40]}>
        <boxGeometry args={[0.48, 0.42, 0.58]} />
        <meshStandardMaterial color="#F97316" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}
export default function HeroEscena({ visible }: { visible: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={visible ? "always" : "never"}
      camera={{ position: [6, 4, 7], fov: 40 }}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 8, 4]} intensity={2} />
      <Carga />
    </Canvas>
  );
}
