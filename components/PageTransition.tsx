'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState, useRef } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

// Main page transition wrapper
export function PageTransition({
  children,
  className = '',
}: PageTransitionProps) {
  return <div className={className}>{children}</div>;
}

// Slide transition
export function SlideTransition({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

// Fade transition
export function FadeTransition({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

// Scale transition
export function ScaleTransition({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

// Rotate transition
export function RotateTransition({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

// Loading transition with progress
export function LoadingTransition({
  children,
  loading = false,
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
    }
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
    return undefined;
  }, [loading]);

  return (
    <>
      {/* Progress bar */}
      {(loading || progress > 0) && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ opacity: loading ? 0.5 : 1 }}>{children}</div>
    </>
  );
}

// Stagger children animation
export function StaggerChildren({
  children,
  delay = 0.1,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return <div>{children}</div>;
}

// Parallax scrolling wrapper
export function ParallaxSection({
  children,
  offset = 50,
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
    <div
      style={{
        transform: `translateY(${scrollY * 0.5}px)`,
      }}
    >
      {children}
    </div>
  );
}

// Reveal on scroll
export function RevealOnScroll({
  children,
  threshold = 0.1,
}: {
  children: ReactNode;
  threshold?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
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

  return <div ref={ref}>{children}</div>;
}

// Morphing layout transition
export function MorphTransition({
  children,
  layoutId,
}: {
  children: ReactNode;
  layoutId: string;
}) {
  return <div>{children}</div>;
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
    document.body.addEventListener('mouseover', handleMouseOver, {
      passive: true,
    });
    document.body.addEventListener('mouseout', handleMouseOut, {
      passive: true,
    });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseover', handleMouseOver);
      document.body.removeEventListener('mouseout', handleMouseOut);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className="fixed pointer-events-none z-50 mix-blend-difference"
      style={{
        transform: `translate(${mousePosition.x - 16}px, ${mousePosition.y - 16}px)`,
      }}
    >
      <div className="w-8 h-8 bg-white rounded-full opacity-50" />
    </div>
  );
}
