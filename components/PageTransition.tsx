'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState, useRef } from 'react';
import { pageTransition } from '@/lib/animations';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

// Main page transition wrapper
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Slide transition
export function SlideTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -300, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Fade transition
export function FadeTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Scale transition
export function ScaleTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.05, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Rotate transition
export function RotateTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ rotateY: -90, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 20
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Loading transition with progress
export function LoadingTransition({ 
  children,
  loading = false 
}: { 
  children: ReactNode;
  loading?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return 90;
          return prev + 10;
        });
      }, 100);
      
      return () => clearInterval(interval);
    } else {
      setProgress(100);
      setTimeout(() => setProgress(0), 500);
    }
  }, [loading]);
  
  return (
    <>
      {/* Progress bar */}
      <AnimatePresence>
        {(loading || progress > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/10"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Content */}
      <motion.div
        animate={{ opacity: loading ? 0.5 : 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </>
  );
}

// Stagger children animation
export function StaggerChildren({ 
  children,
  delay = 0.1 
}: { 
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: delay
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

// Parallax scrolling wrapper
export function ParallaxSection({
  children,
  offset = 50
}: {
  children: ReactNode;
  offset?: number;
}) {
  const scrollRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          setScrollY(scrollRef.current);
          rafRef.current = null;
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <motion.div
      style={{
        transform: `translateY(${scrollY * 0.5}px)`
      }}
    >
      {children}
    </motion.div>
  );
}

// Reveal on scroll
export function RevealOnScroll({ 
  children,
  threshold = 0.1
}: { 
  children: ReactNode;
  threshold?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, [threshold]);
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Morphing layout transition
export function MorphTransition({ 
  children,
  layoutId
}: { 
  children: ReactNode;
  layoutId: string;
}) {
  return (
    <motion.div
      layoutId={layoutId}
      layout
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25
      }}
    >
      {children}
    </motion.div>
  );
}

// Custom cursor follower — uses event delegation + rAF throttle for performance
export function CursorFollower() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          setMousePosition(mouseRef.current);
          rafRef.current = null;
        });
      }
    };

    // Event delegation instead of attaching to 500+ elements
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('a, button, [role="button"]')) {
        setIsHovering(true);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('a, button, [role="button"]')) {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.body.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.body.addEventListener('mouseout', handleMouseOut, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseover', handleMouseOver);
      document.body.removeEventListener('mouseout', handleMouseOut);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
  
  return (
    <motion.div
      className="fixed pointer-events-none z-50 mix-blend-difference"
      animate={{
        x: mousePosition.x - 16,
        y: mousePosition.y - 16,
        scale: isHovering ? 1.5 : 1
      }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 28
      }}
    >
      <div className="w-8 h-8 bg-white rounded-full opacity-50" />
    </motion.div>
  );
}