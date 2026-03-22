'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
}

const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  ({ children, className }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{
          boxShadow: '0 0 0px rgba(255, 184, 123, 0)',
        }}
        whileHover={{
          boxShadow:
            '0 0 24px rgba(255, 184, 123, 0.18), 0 0 48px rgba(255, 184, 123, 0.06)',
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          'relative rounded-sm border-[0.5px] border-white/[0.06] bg-[#080e1a]',
          'hover:border-orange-500/30 transition-colors duration-300',
          className
        )}
      >
        {children}
      </motion.div>
    );
  }
);
GlowCard.displayName = 'GlowCard';

interface GlowCardCanvasProps {
  children: React.ReactNode;
  className?: string;
}

const GlowCardCanvas = ({ children, className }: GlowCardCanvasProps) => {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Ambient background glow layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(255, 184, 123, 0.04) 0%, transparent 70%)',
        }}
      />
      {children}
    </div>
  );
};

export { GlowCard, GlowCardCanvas };
export default GlowCard;
