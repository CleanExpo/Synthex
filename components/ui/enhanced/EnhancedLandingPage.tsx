'use client';

import React, { useRef, useState, useEffect, Suspense } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Text3D, Environment, PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Sparkles, Zap, Brain, Rocket, Shield, Users, TrendingUp, ArrowRight, Check, Star, Globe, Cpu, Layers, BarChart3 } from '@/components/icons';
import Link from 'next/link';

// 3D Animated Sphere Component
function AnimatedSphere({ position = [0, 0, 0] as [number, number, number], color = "#8b5cf6", scale = 1 }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      meshRef.current.scale.setScalar(scale * (hovered ? 1.2 : 1));
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <Sphere
        ref={meshRef}
        args={[1, 64, 64]}
        position={position as [number, number, number]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
    </Float>
  );
}

// 3D Text Component
function Text3DComponent({ text, position = [0, 0, 0] as [number, number, number] }: { text: string; position?: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });

  return (
    <Text3D
      ref={meshRef}
      font="/fonts/helvetiker_bold.typeface.json"
      size={0.5}
      height={0.1}
      position={position as [number, number, number]}
      curveSegments={12}
      bevelEnabled
      bevelThickness={0.02}
      bevelSize={0.02}
      bevelOffset={0}
      bevelSegments={5}
    >
      {text}
      <meshNormalMaterial />
    </Text3D>
  );
}

// Particle Field Background
function ParticleField() {
  const points = useRef<THREE.Points>(null);
  const particlesCount = 5000;

  const positions = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.x = state.clock.elapsedTime * 0.01;
      points.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.01} color="#8b5cf6" sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

