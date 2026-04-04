/**
 * Performance Tracking Middleware
 * Automatically tracks API response times and metrics
 *
 * @task UNI-426 - Implement Performance Monitoring Suite
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackAPIResponse } from '@/lib/monitoring/performance-monitor';

// Request ID counter
let requestCounter = 0;

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  requestCounter = (requestCounter + 1) % 1000000;
  return `req_${Date.now()}_${requestCounter.toString(36)}`;
}

/**
 * Extract endpoint pattern from URL
 * Normalizes dynamic segments like IDs
 */
function normalizeEndpoint(pathname: string): string {
  // Remove query string
  const path = pathname.split('?')[0];

  // Replace UUIDs and numeric IDs with placeholders
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-zA-Z0-9]{20,}/g, '/:id'); // Long alphanumeric IDs
}

/**
 * Check if path should be tracked
 */
function shouldTrack(pathname: string): boolean {
  // Skip static assets and internal paths
  const skipPatterns = [
    /^\/_next/,
    /^\/static/,
    /^\/favicon/,
    /^\/api\/health\/live$/, // Skip liveness probe (too frequent)
    /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf)$/,
  ];

  return !skipPatterns.some((pattern) => pattern.test(pathname));
}

/**
 * Performance tracking configuration
 */
export interface PerformanceTrackingConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of requests to track
  slowThreshold: number; // ms, log warning for slow requests
  excludePaths: RegExp[];
}

const defaultConfig: PerformanceTrackingConfig = {
  enabled: true,
  sampleRate: 1.0, // Track all requests by default
  slowThreshold: 1000,
  excludePaths: [],
};

let config = { ...defaultConfig };

/**
 * Configure performance tracking
 */
export function configurePerformanceTracking(newConfig: Partial<PerformanceTrackingConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Create performance tracking wrapper for API routes
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    if (!config.enabled) {
      return handler(request, ...args);
    }

    const pathname = new URL(request.url).pathname;

    // Check if should track
    if (!shouldTrack(pathname)) {
      return handler(request, ...args);
    }

    // Sample rate check
    if (Math.random() > config.sampleRate) {
      return handler(request, ...args);
    }

    const startTime = Date.now();
    const requestId = generateRequestId();
    const method = request.method;
    const endpoint = normalizeEndpoint(pathname);

    // Extract user ID from auth header if present
    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      // This is a placeholder - implement actual user extraction from JWT
      userId = 'authenticated';
    }

    try {
      // Execute handler
      const response = await handler(request, ...args);

      // Track metrics
      trackAPIResponse(
        endpoint,
        method,
        response.status,
        startTime,
        userId,
        requestId
      );

      // Log slow requests
      const duration = Date.now() - startTime;
      if (duration > config.slowThreshold) {
        console.warn(`[SLOW_REQUEST] ${method} ${endpoint} took ${duration}ms`);
      }

      // Add performance headers
      const headers = new Headers(response.headers);
      headers.set('X-Request-ID', requestId);
      headers.set('X-Response-Time', `${duration}ms`);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error: any) {
      // Track error
      trackAPIResponse(
        endpoint,
        method,
        500,
        startTime,
        userId,
        requestId,
        error.message
      );

      throw error;
    }
  }) as T;
}

/**
 * Middleware function for Next.js middleware.ts
 */
export function performanceTrackingMiddleware(request: NextRequest): {
  startTime: number;
  requestId: string;
  track: (response: NextResponse) => NextResponse;
} {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;
  const method = request.method;
  const endpoint = normalizeEndpoint(pathname);

  return {
    startTime,
    requestId,
    track: (response: NextResponse) => {
      if (shouldTrack(pathname)) {
        const duration = Date.now() - startTime;

        trackAPIResponse(endpoint, method, response.status, startTime, undefined, requestId);

        // Add headers
        response.headers.set('X-Request-ID', requestId);
        response.headers.set('X-Response-Time', `${duration}ms`);
      }

      return response;
    },
  };
}

/**
 * Simple timing utility for manual performance tracking
 */
export class Timer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  mark(name: string): void {
    this.marks.set(name, Date.now() - this.startTime);
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  getMarks(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }

  log(label: string = 'Timer'): void {
    console.log(`[${label}] Elapsed: ${this.elapsed()}ms`, this.getMarks());
  }
}

export default withPerformanceTracking;
