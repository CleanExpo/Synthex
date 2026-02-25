'use client';

import { useEffect } from 'react';
import { collectWebVitals, analyzeResourceTiming, monitorMemoryUsage } from '@/lib/performance';
import { getMonitoring } from '@/lib/monitoring';

export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize monitoring
    const monitoring = getMonitoring();

    // Track page view
    monitoring.trackAction('page_view', window.location.pathname);

    // Web Vitals monitoring via web-vitals SDK
    import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      onCLS(collectWebVitals);
      onFCP(collectWebVitals);
      onINP(collectWebVitals);
      onLCP(collectWebVitals);
      onTTFB(collectWebVitals);
    }).catch(() => {
      // web-vitals not available — PostHog fallback handles collection
    });

    // Analyze resource timing after page load
    if (document.readyState === 'complete') {
      analyzeResourceTiming();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => {
          analyzeResourceTiming();
          monitorMemoryUsage();
        }, 1000);
      });
    }

    // Monitor memory usage periodically in development
    if (process.env.NODE_ENV === 'development') {
      const memoryInterval = setInterval(() => {
        monitorMemoryUsage();
      }, 30000); // Every 30 seconds

      return () => clearInterval(memoryInterval);
    }

    // Clean up
    return () => {
      // Monitoring service handles its own cleanup
    };
  }, []);

  return null; // This component doesn't render anything
}