/**
 * Micro-animations and transitions library
 * Smooth, performant animations for enhanced UX
 */

import { Variants } from 'framer-motion';

// Fade animations
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.3 }
  }
};

export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.4,
      ease: 'easeOut'
    }
  }
};

export const fadeInDown: Variants = {
  hidden: { 
    opacity: 0, 
    y: -20 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.4,
      ease: 'easeOut'
    }
  }
};

// Scale animations
export const scaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

export const popIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.6 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: 'spring',
      stiffness: 260,
      damping: 20
    }
  }
};

// Slide animations
export const slideInLeft: Variants = {
  hidden: { 
    opacity: 0, 
    x: -50 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.4,
      ease: 'easeOut'
    }
  }
};

export const slideInRight: Variants = {
  hidden: { 
    opacity: 0, 
    x: 50 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.4,
      ease: 'easeOut'
    }
  }
};

// Stagger children animations
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

export const staggerItem: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut'
    }
  }
};

// List animations
export const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.05
    }
  }
};

export const listItem: Variants = {
  hidden: { 
    opacity: 0, 
    x: -20 
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3
    }
  }
};

// Hover animations
export const hoverScale = {
  scale: 1.05,
  transition: {
    duration: 0.2,
    ease: 'easeInOut'
  }
};

export const hoverGlow = {
  boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
  transition: {
    duration: 0.3
  }
};

// Tap animations
export const tapScale = {
  scale: 0.95,
  transition: {
    duration: 0.1
  }
};

// Loading animations
export const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [1, 0.8, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut' as const
  }
};

export const shimmer = {
  backgroundPosition: ['200% 0', '-200% 0'],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'linear' as const
  }
};

// Rotate animation
export const rotate360 = {
  rotate: 360,
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'linear' as const
  }
};

// Bounce animation
export const bounce = {
  y: [0, -10, 0],
  transition: {
    duration: 0.6,
    repeat: Infinity,
    ease: 'easeInOut' as const
  }
};

// Page transitions
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    y: 20
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3
    }
  }
};

// Modal animations
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

export const modalContent: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
    y: 20
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      type: 'spring',
      stiffness: 300,
      damping: 25
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    y: 20,
    transition: { duration: 0.2 }
  }
};

// Card animations
export const cardHover = {
  y: -5,
  boxShadow: '0 10px 30px rgba(6, 182, 212, 0.2)',
  transition: {
    duration: 0.3,
    ease: "easeOut" as const
  }
};

// Text animations
export const typewriter = {
  hidden: { width: '0%' },
  visible: {
    width: '100%',
    transition: {
      duration: 2,
      ease: 'linear'
    }
  }
};

export const textReveal: Variants = {
  hidden: {
    opacity: 0,
    y: '100%'
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut'
    }
  }
};

// Notification animations
export const slideInTop: Variants = {
  hidden: { 
    opacity: 0, 
    y: -50 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      type: 'spring',
      stiffness: 200,
      damping: 20
    }
  },
  exit: { 
    opacity: 0, 
    y: -50,
    transition: { duration: 0.2 }
  }
};

// Skeleton loading animation
export const skeletonPulse = {
  opacity: [0.5, 1, 0.5],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'easeInOut' as const
  }
};

// Floating animation
export const float = {
  y: [0, -10, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut" as const
  }
};

// Glitch effect
export const glitch = {
  x: [0, -2, 2, -2, 2, 0],
  filter: [
    'hue-rotate(0deg)',
    'hue-rotate(90deg)',
    'hue-rotate(180deg)',
    'hue-rotate(270deg)',
    'hue-rotate(360deg)',
    'hue-rotate(0deg)'
  ],
  transition: {
    duration: 0.3,
    repeat: 2
  }
};

// Parallax scroll effect
export const parallax = (offset: number = 0) => ({
  y: offset,
  transition: {
    type: 'spring',
    stiffness: 100,
    damping: 30
  }
});

// Custom spring configurations
export const springConfig = {
  gentle: { stiffness: 100, damping: 15 },
  wobbly: { stiffness: 180, damping: 12 },
  stiff: { stiffness: 400, damping: 40 },
  slow: { stiffness: 60, damping: 20 }
};

// Utility function to create custom animations
export const createAnimation = (
  from: Record<string, any>,
  to: Record<string, any>,
  options: Record<string, any> = {}
): Variants => ({
  hidden: from,
  visible: {
    ...to,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
      ...options
    }
  }
});

// Gesture animations
export const dragConstraints = {
  top: -50,
  left: -50,
  right: 50,
  bottom: 50
};

export const dragTransition = {
  bounceStiffness: 600,
  bounceDamping: 20
};

// Success animation
export const successCheckmark = {
  pathLength: [0, 1],
  opacity: [0, 1],
  transition: {
    duration: 0.4,
    ease: 'easeInOut' as const
  }
};

// Export animation presets
export const animationPresets = {
  fadeIn,
  fadeInUp,
  fadeInDown,
  scaleIn,
  popIn,
  slideInLeft,
  slideInRight,
  staggerContainer,
  staggerItem,
  listContainer,
  listItem,
  hoverScale,
  hoverGlow,
  tapScale,
  pulseAnimation,
  shimmer,
  rotate360,
  bounce,
  pageTransition,
  modalOverlay,
  modalContent,
  cardHover,
  typewriter,
  textReveal,
  slideInTop,
  skeletonPulse,
  float,
  glitch,
  successCheckmark
};

// Animation durations
export const durations = {
  instant: 0,
  fast: 0.1,
  normal: 0.3,
  slow: 0.5,
  verySlow: 1
};

// Easing functions
export const easings = {
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  anticipate: [0.17, 0.67, 0.83, 0.67],
  backIn: [0.6, -0.28, 0.735, 0.045],
  backOut: [0.175, 0.885, 0.32, 1.275],
  circIn: [0.6, 0.04, 0.98, 0.335],
  circOut: [0.075, 0.82, 0.165, 1]
};