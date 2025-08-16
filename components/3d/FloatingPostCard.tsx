'use client';

import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Text, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';

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
}

function InteractivePost({ position, rotation, data, delay = 0 }: any) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [liked, setLiked] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      // Floating animation
      meshRef.current.position.y = position[1] + Math.sin(time * 0.5 + delay) * 0.2;
      // Gentle rotation when not hovered
      if (!hovered) {
        meshRef.current.rotation.y = rotation[1] + Math.sin(time * 0.3 + delay) * 0.1;
      }
    }
  });

  return (
    <Float
      speed={2}
      rotationIntensity={hovered ? 0 : 0.2}
      floatIntensity={0.5}
    >
      <group
        ref={meshRef}
        position={position}
        rotation={rotation}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.05 : 1}
      >
        {/* Card background */}
        <RoundedBox args={[4, 5, 0.1]} radius={0.1} smoothness={4}>
          <meshPhysicalMaterial
            color="#1a1a2e"
            roughness={0.1}
            metalness={0.8}
            clearcoat={1}
            clearcoatRoughness={0.2}
          />
        </RoundedBox>
        
        {/* Glass overlay effect */}
        <RoundedBox args={[4.05, 5.05, 0.05]} radius={0.1} position={[0, 0, 0.1]}>
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.1}
            roughness={0}
            metalness={0.5}
            transmission={0.9}
            thickness={0.5}
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
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <div className="text-white">
            {/* Post header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                <div>
                  <div className="flex items-center space-x-1">
                    <span className="font-bold">{data.username}</span>
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
            <p className="mb-4 text-sm leading-relaxed">{data.content}</p>
            
            {/* Post image if exists */}
            {data.image && (
              <div className="mb-4 rounded-lg overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-purple-600/20 to-pink-600/20" />
              </div>
            )}
            
            {/* Engagement bar */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-700">
              <button
                className={`flex items-center space-x-2 transition-colors ${
                  liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                }`}
                onClick={() => setLiked(!liked)}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                <span className="text-sm">{data.likes}</span>
              </button>
              
              <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">{data.comments}</span>
              </button>
              
              <button className="flex items-center space-x-2 text-gray-400 hover:text-green-400 transition-colors">
                <Share2 className="w-5 h-5" />
                <span className="text-sm">{data.shares}</span>
              </button>
              
              <button className="text-gray-400 hover:text-purple-400 transition-colors" aria-label="Bookmark post">
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
    },
  ];

  return (
    <div className="w-full h-[600px] relative">
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.4} />
        <spotLight
          position={[0, 10, 0]}
          angle={0.3}
          penumbra={1}
          intensity={0.5}
          castShadow
        />
        
        {/* Floating posts */}
        <InteractivePost
          position={[-5, 0, 0]}
          rotation={[0, 0.2, 0]}
          data={posts[0]}
          delay={0}
        />
        <InteractivePost
          position={[0, 0, -2]}
          rotation={[0, 0, 0]}
          data={posts[1]}
          delay={1}
        />
        <InteractivePost
          position={[5, 0, 0]}
          rotation={[0, -0.2, 0]}
          data={posts[2]}
          delay={2}
        />
        
        {/* Background gradient sphere */}
        <mesh position={[0, 0, -10]}>
          <sphereGeometry args={[20, 32, 32]} />
          <meshBasicMaterial
            side={THREE.BackSide}
            transparent
            opacity={0.3}
          >
            <primitive attach="map" object={new THREE.Texture()} />
          </meshBasicMaterial>
        </mesh>
      </Canvas>
      
      <div className="absolute bottom-4 left-4 right-4 text-center">
        <p className="text-white/60 text-sm">
          Hover to interact • Click hearts to like • Real engagement in 3D
        </p>
      </div>
    </div>
  );
}
