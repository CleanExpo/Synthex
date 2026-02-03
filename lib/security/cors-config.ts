/**
 * CORS Configuration
 *
 * @description Centralized CORS configuration for API security:
 * - Whitelist-based origin validation
 * - Method restrictions
 * - Header controls
 * - Credentials handling
 *
 * ENVIRONMENT VARIABLES:
 * - CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins
 * - NEXT_PUBLIC_APP_URL: Primary application URL
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CorsConfig {
  /** Allowed origins (use '*' for any, or array of specific origins) */
  allowedOrigins: string[] | '*';
  /** Allowed HTTP methods */
  allowedMethods: string[];
  /** Allowed request headers */
  allowedHeaders: string[];
  /** Headers exposed to the browser */
  exposedHeaders: string[];
  /** Allow credentials (cookies, auth headers) */
  credentials: boolean;
  /** Preflight cache duration in seconds */
  maxAge: number;
  /** Whether to allow requests without Origin header */
  allowNoOrigin: boolean;
}

export interface CorsResult {
  allowed: boolean;
  headers: Record<string, string>;
  reason?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const VERCEL_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const CUSTOM_ORIGINS = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || [];

// Default allowed origins
const DEFAULT_ALLOWED_ORIGINS = [
  APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://synthex.ai',
  'https://www.synthex.ai',
  'https://app.synthex.ai',
  ...(VERCEL_URL ? [VERCEL_URL] : []),
  ...CUSTOM_ORIGINS,
].filter(Boolean);

// Default CORS configuration
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'X-Api-Version',
    'Accept',
    'Accept-Language',
    'Content-Language',
    'Origin',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-Id',
    'X-Response-Time',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  allowNoOrigin: false,
};

// Strict CORS for sensitive endpoints
export const STRICT_CORS_CONFIG: CorsConfig = {
  ...DEFAULT_CORS_CONFIG,
  allowedOrigins: [APP_URL, 'https://synthex.ai', 'https://app.synthex.ai'],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowNoOrigin: false,
};

// Permissive CORS for public APIs
export const PUBLIC_CORS_CONFIG: CorsConfig = {
  ...DEFAULT_CORS_CONFIG,
  allowedOrigins: '*',
  credentials: false,
  allowNoOrigin: true,
};

// ============================================================================
// CORS VALIDATOR
// ============================================================================

export class CorsValidator {
  private config: CorsConfig;

  constructor(config: CorsConfig = DEFAULT_CORS_CONFIG) {
    this.config = config;
  }

  /**
   * Validate origin and return CORS headers
   */
  validate(origin: string | null, method: string): CorsResult {
    // Check if method is allowed
    if (!this.config.allowedMethods.includes(method.toUpperCase())) {
      return {
        allowed: false,
        headers: {},
        reason: `Method ${method} not allowed`,
      };
    }

    // Handle missing origin
    if (!origin) {
      if (this.config.allowNoOrigin) {
        return {
          allowed: true,
          headers: this.buildHeaders('*'),
        };
      }
      return {
        allowed: false,
        headers: {},
        reason: 'Origin header required',
      };
    }

    // Check origin
    const isAllowed = this.isOriginAllowed(origin);

    if (!isAllowed) {
      return {
        allowed: false,
        headers: {},
        reason: `Origin ${origin} not allowed`,
      };
    }

    return {
      allowed: true,
      headers: this.buildHeaders(origin),
    };
  }

  /**
   * Handle preflight (OPTIONS) request
   */
  handlePreflight(
    origin: string | null,
    requestMethod: string | null,
    requestHeaders: string | null
  ): CorsResult {
    // Validate origin first
    const originCheck = this.validate(origin, 'OPTIONS');
    if (!originCheck.allowed) {
      return originCheck;
    }

    // Check requested method
    if (requestMethod && !this.config.allowedMethods.includes(requestMethod.toUpperCase())) {
      return {
        allowed: false,
        headers: {},
        reason: `Method ${requestMethod} not allowed`,
      };
    }

    // Check requested headers
    if (requestHeaders) {
      const requested = requestHeaders.split(',').map(h => h.trim().toLowerCase());
      const allowed = this.config.allowedHeaders.map(h => h.toLowerCase());

      const disallowed = requested.filter(h => !allowed.includes(h));
      if (disallowed.length > 0) {
        return {
          allowed: false,
          headers: {},
          reason: `Headers not allowed: ${disallowed.join(', ')}`,
        };
      }
    }

    return {
      allowed: true,
      headers: {
        ...this.buildHeaders(origin || '*'),
        'Access-Control-Max-Age': this.config.maxAge.toString(),
      },
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isOriginAllowed(origin: string): boolean {
    if (this.config.allowedOrigins === '*') {
      return true;
    }

    // Normalize origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');

    return this.config.allowedOrigins.some(allowed => {
      // Exact match
      if (allowed === normalizedOrigin) return true;

      // Wildcard subdomain matching (e.g., *.synthex.ai)
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        const originDomain = new URL(normalizedOrigin).hostname;
        return originDomain === domain || originDomain.endsWith(`.${domain}`);
      }

      return false;
    });
  }

  private buildHeaders(origin: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': this.config.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': this.config.allowedHeaders.join(', '),
      'Access-Control-Expose-Headers': this.config.exposedHeaders.join(', '),
      'Vary': 'Origin',
    };

    if (this.config.credentials && origin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Apply CORS headers to a response
 */
export function applyCorsHeaders(
  response: Response,
  origin: string | null,
  config: CorsConfig = DEFAULT_CORS_CONFIG
): Response {
  const validator = new CorsValidator(config);
  const result = validator.validate(origin, 'GET');

  if (result.allowed) {
    Object.entries(result.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Create preflight response
 */
export function createPreflightResponse(
  origin: string | null,
  requestMethod: string | null,
  requestHeaders: string | null,
  config: CorsConfig = DEFAULT_CORS_CONFIG
): Response {
  const validator = new CorsValidator(config);
  const result = validator.handlePreflight(origin, requestMethod, requestHeaders);

  if (!result.allowed) {
    return new Response(result.reason, {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response(null, {
    status: 204,
    headers: result.headers,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export const corsValidator = new CorsValidator();
export default corsValidator;
