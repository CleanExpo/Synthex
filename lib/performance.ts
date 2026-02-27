/**
 * Performance Monitoring Utilities for SYNTHEX
 *
 * Provides Web Vitals collection, performance marks,
 * and RUM (Real User Monitoring) capabilities.
 *
 * @module lib/performance
 */

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  inp: number; // Interaction to Next Paint
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

export interface WebVitalsMetric {
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

/** Chrome-specific memory info interface */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/** Extended performance interface with memory */
interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

/** Slow resource info */
interface SlowResourceInfo {
  name: string;
  duration: number;
  size: number;
  type: string;
}

// Web Vitals Thresholds (based on Google's standards)
const VITALS_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Get rating for a metric value
 */
export function getMetricRating(
  name: WebVitalsMetric['name'],
  value: number
): WebVitalsMetric['rating'] {
  const thresholds = VITALS_THRESHOLDS[name];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

// Web Vitals collection
export function collectWebVitals(metric: WebVitalsMetric) {
  const metrics: PerformanceMetrics = {
    fcp: 0,
    lcp: 0,
    fid: 0,
    inp: 0,
    cls: 0,
    ttfb: 0,
  };

  switch (metric.name) {
    case 'FCP':
      metrics.fcp = metric.value;
      break;
    case 'LCP':
      metrics.lcp = metric.value;
      break;
    case 'FID':
      metrics.fid = metric.value;
      break;
    case 'INP':
      metrics.inp = metric.value;
      break;
    case 'CLS':
      metrics.cls = metric.value;
      break;
    case 'TTFB':
      metrics.ttfb = metric.value;
      break;
  }

  // Send metrics to analytics endpoint
  if (process.env.NODE_ENV === 'production') {
    sendMetricsToAnalytics(metrics);
  }
}

// Send metrics to your analytics service
async function sendMetricsToAnalytics(metrics: PerformanceMetrics) {
  try {
    // Replace with your analytics endpoint
    await fetch('/api/analytics/performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metrics,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    });
  } catch (error) {
    console.error('Failed to send performance metrics:', error);
  }
}

// Resource timing analysis
export function analyzeResourceTiming(): SlowResourceInfo[] | undefined {
  if (!window.performance || !window.performance.getEntriesByType) {
    return;
  }

  const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const slowResources: SlowResourceInfo[] = resources
    .filter((resource) => resource.duration > 1000)
    .map((resource) => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize,
      type: resource.initiatorType,
    }));

  // slowResources are returned to caller for handling

  return slowResources;
}

// Memory usage monitoring
export function monitorMemoryUsage(): { usedJSHeapSize: string; totalJSHeapSize: string; jsHeapSizeLimit: string } | null {
  const extendedPerf = performance as ExtendedPerformance;
  if (extendedPerf.memory) {
    const memory = extendedPerf.memory;
    const memoryInfo = {
      usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
    };


    // Memory usage is returned to caller for handling

    return memoryInfo;
  }
  return null;
}

// Lazy loading helper
// Note: Dynamic imports with variable paths require specific handling
// Use React.lazy() or next/dynamic for component lazy loading instead
export async function lazyLoad(
  componentPath: string
): Promise<null> {
  // This is a placeholder - in practice, use next/dynamic or React.lazy
  // Dynamic imports with variables are not supported in webpack
  return Promise.resolve(null);
}

// Image optimization helper
export function getOptimizedImageUrl(
  src: string,
  width: number,
  quality: number = 75
): string {
  // If using Next.js Image component internally
  if (src.startsWith('/')) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
  }
  return src;
}

// Debounce helper for performance
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle helper for performance
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Request idle callback wrapper
export function whenIdle(callback: () => void) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback);
  } else {
    setTimeout(callback, 1);
  }
}

// Intersection Observer for lazy loading
export function observeElement(
  element: Element,
  callback: () => void,
  options?: IntersectionObserverInit
) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback();
        observer.unobserve(element);
      }
    });
  }, options);

  observer.observe(element);
  return observer;
}

// Performance marks and measures
export class PerformanceTracker {
  private marks: Map<string, number> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
    if (window.performance && window.performance.mark) {
      window.performance.mark(name);
    }
  }

  measure(name: string, startMark: string, endMark?: string) {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();
    
    if (start && end) {
      const duration = end - (typeof start === 'number' ? start : 0);
      
      if (window.performance && window.performance.measure) {
        window.performance.measure(name, startMark, endMark);
      }
      
      return duration;
    }
    return 0;
  }

  clear() {
    this.marks.clear();
    if (window.performance && window.performance.clearMarks) {
      window.performance.clearMarks();
      window.performance.clearMeasures();
    }
  }
}

// Export singleton instance
export const performanceTracker = new PerformanceTracker();