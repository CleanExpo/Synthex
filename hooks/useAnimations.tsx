'use client';

/**
 * Animation hooks for easy integration
 * Provides simple API for common animations
 */

import { useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { animationPresets, durations, easings } from '@/lib/animations';

// Hook for scroll-triggered animations
export function useScrollAnimation(threshold = 0.1) {
  const ref = useRef(null);
  const isInView = useInView(ref, { 
    once: true, 
    margin: "0px 0px -100px 0px" 
  });
  
  return { ref, isInView };
}

// Hook for delayed animations
export function useDelayedAnimation(delay: number = 0) {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimate(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  
  return shouldAnimate;
}

// Hook for staggered list animations
export function useStaggerAnimation(itemCount: number, baseDelay = 0.1) {
  return Array.from({ length: itemCount }, (_, i) => ({
    initial: "hidden",
    animate: "visible",
    custom: i,
    transition: { delay: i * baseDelay }
  }));
}

// Hook for parallax effects
export function useParallax(speed = 0.5) {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      setOffset(window.scrollY * speed);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);
  
  return offset;
}

// Hook for performance-optimized animations
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return prefersReducedMotion;
}

// Export commonly used presets
export { animationPresets, durations, easings };