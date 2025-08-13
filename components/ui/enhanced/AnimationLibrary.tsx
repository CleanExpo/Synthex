'use client';

import React, { useRef, useState, useEffect, ReactNode } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence, MotionValue } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Box, Text, Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// ANIMATION VARIANTS
// ============================================

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5 }
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: { duration: 0.5 }
};

export const slideInLeft = {
  initial: { x: -100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 100, opacity: 0 },
  transition: { type: "spring", stiffness: 100 }
};

export const slideInRight = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -100, opacity: 0 },
  transition: { type: "spring", stiffness: 100 }
};

export const rotateIn = {
  initial: { rotate: -180, opacity: 0 },
  animate: { rotate: 0, opacity: 1 },
  exit: { rotate: 180, opacity: 0 },
  transition: { duration: 0.6 }
};

export const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const pulseAnimation = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// ============================================
// REUSABLE ANIMATED COMPONENTS
// ============================================

// Parallax Container
interface ParallaxContainerProps {
  children: ReactNode;
  offset?: number;
}

export function ParallaxContainer({ children, offset = 50 }: ParallaxContainerProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  
  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
}

// Reveal on Scroll
interface RevealOnScrollProps {
  children: ReactNode;
  width?: "fit-content" | "100%";
}

export function RevealOnScroll({ children, width = "fit-content" }: RevealOnScrollProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  return (
    <div ref={ref} style={{ position: "relative", width, overflow: "hidden" }}>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 75 },
          visible: { opacity: 1, y: 0 }
        }}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Magnetic Button
interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MagneticButton({ children, className = "", onClick }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current!.getBoundingClientRect();
    const x = (clientX - left - width / 2) * 0.15;
    const y = (clientY - top - height / 2) * 0.15;
    setPosition({ x, y });
  };
  
  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };
  
  const { x, y } = position;
  
  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

// Floating Element
interface FloatingElementProps {
  children: ReactNode;
  duration?: number;
  delay?: number;
}

export function FloatingElement({ children, duration = 3, delay = 0 }: FloatingElementProps) {
  return (
    <motion.div
      animate={{
        y: [0, -20, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
}

// Gradient Text Animation
interface GradientTextProps {
  text: string;
  className?: string;
  colors?: string[];
}

export function GradientText({ 
  text, 
  className = "", 
  colors = ["#8b5cf6", "#ec4899", "#06b6d4"] 
}: GradientTextProps) {
  return (
    <motion.span
      className={className}
      animate={{
        backgroundImage: colors.map(color => 
          `linear-gradient(45deg, ${color}, ${colors[(colors.indexOf(color) + 1) % colors.length]})`
        )
      }}
      transition={{ duration: 5, repeat: Infinity }}
      style={{
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        display: 'inline-block'
      }}
    >
      {text}
    </motion.span>
  );
}

// 3D Card
interface Card3DProps {
  children: ReactNode;
  className?: string;
}

export function Card3D({ children, className = "" }: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top) / height;
    
    setRotateX((y - 0.5) * -20);
    setRotateY((x - 0.5) * 20);
  };
  
  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };
  
  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000
      }}
    >
      {children}
    </motion.div>
  );
}

// Morphing SVG Shape
interface MorphingShapeProps {
  colors?: string[];
  className?: string;
}

export function MorphingShape({ 
  colors = ["#8b5cf6", "#ec4899"],
  className = ""
}: MorphingShapeProps) {
  return (
    <svg className={className} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="morphGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors[0]} stopOpacity="0.8" />
          <stop offset="100%" stopColor={colors[1]} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <motion.path
        d="M50,100 Q100,50 150,100 T150,150 Q100,200 50,150 Z"
        fill="url(#morphGradient)"
        animate={{
          d: [
            "M50,100 Q100,50 150,100 T150,150 Q100,200 50,150 Z",
            "M50,100 Q100,20 150,100 T150,180 Q100,200 50,150 Z",
            "M30,100 Q100,50 170,100 T150,150 Q100,200 50,150 Z",
            "M50,100 Q100,50 150,100 T150,150 Q100,200 50,150 Z"
          ]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </svg>
  );
}

// Typewriter Effect
interface TypewriterProps {
  text: string;
  delay?: number;
  className?: string;
}

export function Typewriter({ text, delay = 0.05, className = "" }: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, delay * 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);
  
  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        |
      </motion.span>
    </span>
  );
}

