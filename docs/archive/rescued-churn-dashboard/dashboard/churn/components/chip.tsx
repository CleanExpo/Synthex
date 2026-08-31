import React from 'react';

interface ChipProps {
  variant?: 'success' | 'warning' | 'error' | 'neutral';
  children: React.ReactNode;
}

export function Chip({ variant = 'neutral', children }: ChipProps) {
  const baseClasses =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap';

  const variantClasses: Record<ChipProps['variant'], string> = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    neutral: 'bg-sx-bg-tertiary text-sx-text-secondary',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
