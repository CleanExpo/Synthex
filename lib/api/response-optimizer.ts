/**
 * API Response Optimizer
 *
 * @description Provides response optimization utilities including:
 * - Response compression for large payloads
 * - Automatic pagination with cursor support
 * - Field selection (GraphQL-lite)
 * - Cache headers management
 * - Response timing metrics
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_APP_URL: Application URL for cache headers (PUBLIC)
 *
 * FAILURE MODE: Falls back to unoptimized responses
 */

import { NextResponse } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export interface OptimizedResponseOptions {
  compress?: boolean;
  cacheDuration?: number;
  cacheType?: 'static' | 'dynamic' | 'api' | 'private' | 'none';
  etag?: boolean;
}

export interface FieldSelectionOptions {
  fields?: string[];
  exclude?: string[];
  depth?: number;
}

// ============================================================================
// CACHE HEADERS
// ============================================================================

/**
 * Pre-configured cache header values for different scenarios
 */
export const cacheHeaders = {
  // Static content that never changes
  static: 'public, max-age=31536000, immutable',

  // Dynamic content that can be cached but must revalidate
  dynamic: 'private, max-age=0, must-revalidate',

  // API responses with stale-while-revalidate
  api: 's-maxage=60, stale-while-revalidate=300',

  // Private data (user-specific)
  private: 'private, no-cache, no-store, must-revalidate',

  // No caching at all
  none: 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

/**
 * Get cache headers based on type and optional duration
 */
export function getCacheHeaders(
  type: keyof typeof cacheHeaders = 'api',
  durationSeconds?: number
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (type === 'none') {
    headers['Cache-Control'] = cacheHeaders.none;
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  } else if (durationSeconds !== undefined) {
    if (type === 'private') {
      headers['Cache-Control'] = `private, max-age=${durationSeconds}`;
    } else {
      headers['Cache-Control'] = `public, s-maxage=${durationSeconds}, stale-while-revalidate=${durationSeconds * 2}`;
    }
  } else {
    headers['Cache-Control'] = cacheHeaders[type];
  }

  return headers;
}

// ============================================================================
// RESPONSE OPTIMIZER
// ============================================================================

export class ResponseOptimizer {
  /**
   * Paginate an array of items
   */
  static paginate<T>(
    items: T[],
    page: number = 1,
    limit: number = 20,
    options?: { cursorField?: keyof T }
  ): PaginatedResponse<T> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const total = items.length;
    const totalPages = Math.ceil(total / safeLimit);
    const startIndex = (safePage - 1) * safeLimit;
    const endIndex = startIndex + safeLimit;
    const data = items.slice(startIndex, endIndex);
    const hasMore = endIndex < total;

    const response: PaginatedResponse<T> = {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasMore,
      },
    };

    // Add cursor-based pagination if field specified
    if (options?.cursorField && data.length > 0) {
      const lastItem = data[data.length - 1];
      const firstItem = data[0];

      response.pagination.nextCursor = hasMore
        ? this.encodeCursor(String(lastItem[options.cursorField]))
        : undefined;

      response.pagination.prevCursor = safePage > 1
        ? this.encodeCursor(String(firstItem[options.cursorField]))
        : undefined;
    }

    return response;
  }

  /**
   * Select specific fields from an object
   */
  static selectFields<T extends Record<string, unknown>>(
    item: T,
    options: FieldSelectionOptions
  ): Partial<T> {
    const { fields, exclude, depth = 3 } = options;

    if (!fields && !exclude) {
      return item;
    }

    const result: Partial<T> = {};

    // If fields specified, only include those
    if (fields && fields.length > 0) {
      for (const field of fields) {
        if (field in item) {
          const value = item[field as keyof T];
          result[field as keyof T] = this.processFieldValue(value, depth);
        }
      }
      return result;
    }

    // If exclude specified, include all except those
    if (exclude && exclude.length > 0) {
      for (const key of Object.keys(item) as Array<keyof T>) {
        if (!exclude.includes(key as string)) {
          const value = item[key];
          result[key] = this.processFieldValue(value, depth);
        }
      }
      return result;
    }

    return item;
  }

  /**
   * Process a field value recursively
   */
  private static processFieldValue<T>(value: T, depth: number): T {
    if (depth <= 0) {
      return value;
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(v => this.processFieldValue(v, depth - 1)) as T;
    }

    if (typeof value === 'object' && !(value instanceof Date)) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        obj[k] = this.processFieldValue(v, depth - 1);
      }
      return obj as T;
    }

    return value;
  }

  /**
   * Encode a cursor for pagination
   */
  static encodeCursor(value: string): string {
    return Buffer.from(value).toString('base64url');
  }

  /**
   * Decode a pagination cursor
   */
  static decodeCursor(cursor: string): string {
    return Buffer.from(cursor, 'base64url').toString('utf-8');
  }

  /**
   * Estimate response size in bytes
   */
  static estimateSize(data: unknown): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Check if response should be compressed
   */
  static shouldCompress(data: unknown, threshold: number = 1024): boolean {
    return this.estimateSize(data) > threshold;
  }

  /**
   * Generate ETag for response
   */
  static generateETag(data: unknown): string {
    const content = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `"${Math.abs(hash).toString(16)}"`;
  }

  /**
   * Create an optimized NextResponse
   */
  static createResponse<T>(
    data: T,
    options: OptimizedResponseOptions & { status?: number } = {}
  ): NextResponse<T> {
    const {
      cacheType = 'api',
      cacheDuration,
      etag = true,
      status = 200,
    } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getCacheHeaders(cacheType, cacheDuration),
    };

    // Add ETag for cache validation
    if (etag) {
      headers['ETag'] = this.generateETag(data);
    }

    // Add timing header
    headers['X-Response-Time'] = `${Date.now()}`;

    return NextResponse.json(data, {
      status,
      headers,
    });
  }

  /**
   * Create a paginated response
   */
  static createPaginatedResponse<T>(
    items: T[],
    page: number,
    limit: number,
    options?: OptimizedResponseOptions & { cursorField?: keyof T }
  ): NextResponse<PaginatedResponse<T>> {
    const paginated = this.paginate(items, page, limit, {
      cursorField: options?.cursorField,
    });

    return this.createResponse(paginated, {
      ...options,
      cacheType: options?.cacheType || 'api',
    });
  }

  /**
   * Create an error response
   */
  static createErrorResponse(
    message: string,
    status: number = 500,
    details?: Record<string, unknown>
  ): NextResponse {
    return NextResponse.json(
      {
        error: message,
        status,
        timestamp: new Date().toISOString(),
        ...(details && { details }),
      },
      {
        status,
        headers: getCacheHeaders('none'),
      }
    );
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number } = {}
): { page: number; limit: number; cursor?: string } {
  const page = parseInt(searchParams.get('page') || String(defaults.page || 1), 10);
  const limit = parseInt(searchParams.get('limit') || String(defaults.limit || 20), 10);
  const cursor = searchParams.get('cursor') || undefined;

  return {
    page: Math.max(1, page),
    limit: Math.min(Math.max(1, limit), 100),
    cursor,
  };
}

