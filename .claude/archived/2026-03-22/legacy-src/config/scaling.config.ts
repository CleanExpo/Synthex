/**
 * Auto-scaling Configuration
 * Production scaling settings for handling traffic spikes
 *
 * @task UNI-439 - Implement Auto-scaling Configuration
 *
 * ENVIRONMENT VARIABLES:
 * - RATE_LIMIT_WINDOW_MS: Rate limit window in ms (default: 60000)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 * - SCALING_MAX_CONCURRENT: Max concurrent requests (default: 100)
 * - SCALING_QUEUE_SIZE: Request queue size (default: 500)
 */

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  statusCode: number;
  keyGenerator: (identifier: string) => string;
  skipFailedRequests: boolean;
  skipSuccessfulRequests: boolean;
}

export interface RateLimitTier {
  anonymous: RateLimitConfig;
  authenticated: RateLimitConfig;
  premium: RateLimitConfig;
  enterprise: RateLimitConfig;
}

/**
 * Get rate limiting configuration for different user tiers
 */
export function getRateLimitConfig(): RateLimitTier {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

  return {
    anonymous: {
      windowMs,
      maxRequests: parseInt(process.env.RATE_LIMIT_ANON_MAX || '30', 10),
      message: 'Too many requests. Please try again later.',
      statusCode: 429,
      keyGenerator: (ip: string) => `ratelimit:anon:${ip}`,
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
    },
    authenticated: {
      windowMs,
      maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '100', 10),
      message: 'Rate limit exceeded. Please slow down.',
      statusCode: 429,
      keyGenerator: (userId: string) => `ratelimit:auth:${userId}`,
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
    },
    premium: {
      windowMs,
      maxRequests: parseInt(process.env.RATE_LIMIT_PREMIUM_MAX || '500', 10),
      message: 'Rate limit exceeded. Contact support if you need higher limits.',
      statusCode: 429,
      keyGenerator: (userId: string) => `ratelimit:premium:${userId}`,
      skipFailedRequests: true,
      skipSuccessfulRequests: false,
    },
    enterprise: {
      windowMs,
      maxRequests: parseInt(process.env.RATE_LIMIT_ENTERPRISE_MAX || '2000', 10),
      message: 'Rate limit exceeded. Please contact your account manager.',
      statusCode: 429,
      keyGenerator: (userId: string) => `ratelimit:enterprise:${userId}`,
      skipFailedRequests: true,
      skipSuccessfulRequests: false,
    },
  };
}

// ============================================================================
// ENDPOINT-SPECIFIC RATE LIMITS
// ============================================================================

export interface EndpointRateLimit {
  path: string;
  windowMs: number;
  maxRequests: number;
  method?: string;
}

/**
 * Get endpoint-specific rate limits for sensitive operations
 */
export function getEndpointRateLimits(): EndpointRateLimit[] {
  return [
    // Authentication endpoints - stricter limits
    {
      path: '/api/auth/login',
      windowMs: 300000, // 5 minutes
      maxRequests: 5,
      method: 'POST',
    },
    {
      path: '/api/auth/register',
      windowMs: 3600000, // 1 hour
      maxRequests: 3,
      method: 'POST',
    },
    {
      path: '/api/auth/request-reset',
      windowMs: 3600000, // 1 hour
      maxRequests: 3,
      method: 'POST',
    },
    // AI endpoints - resource intensive
    {
      path: '/api/ai/generate',
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      method: 'POST',
    },
    {
      path: '/api/generate',
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      method: 'POST',
    },
    // Social posting - prevent spam
    {
      path: '/api/social/post',
      windowMs: 60000, // 1 minute
      maxRequests: 5,
      method: 'POST',
    },
    // Bulk operations
    {
      path: '/api/quotes',
      windowMs: 60000,
      maxRequests: 20,
      method: 'DELETE',
    },
  ];
}

// ============================================================================
// SCALING CONFIGURATION
// ============================================================================

export interface ScalingConfig {
  maxConcurrentRequests: number;
  queueSize: number;
  queueTimeout: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  healthCheckInterval: number;
  gracefulShutdownTimeout: number;
}

/**
 * Get scaling configuration for production
 */
export function getScalingConfig(): ScalingConfig {
  return {
    // Max concurrent requests per instance
    maxConcurrentRequests: parseInt(process.env.SCALING_MAX_CONCURRENT || '100', 10),

    // Request queue settings
    queueSize: parseInt(process.env.SCALING_QUEUE_SIZE || '500', 10),
    queueTimeout: parseInt(process.env.SCALING_QUEUE_TIMEOUT || '30000', 10), // 30s

    // Circuit breaker settings
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '50', 10), // 50% failure rate
    circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '30000', 10), // 30s

    // Health check settings
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '10000', 10), // 10s

    // Graceful shutdown
    gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000', 10), // 30s
  };
}

// ============================================================================
// CACHING CONFIGURATION
// ============================================================================

export interface CacheTTL {
  [key: string]: number;
}

export interface CachingConfig {
  enabled: boolean;
  defaultTTL: number;
  maxCacheSize: number;
  ttlByEndpoint: CacheTTL;
  staleWhileRevalidate: number;
}

/**
 * Get caching configuration for API responses
 */
