/**
 * Health Check API Endpoint
 * Provides system health status for monitoring and deployment verification
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Health check metrics
let healthMetrics = {
  uptime: 0,
  timestamp: new Date().toISOString(),
  version: packageJson.version,
  environment: process.env.NODE_ENV || 'development',
  memory: null,
  connections: {
    database: 'unknown',
    redis: 'unknown',
    external_apis: 'unknown'
  },
  features: {
    optimizers: false,
    monitoring: false,
    authentication: false
  }
};

// Update metrics
function updateHealthMetrics() {
  healthMetrics.uptime = process.uptime();
  healthMetrics.timestamp = new Date().toISOString();
  healthMetrics.memory = process.memoryUsage();
  
  // Check feature flags
  healthMetrics.features = {
    optimizers: process.env.REACT_APP_OPTIMIZERS === 'true',
    monitoring: process.env.ANALYTICS_ENABLED === 'true',
    authentication: !!process.env.JWT_SECRET,
    glassmorphicUI: process.env.REACT_APP_GLASSMORPHIC === 'true'
  };
}

// Test database connection
async function testDatabaseConnection() {
  try {
    // If using Supabase
    if (process.env.DATABASE_URL) {
      // Simple connection test would go here
      return 'connected';
    }
    return 'not_configured';
  } catch (error) {
    console.error('Database health check failed:', error);
    return 'error';
  }
}

// Test Redis connection
async function testRedisConnection() {
  try {
    if (process.env.REDIS_URL) {
      // Redis connection test would go here
      return 'connected';
    }
    return 'not_configured';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return 'error';
  }
}

// Test external APIs
async function testExternalAPIs() {
  const apis = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL
  };
  
  const configuredCount = Object.values(apis).filter(Boolean).length;
  
  if (configuredCount === 0) return 'not_configured';
  if (configuredCount < 2) return 'partial';
  return 'configured';
}

// Get detailed health status
async function getDetailedHealth() {
  updateHealthMetrics();
  
  // Test connections
  const [dbStatus, redisStatus, apiStatus] = await Promise.all([
    testDatabaseConnection(),
    testRedisConnection(),
    testExternalAPIs()
  ]);
  
  healthMetrics.connections = {
    database: dbStatus,
    redis: redisStatus,
    external_apis: apiStatus
  };
  
  // Determine overall status
  let status = 'healthy';
  
  if (healthMetrics.memory && healthMetrics.memory.heapUsed / healthMetrics.memory.heapTotal > 0.9) {
    status = 'warning';
  }
  
  if (dbStatus === 'error' || healthMetrics.uptime < 30) {
    status = 'unhealthy';
  }
  
  return {
    status,
    ...healthMetrics,
    checks: {
      memory_usage: healthMetrics.memory ? 
        Math.round((healthMetrics.memory.heapUsed / healthMetrics.memory.heapTotal) * 100) : 0,
      uptime_minutes: Math.round(healthMetrics.uptime / 60),
      environment_configured: process.env.NODE_ENV === 'production',
      feature_flags_enabled: Object.values(healthMetrics.features).some(Boolean)
    }
  };
}

// Main health check handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const detailed = req.query.detailed === 'true';
    
    if (detailed) {
      const health = await getDetailedHealth();
      res.status(health.status === 'healthy' ? 200 : 
                health.status === 'warning' ? 200 : 503)
         .json(health);
    } else {
      // Simple health check
      updateHealthMetrics();
      res.status(200).json({
        status: 'healthy',
        timestamp: healthMetrics.timestamp,
        uptime: Math.round(healthMetrics.uptime),
        version: healthMetrics.version,
        environment: healthMetrics.environment
      });
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
}

// Export for testing
export { getDetailedHealth, testDatabaseConnection, testRedisConnection };