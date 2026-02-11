'use client';

/**
 * Live Counter Component
 *
 * Animated counter that smoothly transitions between values.
 * Perfect for real-time dashboard stats.
 */

import React, { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown } from '@/components/icons';

interface LiveCounterProps {
  value: number;
  previousValue?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (value: number) => string;
  showTrend?: boolean;
  trendThreshold?: number;
  className?: string;
  valueClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LiveCounter({
  value,
  previousValue,
  duration = 500,
  prefix = '',
  suffix = '',
  formatter,
  showTrend = true,
  trendThreshold = 0,
  className = '',
  valueClassName = '',
  size = 'md',
}: LiveCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValueRef = useRef(value);
  const animationFrameRef = useRef<number>();

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  useEffect(() => {
    if (value === previousValueRef.current) return;

    const startValue = previousValueRef.current;
    const endValue = value;
    const startTime = performance.now();

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (endValue - startValue) * easeOut;
      setDisplayValue(Math.round(currentValue));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
        previousValueRef.current = endValue;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  const formatValue = (val: number): string => {
    if (formatter) return formatter(val);

    // Default formatting with K, M, B suffixes
    if (val >= 1000000000) {
      return (val / 1000000000).toFixed(1) + 'B';
    }
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + 'M';
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(1) + 'K';
    }
    return val.toLocaleString();
  };

  const change = previousValue !== undefined ? value - previousValue : 0;
  const changePercent =
    previousValue && previousValue > 0
      ? ((value - previousValue) / previousValue) * 100
      : 0;

  const showUpTrend = showTrend && change > trendThreshold;
  const showDownTrend = showTrend && change < -trendThreshold;

  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      {/* Main Value */}
      <span
        className={`
          font-bold transition-all duration-200
          ${sizeClasses[size]}
          ${valueClassName}
          ${isAnimating ? 'scale-105' : 'scale-100'}
        `}
      >
        {prefix}
        {formatValue(displayValue)}
        {suffix}
      </span>

      {/* Trend Indicator */}
      {showUpTrend && (
        <span className="flex items-center gap-1 text-green-400 text-sm animate-pulse">
          <TrendingUp className="h-4 w-4" />
          <span>+{changePercent.toFixed(1)}%</span>
        </span>
      )}
      {showDownTrend && (
        <span className="flex items-center gap-1 text-red-400 text-sm">
          <TrendingDown className="h-4 w-4" />
          <span>{changePercent.toFixed(1)}%</span>
        </span>
      )}

      {/* Pulse animation on update */}
      {isAnimating && (
        <span className="absolute inset-0 bg-cyan-500/20 rounded-lg animate-ping pointer-events-none" />
      )}
    </div>
  );
}

/**
 * Percentage Counter
 */
export function PercentageCounter({
  value,
  previousValue,
  ...props
}: Omit<LiveCounterProps, 'suffix' | 'formatter'>) {
  return (
    <LiveCounter
      value={value}
      previousValue={previousValue}
      suffix="%"
      formatter={(v) => v.toFixed(1)}
      {...props}
    />
  );
}

/**
 * Currency Counter
 */
export function CurrencyCounter({
  value,
  previousValue,
  currency = 'USD',
  ...props
}: Omit<LiveCounterProps, 'prefix' | 'formatter'> & { currency?: string }) {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };

  return (
    <LiveCounter
      value={value}
      previousValue={previousValue}
      prefix={currencySymbols[currency] || '$'}
      formatter={(v) => v.toLocaleString('en-US', { minimumFractionDigits: 0 })}
      {...props}
    />
  );
}

export default LiveCounter;
