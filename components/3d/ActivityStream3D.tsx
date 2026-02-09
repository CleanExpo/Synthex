'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Stars, Sparkles } from '@react-three/drei';
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

const typeConfig = {
  like: { color: '#ef4444', icon: '❤️' },
  comment: { color: '#3b82f6', icon: '💬' },
  share: { color: '#10b981', icon: '🔄' },
  follow: { color: '#8b5cf6', icon: '➕' },
  post: { color: '#f59e0b', icon: '📝' },
};

// Flowing particle stream
function FlowingParticles() {
  const count = 100;
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const particleData = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          -8 + Math.random() * 16,
          (Math.random() - 0.5) * 10
        ),
        speed: 0.02 + Math.random() * 0.03,
        color: Object.values(typeConfig)[Math.floor(Math.random() * 5)].color,
      });
    }
    return data;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();

    particleData.forEach((particle, i) => {
      particle.position.y += particle.speed;
      if (particle.position.y > 8) {
        particle.position.y = -8;
        particle.position.x = (Math.random() - 0.5) * 10;
        particle.position.z = (Math.random() - 0.5) * 10;
      }

      dummy.position.copy(particle.position);
      dummy.scale.setScalar(0.05 + Math.sin(particle.position.y * 0.5) * 0.02);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} />
    </instancedMesh>
  );
}

// Central hub with pulsing rings
function CentralHub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.3;
      meshRef.current.rotation.x = Math.sin(time * 0.5) * 0.1;
    }

    if (ring1Ref.current) {
      ring1Ref.current.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
      ring1Ref.current.rotation.z = time * 0.5;
    }
    if (ring2Ref.current) {
      ring2Ref.current.scale.setScalar(1 + Math.sin(time * 2 + 1) * 0.1);
      ring2Ref.current.rotation.z = -time * 0.3;
    }
    if (ring3Ref.current) {
      ring3Ref.current.scale.setScalar(1 + Math.sin(time * 2 + 2) * 0.1);
      ring3Ref.current.rotation.z = time * 0.4;
    }
  });

  return (
    <group>
      {/* Core sphere */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.2, 2]} />
        <meshPhysicalMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={0.4}
          roughness={0}
          metalness={1}
          clearcoat={1}
          clearcoatRoughness={0}
        />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.2} />
      </mesh>

      {/* Middle glow */}
      <mesh>
        <sphereGeometry args={[1.9, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>

      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[2.4, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.05} />
      </mesh>

      {/* Pulsing rings */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 2.6, 64]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.0, 3.08, 64]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 3.56, 64]} />
        <meshBasicMaterial color="#ddd6fe" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Orbiting activity node
