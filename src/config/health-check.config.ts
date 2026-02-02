/**
 * Health Check Configuration
 * Load balancer and monitoring configuration
 *
 * @task UNI-438 - Implement Load Balancer Health Checks
 *
 * HEALTH CHECK ENDPOINTS:
 * - /api/health       - Comprehensive health (all checks)
 * - /api/health/live  - Liveness probe (process alive?)
 * - /api/health/ready - Readiness probe (accept traffic?)
 * - /api/health/db    - Database health
 * - /api/health/redis - Cache health
 * - /api/health/scaling - Scaling metrics
 */

// ============================================================================
// HEALTH CHECK ENDPOINT CONFIGURATION
// ============================================================================

export interface HealthEndpoint {
  path: string;
  description: string;
  methods: string[];
  timeout: number;
  successCodes: number[];
  failureCodes: number[];
  interval: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

/**
 * Get health check endpoint configurations
 */
export function getHealthEndpoints(): Record<string, HealthEndpoint> {
  return {
    comprehensive: {
      path: '/api/health',
      description: 'Comprehensive health check with all dependencies',
      methods: ['GET', 'HEAD'],
      timeout: 10000,
      successCodes: [200],
      failureCodes: [500, 502, 503, 504],
      interval: 30000, // 30 seconds
      unhealthyThreshold: 3,
      healthyThreshold: 2,
    },
    liveness: {
      path: '/api/health/live',
      description: 'Liveness probe - checks if process is running',
      methods: ['GET', 'HEAD'],
      timeout: 2000,
      successCodes: [200],
      failureCodes: [500, 502, 503, 504],
      interval: 10000, // 10 seconds
      unhealthyThreshold: 3,
      healthyThreshold: 1,
    },
    readiness: {
      path: '/api/health/ready',
      description: 'Readiness probe - checks if service can accept traffic',
      methods: ['GET', 'HEAD'],
      timeout: 5000,
      successCodes: [200],
      failureCodes: [503],
      interval: 15000, // 15 seconds
      unhealthyThreshold: 2,
      healthyThreshold: 2,
    },
    database: {
      path: '/api/health/db',
      description: 'Database connectivity and pool status',
      methods: ['GET'],
      timeout: 5000,
      successCodes: [200],
      failureCodes: [503],
      interval: 30000,
      unhealthyThreshold: 3,
      healthyThreshold: 2,
    },
    redis: {
      path: '/api/health/redis',
      description: 'Redis/cache connectivity',
      methods: ['GET'],
      timeout: 5000,
      successCodes: [200, 207], // 207 = degraded but functional
      failureCodes: [503],
      interval: 30000,
      unhealthyThreshold: 3,
      healthyThreshold: 2,
    },
    scaling: {
      path: '/api/health/scaling',
      description: 'Scaling metrics and resource utilization',
      methods: ['GET'],
      timeout: 5000,
      successCodes: [200, 207],
      failureCodes: [503],
      interval: 60000, // 1 minute
      unhealthyThreshold: 5,
      healthyThreshold: 2,
    },
  };
}

// ============================================================================
// LOAD BALANCER CONFIGURATIONS
// ============================================================================

export interface LoadBalancerConfig {
  provider: string;
  healthCheckPath: string;
  healthCheckMethod: string;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  successCodes: string;
  additionalConfig?: Record<string, any>;
}

/**
 * Get AWS Application Load Balancer configuration
 */
export function getAWSALBConfig(): LoadBalancerConfig {
  return {
    provider: 'aws-alb',
    healthCheckPath: '/api/health/ready',
    healthCheckMethod: 'GET',
    healthCheckInterval: 15,
    healthCheckTimeout: 5,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    successCodes: '200',
    additionalConfig: {
      protocol: 'HTTPS',
      port: 443,
      matcher: {
        httpCode: '200',
      },
    },
  };
}

/**
 * Get AWS Network Load Balancer configuration
 */
export function getAWSNLBConfig(): LoadBalancerConfig {
  return {
    provider: 'aws-nlb',
    healthCheckPath: '/api/health/live',
    healthCheckMethod: 'GET',
    healthCheckInterval: 10,
    healthCheckTimeout: 2,
    healthyThreshold: 2,
    unhealthyThreshold: 2,
    successCodes: '200',
    additionalConfig: {
      protocol: 'TCP',
      port: 443,
    },
  };
}

/**
 * Get Kubernetes health check configuration
 */
export function getKubernetesConfig(): {
  livenessProbe: Record<string, any>;
  readinessProbe: Record<string, any>;
  startupProbe: Record<string, any>;
} {
  return {
    livenessProbe: {
      httpGet: {
        path: '/api/health/live',
        port: 3000,
        scheme: 'HTTP',
      },
      initialDelaySeconds: 10,
      periodSeconds: 10,
      timeoutSeconds: 2,
      successThreshold: 1,
      failureThreshold: 3,
    },
    readinessProbe: {
      httpGet: {
        path: '/api/health/ready',
        port: 3000,
        scheme: 'HTTP',
      },
      initialDelaySeconds: 5,
      periodSeconds: 15,
      timeoutSeconds: 5,
      successThreshold: 2,
      failureThreshold: 2,
    },
    startupProbe: {
      httpGet: {
        path: '/api/health/ready',
        port: 3000,
        scheme: 'HTTP',
      },
      initialDelaySeconds: 0,
      periodSeconds: 5,
      timeoutSeconds: 5,
      successThreshold: 1,
      failureThreshold: 30, // Allow up to 150 seconds for startup
    },
  };
}

/**
 * Get Nginx upstream health check configuration
 */
export function getNginxConfig(): string {
  return `
# Nginx health check configuration for SYNTHEX
upstream synthex_backend {
    zone backend 64k;
    server app:3000;

    # Health check configuration
    health_check interval=15s
                 fails=3
                 passes=2
                 uri=/api/health/ready
                 match=healthy;
}

match healthy {
    status 200;
    header Content-Type ~ application/json;
    body ~ '"status"\\s*:\\s*"ready"';
}

server {
    location /api {
        proxy_pass http://synthex_backend;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;

        # Pass health check headers
        proxy_set_header X-Health-Check-Origin nginx;
    }
}
`.trim();
}

/**
 * Get HAProxy health check configuration
 */
export function getHAProxyConfig(): string {
  return `
# HAProxy health check configuration for SYNTHEX
backend synthex_servers
    mode http
    balance roundrobin
    option httpchk GET /api/health/ready
    http-check expect status 200

    # Server definitions
    server app1 app1:3000 check inter 15s fall 3 rise 2
    server app2 app2:3000 check inter 15s fall 3 rise 2

    # Timeouts
    timeout connect 5s
    timeout server 30s
    timeout check 5s
`.trim();
}

/**
 * Get Cloudflare Load Balancer configuration
 */
export function getCloudflareConfig(): Record<string, any> {
  return {
    monitor: {
      type: 'https',
      method: 'GET',
      path: '/api/health/ready',
      port: 443,
      timeout: 5,
      interval: 15,
      retries: 2,
      expectedCodes: '200',
      followRedirects: false,
      allowInsecure: false,
      header: {
        'User-Agent': ['Cloudflare-Health-Check'],
      },
    },
    pool: {
      minimumOrigins: 1,
      notificationEmail: 'alerts@example.com',
    },
  };
}

// ============================================================================
// HEALTH CHECK RESPONSE SCHEMAS
// ============================================================================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
  responseTime?: number;
  checks?: Record<string, CheckResult>;
}