// Animated Feature Card
function FeatureCard3D({ icon: Icon, title, description, delay = 0 }: { icon: any; title: string; description: string; delay?: number }) {
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { once: true });
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 50, rotateX: -15 }}
      animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: 0.8, delay, type: "spring", stiffness: 100 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      className="relative"
    >
      <motion.div
        animate={{
          rotateY: isHovered ? 10 : 0,
          z: isHovered ? 50 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-xl rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300"
        style={{
          boxShadow: isHovered 
            ? '0 20px 40px rgba(139, 92, 246, 0.3), 0 0 80px rgba(139, 92, 246, 0.1)' 
            : '0 10px 30px rgba(0, 0, 0, 0.3)',
          transform: 'translateZ(0)',
        }}
      >
        <motion.div
          animate={{ rotate: isHovered ? 360 : 0 }}
          transition={{ duration: 0.8 }}
          className="w-16 h-16 mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
        >
          <Icon className="w-8 h-8 text-white" />
        </motion.div>
        <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
        <p className="text-gray-300">{description}</p>
        
        {/* 3D Floating particles */}
        <AnimatePresence>
          {isHovered && (
            <>
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    x: Math.random() * 200 - 100,
                    y: Math.random() * -100 - 50,
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 2, delay: i * 0.1 }}
                  className="absolute top-1/2 left-1/2 w-2 h-2 bg-purple-400 rounded-full"
                  style={{ zIndex: -1 }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// Morphing Shape Background
function MorphingShape() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute w-full h-full" viewBox="0 0 1200 800">
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 100 200 Q 400 100 700 200 T 1100 200 L 1100 600 Q 700 700 400 600 T 100 600 Z"
          fill="url(#gradient1)"
          animate={{
            d: [
              "M 100 200 Q 400 100 700 200 T 1100 200 L 1100 600 Q 700 700 400 600 T 100 600 Z",
              "M 100 250 Q 450 50 750 250 T 1100 250 L 1100 550 Q 750 750 450 550 T 100 550 Z",
              "M 100 200 Q 400 100 700 200 T 1100 200 L 1100 600 Q 700 700 400 600 T 100 600 Z",
            ]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </svg>
    </div>
  );
}

// Interactive 3D Profile Card
function Profile3DCard({ name, role, image, delay = 0 }: { name: string; role: string; image: string; delay?: number }) {
  const [isFlipped, setIsFlipped] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotateY: -180 }}
      whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 1, delay }}
      className="relative w-64 h-80 cursor-pointer"
      style={{ perspective: 1000 }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="absolute inset-0"
      >
        {/* Front */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-1"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="w-full h-full bg-gray-900 rounded-2xl flex flex-col items-center justify-center p-6">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4 flex items-center justify-center text-4xl font-bold text-white"
            >
              {name[0]}
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">{name}</h3>
            <p className="text-purple-400">{role}</p>
            <div className="mt-4 flex gap-2">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                >
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Back */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-pink-600 to-purple-600 rounded-2xl p-6 flex flex-col justify-center"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <h4 className="text-white font-bold mb-4">Skills</h4>
          <div className="space-y-2">
            {['AI Strategy', 'Marketing', 'Analytics', 'Growth'].map((skill, i) => (
              <motion.div
                key={skill}
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                className="bg-white/20 rounded-full p-2 text-white text-sm"
              >
                {skill}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Main Enhanced Landing Page Component
export default function EnhancedLandingPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const springConfig = { stiffness: 100, damping: 30 };
  const x = useSpring(mousePosition.x * 20, springConfig);
  const yMouse = useSpring(mousePosition.y * 20, springConfig);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-gray-900 overflow-hidden">
      {/* Morphing Background */}
      <MorphingShape />
      
      {/* 3D Canvas Background */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <Suspense fallback={null}>
            <ParticleField />
            <AnimatedSphere position={[-2, 2, 0]} color="#8b5cf6" />
            <AnimatedSphere position={[3, -1, -2]} color="#ec4899" scale={0.7} />
            <AnimatedSphere position={[-3, -2, -1]} color="#06b6d4" scale={0.5} />
          </Suspense>
          <OrbitControls enableZoom={false} enablePan={false} />
        </Canvas>
      </div>

      {/* Animated Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="fixed top-0 w-full z-50 backdrop-blur-xl bg-gray-900/30 border-b border-purple-500/20"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-8 h-8 text-purple-500" />
              </motion.div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Synthex
              </span>
            </motion.div>
            
            <div className="hidden md:flex items-center space-x-8">
              {['Features', 'Pricing', 'Docs', 'Blog'].map((item, i) => (
                <motion.a
                  key={item}
                  href={`/${item.toLowerCase()}`}
                  className="text-gray-300 hover:text-white transition-colors relative"
                  whileHover={{ scale: 1.1 }}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {item}
                  <motion.span
                    className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ scaleX: 0 }}
                    whileHover={{ scaleX: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.a>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2 text-white border border-purple-500/50 rounded-full hover:bg-purple-500/20 transition-colors"
              >
                Login
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Get Started
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section with 3D Elements */}
      <section className="relative pt-32 pb-20 px-6 z-10">
        <motion.div
          style={{ opacity, scale, x, y: yMouse }}
          className="container mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.h1
              className="text-6xl md:text-8xl font-bold text-white mb-6"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.span
                className="inline-block"
                animate={{ 
                  backgroundImage: [
                    'linear-gradient(45deg, #8b5cf6, #ec4899)',
                    'linear-gradient(45deg, #ec4899, #06b6d4)',
                    'linear-gradient(45deg, #06b6d4, #8b5cf6)',
                  ]
                }}
                transition={{ duration: 5, repeat: Infinity }}
                style={{
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                AI-Powered
              </motion.span>
              <br />
              <motion.span
                className="text-white"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                Marketing Revolution
              </motion.span>
            </motion.h1>
            
            <motion.p
              className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Transform your social media strategy with psychology-driven AI that understands 
              human behavior and creates content that converts.
            </motion.p>

            <motion.div
              className="flex flex-col md:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(139, 92, 246, 0.4)' }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold text-lg flex items-center gap-2 hover:shadow-2xl transition-all"
              >
                Start Free Trial
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.div>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 border-2 border-purple-500/50 text-white rounded-full font-bold text-lg hover:bg-purple-500/10 transition-all"
              >
                Watch Demo
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Floating Stats */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {[
              { label: 'Active Users', value: '50K+', icon: Users },
              { label: 'Content Generated', value: '1M+', icon: Zap },
              { label: 'ROI Increase', value: '300%', icon: TrendingUp },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                whileHover={{ y: -10, scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
                  <stat.icon className="w-8 h-8 text-purple-400 mb-2" />
                  <motion.h3
                    className="text-4xl font-bold text-white mb-1"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
                  >
                    {stat.value}
                  </motion.h3>
                  <p className="text-gray-400">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* 3D Feature Cards Section */}
      <section className="relative py-20 px-6 z-10">
        <div className="container mx-auto">
          <motion.h2
            className="text-5xl font-bold text-center text-white mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Revolutionary Features
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard3D
              icon={Brain}
              title="AI Psychology"
              description="Leverage 50+ psychological principles to create content that resonates with your audience's deepest motivations."
              delay={0}
            />
            <FeatureCard3D
              icon={Rocket}
              title="Instant Deployment"
              description="Deploy your campaigns across all major social platforms with a single click. No more manual posting."
              delay={0.1}
            />
            <FeatureCard3D
              icon={Shield}
              title="Brand Safety"
              description="Advanced AI ensures your content aligns with brand values and maintains consistency across all channels."
              delay={0.2}
            />
            <FeatureCard3D
              icon={BarChart3}
              title="Real-time Analytics"
              description="Track performance metrics in real-time with AI-powered insights and recommendations."
              delay={0.3}
            />
            <FeatureCard3D
              icon={Globe}
              title="Global Reach"
              description="Automatically adapt content for different regions, languages, and cultural contexts."
              delay={0.4}
            />
            <FeatureCard3D
              icon={Layers}
              title="Multi-Platform"
              description="Seamlessly manage Instagram, Twitter, LinkedIn, TikTok, and more from one unified dashboard."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* 3D Team Profiles */}
      <section className="relative py-20 px-6 z-10">
        <div className="container mx-auto">
          <motion.h2
            className="text-5xl font-bold text-center text-white mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Meet Our Team
          </motion.h2>
          
          <div className="flex flex-wrap justify-center gap-8">
            <Profile3DCard name="Alex Chen" role="CEO & Founder" image="/team/alex.jpg" delay={0} />
            <Profile3DCard name="Sarah Johnson" role="CTO" image="/team/sarah.jpg" delay={0.1} />
            <Profile3DCard name="Mike Williams" role="Head of AI" image="/team/mike.jpg" delay={0.2} />
            <Profile3DCard name="Emma Davis" role="Lead Designer" image="/team/emma.jpg" delay={0.3} />
          </div>
        </div>
      </section>

      {/* Interactive CTA Section */}
      <section className="relative py-20 px-6 z-10">
        <motion.div
          className="container mx-auto text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="relative bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl rounded-3xl p-12 border border-purple-500/20 overflow-hidden">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(139, 92, 246, 0.1) 10px, rgba(139, 92, 246, 0.1) 20px)',
                }}
                animate={{ x: [0, 28], y: [0, 28] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
            </div>
            
            <motion.h2
              className="text-5xl font-bold text-white mb-6 relative z-10"
              animate={{ 
                backgroundImage: [
                  'linear-gradient(45deg, #fff, #fff)',
                  'linear-gradient(45deg, #8b5cf6, #ec4899)',
                  'linear-gradient(45deg, #fff, #fff)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              style={{
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Ready to Transform Your Marketing?
            </motion.h2>
            
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto relative z-10">
              Join thousands of brands using AI to create psychology-driven content that converts.
            </p>
            
            <motion.button
              whileHover={{ scale: 1.1, boxShadow: '0 30px 60px rgba(139, 92, 246, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold text-xl relative z-10 hover:shadow-2xl transition-all"
            >
              Get Started Free
            </motion.button>
            
            <div className="mt-8 flex items-center justify-center gap-8 relative z-10">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">Cancel anytime</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}