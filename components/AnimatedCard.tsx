'use client';

import { ReactNode } from 'react';

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
  glow = false,
}: AnimatedCardProps) {
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    // tilt functionality removed (framer-motion dependency removed)
  };

  const handleMouseLeave = () => {
    // tilt functionality removed (framer-motion dependency removed)
  };

  return (
    <div
      className={`bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle at center, rgba(245, 158, 11, 0.15), transparent)',
          }}
        />
      )}
      {children}
    </div>
  );
}

// List item with stagger animation
export function AnimatedListItem({
  children,
  index = 0,
}: {
  children: ReactNode;
  index?: number;
}) {
  return <div>{children}</div>;
}

// Animated counter
export function AnimatedCounter({ value }: { value: number }) {
  return <span>{value}</span>;
}

// Animated progress bar
export function AnimatedProgress({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-orange-500 to-orange-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