function ActivityOrbit({ activity, index, total }: { activity: Activity, index: number, total: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const angle = (index / total) * Math.PI * 2;
  const radius = 5;

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (groupRef.current) {
      const currentAngle = angle + time * 0.2;
      groupRef.current.position.x = Math.cos(currentAngle) * radius;
      groupRef.current.position.z = Math.sin(currentAngle) * radius;
      groupRef.current.position.y = Math.sin(time * 2 + index) * 0.5;
      groupRef.current.lookAt(0, 0, 0);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(time * 3 + index) * 0.15);
    }
  });

  const color = typeConfig[activity.type].color;

  return (
    <Float speed={2} rotationIntensity={0.3}>
      <group ref={groupRef}>
        {/* Activity sphere */}
        <mesh>
          <sphereGeometry args={[0.35, 24, 24]} />
          <meshPhysicalMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>

        {/* Glow effect */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.5, 24, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>

        {/* Label */}
        <Text
          position={[0, 0.7, 0]}
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000"
        >
          {activity.icon} {activity.user}
        </Text>
        <Text
          position={[0, 0.45, 0]}
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
}

// Connection lines from center to orbiting nodes
function ConnectionBeams({ activities }: { activities: Activity[] }) {
  const linesRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!linesRef.current) return;
    const time = state.clock.getElapsedTime();

    linesRef.current.children.forEach((child, i) => {
      const line = child as THREE.Line;
      const geometry = line.geometry as THREE.BufferGeometry;
      const positions = geometry.attributes.position.array as Float32Array;

      const angle = (i / activities.length) * Math.PI * 2 + time * 0.2;
      const radius = 5;

      // Start point (center)
      positions[0] = 0;
      positions[1] = 0;
      positions[2] = 0;

      // End point (orbiting node)
      positions[3] = Math.cos(angle) * radius;
      positions[4] = Math.sin(time * 2 + i) * 0.5;
      positions[5] = Math.sin(angle) * radius;

      geometry.attributes.position.needsUpdate = true;
    });
  });

  return (
    <group ref={linesRef}>
      {activities.map((activity, i) => (
        <line key={`beam-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([0, 0, 0, 0, 0, 0])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={typeConfig[activity.type].color}
            transparent
            opacity={0.3}
          />
        </line>
      ))}
    </group>
  );
}

export default function ActivityStream3D() {
  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, type: 'like', user: '@sarah', action: 'liked', timestamp: 'now', color: '#ef4444', icon: '❤️' },
    { id: 2, type: 'comment', user: '@john', action: 'commented', timestamp: '1m', color: '#3b82f6', icon: '💬' },
    { id: 3, type: 'share', user: '@emma', action: 'shared', timestamp: '2m', color: '#10b981', icon: '🔄' },
    { id: 4, type: 'follow', user: '@alex', action: 'followed', timestamp: '3m', color: '#8b5cf6', icon: '➕' },
    { id: 5, type: 'post', user: '@mike', action: 'posted', timestamp: '5m', color: '#f59e0b', icon: '📝' },
    { id: 6, type: 'like', user: '@lisa', action: 'liked', timestamp: '7m', color: '#ef4444', icon: '❤️' },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const types: Activity['type'][] = ['like', 'comment', 'share', 'follow', 'post'];
      const users = ['@user1', '@user2', '@user3', '@user4', '@user5', '@creator', '@brand'];
      const actions = ['liked', 'commented', 'shared', 'followed', 'posted'];

      const randomType = Math.floor(Math.random() * types.length);
      const config = typeConfig[types[randomType]];

      const newActivity: Activity = {
        id: Date.now(),
        type: types[randomType],
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[randomType],
        timestamp: 'now',
        color: config.color,
        icon: config.icon,
      };

      setActivities(prev => [newActivity, ...prev.slice(0, 5)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const activityCount = activities.length * 247;

  return (
    <div className="w-full h-[500px] relative rounded-2xl overflow-hidden">
      <Canvas camera={{ position: [0, 6, 12], fov: 50 }}>
        {/* Premium dark background */}
        <color attach="background" args={['#030014']} />

        {/* Starfield */}
        <Stars radius={50} depth={50} count={1500} factor={2} saturation={0} fade speed={0.4} />

        {/* Sparkles */}
        <Sparkles count={60} scale={15} size={1} speed={0.2} color="#8b5cf6" />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#8b5cf6" />
        <pointLight position={[-10, 10, -10]} intensity={0.6} color="#d946ef" />
        <pointLight position={[0, -10, 0]} intensity={0.4} color="#3b82f6" />
        <spotLight
          position={[0, 15, 0]}
          angle={0.4}
          penumbra={1}
          intensity={0.8}
          color="#8b5cf6"
        />

        {/* Flowing particles */}
        <FlowingParticles />

        {/* Central hub */}
        <CentralHub />

        {/* Connection beams */}
        <ConnectionBeams activities={activities} />

        {/* Orbiting activity nodes */}
        {activities.map((activity, i) => (
          <ActivityOrbit
            key={activity.id}
            activity={activity}
            index={i}
            total={activities.length}
          />
        ))}

        {/* Stats display */}
        <Float speed={1} rotationIntensity={0.1}>
          <group position={[0, 4.5, 0]}>
            <Text
              fontSize={0.5}
              color="#8b5cf6"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#000"
            >
              LIVE ACTIVITY
            </Text>
            <Text
              position={[0, -0.6, 0]}
              fontSize={0.3}
              color="#a78bfa"
              anchorX="center"
              anchorY="middle"
            >
              {activityCount.toLocaleString()} actions/min
            </Text>
          </group>
        </Float>

        {/* Fog for depth */}
        <fog attach="fog" args={['#030014', 10, 30]} />
      </Canvas>

      {/* Activity feed overlay */}
      <div className="absolute top-4 right-4 w-64 bg-black/70 backdrop-blur-xl rounded-xl p-4 border border-purple-500/30 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
        <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Real-Time Activity
        </h3>
        <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
          {activities.slice(0, 4).map((activity) => (
            <div
              key={activity.id}
              className="flex items-center space-x-2 text-xs text-white/80 py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-base">{activity.icon}</span>
              <span className="flex-1">
                <span className="font-semibold text-white">{activity.user}</span>{' '}
                <span className="text-white/60">{activity.action}</span>
              </span>
              <span className="text-white/40 text-[10px]">{activity.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 pointer-events-none">
        <p className="text-white/60 text-sm backdrop-blur-sm bg-black/20 rounded-full px-4 py-2 inline-block">
          {activityCount.toLocaleString()} interactions per minute
        </p>
      </div>
    </div>
  );
}
