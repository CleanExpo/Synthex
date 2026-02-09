'use client';

import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Text, Float, Html, Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Heart, MessageCircle, Share2, Bookmark } from '@/components/icons';

interface PostData {
  username: string;
  handle: string;
  content: string;
  likes: string;
  comments: string;
  shares: string;
  timestamp: string;
  verified: boolean;
  image?: string;
  gradient: string;
}

// Floating particles background
function ParticleRing() {
  const count = 150;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 12 + Math.random() * 5;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
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
        size={0.08}
        color="#8b5cf6"
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  );
}

function InteractivePost({ position, rotation, data, delay = 0 }: { position: [number, number, number], rotation: [number, number, number], data: PostData, delay: number }) {
  const meshRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [liked, setLiked] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      meshRef.current.position.y = position[1] + Math.sin(time * 0.5 + delay) * 0.3;
      if (!hovered) {
        meshRef.current.rotation.y = rotation[1] + Math.sin(time * 0.3 + delay) * 0.1;
      }
    }
    if (glowRef.current) {
      const time = state.clock.getElapsedTime();
      glowRef.current.scale.setScalar(1 + Math.sin(time * 2 + delay) * 0.05);
    }
  });

  return (
    <Float speed={2} rotationIntensity={hovered ? 0 : 0.15} floatIntensity={0.4}>
      <group
        ref={meshRef}
        position={position}
        rotation={rotation}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.08 : 1}
      >
        {/* Glow effect behind card */}
        <mesh ref={glowRef} position={[0, 0, -0.2]}>
          <planeGeometry args={[4.5, 5.5]} />
          <meshBasicMaterial
            color={data.gradient}
            transparent
            opacity={hovered ? 0.25 : 0.15}
          />
        </mesh>

        {/* Card background */}
        <RoundedBox args={[4, 5, 0.15]} radius={0.15} smoothness={4}>
          <meshPhysicalMaterial
            color="#1a1a2e"
            roughness={0.05}
            metalness={0.9}
            clearcoat={1}
            clearcoatRoughness={0.1}
            emissive="#1a0a2e"
            emissiveIntensity={0.1}
          />
        </RoundedBox>

        {/* Gradient border */}
        <mesh position={[0, 0, 0.08]}>
          <planeGeometry args={[4.05, 5.05]} />
          <meshBasicMaterial
            color={data.gradient}
            transparent
            opacity={0.1}
          />
        </mesh>

        {/* Glass overlay */}
        <RoundedBox args={[4.02, 5.02, 0.05]} radius={0.15} position={[0, 0, 0.1]}>
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.05}
            roughness={0}
            metalness={0.5}
          />
        </RoundedBox>

        {/* HTML Content overlay */}
        <Html
          transform
          occlude
          position={[0, 0, 0.2]}
          style={{
            width: '350px',
            padding: '20px',
            backgroundColor: 'rgba(26, 26, 46, 0.95)',
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            border: `1px solid rgba(139, 92, 246, ${hovered ? 0.5 : 0.2})`,
            boxShadow: hovered
              ? '0 0 40px rgba(139, 92, 246, 0.3), 0 20px 40px rgba(0, 0, 0, 0.4)'
              : '0 10px 30px rgba(0, 0, 0, 0.3)',
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          <div className="text-white">
            {/* Post header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${data.gradient}, #8b5cf6)` }}
                />
                <div>
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-white">{data.username}</span>
                    {data.verified && (
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-400 text-sm">{data.handle} · {data.timestamp}</span>
                </div>
              </div>
            </div>

            {/* Post content */}
            <p className="mb-4 text-sm leading-relaxed text-gray-100">{data.content}</p>

            {/* Post image placeholder */}
            {data.image && (
              <div className="mb-4 rounded-xl overflow-hidden">
                <div
                  className="h-36"
                  style={{
                    background: `linear-gradient(135deg, ${data.gradient}30, #8b5cf630)`,
                  }}
                />
              </div>
            )}

            {/* Engagement bar */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
              <button
                className={`flex items-center space-x-2 transition-all duration-300 ${
                  liked ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-red-500 hover:scale-105'
                }`}
                onClick={() => setLiked(!liked)}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                <span className="text-sm font-medium">{data.likes}</span>
              </button>

              <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-all duration-300 hover:scale-105">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{data.comments}</span>
              </button>

              <button className="flex items-center space-x-2 text-gray-400 hover:text-green-400 transition-all duration-300 hover:scale-105">
                <Share2 className="w-5 h-5" />
                <span className="text-sm font-medium">{data.shares}</span>
              </button>

              <button className="text-gray-400 hover:text-purple-400 transition-all duration-300 hover:scale-110" aria-label="Bookmark post">
                <Bookmark className="w-5 h-5" />
              </button>
            </div>
          </div>
        </Html>
      </group>
    </Float>
  );
}

export default function FloatingPostCards() {
  const posts: PostData[] = [
    {
      username: 'TechCEO',
      handle: '@techceo',
      content: 'Just launched our new AI features! The engagement metrics are through the roof 🚀 Thanks to @SYNTHEX for making our social media strategy actually work.',
      likes: '12.5K',
      comments: '342',
      shares: '1.2K',
      timestamp: '2h',
      verified: true,
      image: '/placeholder-image.jpg',
      gradient: '#8b5cf6',
    },
    {
      username: 'MarketingPro',
      handle: '@marketingpro',
      content: 'Stop paying agencies $10K/month. Started using SYNTHEX last month and our engagement is up 300%. This is the future of social media management.',
      likes: '8.3K',
      comments: '189',
      shares: '567',
      timestamp: '4h',
      verified: false,
      gradient: '#d946ef',
    },
    {
      username: 'StartupFounder',
      handle: '@founder',
      content: 'The AI-generated content is indistinguishable from human writing. But with 10x the consistency and 100x the speed. Game changer. 🔥',
      likes: '15.7K',
      comments: '423',
      shares: '2.1K',
      timestamp: '1d',
      verified: true,
      gradient: '#06b6d4',
    },
  ];

  return (
    <div className="w-full h-[600px] relative rounded-2xl overflow-hidden">
      <Canvas camera={{ position: [0, 0, 16], fov: 45 }}>
        {/* Premium dark background */}
        <color attach="background" args={['#030014']} />

        {/* Starfield */}
        <Stars radius={60} depth={60} count={1500} factor={2.5} saturation={0} fade speed={0.3} />

        {/* Sparkles */}
        <Sparkles count={80} scale={20} size={1.2} speed={0.2} color="#d946ef" />

        {/* Particle ring */}
        <ParticleRing />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#8b5cf6" />
        <pointLight position={[-10, -10, -10]} intensity={0.6} color="#d946ef" />
        <pointLight position={[0, 10, 5]} intensity={0.8} color="#06b6d4" />
        <spotLight
          position={[0, 15, 10]}
          angle={0.4}
          penumbra={1}
          intensity={0.6}
          color="#8b5cf6"
          castShadow
        />

        {/* Floating posts */}
        <InteractivePost
          position={[-5.5, 0, 0]}
          rotation={[0, 0.25, 0]}
          data={posts[0]}
          delay={0}
        />
        <InteractivePost
          position={[0, 0.5, -2]}
          rotation={[0, 0, 0]}
          data={posts[1]}
          delay={1.2}
        />
        <InteractivePost
          position={[5.5, 0, 0]}
          rotation={[0, -0.25, 0]}
          data={posts[2]}
          delay={2.4}
        />

        {/* Ambient fog for depth */}
        <fog attach="fog" args={['#030014', 15, 35]} />
      </Canvas>

      <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
        <p className="text-white/60 text-sm backdrop-blur-sm bg-black/20 rounded-full px-4 py-2 inline-block">
          Hover to interact • Click hearts to like • Real engagement in 3D
        </p>
      </div>
    </div>
  );
}
