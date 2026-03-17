'use client';

import * as React from 'react';
import {
  HTMLMotionProps,
  MotionValue,
  motion,
  useMotionTemplate,
  useScroll,
  useTransform,
} from 'framer-motion';
import { cn } from '@/lib/utils';

type AnimateT = 'left' | 'right' | 'top' | 'bottom' | 'z' | 'blur' | undefined;

const SPRING_CONFIG = {
  type: 'spring' as const,
  stiffness: 100,
  damping: 16,
  mass: 0.75,
  restDelta: 0.005,
  duration: 0.3,
};

const useAnimationVariants = (animate: AnimateT) =>
  React.useMemo(
    () => ({
      hidden: {
        x: animate === 'left' ? '-100%' : animate === 'right' ? '100%' : 0,
        y: animate === 'top' ? '-100%' : animate === 'bottom' ? '100%' : 0,
        scale: animate === 'z' ? 0 : 1,
        filter: animate === 'blur' ? 'blur(10px)' : 'blur(0px)',
        opacity: 0,
      },
      visible: {
        x: 0,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        opacity: 1,
      },
    }),
    [animate]
  );

// ContainerStagger: staggered entrance animation wrapper
const ContainerStagger = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ children, className, ...props }, ref) => {
    return (
      <motion.div
        className={cn('relative', className)}
        ref={ref}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, ...props.viewport }}
        transition={{
          staggerChildren: props.transition?.staggerChildren || 0.2,
          ...props.transition,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
ContainerStagger.displayName = 'ContainerStagger';

// ContainerAnimated: single animated child
interface ContainerAnimatedProps extends HTMLMotionProps<'div'> {
  animation?: AnimateT;
}

const ContainerAnimated = React.forwardRef<HTMLDivElement, ContainerAnimatedProps>(
  ({ animation, children, className, ...props }, ref) => {
    const variants = useAnimationVariants(animation);
    return (
      <motion.div
        transition={SPRING_CONFIG}
        ref={ref}
        variants={variants}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
ContainerAnimated.displayName = 'ContainerAnimated';

// ContainerScroll context
interface ContainerScrollValue {
  scrollYProgress: MotionValue<number>;
}

const ContainerScrollContext = React.createContext<ContainerScrollValue | undefined>(undefined);

function useContainerScrollContext() {
  const context = React.useContext(ContainerScrollContext);
  if (!context) {
    throw new Error(
      'useContainerScrollContext must be used within <ContainerScroll> component'
    );
  }
  return context;
}

// ContainerScroll: scroll-linked wrapper
interface ContainerScrollProps extends React.HTMLAttributes<HTMLDivElement> {}

const ContainerScroll = ({ children, className, ...props }: ContainerScrollProps) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef });

  return (
    <ContainerScrollContext.Provider value={{ scrollYProgress }}>
      <section
        className={cn('relative min-h-[120vh] w-full pb-[30%] pt-8 bg-[#080e1a]', className)}
        {...props}
        ref={scrollRef}
      >
        {children}
      </section>
    </ContainerScrollContext.Provider>
  );
};
ContainerScroll.displayName = 'ContainerScroll';

// ContainerInset: scroll-driven clip-path inset reveal
interface ContainerInsetProps extends HTMLMotionProps<'div'> {
  translateYRange?: [string, string];
  insetYRange?: [number, number];
  insetXRange?: [number, number];
  roundednessRange?: [number, number];
}

const ContainerInset = React.forwardRef<HTMLDivElement, ContainerInsetProps>(
  (
    {
      translateYRange = ['-25%', '50%'],
      insetYRange = [35, 0],
      insetXRange = [42, 0],
      roundednessRange = [1000, 4],
      children,
      className,
      ...props
    },
    ref
  ) => {
    const { scrollYProgress } = useContainerScrollContext();
    const y = useTransform(scrollYProgress, [0, 1], translateYRange);
    const insetY = useTransform(scrollYProgress, [0, 1], insetYRange);
    const insetX = useTransform(scrollYProgress, [0, 1], insetXRange);
    const roundedness = useTransform(scrollYProgress, [0, 1], roundednessRange);
    const clipPath = useMotionTemplate`inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${roundedness}px)`;

    const style = React.useMemo(
      () => ({ y, clipPath, ...props.style }),
      [y, clipPath, props.style]
    );

    return (
      <motion.div
        transition={SPRING_CONFIG}
        ref={ref}
        className={cn(
          'origin-top overflow-hidden border-[0.5px] border-white/[0.06]',
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
ContainerInset.displayName = 'ContainerInset';

export { ContainerAnimated, ContainerStagger, ContainerScroll, ContainerInset };
