'use client';

import React, { useRef, useState, useEffect, useMemo, ReactNode } from 'react';
import { 
  motion, 
  useScroll, 
  useTransform, 
  useSpring, 
  useInView, 
  AnimatePresence,
  useMotionValue,
  useVelocity,
  useAnimationFrame,
  MotionValue,
  cubicBezier
} from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Sphere, 
  Box, 
  Torus, 
  TorusKnot,
  MeshDistortMaterial,
  Float,
  Trail,
  Sparkles as DreiSparkles,
  Cloud,
  Stars,
  PointMaterial,
  Points,
  Text3D,
  RoundedBox,
  Wireframe,
  MeshWobbleMaterial,
  GradientTexture,
  Environment,
  ContactShadows
} from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// CUTTING-EDGE ANIMATION COMPONENTS
// ============================================

// Liquid Morphing Text
interface LiquidTextProps {
  text: string;
  className?: string;
}

export function LiquidText({ text, className = "" }: LiquidTextProps) {
  const letters = text.split('');
  
  return (
    <div className={`flex ${className}`}>
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          initial={{ y: 100, opacity: 0, filter: 'blur(10px)' }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            filter: 'blur(0px)',
          }}
          transition={{
            delay: index * 0.05,
            type: "spring",
            damping: 12,
            stiffness: 200,
          }}
          whileHover={{
            y: -20,
            scale: 1.5,
            color: '#8b5cf6',
            textShadow: '0 10px 40px rgba(139, 92, 246, 0.8)',
            transition: { type: "spring", stiffness: 300 }
          }}
          className="inline-block cursor-default"
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </div>
  );
}

// Neon Glow Card
interface NeonCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function NeonCard({ children, className = "", glowColor = "#8b5cf6" }: NeonCardProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };
  
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden ${className}`}
      whileHover={{ scale: 1.02 }}
      style={{
        background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}20, transparent 40%)`,
      }}
    >
      <motion.div
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}40, transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          boxShadow: [
            `inset 0 0 20px ${glowColor}00`,
            `inset 0 0 20px ${glowColor}40`,
            `inset 0 0 20px ${glowColor}00`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
}