/**
 * Parse field selection from URL search params
 */
export function parseFieldSelection(
  searchParams: URLSearchParams
): FieldSelectionOptions {
  const fieldsParam = searchParams.get('fields');
  const excludeParam = searchParams.get('exclude');

  return {
    fields: fieldsParam ? fieldsParam.split(',').map(f => f.trim()) : undefined,
    exclude: excludeParam ? excludeParam.split(',').map(f => f.trim()) : undefined,
  };
}

/**
 * Apply response optimization to data
 */
export function optimizeResponse<T extends Record<string, unknown>>(
  data: T | T[],
  options: {
    fields?: FieldSelectionOptions;
    pagination?: { page: number; limit: number };
  } = {}
): T | T[] | PaginatedResponse<T> {
  let result = data;

  // Apply field selection
  if (options.fields && (options.fields.fields || options.fields.exclude)) {
    if (Array.isArray(result)) {
      result = result.map(item =>
        ResponseOptimizer.selectFields(item, options.fields!)
      ) as T[];
    } else {
      result = ResponseOptimizer.selectFields(result as T, options.fields!) as T;
    }
  }

  // Apply pagination
  if (options.pagination && Array.isArray(result)) {
    return ResponseOptimizer.paginate(
      result,
      options.pagination.page,
      options.pagination.limit
    );
  }

  return result;
}

// Export default
export default ResponseOptimizer;