export function getCachingConfig(): CachingConfig {
  return {
    enabled: process.env.CACHING_ENABLED !== 'false',
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '60', 10), // 60s
    maxCacheSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10), // items
    staleWhileRevalidate: parseInt(process.env.CACHE_STALE_WHILE_REVALIDATE || '300', 10), // 5 min

    // TTL by endpoint pattern (in seconds)
    ttlByEndpoint: {
      '/api/stats': 300, // 5 minutes
      '/api/quotes': 60, // 1 minute
      '/api/health': 10, // 10 seconds
      '/api/health/redis': 10,
      '/api/health/db': 10,
    },
  };
}

// ============================================================================
// RESOURCE LIMITS
// ============================================================================

export interface ResourceLimits {
  maxRequestBodySize: string;
  maxResponseSize: string;
  maxHeaderSize: string;
  maxUrlLength: number;
  maxUploadSize: string;
  maxJsonDepth: number;
}

/**
 * Get resource limits for request/response handling
 */
export function getResourceLimits(): ResourceLimits {
  return {
    maxRequestBodySize: process.env.MAX_REQUEST_BODY_SIZE || '10mb',
    maxResponseSize: process.env.MAX_RESPONSE_SIZE || '50mb',
    maxHeaderSize: process.env.MAX_HEADER_SIZE || '8kb',
    maxUrlLength: parseInt(process.env.MAX_URL_LENGTH || '2048', 10),
    maxUploadSize: process.env.MAX_UPLOAD_SIZE || '50mb',
    maxJsonDepth: parseInt(process.env.MAX_JSON_DEPTH || '20', 10),
  };
}

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

export interface TimeoutConfig {
  default: number;
  ai: number;
  database: number;
  external: number;
  upload: number;
}

/**
 * Get timeout configuration for different operation types
 */
export function getTimeoutConfig(): TimeoutConfig {
  return {
    default: parseInt(process.env.TIMEOUT_DEFAULT || '30000', 10), // 30s
    ai: parseInt(process.env.TIMEOUT_AI || '60000', 10), // 60s
    database: parseInt(process.env.TIMEOUT_DATABASE || '10000', 10), // 10s
    external: parseInt(process.env.TIMEOUT_EXTERNAL || '15000', 10), // 15s
    upload: parseInt(process.env.TIMEOUT_UPLOAD || '120000', 10), // 2 min
  };
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Get retry configuration for failed operations
 */
export function getRetryConfig(): RetryConfig {
  return {
    maxRetries: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000', 10), // 1s
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '30000', 10), // 30s
    backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || '2'),
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'SERVICE_UNAVAILABLE',
      'GATEWAY_TIMEOUT',
    ],
  };
}

// ============================================================================
// MONITORING THRESHOLDS
// ============================================================================

export interface MonitoringThresholds {
  errorRateWarning: number;
  errorRateCritical: number;
  latencyWarning: number;
  latencyCritical: number;
  memoryWarning: number;
  memoryCritical: number;
  cpuWarning: number;
  cpuCritical: number;
}

/**
 * Get monitoring thresholds for alerting
 */
export function getMonitoringThresholds(): MonitoringThresholds {
  return {
    errorRateWarning: parseFloat(process.env.MONITOR_ERROR_RATE_WARN || '0.05'), // 5%
    errorRateCritical: parseFloat(process.env.MONITOR_ERROR_RATE_CRIT || '0.10'), // 10%
    latencyWarning: parseInt(process.env.MONITOR_LATENCY_WARN || '1000', 10), // 1s
    latencyCritical: parseInt(process.env.MONITOR_LATENCY_CRIT || '5000', 10), // 5s
    memoryWarning: parseFloat(process.env.MONITOR_MEMORY_WARN || '0.80'), // 80%
    memoryCritical: parseFloat(process.env.MONITOR_MEMORY_CRIT || '0.95'), // 95%
    cpuWarning: parseFloat(process.env.MONITOR_CPU_WARN || '0.70'), // 70%
    cpuCritical: parseFloat(process.env.MONITOR_CPU_CRIT || '0.90'), // 90%
  };
}

// ============================================================================
// COMBINED CONFIGURATION
// ============================================================================

export interface AutoScalingConfig {
  rateLimit: RateLimitTier;
  endpointRateLimits: EndpointRateLimit[];
  scaling: ScalingConfig;
  caching: CachingConfig;
  resources: ResourceLimits;
  timeouts: TimeoutConfig;
  retry: RetryConfig;
  monitoring: MonitoringThresholds;
}

/**
 * Get complete auto-scaling configuration
 */
export function getAutoScalingConfig(): AutoScalingConfig {
  return {
    rateLimit: getRateLimitConfig(),
    endpointRateLimits: getEndpointRateLimits(),
    scaling: getScalingConfig(),
    caching: getCachingConfig(),
    resources: getResourceLimits(),
    timeouts: getTimeoutConfig(),
    retry: getRetryConfig(),
    monitoring: getMonitoringThresholds(),
  };
}

// Export default configuration
export default {
  getRateLimitConfig,
  getEndpointRateLimits,
  getScalingConfig,
  getCachingConfig,
  getResourceLimits,
  getTimeoutConfig,
  getRetryConfig,
  getMonitoringThresholds,
  getAutoScalingConfig,
};
