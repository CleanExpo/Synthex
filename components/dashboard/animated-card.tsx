'use client';

/**
 * Animated Card Component
 * Motion wrapper for dashboard cards
 */

import { motion } from 'framer-motion';
import { animationVariants } from '@/components/ui/index';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedCard({ children, className, delay = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      initial={animationVariants.cardEntrance.initial}
      animate={animationVariants.cardEntrance.animate}
      transition={{ ...animationVariants.cardEntrance.transition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
