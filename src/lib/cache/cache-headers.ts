/**
 * Cache Control and CDN Configuration
 * Optimizes performance with proper caching strategies
 */

export interface CacheConfig {
  maxAge: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  mustRevalidate?: boolean;
  public?: boolean;
  private?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  immutable?: boolean;
}

/**
 * Cache configurations for different resource types
 */
export const CacheConfigs: Record<string, CacheConfig> = {
  // Static assets - cache for 1 year
  STATIC_ASSETS: {
    maxAge: 31536000, // 1 year
    public: true,
    immutable: true
  },
  
  // Images - cache for 30 days
  IMAGES: {
    maxAge: 2592000, // 30 days
    public: true,
    staleWhileRevalidate: 86400 // 1 day
  },
  
  // API responses - no client cache, CDN cache
  API_RESPONSES: {
    maxAge: 0,
    sMaxAge: 60, // CDN caches for 1 minute
    staleWhileRevalidate: 300, // 5 minutes
    private: true
  },
  
  // HTML pages - short cache with revalidation
  HTML_PAGES: {
    maxAge: 300, // 5 minutes
    sMaxAge: 3600, // CDN caches for 1 hour
    staleWhileRevalidate: 86400, // 1 day
    staleIfError: 604800 // 7 days
  },
  
  // User-specific content - no cache
  USER_CONTENT: {
    noStore: true,
    noCache: true,
    private: true
  },
  
  // Marketing pages - moderate cache
  MARKETING_PAGES: {
    maxAge: 3600, // 1 hour
    sMaxAge: 86400, // CDN caches for 1 day
    staleWhileRevalidate: 604800 // 7 days
  },
  
  // Error pages - short cache
  ERROR_PAGES: {
    maxAge: 60, // 1 minute
    sMaxAge: 300, // CDN caches for 5 minutes
    staleIfError: 3600 // 1 hour
  }
};

/**
 * Generate Cache-Control header string
 */
export function generateCacheControl(config: CacheConfig): string {
  const directives: string[] = [];
  
  if (config.noStore) {
    return 'no-store';
  }
  
  if (config.noCache) {
    directives.push('no-cache');
  }
  
  if (config.public) {
    directives.push('public');
  } else if (config.private) {
    directives.push('private');
  }
  
  if (config.maxAge !== undefined) {
    directives.push(`max-age=${config.maxAge}`);
  }
  
  if (config.sMaxAge !== undefined) {
    directives.push(`s-maxage=${config.sMaxAge}`);
  }
  
  if (config.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }
  
  if (config.staleIfError !== undefined) {
    directives.push(`stale-if-error=${config.staleIfError}`);
  }
  
  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }
  
  if (config.immutable) {
    directives.push('immutable');
  }
  
  return directives.join(', ');
}

/**
 * Set cache headers based on path
 */
export function setCacheHeaders(path: string, headers: Headers): void {
  let config: CacheConfig;
  
  // Determine cache config based on path
  if (path.match(/\.(js|css|woff2?|ttf|eot|svg|ico)$/)) {
    config = CacheConfigs.STATIC_ASSETS;
  } else if (path.match(/\.(jpg|jpeg|png|gif|webp|avif)$/)) {
    config = CacheConfigs.IMAGES;
  } else if (path.startsWith('/api/')) {
    // Check for specific API endpoints
    if (path.includes('/user/') || path.includes('/auth/')) {
      config = CacheConfigs.USER_CONTENT;
    } else {
      config = CacheConfigs.API_RESPONSES;
    }
  } else if (path.match(/\/(pricing|about|features|contact)/)) {
    config = CacheConfigs.MARKETING_PAGES;
  } else if (path.match(/\/(404|500|error)/)) {
    config = CacheConfigs.ERROR_PAGES;
  } else {
    config = CacheConfigs.HTML_PAGES;
  }
  
  // Set Cache-Control header
  headers.set('Cache-Control', generateCacheControl(config));
  
  // Set ETag for cache validation
  headers.set('ETag', `W/"${generateETag(path)}"`)
  
  // Set Vary header for proper caching
  if (path.startsWith('/api/')) {
    headers.set('Vary', 'Accept-Encoding, Authorization');
  } else {
    headers.set('Vary', 'Accept-Encoding');
  }
}

/**
 * Generate ETag for resource
 */
function generateETag(content: string): string {
  // Simple ETag generation - in production use proper hashing
  const hash = content.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  return Math.abs(hash).toString(36);
}

/**
 * CDN purge configuration
 */
export interface PurgeConfig {
  urls?: string[];
  tags?: string[];
  all?: boolean;
}

/**
 * Purge CDN cache
 */
export async function purgeCDNCache(config: PurgeConfig): Promise<void> {
  const purgeUrl = process.env.CDN_PURGE_URL;
  const purgeKey = process.env.CDN_PURGE_KEY;
  
  if (!purgeUrl || !purgeKey) {
    console.warn('CDN purge not configured');
    return;
  }
  
  const payload = {
    files: config.urls,
    tags: config.tags,
    purge_everything: config.all
  };
  
  try {
    const response = await fetch(purgeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${purgeKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`CDN purge failed: ${response.statusText}`);
    }
    
    console.log('✅ CDN cache purged successfully');
  } catch (error) {
    console.error('❌ CDN purge error:', error);
    throw error;
  }
}

/**
 * Middleware to handle cache headers
 */
export function cacheMiddleware(request: Request): Response | null {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Check if resource can be served from cache
  const ifNoneMatch = request.headers.get('If-None-Match');
  const etag = `W/"${generateETag(path)}"`;
  
  if (ifNoneMatch === etag) {
    // Return 304 Not Modified
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': generateCacheControl(CacheConfigs.STATIC_ASSETS)
      }
    });
  }
  
  return null;
}