// DNA Helix Loader
export function DNALoader() {
  return (
    <div className="flex gap-1">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="w-2 h-8 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
          animate={{
            scaleY: [1, 2, 1],
            rotateZ: [0, 180, 360],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Holographic Card
interface HolographicCardProps {
  children: ReactNode;
  className?: string;
}

export function HolographicCard({ children, className = "" }: HolographicCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setRotateX((y - 0.5) * -30);
    setRotateY((x - 0.5) * 30);
  };
  
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setRotateX(0); setRotateY(0); }}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`relative ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
        backdropFilter: 'blur(10px)',
      }}
    >
      <motion.div
        className="absolute inset-0 rounded-inherit"
        animate={{
          background: [
            'linear-gradient(45deg, transparent 30%, rgba(139, 92, 246, 0.3) 50%, transparent 70%)',
            'linear-gradient(45deg, transparent 30%, rgba(236, 72, 153, 0.3) 50%, transparent 70%)',
            'linear-gradient(45deg, transparent 30%, rgba(139, 92, 246, 0.3) 50%, transparent 70%)',
          ],
          backgroundPosition: ['-200% 0', '200% 0', '-200% 0'],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        style={{ mixBlendMode: 'overlay' }}
      />
      <div className="relative z-10" style={{ transform: 'translateZ(50px)' }}>
        {children}
      </div>
    </motion.div>
  );
}

// Kinetic Typography
interface KineticTextProps {
  words: string[];
  className?: string;
}

export function KineticText({ words, className = "" }: KineticTextProps) {
  const [index, setIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [words.length]);
  
  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ 
            y: 50, 
            opacity: 0, 
            scale: 0.8,
            filter: 'blur(10px)',
          }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            scale: 1,
            filter: 'blur(0px)',
          }}
          exit={{ 
            y: -50, 
            opacity: 0, 
            scale: 0.8,
            filter: 'blur(10px)',
          }}
          transition={{
            type: "spring",
            damping: 15,
            stiffness: 300,
          }}
        >
          <motion.span
            animate={{
              backgroundImage: [
                'linear-gradient(45deg, #8b5cf6, #ec4899)',
                'linear-gradient(45deg, #ec4899, #06b6d4)',
                'linear-gradient(45deg, #06b6d4, #8b5cf6)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
            className="font-bold"
          >
            {words[index]}
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Matrix Rain Effect
export function MatrixRain() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()';
  const columns = 50;
  const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {[...Array(columns)].map((_, i) => (
        <div
          key={i}
          className="absolute top-0"
          style={{ left: `${(i / columns) * 100}%` }}
        >
          {[...Array(20)].map((_, j) => (
            <motion.div
              key={j}
              initial={{ opacity: 0, y: -20 }}
              animate={{ 
                opacity: [0, 1, 0],
                y: height + 20,
              }}
              transition={{
                duration: Math.random() * 5 + 5,
                repeat: Infinity,
                delay: Math.random() * 5 + i * 0.1,
                ease: "linear",
              }}
              className="text-green-500 text-sm font-mono"
              style={{ 
                textShadow: '0 0 10px rgba(34, 197, 94, 0.8)',
              }}
            >
              {characters[Math.floor(Math.random() * characters.length)]}
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Organic Blob
export function OrganicBlob({ color = "#8b5cf6" }) {
  return (
    <motion.div
      className="absolute w-96 h-96"
      animate={{
        scale: [1, 1.2, 1],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id="blobGradient">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <motion.path
          fill="url(#blobGradient)"
          animate={{
            d: [
              "M44.7,-76.4C59.3,-69.5,73.3,-59.1,79.6,-45.3C85.9,-31.5,84.5,-14.3,81.5,1.7C78.5,17.7,73.9,32.5,65.5,44.9C57.1,57.3,44.9,67.3,30.6,72.8C16.3,78.3,-0.1,79.3,-16.6,76.1C-33.1,72.9,-49.6,65.5,-62.1,54C-74.6,42.5,-83.1,26.9,-85.9,10.1C-88.7,-6.7,-85.8,-24.7,-77.8,-39.4C-69.8,-54.1,-56.7,-65.5,-41.7,-72.1C-26.7,-78.7,-9.8,-80.5,2.6,-84.9C15,-89.3,30,-83.3,44.7,-76.4Z",
              "M40.5,-69.3C53.6,-62.3,66,-52.7,73.1,-40.1C80.2,-27.5,82,-11.9,80.5,3.3C79,18.5,74.2,33.3,65.5,45.5C56.8,57.7,44.2,67.3,29.7,72.2C15.2,77.1,-1.2,77.3,-17.3,73.8C-33.4,70.3,-49.2,63.1,-60.6,51.8C-72,40.5,-79,25.1,-81.5,8.7C-84,-7.7,-82,-25.1,-74.8,-39.8C-67.6,-54.5,-55.2,-66.5,-40.9,-72.9C-26.6,-79.3,-10.4,-80.1,2.1,-83.3C14.6,-86.5,27.4,-76.3,40.5,-69.3Z",
              "M44.7,-76.4C59.3,-69.5,73.3,-59.1,79.6,-45.3C85.9,-31.5,84.5,-14.3,81.5,1.7C78.5,17.7,73.9,32.5,65.5,44.9C57.1,57.3,44.9,67.3,30.6,72.8C16.3,78.3,-0.1,79.3,-16.6,76.1C-33.1,72.9,-49.6,65.5,-62.1,54C-74.6,42.5,-83.1,26.9,-85.9,10.1C-88.7,-6.7,-85.8,-24.7,-77.8,-39.4C-69.8,-54.1,-56.7,-65.5,-41.7,-72.1C-26.7,-78.7,-9.8,-80.5,2.6,-84.9C15,-89.3,30,-83.3,44.7,-76.4Z",
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          transform="translate(100 100)"
        />
      </svg>
    </motion.div>
  );
}

// Infinite Marquee
interface MarqueeProps {
  children: ReactNode;
  speed?: number;
  direction?: 'left' | 'right';
}

export function InfiniteMarquee({ children, speed = 20, direction = 'left' }: MarqueeProps) {
  return (
    <div className="overflow-hidden">
      <motion.div
        className="flex gap-8"
        animate={{
          x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'],
        }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex gap-8 shrink-0">
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// Glowing Orbs Background
export function GlowingOrbs() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-96 h-96 rounded-full"
          style={{
            background: `radial-gradient(circle, ${
              ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'][i]
            }40 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{
            x: [
              Math.random() * width,
              Math.random() * width,
              Math.random() * width,
            ],
            y: [
              Math.random() * height,
              Math.random() * height,
              Math.random() * height,
            ],
          }}
          transition={{
            duration: 20 + i * 5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

// Fractal Tree Animation
export function FractalTree() {
  const drawBranch = (depth: number, angle: number, length: number) => {
    if (depth === 0) return null;
    
    const endX = Math.cos(angle) * length;
    const endY = Math.sin(angle) * length;
    
    return (
      <g>
        <motion.line
          x1="0"
          y1="0"
          x2={endX}
          y2={endY}
          stroke="url(#treeGradient)"
          strokeWidth={depth / 2}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: (5 - depth) * 0.2 }}
        />
        <g transform={`translate(${endX}, ${endY})`}>
          {drawBranch(depth - 1, angle - 0.4, length * 0.7)}
          {drawBranch(depth - 1, angle + 0.4, length * 0.7)}
        </g>
      </g>
    );
  };
  
  return (
    <svg className="w-full h-full" viewBox="-200 -300 400 400">
      <defs>
        <linearGradient id="treeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <g transform="translate(0, 100)">
        {drawBranch(5, -Math.PI / 2, 80)}
      </g>
    </svg>
  );
}

// Cyberpunk Button
interface CyberpunkButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function CyberpunkButton({ children, onClick, className = "" }: CyberpunkButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative px-8 py-4 overflow-hidden ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Background animations */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500"
        animate={{
          background: isHovered
            ? 'linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4)'
            : 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
        }}
        style={{ backgroundSize: '200% 100%' }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Glitch effect */}
      <motion.div
        className="absolute inset-0"
        animate={isHovered ? {
          clipPath: [
            'inset(0 0 0 0)',
            'inset(20% 0 30% 0)',
            'inset(0 0 0 0)',
            'inset(60% 0 10% 0)',
            'inset(0 0 0 0)',
          ],
        } : {}}
        transition={{ duration: 0.5 }}
        style={{ background: 'linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent)' }}
      />
      
      {/* Border glow */}
      <motion.div
        className="absolute inset-0 rounded-inherit"
        animate={{
          boxShadow: isHovered
            ? '0 0 30px rgba(6, 182, 212, 0.8), inset 0 0 30px rgba(139, 92, 246, 0.3)'
            : '0 0 10px rgba(139, 92, 246, 0.5)',
        }}
      />
      
      {/* Text */}
      <span className="relative z-10 font-bold text-white uppercase tracking-wider">
        {children}
      </span>
      
      {/* Scan line */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          backgroundPosition: ['0% 0%', '0% 100%'],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        style={{
          background: 'linear-gradient(transparent 50%, rgba(255,255,255,0.1) 50%)',
          backgroundSize: '100% 4px',
        }}
      />
    </motion.button>
  );
}

// Wave Text Animation
interface WaveTextProps {
  text: string;
  className?: string;
}

export function WaveText({ text, className = "" }: WaveTextProps) {
  const letters = text.split('');
  
  return (
    <div className={`flex ${className}`}>
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          animate={{
            y: [0, -20, 0],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: index * 0.1,
            ease: "easeInOut",
          }}
          className="inline-block"
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </div>
  );
}

// Aurora Background
export function AuroraBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at top, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
            'radial-gradient(ellipse at bottom, rgba(236, 72, 153, 0.3) 0%, transparent 50%)',
            'radial-gradient(ellipse at left, rgba(6, 182, 212, 0.3) 0%, transparent 50%)',
            'radial-gradient(ellipse at right, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
            'radial-gradient(ellipse at top, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
          ],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <svg className="absolute inset-0 w-full h-full">
        <filter id="aurora">
          <feTurbulence baseFrequency="0.01" numOctaves="4" seed="5" />
          <feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.3 0 0 0 0 0.9 0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#aurora)" opacity="0.4" />
      </svg>
    </div>
  );
}

// Ripple Effect Button
interface RippleButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function RippleButton({ children, className = "", onClick }: RippleButtonProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 1000);
  };
  
  return (
    <button
      ref={buttonRef}
      className={`relative overflow-hidden ${className}`}
      onClick={(e) => {
        createRipple(e);
        onClick && onClick();
      }}
    >
      {ripples.map(ripple => (
        <motion.span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ width: 0, height: 0, opacity: 1 }}
          animate={{ width: 300, height: 300, opacity: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      ))}
      {children}
    </button>
  );
}

// 3D Flip Card
interface FlipCard3DProps {
  front: ReactNode;
  back: ReactNode;
  className?: string;
}

export function FlipCard3D({ front, back, className = "" }: FlipCard3DProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  
  return (
    <motion.div
      className={`relative cursor-pointer ${className}`}
      style={{ perspective: 1000 }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="w-full h-full"
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
          {front}
        </div>
        <div 
          className="absolute inset-0" 
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          {back}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Spotlight Card
interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({ 
  children, 
  className = "", 
  spotlightColor = "rgba(139, 92, 246, 0.5)" 
}: SpotlightCardProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };
  
  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden bg-gray-900 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}