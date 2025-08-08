/**
 * CDN Service for Static Assets
 * Handles asset optimization and delivery through CDN providers
 */

// CDN Configuration
const CDN_CONFIG = {
  enabled: process.env.CDN_ENABLED === 'true',
  provider: process.env.CDN_PROVIDER || 'vercel', // vercel, cloudflare, aws, custom
  baseUrl: process.env.CDN_URL || '',
  
  // Asset optimization settings
  optimization: {
    images: {
      enabled: process.env.CDN_IMAGE_OPTIMIZATION !== 'false',
      quality: parseInt(process.env.CDN_IMAGE_QUALITY) || 85,
      formats: ['webp', 'avif', 'jpeg', 'png'],
      sizes: [320, 640, 768, 1024, 1280, 1920],
      lazyLoading: true
    },
    css: {
      enabled: process.env.CDN_CSS_OPTIMIZATION !== 'false',
      minify: true,
      purgeUnused: process.env.NODE_ENV === 'production'
    },
    js: {
      enabled: process.env.CDN_JS_OPTIMIZATION !== 'false',
      minify: true,
      compression: 'gzip'
    }
  },

  // Cache settings
  cache: {
    static: '31536000', // 1 year for static assets
    dynamic: '3600',    // 1 hour for dynamic content
    api: '300',         // 5 minutes for API responses
    images: '86400'     // 1 day for images
  },

  // Security headers
  security: {
    contentSecurityPolicy: true,
    crossOrigin: 'anonymous',
    referrerPolicy: 'strict-origin-when-cross-origin'
  }
};

class CDNService {
  constructor() {
    this.isEnabled = CDN_CONFIG.enabled;
    this.baseUrl = this.getBaseUrl();
    this.assetManifest = new Map();
    this.init();
  }

  // Initialize CDN service
  init() {
    if (!this.isEnabled) {
      console.log('CDN service disabled');
      return;
    }

    console.log(`CDN service initialized with ${CDN_CONFIG.provider} provider`);
    this.loadAssetManifest();
  }

  // Get CDN base URL based on provider
  getBaseUrl() {
    if (!this.isEnabled || !CDN_CONFIG.baseUrl) {
      return '';
    }

    switch (CDN_CONFIG.provider) {
      case 'vercel':
        return CDN_CONFIG.baseUrl || this.getVercelUrl();
      case 'cloudflare':
        return CDN_CONFIG.baseUrl;
      case 'aws':
        return CDN_CONFIG.baseUrl;
      case 'custom':
        return CDN_CONFIG.baseUrl;
      default:
        return CDN_CONFIG.baseUrl;
    }
  }

  // Get Vercel deployment URL
  getVercelUrl() {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  }

  // Load asset manifest for cache busting
  async loadAssetManifest() {
    try {
      // In a real implementation, this would load from a manifest file
      // generated during build process
      const response = await fetch('/asset-manifest.json').catch(() => null);
      if (response?.ok) {
        const manifest = await response.json();
        Object.entries(manifest.files || {}).forEach(([key, value]) => {
          this.assetManifest.set(key, value);
        });
      }
    } catch (error) {
      console.warn('Failed to load asset manifest:', error.message);
    }
  }

  // Generate asset URL with CDN
  getAssetUrl(assetPath, options = {}) {
    if (!this.isEnabled || !assetPath) {
      return assetPath;
    }

    // Remove leading slash if present
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    
    // Check for versioned asset in manifest
    const versionedPath = this.assetManifest.get(cleanPath) || cleanPath;
    
    // Build full CDN URL
    const baseUrl = this.baseUrl || '';
    let fullUrl = baseUrl ? `${baseUrl}/${versionedPath}` : `/${versionedPath}`;

    // Add optimization parameters for images
    if (this.isImageAsset(assetPath) && CDN_CONFIG.optimization.images.enabled) {
      fullUrl = this.addImageOptimization(fullUrl, options);
    }

    return fullUrl;
  }

