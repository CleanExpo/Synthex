'use client';

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Trail, Float } from '@react-three/drei';
import * as THREE from 'three';

interface Activity {
  id: number;
  type: 'like' | 'comment' | 'share' | 'follow' | 'post';
  user: string;
  action: string;
  timestamp: string;
  color: string;
  icon: string;
}

// Particle system for activity
function ActivityParticle({ activity, index }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [opacity, setOpacity] = useState(1);
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      // Flow upward and fade
      meshRef.current.position.y += 0.02;
      meshRef.current.position.x = Math.sin(time + index) * 2;
      meshRef.current.rotation.z = time * 0.5;
      
      // Fade out as it rises
      const newOpacity = Math.max(0, 1 - (meshRef.current.position.y / 10));
      setOpacity(newOpacity);
      
      // Reset position when too high
      if (meshRef.current.position.y > 10) {
        meshRef.current.position.y = -5;
      }
    }
  });

  const typeColors = {
    like: '#ef4444',
    comment: '#3b82f6',
    share: '#10b981',
    follow: '#8b5cf6',
    post: '#f59e0b',
  };

  return (
    <mesh ref={meshRef} position={[0, -5 + index * 0.5, 0]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshPhysicalMaterial
        color={typeColors[activity.type as keyof typeof typeColors]}
        emissive={typeColors[activity.type as keyof typeof typeColors]}
        emissiveIntensity={0.5}
        transparent
        opacity={opacity}
        roughness={0.1}
        metalness={0.8}
      />
    </mesh>
  );
}

// Engagement pulse waves
function EngagementWave({ delay = 0 }: any) {
  const ringRef = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(0.8);
  
  useFrame((state) => {
    if (ringRef.current) {
      const time = state.clock.getElapsedTime();
      const pulse = Math.sin((time + delay) * 2) * 0.5 + 1;
      
      ringRef.current.scale.x = ringRef.current.scale.y = pulse;
      setOpacity(0.8 - pulse * 0.3);
    }
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2, 2.2, 32]} />
      <meshBasicMaterial
        color="#8b5cf6"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Live activity ticker
function ActivityTicker({ activities }: { activities: Activity[] }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {activities.map((activity, i) => {
        const angle = (i / activities.length) * Math.PI * 2;
        const radius = 4;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        return (
          <Float key={activity.id} speed={2} rotationIntensity={0.5}>
            <group position={[x, 0, z]}>
              <mesh>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshPhysicalMaterial
                  color={activity.color}
                  emissive={activity.color}
                  emissiveIntensity={0.5}
                  roughness={0.1}
                  metalness={0.8}
                />
              </mesh>
              <Text
                position={[0, 0.6, 0]}
                fontSize={0.15}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                {activity.icon} {activity.user}
              </Text>
              <Text
                position={[0, 0.3, 0]}
                fontSize={0.1}
                color="#888"
                anchorX="center"
                anchorY="middle"
              >
                {activity.action}
              </Text>
            </group>
          </Float>
        );
      })}
    </group>
  );
}

export default function ActivityStream3D() {
  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, type: 'like', user: '@sarah', action: 'liked your post', timestamp: 'now', color: '#ef4444', icon: '❤️' },
    { id: 2, type: 'comment', user: '@john', action: 'commented', timestamp: '1m', color: '#3b82f6', icon: '💬' },
    { id: 3, type: 'share', user: '@emma', action: 'shared', timestamp: '2m', color: '#10b981', icon: '🔄' },
    { id: 4, type: 'follow', user: '@alex', action: 'started following', timestamp: '3m', color: '#8b5cf6', icon: '➕' },
    { id: 5, type: 'post', user: '@mike', action: 'posted', timestamp: '5m', color: '#f59e0b', icon: '📝' },
    { id: 6, type: 'like', user: '@lisa', action: 'liked', timestamp: '7m', color: '#ef4444', icon: '❤️' },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const types: Activity['type'][] = ['like', 'comment', 'share', 'follow', 'post'];
      const users = ['@user1', '@user2', '@user3', '@user4', '@user5'];
      const actions = ['liked your post', 'commented', 'shared', 'started following', 'posted'];
      const colors = ['#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
      const icons = ['❤️', '💬', '🔄', '➕', '📝'];
      
      const randomType = Math.floor(Math.random() * types.length);
      
      const newActivity: Activity = {
        id: Date.now(),
        type: types[randomType],
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[randomType],
        timestamp: 'now',
        color: colors[randomType],
        icon: icons[randomType],
      };
      
      setActivities(prev => [newActivity, ...prev.slice(0, 5)]);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-[500px] relative">
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, 10, -10]} intensity={0.3} />
        
        {/* Central hub */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshPhysicalMaterial
            color="#8b5cf6"
            emissive="#8b5cf6"
            emissiveIntensity={0.2}
            roughness={0.1}
            metalness={0.9}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>
        
        {/* Engagement waves */}
        <EngagementWave delay={0} />
        <EngagementWave delay={0.5} />
        <EngagementWave delay={1} />
        
        {/* Activity ticker */}
        <ActivityTicker activities={activities} />
        
        {/* Flowing particles */}
        {activities.map((activity, i) => (
          <ActivityParticle key={`particle-${i}`} activity={activity} index={i} />
        ))}
        
        {/* Stats display */}
        <Float speed={1} rotationIntensity={0.2}>
          <group position={[0, 3, 0]}>
            <Text
              fontSize={0.5}
              color="#8b5cf6"
              anchorX="center"
              anchorY="middle"
              font="/fonts/bold.woff"
            >
              LIVE ACTIVITY
            </Text>
            <Text
              position={[0, -0.5, 0]}
              fontSize={0.3}
              color="#888"
              anchorX="center"
              anchorY="middle"
            >
              {activities.length * 247} actions/min
            </Text>
          </group>
        </Float>
      </Canvas>
      
      {/* Activity feed overlay */}
      <div className="absolute top-4 right-4 w-64 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30">
        <h3 className="text-white font-bold mb-3 text-sm">Real-Time Activity</h3>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {activities.slice(0, 4).map((activity) => (
            <div key={activity.id} className="flex items-center space-x-2 text-xs text-white/80">
              <span className="text-lg">{activity.icon}</span>
              <span>
                <span className="font-semibold">{activity.user}</span> {activity.action}
              </span>
              <span className="text-white/40 ml-auto">{activity.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 text-white/60 text-sm">
        Real-time engagement visualization • {activities.length * 247} interactions per minute
      </div>
    </div>
  );
}
