/**
 * Environment Configuration Manager
 * Handles environment-specific settings and configurations
 */

const environments = {
  development: {
    name: 'Development',
    url: 'http://localhost:3000',
    apiUrl: 'http://localhost:3000/api/v1',
    features: {
      analytics: false,
      betaFeatures: true,
      debugMode: true,
      rateLimiting: false,
      caching: false,
      serviceWorker: false
    },
    security: {
      corsOrigin: '*',
      rateLimitMax: 1000,
      rateLimitWindow: 60000
    },
    database: {
      logging: true,
      synchronize: true
    }
  },

  staging: {
    name: 'Staging',
    url: 'https://staging.synthex.social',
    apiUrl: 'https://staging.synthex.social/api/v1',
    features: {
      analytics: true,
      betaFeatures: true,
      debugMode: true,
      rateLimiting: true,
      caching: true,
      serviceWorker: true
    },
    security: {
      corsOrigin: 'https://staging.synthex.social',
      rateLimitMax: 200,
      rateLimitWindow: 60000
    },
    database: {
      logging: false,
      synchronize: false
    },
    monitoring: {
      sentry: true,
      logLevel: 'debug'
    }
  },

  production: {
    name: 'Production',
    url: 'https://synthex.social',
    apiUrl: 'https://synthex.social/api/v1',
    features: {
      analytics: true,
      betaFeatures: false,
      debugMode: false,
      rateLimiting: true,
      caching: true,
      serviceWorker: true
    },
    security: {
      corsOrigin: 'https://synthex.social',
      rateLimitMax: 100,
      rateLimitWindow: 60000
    },
    database: {
      logging: false,
      synchronize: false
    },
    monitoring: {
      sentry: true,
      logLevel: 'error'
    }
  },

  test: {
    name: 'Test',
    url: 'http://localhost:3001',
    apiUrl: 'http://localhost:3001/api/v1',
    features: {
      analytics: false,
      betaFeatures: true,
      debugMode: true,
      rateLimiting: false,
      caching: false,
      serviceWorker: false
    },
    security: {
      corsOrigin: '*',
      rateLimitMax: 10000,
      rateLimitWindow: 1000
    },
    database: {
      logging: false,
      synchronize: true
    }
  }
};

/**
 * Get environment configuration
 */
function getEnvironment(env = process.env.NODE_ENV || 'development') {
  const config = environments[env] || environments.development;
  
  return {
    ...config,
    env,
    isDevelopment: env === 'development',
    isStaging: env === 'staging',
    isProduction: env === 'production',
    isTest: env === 'test'
  };
}

/**
 * Get specific feature flag
 */
function getFeatureFlag(flag) {
  const env = getEnvironment();
  return env.features[flag] || false;
}

/**
 * Get API endpoint
 */
function getApiEndpoint(path = '') {
  const env = getEnvironment();
  return `${env.apiUrl}${path}`;
}

/**
 * Check if environment is secure (HTTPS)
 */
function isSecureEnvironment() {
  const env = getEnvironment();
  return env.url.startsWith('https://');
}

/**
 * Get database configuration
 */
function getDatabaseConfig() {
  const env = getEnvironment();
  return {
    ...env.database,
    url: process.env.DATABASE_URL,
    ssl: isSecureEnvironment() ? { rejectUnauthorized: false } : false
  };
}

/**
 * Get security configuration
 */
function getSecurityConfig() {
  const env = getEnvironment();
  return {
    ...env.security,
    jwtSecret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET
  };
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
  const required = {
    common: ['NODE_ENV', 'DATABASE_URL'],
    staging: ['JWT_SECRET', 'OPENROUTER_API_KEY', 'SUPABASE_URL'],
    production: ['JWT_SECRET', 'OPENROUTER_API_KEY', 'SUPABASE_URL', 'SENTRY_DSN']
  };

  const env = process.env.NODE_ENV || 'development';
  const errors = [];

  // Check common requirements
  required.common.forEach(key => {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });

  // Check environment-specific requirements
  if (env === 'staging' || env === 'production') {
    required[env]?.forEach(key => {
      if (!process.env[key]) {
        errors.push(`Missing required ${env} environment variable: ${key}`);
      }
    });
  }

  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    if (env === 'production') {
      throw new Error('Environment validation failed in production');
    }
  }

  return errors.length === 0;
}

module.exports = {
  getEnvironment,
  getFeatureFlag,
  getApiEndpoint,
  isSecureEnvironment,
  getDatabaseConfig,
  getSecurityConfig,
  validateEnvironment,
  environments
};