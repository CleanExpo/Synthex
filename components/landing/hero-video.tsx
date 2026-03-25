'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type AnimateT = 'left' | 'right' | 'top' | 'bottom' | 'z' | 'blur' | undefined;

// ContainerStagger: wrapper div (stagger entrance removed)
const ContainerStagger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
  return (
    <div className={cn('relative', className)} ref={ref} {...props}>
      {children}
    </div>
  );
});
ContainerStagger.displayName = 'ContainerStagger';

// ContainerAnimated: plain div wrapper (entrance animation removed)
interface ContainerAnimatedProps extends React.HTMLAttributes<HTMLDivElement> {
  animation?: AnimateT;
}

const ContainerAnimated = React.forwardRef<
  HTMLDivElement,
  ContainerAnimatedProps
>(({ animation: _animation, children, className, ...props }, ref) => {
  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
});
ContainerAnimated.displayName = 'ContainerAnimated';

// ContainerScroll context (scroll tracking removed — children render normally)
interface ContainerScrollProps extends React.HTMLAttributes<HTMLDivElement> {}

const ContainerScroll = ({
  children,
  className,
  ...props
}: ContainerScrollProps) => {
  return (
    <section
      className={cn(
        'relative min-h-[120vh] w-full pb-[30%] pt-8 bg-[#080e1a]',
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
};
ContainerScroll.displayName = 'ContainerScroll';

// ContainerInset: plain div wrapper (scroll-driven clip-path removed)
interface ContainerInsetProps extends React.HTMLAttributes<HTMLDivElement> {
  translateYRange?: [string, string];
  insetYRange?: [number, number];
  insetXRange?: [number, number];
  roundednessRange?: [number, number];
}

const ContainerInset = React.forwardRef<HTMLDivElement, ContainerInsetProps>(
  (
    {
      translateYRange: _translateYRange,
      insetYRange: _insetYRange,
      insetXRange: _insetXRange,
      roundednessRange: _roundednessRange,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'origin-top overflow-hidden border-[0.5px] border-white/[0.06]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerInset.displayName = 'ContainerInset';

export { ContainerAnimated, ContainerStagger, ContainerScroll, ContainerInset };