  // Add image optimization parameters
  addImageOptimization(url, options = {}) {
    const params = new URLSearchParams();

    // Width and height
    if (options.width) params.set('w', options.width);
    if (options.height) params.set('h', options.height);

    // Quality
    const quality = options.quality || CDN_CONFIG.optimization.images.quality;
    params.set('q', quality);

    // Format
    if (options.format) {
      params.set('f', options.format);
    } else if (this.supportsWebP() && CDN_CONFIG.optimization.images.formats.includes('webp')) {
      params.set('f', 'webp');
    }

    // Fit mode
    if (options.fit) params.set('fit', options.fit);

    // Device pixel ratio
    if (options.dpr) params.set('dpr', options.dpr);

    // Add parameters to URL
    if (params.toString()) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}${params.toString()}`;
    }

    return url;
  }

  // Generate responsive image srcset
  generateSrcSet(assetPath, options = {}) {
    if (!this.isEnabled || !this.isImageAsset(assetPath)) {
      return '';
    }

    const sizes = options.sizes || CDN_CONFIG.optimization.images.sizes;
    const srcSet = sizes.map(size => {
      const url = this.getAssetUrl(assetPath, { 
        ...options, 
        width: size 
      });
      return `${url} ${size}w`;
    }).join(', ');

    return srcSet;
  }

  // Generate CSS with CDN URLs
  processCSSUrls(cssContent) {
    if (!this.isEnabled) return cssContent;

    return cssContent.replace(
      /url\(['"]?([^'")]+)['"]?\)/g,
      (match, url) => {
        if (url.startsWith('http') || url.startsWith('data:')) {
          return match; // Don't process external URLs or data URLs
        }
        const cdnUrl = this.getAssetUrl(url);
        return `url('${cdnUrl}')`;
      }
    );
  }

  // Preload critical assets
  preloadAssets(assets) {
    if (typeof document === 'undefined' || !this.isEnabled) return;

    assets.forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = this.getAssetUrl(asset.url);
      
      if (asset.as) link.as = asset.as;
      if (asset.type) link.type = asset.type;
      if (asset.crossorigin) link.crossOrigin = asset.crossorigin;
      
      document.head.appendChild(link);
    });
  }

  // Generate cache headers
  getCacheHeaders(assetType) {
    const maxAge = CDN_CONFIG.cache[assetType] || CDN_CONFIG.cache.static;
    
    return {
      'Cache-Control': `public, max-age=${maxAge}, immutable`,
      'Expires': new Date(Date.now() + parseInt(maxAge) * 1000).toUTCString(),
      'ETag': `"${Date.now()}"`, // Simple ETag, should be based on content hash
      'Vary': 'Accept-Encoding'
    };
  }

  // Generate security headers for assets
  getSecurityHeaders() {
    const headers = {};

    if (CDN_CONFIG.security.crossOrigin) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
    }

    if (CDN_CONFIG.security.referrerPolicy) {
      headers['Referrer-Policy'] = CDN_CONFIG.security.referrerPolicy;
    }

    if (CDN_CONFIG.security.contentSecurityPolicy) {
      headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
    }

    return headers;
  }

  // Utility methods
  isImageAsset(path) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
    return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  isCSSAsset(path) {
    return path.toLowerCase().endsWith('.css');
  }

  isJSAsset(path) {
    return path.toLowerCase().endsWith('.js');
  }

  supportsWebP() {
    if (typeof window === 'undefined') return true; // Assume support on server
    
    // Check if browser supports WebP
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  // Performance monitoring
  trackAssetPerformance(assetUrl, loadTime) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'asset_load', {
        event_category: 'performance',
        event_label: assetUrl,
        value: loadTime
      });
    }
  }

  // Asset optimization for build process
  optimizeAsset(assetPath, content, type) {
    if (!this.isEnabled) return content;

    switch (type) {
      case 'css':
        return this.optimizeCSS(content);
      case 'js':
        return this.optimizeJS(content);
      default:
        return content;
    }
  }

  optimizeCSS(cssContent) {
    if (!CDN_CONFIG.optimization.css.enabled) return cssContent;

    let optimized = cssContent;

    if (CDN_CONFIG.optimization.css.minify) {
      // Basic CSS minification
      optimized = optimized
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove last semicolon in rules
        .trim();
    }

    // Process CDN URLs
    optimized = this.processCSSUrls(optimized);

    return optimized;
  }

  optimizeJS(jsContent) {
    if (!CDN_CONFIG.optimization.js.enabled) return jsContent;

    // Basic JS optimization (in production, use proper tools like Terser)
    return jsContent;
  }

  // CDN status and health check
  async healthCheck() {
    if (!this.isEnabled) {
      return { status: 'disabled' };
    }

    try {
      // Test CDN availability with a small asset
      const testUrl = this.getAssetUrl('/favicon.ico');
      const startTime = Date.now();
      
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const responseTime = Date.now() - startTime;

      return {
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        provider: CDN_CONFIG.provider,
        baseUrl: this.baseUrl
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Get CDN statistics
  getStats() {
    return {
      enabled: this.isEnabled,
      provider: CDN_CONFIG.provider,
      baseUrl: this.baseUrl,
      manifestSize: this.assetManifest.size,
      optimization: {
        images: CDN_CONFIG.optimization.images.enabled,
        css: CDN_CONFIG.optimization.css.enabled,
        js: CDN_CONFIG.optimization.js.enabled
      }
    };
  }
}

// Create singleton instance
export const cdnService = new CDNService();

// Export convenience methods
export const {
  getAssetUrl,
  generateSrcSet,
  preloadAssets,
  getCacheHeaders,
  getSecurityHeaders,
  healthCheck,
  getStats
} = cdnService;

export default cdnService;