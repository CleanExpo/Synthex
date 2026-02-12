'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/icons';

/**
 * Spinner Component
 * Loading indicators with various styles
 *
 * @task UNI-411 - Frontend Component Completeness
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'bars' | 'pulse' | 'gradient';
  color?: 'default' | 'primary' | 'secondary' | 'white';
  className?: string;
  label?: string;
}

// ============================================================================
// SIZE MAP
// ============================================================================

const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const colorMap = {
  default: 'text-slate-400',
  primary: 'text-cyan-500',
  secondary: 'text-cyan-500',
  white: 'text-white',
};

// ============================================================================
// SPINNER VARIANTS
// ============================================================================

function DefaultSpinner({ size, color, className }: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        'animate-spin',
        sizeMap[size || 'md'],
        colorMap[color || 'default'],
        className
      )}
    />
  );
}

function DotsSpinner({ size, color, className }: SpinnerProps) {
  const dotSize = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
    xl: 'w-3 h-3',
  };

  const colorClass = {
    default: 'bg-slate-400',
    primary: 'bg-cyan-500',
    secondary: 'bg-cyan-500',
    white: 'bg-white',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full animate-bounce',
            dotSize[size || 'md'],
            colorClass[color || 'default']
          )}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function BarsSpinner({ size, color, className }: SpinnerProps) {
  const barSize = {
    xs: 'w-0.5 h-2',
    sm: 'w-0.5 h-3',
    md: 'w-1 h-4',
    lg: 'w-1 h-5',
    xl: 'w-1.5 h-6',
  };

  const colorClass = {
    default: 'bg-slate-400',
    primary: 'bg-cyan-500',
    secondary: 'bg-cyan-500',
    white: 'bg-white',
  };

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full animate-pulse',
            barSize[size || 'md'],
            colorClass[color || 'default']
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.8s',
          }}
        />
      ))}
    </div>
  );
}

function PulseSpinner({ size, color, className }: SpinnerProps) {
  const colorClass = {
    default: 'border-slate-400',
    primary: 'border-cyan-500',
    secondary: 'border-cyan-500',
    white: 'border-white',
  };

  return (
    <div
      className={cn(
        'rounded-full border-2 animate-ping',
        sizeMap[size || 'md'],
        colorClass[color || 'default'],
        className
      )}
    />
  );
}

function GradientSpinner({ size, className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full animate-spin',
        sizeMap[size || 'md'],
        'bg-gradient-to-r from-cyan-500 via-cyan-500 to-cyan-500',
        className
      )}
      style={{
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))',
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))',
      }}
    />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Spinner({
  size = 'md',
  variant = 'default',
  color = 'default',
  className,
  label,
}: SpinnerProps) {
  const SpinnerComponent = {
    default: DefaultSpinner,
    dots: DotsSpinner,
    bars: BarsSpinner,
    pulse: PulseSpinner,
    gradient: GradientSpinner,
  }[variant];

  const spinner = (
    <SpinnerComponent
      size={size}
      color={color}
      className={className}
    />
  );

  if (label) {
    return (
      <div className="flex items-center gap-2">
        {spinner}
        <span className={cn('text-sm', colorMap[color])}>{label}</span>
      </div>
    );
  }

  return spinner;
}

// ============================================================================
// LOADING OVERLAY
// ============================================================================

export interface LoadingOverlayProps {
  loading?: boolean;
  children: React.ReactNode;
  spinner?: SpinnerProps;
  text?: string;
  blur?: boolean;
  className?: string;
}

export function LoadingOverlay({
  loading = true,
  children,
  spinner,
  text,
  blur = true,
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}

      {loading && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center z-50',
            blur ? 'backdrop-blur-sm bg-slate-900/50' : 'bg-slate-900/70'
          )}
        >
          <Spinner {...spinner} />
          {text && (
            <p className="mt-3 text-sm text-slate-300">{text}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FULL PAGE LOADING
// ============================================================================

export interface FullPageLoadingProps {
  text?: string;
  spinner?: SpinnerProps;
}

export function FullPageLoading({ text = 'Loading...', spinner }: FullPageLoadingProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 z-50">
      <Spinner size="xl" variant="gradient" {...spinner} />
      {text && (
        <p className="mt-4 text-slate-400">{text}</p>
      )}
    </div>
  );
}

// ============================================================================
// BUTTON LOADING STATE
// ============================================================================

export interface ButtonSpinnerProps {
  loading?: boolean;
  children: React.ReactNode;
  loadingText?: string;
  spinnerProps?: SpinnerProps;
  className?: string;
}

export function ButtonSpinner({
  loading,
  children,
  loadingText,
  spinnerProps,
  className,
}: ButtonSpinnerProps) {
  if (!loading) {
    return <>{children}</>;
  }

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Spinner size="sm" color="white" {...spinnerProps} />
      {loadingText || children}
    </span>
  );
}

export default Spinner;