// Glitch Text
interface GlitchTextProps {
  text: string;
  className?: string;
}

export function GlitchText({ text, className = "" }: GlitchTextProps) {
  return (
    <div className={`relative ${className}`}>
      <span className="relative z-10">{text}</span>
      <motion.span
        className="absolute top-0 left-0 text-purple-500"
        animate={{
          x: [-2, 2, -2],
          y: [2, -2, 2],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute top-0 left-0 text-pink-500"
        animate={{
          x: [2, -2, 2],
          y: [-2, 2, -2],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      >
        {text}
      </motion.span>
    </div>
  );
}

// Loading Spinner
interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export function LoadingSpinner({ size = 40, color = "#8b5cf6" }: LoadingSpinnerProps) {
  return (
    <motion.div
      style={{
        width: size,
        height: size,
        border: `3px solid ${color}20`,
        borderTop: `3px solid ${color}`,
        borderRadius: "50%"
      }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );
}

// Particle Effect
interface ParticleEffectProps {
  count?: number;
  color?: string;
}

export function ParticleEffect({ count = 50, color = "#8b5cf6" }: ParticleEffectProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ backgroundColor: color }}
          initial={{
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + 10,
          }}
          animate={{
            y: -10,
            x: Math.random() * window.innerWidth,
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
}

// Cursor Trail
export function CursorTrail() {
  const [trails, setTrails] = useState<{ x: number; y: number; id: number }[]>([]);
  const idRef = useRef(0);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const newTrail = {
        x: e.clientX,
        y: e.clientY,
        id: idRef.current++
      };
      
      setTrails(prev => [...prev.slice(-10), newTrail]);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {trails.map((trail, index) => (
        <motion.div
          key={trail.id}
          className="absolute w-3 h-3 bg-purple-500 rounded-full"
          initial={{ x: trail.x - 6, y: trail.y - 6, opacity: 1, scale: 1 }}
          animate={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.5 }}
        />
      ))}
    </div>
  );
}

// Responsive Container with Breakpoints
interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveContainer({ children, className = "" }: ResponsiveContainerProps) {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const getDeviceType = () => {
    if (windowSize.width < 640) return 'mobile';
    if (windowSize.width < 1024) return 'tablet';
    return 'desktop';
  };
  
  return (
    <motion.div
      className={`${className} ${getDeviceType()}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

// Animated Counter
interface AnimatedCounterProps {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
  suffix?: string;
}

export function AnimatedCounter({ 
  from = 0, 
  to, 
  duration = 2, 
  className = "",
  suffix = ""
}: AnimatedCounterProps) {
  const [count, setCount] = useState(from);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    
    const increment = (to - from) / (duration * 60);
    let current = from;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= to) {
        setCount(to);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 1000 / 60);
    
    return () => clearInterval(timer);
  }, [from, to, duration, isInView]);
  
  return (
    <span ref={ref} className={className}>
      {count}{suffix}
    </span>
  );
}

// Blur In Animation
interface BlurInProps {
  children: ReactNode;
  className?: string;
  duration?: number;
}

export function BlurIn({ children, className = "", duration = 1 }: BlurInProps) {
  return (
    <motion.div
      initial={{ filter: "blur(10px)", opacity: 0 }}
      animate={{ filter: "blur(0px)", opacity: 1 }}
      transition={{ duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Tilt Card
interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}

export function TiltCard({ children, className = "", maxTilt = 15 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top) / height;
    
    setTilt({
      x: (y - 0.5) * maxTilt,
      y: (x - 0.5) * -maxTilt
    });
  };
  
  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };
  
  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      <div style={{ transform: "translateZ(75px)" }}>
        {children}
      </div>
    </motion.div>
  );
}

// Export all animation utilities
export const animations = {
  fadeInUp,
  fadeInScale,
  slideInLeft,
  slideInRight,
  rotateIn,
  staggerChildren,
  pulseAnimation
};