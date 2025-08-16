'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Text } from '@react-three/drei';

// Animated social network nodes
function NetworkNode({ position, color, label }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
      if (hovered) {
        meshRef.current.scale.x = meshRef.current.scale.y = meshRef.current.scale.z = 1.2;
      } else {
        meshRef.current.scale.x = meshRef.current.scale.y = meshRef.current.scale.z = 1;
      }
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh
        ref={meshRef}
        position={position}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={0.3}
          speed={2}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
      {hovered && (
        <Text
          position={[position[0], position[1] + 1, position[2]]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </Float>
  );
}

// Connection lines between nodes
function ConnectionLine({ start, end }: any) {
  const ref = useRef<THREE.BufferGeometry>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const time = state.clock.getElapsedTime();
      const points = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const x = start[0] + (end[0] - start[0]) * t;
        const y = start[1] + (end[1] - start[1]) * t + Math.sin(time * 2 + t * 3) * 0.1;
        const z = start[2] + (end[2] - start[2]) * t;
        points.push(new THREE.Vector3(x, y, z));
      }
      ref.current.setFromPoints(points);
    }
  });

  return (
    <line>
      <bufferGeometry ref={ref} />
      <lineBasicMaterial color="#8b5cf6" opacity={0.3} transparent />
    </line>
  );
}

// Main 3D Social Network Visualization
export default function SocialNetworkOrb() {
  const networks = [
    { position: [0, 0, 0], color: '#8b5cf6', label: 'SYNTHEX Hub' },
    { position: [3, 1, -1], color: '#1DA1F2', label: 'Twitter/X' },
    { position: [-3, -1, 1], color: '#0077B5', label: 'LinkedIn' },
    { position: [2, -2, 2], color: '#E4405F', label: 'Instagram' },
    { position: [-2, 2, -2], color: '#000000', label: 'TikTok' },
    { position: [0, 3, 1], color: '#1877F2', label: 'Facebook' },
    { position: [1, -3, -1], color: '#FF0000', label: 'YouTube' },
  ];

  const connections = [
    [networks[0].position, networks[1].position],
    [networks[0].position, networks[2].position],
    [networks[0].position, networks[3].position],
    [networks[0].position, networks[4].position],
    [networks[0].position, networks[5].position],
    [networks[0].position, networks[6].position],
  ];

  return (
    <div className="w-full h-[500px] relative">
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        {/* Animated background particles */}
        <mesh>
          <sphereGeometry args={[15, 32, 32]} />
          <meshBasicMaterial color="#000000" side={THREE.BackSide} />
        </mesh>
        
        {/* Network nodes */}
        {networks.map((network, i) => (
          <NetworkNode key={i} {...network} />
        ))}
        
        {/* Connection lines */}
        {connections.map((conn, i) => (
          <ConnectionLine key={i} start={conn[0]} end={conn[1]} />
        ))}
        
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
      
      <div className="absolute bottom-4 left-4 right-4 text-center">
        <p className="text-white/60 text-sm">
          Drag to rotate • All platforms connected through SYNTHEX
        </p>
      </div>
    </div>
  );
}
