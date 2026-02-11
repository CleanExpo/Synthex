'use client';

import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { ReactNode } from 'react';
import { cardHover, fadeInUp, tapScale } from '@/lib/animations';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
  tap?: boolean;
  tilt?: boolean;
  glow?: boolean;
}

export function AnimatedCard({
  children,
  className = '',
  delay = 0,
  hover = true,
  tap = true,
  tilt = false,
  glow = false
}: AnimatedCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotateX = useSpring(useTransform(y, [-100, 100], [10, -10]));
  const rotateY = useSpring(useTransform(x, [-100, 100], [-10, 10]));
  
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    x.set(event.clientX - centerX);
    y.set(event.clientY - centerY);
  };
  
  const handleMouseLeave = () => {
    if (!tilt) return;
    x.set(0);
    y.set(0);
  };
  
  return (
    <motion.div
      className={`bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg ${className}`}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      whileHover={hover ? cardHover : undefined}
      whileTap={tap ? tapScale : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={tilt ? {
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d'
      } : undefined}
      transition={{ delay }}
    >
      {glow && (
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0"
          whileHover={{
            opacity: 1,
            background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.15), transparent)',
          }}
          transition={{ duration: 0.3 }}
        />
      )}
      {children}
    </motion.div>
  );
}

// List item with stagger animation
export function AnimatedListItem({ 
  children, 
  index = 0 
}: { 
  children: ReactNode; 
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ 
        delay: index * 0.05,
        duration: 0.3
      }}
    >
      {children}
    </motion.div>
  );
}

// Animated counter
export function AnimatedCounter({ value }: { value: number }) {
  const count = useSpring(value, { stiffness: 100, damping: 10 });
  const rounded = useTransform(count, (latest) => Math.round(latest));
  
  return <motion.span>{rounded}</motion.span>;
}

// Animated progress bar
export function AnimatedProgress({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-500"
        initial={{ width: '0%' }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}