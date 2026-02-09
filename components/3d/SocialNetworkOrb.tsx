'use client';

import { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import {
  OrbitControls,
  Sphere,
  MeshDistortMaterial,
  Float,
  Text,
  Stars,
  Sparkles,
  Trail,
  MeshTransmissionMaterial,
  Environment
} from '@react-three/drei';

// Premium glowing sphere with aura
function GlowingSphere({ position, color, intensity = 0.5 }: { position: [number, number, number], color: string, intensity?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.8, 32, 32]} />
      <meshBasicMaterial color={color} transparent opacity={intensity * 0.15} />
    </mesh>
  );
}

// Animated connection with trail effect
function AnimatedConnection({ start, end, color }: { start: number[], end: number[], color: string }) {
  const ref = useRef<THREE.Line>(null);
  const particleRef = useRef<THREE.Mesh>(null);
  const [progress, setProgress] = useState(0);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    setProgress((Math.sin(time * 2) + 1) / 2);

    if (particleRef.current) {
      const t = (Math.sin(time * 3) + 1) / 2;
      particleRef.current.position.x = start[0] + (end[0] - start[0]) * t;
      particleRef.current.position.y = start[1] + (end[1] - start[1]) * t;
      particleRef.current.position.z = start[2] + (end[2] - start[2]) * t;
    }

    if (ref.current) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const x = start[0] + (end[0] - start[0]) * t;
        const y = start[1] + (end[1] - start[1]) * t + Math.sin(time * 2 + t * 4) * 0.15;
        const z = start[2] + (end[2] - start[2]) * t;
        points.push(new THREE.Vector3(x, y, z));
      }
      (ref.current.geometry as THREE.BufferGeometry).setFromPoints(points);
    }
  });

  return (
    <group>
      <line ref={ref}>
        <bufferGeometry />
        <lineBasicMaterial color={color} opacity={0.4} transparent linewidth={2} />
      </line>
      {/* Traveling particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Particle glow */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// Premium network node with multiple layers
function PremiumNetworkNode({ position, color, label, size = 0.5 }: { position: [number, number, number], color: string, label: string, size?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.x = time * 0.3;
      meshRef.current.rotation.y = time * 0.5;
      const scale = hovered ? 1.3 : 1;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.4}>
      <group position={position}>
        {/* Inner core */}
        <mesh
          ref={meshRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <icosahedronGeometry args={[size, 1]} />
          <MeshDistortMaterial
            color={color}
            distort={0.4}
            speed={2}
            roughness={0.1}
            metalness={0.9}
            emissive={color}
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Inner glow layer */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[size * 1.3, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>

        {/* Outer glow */}
        <mesh>
          <sphereGeometry args={[size * 1.8, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.05} />
        </mesh>

        {/* Label */}
        {hovered && (
          <Text
            position={[0, size + 0.8, 0]}
            fontSize={0.25}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {label}
          </Text>
        )}
      </group>
    </Float>
  );
}

// Central hub with pulsing effect
function CentralHub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);
  const ringRef3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.2;
    }
    if (ringRef1.current) {
      ringRef1.current.rotation.x = time * 0.5;
      ringRef1.current.rotation.y = time * 0.3;
      ringRef1.current.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
    }
    if (ringRef2.current) {
      ringRef2.current.rotation.x = time * 0.3;
      ringRef2.current.rotation.z = time * 0.5;
      ringRef2.current.scale.setScalar(1 + Math.sin(time * 2 + 1) * 0.05);
    }
    if (ringRef3.current) {
      ringRef3.current.rotation.y = time * 0.4;
      ringRef3.current.rotation.z = time * 0.2;
      ringRef3.current.scale.setScalar(1 + Math.sin(time * 2 + 2) * 0.05);
    }
  });

  return (
    <group>
      {/* Central sphere */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.8, 2]} />
        <MeshDistortMaterial
          color="#8b5cf6"
          distort={0.5}
          speed={3}
          roughness={0}
          metalness={1}
          emissive="#8b5cf6"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Glow layers */}
      <mesh>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.3, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.05} />
      </mesh>

      {/* Orbital rings */}
      <mesh ref={ringRef1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.02, 16, 100]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.6} />
      </mesh>
      <mesh ref={ringRef2} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[1.8, 0.015, 16, 100]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.4} />
      </mesh>
      <mesh ref={ringRef3} rotation={[Math.PI / 6, Math.PI / 2, 0]}>
        <torusGeometry args={[2.1, 0.01, 16, 100]} />
        <meshBasicMaterial color="#ddd6fe" transparent opacity={0.3} />
      </mesh>

      {/* SYNTHEX label */}
      <Text
        position={[0, 0, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        S
      </Text>
    </group>
  );
}

// Floating particles background
function ParticleField() {
  const count = 200;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#8b5cf6"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function SocialNetworkOrb() {
  const networks = [
    { position: [3.5, 1.5, -1] as [number, number, number], color: '#1DA1F2', label: 'Twitter/X', size: 0.45 },
    { position: [-3.5, -1, 1.5] as [number, number, number], color: '#0077B5', label: 'LinkedIn', size: 0.45 },
    { position: [2.5, -2.5, 2.5] as [number, number, number], color: '#E4405F', label: 'Instagram', size: 0.45 },
    { position: [-2.5, 2.5, -2] as [number, number, number], color: '#ffffff', label: 'TikTok', size: 0.45 },
    { position: [0, 3.5, 1.5] as [number, number, number], color: '#1877F2', label: 'Facebook', size: 0.45 },
    { position: [1.5, -3.5, -1.5] as [number, number, number], color: '#FF0000', label: 'YouTube', size: 0.45 },
  ];

  const connectionColor = '#8b5cf6';

  return (
    <div className="w-full h-[500px] relative rounded-2xl overflow-hidden">
      <Canvas camera={{ position: [0, 0, 12], fov: 50 }}>
        {/* Premium gradient background */}
        <color attach="background" args={['#030014']} />

        {/* Starfield */}
        <Stars radius={50} depth={50} count={2000} factor={3} saturation={0} fade speed={0.5} />

        {/* Sparkles */}
        <Sparkles count={100} scale={15} size={1.5} speed={0.3} color="#8b5cf6" />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#8b5cf6" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#3b82f6" />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#d946ef" />
        <spotLight
          position={[0, 15, 0]}
          angle={0.3}
          penumbra={1}
          intensity={0.8}
          color="#8b5cf6"
        />

        {/* Particle background */}
        <ParticleField />

        {/* Central hub */}
        <CentralHub />

        {/* Network nodes */}
        {networks.map((network, i) => (
          <PremiumNetworkNode key={i} {...network} />
        ))}

        {/* Connections */}
        {networks.map((network, i) => (
          <AnimatedConnection
            key={`conn-${i}`}
            start={[0, 0, 0]}
            end={network.position}
            color={connectionColor}
          />
        ))}

        <OrbitControls
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.3}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>

      <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
        <p className="text-white/60 text-sm backdrop-blur-sm bg-black/20 rounded-full px-4 py-2 inline-block">
          Drag to rotate • All platforms connected through SYNTHEX
        </p>
      </div>
    </div>
  );
}
