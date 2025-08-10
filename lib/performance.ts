// Performance monitoring utilities for SYNTHEX

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

// Web Vitals collection
export function collectWebVitals(metric: any) {
  const metrics: PerformanceMetrics = {
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0,
  };

  switch (metric.name) {
    case 'FCP':
      metrics.fcp = metric.value;
      console.log('FCP:', metric.value);
      break;
    case 'LCP':
      metrics.lcp = metric.value;
      console.log('LCP:', metric.value);
      break;
    case 'FID':
      metrics.fid = metric.value;
      console.log('FID:', metric.value);
      break;
    case 'CLS':
      metrics.cls = metric.value;
      console.log('CLS:', metric.value);
      break;
    case 'TTFB':
      metrics.ttfb = metric.value;
      console.log('TTFB:', metric.value);
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
export function analyzeResourceTiming() {
  if (!window.performance || !window.performance.getEntriesByType) {
    return;
  }

  const resources = window.performance.getEntriesByType('resource');
  const slowResources = resources
    .filter((resource: any) => resource.duration > 1000)
    .map((resource: any) => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize,
      type: resource.initiatorType,
    }));

  if (slowResources.length > 0) {
    console.warn('Slow resources detected:', slowResources);
  }

  return slowResources;
}

// Memory usage monitoring
export function monitorMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const memoryInfo = {
      usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
    };
    
    console.log('Memory usage:', memoryInfo);
    
    // Warn if memory usage is high
    const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    if (usagePercent > 90) {
      console.warn('High memory usage detected:', usagePercent.toFixed(2) + '%');
    }
    
    return memoryInfo;
  }
  return null;
}

// Lazy loading helper
export function lazyLoad(
  componentPath: string,
  chunkName?: string
): Promise<any> {
  return import(
    /* webpackChunkName: "[request]" */
    /* webpackPrefetch: true */
    componentPath
  );
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
export function debounce<T extends (...args: any[]) => any>(
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
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(...args: Parameters<T>) {
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
    (window as any).requestIdleCallback(callback);
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
      console.log(`${name}: ${duration.toFixed(2)}ms`);
      
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