export interface CheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, any>;
}

export interface LivenessResponse {
  status: 'alive';
  timestamp: string;
  uptime: number;
}

export interface ReadinessResponse {
  status: 'ready' | 'degraded' | 'not_ready';
  timestamp: string;
  responseTime: number;
  checks: Record<string, CheckResult>;
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all health check configurations for documentation
 */
export function getAllConfigurations(): Record<string, any> {
  return {
    endpoints: getHealthEndpoints(),
    loadBalancers: {
      awsALB: getAWSALBConfig(),
      awsNLB: getAWSNLBConfig(),
      kubernetes: getKubernetesConfig(),
      cloudflare: getCloudflareConfig(),
    },
    configExamples: {
      nginx: getNginxConfig(),
      haproxy: getHAProxyConfig(),
    },
  };
}

/**
 * Validate health check response
 */
export function isHealthy(response: HealthResponse): boolean {
  return response.status === 'healthy';
}

/**
 * Check if service is ready to accept traffic
 */
export function isReady(response: ReadinessResponse): boolean {
  return response.status === 'ready' || response.status === 'degraded';
}

export default {
  getHealthEndpoints,
  getAWSALBConfig,
  getAWSNLBConfig,
  getKubernetesConfig,
  getNginxConfig,
  getHAProxyConfig,
  getCloudflareConfig,
  getAllConfigurations,
  isHealthy,
  isReady,
};
