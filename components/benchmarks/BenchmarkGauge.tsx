'use client';

/**
 * Benchmark Gauge
 *
 * @description Semi-circular gauge showing percentile score (0-100)
 * with color zones indicating performance level.
 */

import { cn } from '@/lib/utils';

interface BenchmarkGaugeProps {
  value: number; // 0-100 percentile
  rating: 'below' | 'average' | 'good' | 'excellent';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RATING_COLORS = {
  below: { stroke: '#ef4444', text: 'text-red-400', bg: 'bg-red-500/10' },
  average: { stroke: '#eab308', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  good: { stroke: '#22c55e', text: 'text-green-400', bg: 'bg-green-500/10' },
  excellent: { stroke: '#06b6d4', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

const RATING_LABELS = {
  below: 'Below Average',
  average: 'Average',
  good: 'Good',
  excellent: 'Excellent',
};

const SIZE_CONFIG = {
  sm: { width: 100, height: 60, strokeWidth: 8, fontSize: 'text-lg', labelSize: 'text-xs' },
  md: { width: 140, height: 80, strokeWidth: 10, fontSize: 'text-2xl', labelSize: 'text-sm' },
  lg: { width: 200, height: 110, strokeWidth: 12, fontSize: 'text-4xl', labelSize: 'text-base' },
};

export function BenchmarkGauge({
  value,
  rating,
  label,
  size = 'md',
  className,
}: BenchmarkGaugeProps) {
  const config = SIZE_CONFIG[size];
  const colors = RATING_COLORS[rating];

  // SVG arc calculations
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const clampedValue = Math.max(0, Math.min(100, value));
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  // Center coordinates
  const cx = config.width / 2;
  const cy = config.height;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <svg
          width={config.width}
          height={config.height}
          viewBox={`0 0 ${config.width} ${config.height}`}
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${cy}`}
            fill="none"
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${cy}`}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={cn('font-bold text-white', config.fontSize)}>
            {Math.round(clampedValue)}
          </span>
        </div>
      </div>

      {/* Rating badge */}
      <div className={cn('px-3 py-1 rounded-full mt-2', colors.bg)}>
        <span className={cn('text-xs font-medium', colors.text)}>
          {RATING_LABELS[rating]}
        </span>
      </div>

      {/* Label */}
      {label && (
        <p className={cn('text-gray-400 mt-2', config.labelSize)}>
          {label}
        </p>
      )}
    </div>
  );
}

// Loading skeleton
export function BenchmarkGaugeSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const config = SIZE_CONFIG[size];

  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-white/5 rounded-t-full animate-pulse"
        style={{ width: config.width, height: config.height }}
      />
      <div className="w-20 h-6 bg-white/5 rounded-full mt-2 animate-pulse" />
      <div className="w-24 h-4 bg-white/5 rounded mt-2 animate-pulse" />
    </div>
  );
}

export default BenchmarkGauge;
