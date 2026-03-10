'use client';

import { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  startOnView?: boolean;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedCounter({
  end,
  duration = 2000,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  startOnView = true,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const currentCount = easedProgress * end;

      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, hasStarted]);

  const formattedCount = count.toFixed(decimals);
  const displayValue = Number(formattedCount).toLocaleString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}

// Specialized counter for percentage
export function PercentageCounter({
  end,
  duration = 2000,
  className = '',
}: {
  end: number;
  duration?: number;
  className?: string;
}) {
  return (
    <AnimatedCounter
      end={end}
      duration={duration}
      suffix="%"
      decimals={1}
      className={className}
    />
  );
}

// Specialized counter for currency
export function CurrencyCounter({
  end,
  duration = 2000,
  className = '',
}: {
  end: number;
  duration?: number;
  className?: string;
}) {
  return (
    <AnimatedCounter
      end={end}
      duration={duration}
      prefix="$"
      decimals={0}
      className={className}
    />
  );
}

// Specialized counter with K/M suffix
export function CompactCounter({
  value,
  duration = 2000,
  className = '',
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  let displayValue = value;
  let suffix = '';

  if (value >= 1000000) {
    displayValue = value / 1000000;
    suffix = 'M';
  } else if (value >= 1000) {
    displayValue = value / 1000;
    suffix = 'K';
  }

  return (
    <AnimatedCounter
      end={displayValue}
      duration={duration}
      suffix={suffix}
      decimals={suffix ? 1 : 0}
      className={className}
    />
  );
}
