/**
 * Three-Tier Architecture Configuration
 * Complete enterprise-grade system architecture definition
 */

export interface ThreeTierConfig {
  presentation: PresentationLayerConfig;
  business: BusinessLayerConfig;
  data: DataLayerConfig;
  infrastructure: InfrastructureConfig;
}

export interface PresentationLayerConfig {
  apiGateway: {
    enabled: boolean;
    rateLimit: {
      windowMs: number;
      max: number;
    };
    cors: {
      origins: string[];
      credentials: boolean;
    };
    compression: boolean;
    helmet: boolean;
  };
  routing: {
    apiVersioning: boolean;
    pathPrefix: string;
    documentation: {
      swagger: boolean;
      redoc: boolean;
    };
  };
  middleware: {
    authentication: boolean;
    authorization: boolean;
    validation: boolean;
    logging: boolean;
    monitoring: boolean;
  };
}

export interface BusinessLayerConfig {
  services: {
    caching: {
      provider: 'redis' | 'memory' | 'hybrid';
      ttl: number;
      maxSize: number;
    };
    messaging: {
      provider: 'rabbitmq' | 'redis' | 'sqs' | 'kafka';
      queues: string[];
      deadLetter: boolean;
    };
    orchestration: {
      workflows: boolean;
      saga: boolean;
      eventSourcing: boolean;
    };
  };
  patterns: {
    repository: boolean;
    unitOfWork: boolean;
    factory: boolean;
    observer: boolean;
    strategy: boolean;
  };
}

export interface DataLayerConfig {
  primary: {
    provider: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
    connectionString: string;
    poolSize: number;
    ssl: boolean;
  };
  cache: {
    provider: 'redis' | 'memcached';
    connectionString: string;
    cluster: boolean;
  };
  search: {
    provider: 'elasticsearch' | 'solr' | 'postgres-fts';
    connectionString?: string;
  };
  migrations: {
    enabled: boolean;
    autoRun: boolean;
    directory: string;
  };
}

export interface InfrastructureConfig {
  monitoring: {
    metrics: {
      provider: 'prometheus' | 'datadog' | 'newrelic';
      enabled: boolean;
    };
    logging: {
      provider: 'winston' | 'pino' | 'bunyan';
      level: 'error' | 'warn' | 'info' | 'debug';
      destinations: ('console' | 'file' | 'elasticsearch' | 'cloudwatch')[];
    };
    tracing: {
      provider: 'jaeger' | 'zipkin' | 'datadog';
      enabled: boolean;
    };
  };
  security: {
    jwt: {
      secret: string;
      expiresIn: string;
      issuer: string;
    };
    oauth: {
      providers: ('google' | 'github' | 'microsoft')[];
    };
    encryption: {
      algorithm: string;
      keyRotation: boolean;
    };
  };
  deployment: {
    containerized: boolean;
    orchestrator: 'kubernetes' | 'docker-swarm' | 'ecs';
    scaling: {
      horizontal: boolean;
      vertical: boolean;
      autoScale: boolean;
    };
  };
}

// Default enterprise configuration
export const defaultThreeTierConfig: ThreeTierConfig = {
  presentation: {
    apiGateway: {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000 // requests per window
      },
      cors: {
        origins: ['http://localhost:3000', 'https://synthex.app'],
        credentials: true
      },
      compression: true,
      helmet: true
    },
    routing: {
      apiVersioning: true,
      pathPrefix: '/api',
      documentation: {
        swagger: true,
        redoc: true
      }
    },
    middleware: {
      authentication: true,
      authorization: true,
      validation: true,
      logging: true,
      monitoring: true
    }
  },
  business: {
    services: {
      caching: {
        provider: 'redis',
        ttl: 3600, // 1 hour
        maxSize: 1000
      },
      messaging: {
        provider: 'redis',
        queues: ['content-generation', 'analytics', 'notifications', 'campaigns'],
        deadLetter: true
      },
      orchestration: {
        workflows: true,
        saga: true,
        eventSourcing: false
      }
    },
    patterns: {
      repository: true,
      unitOfWork: true,
      factory: true,
      observer: true,
      strategy: true
    }
  },
  data: {
    primary: {
      provider: 'postgresql',
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/synthex',
      poolSize: 20,
      ssl: process.env.NODE_ENV === 'production'
    },
    cache: {
      provider: 'redis',
      connectionString: process.env.REDIS_URL || 'redis://localhost:6379',
      cluster: false
    },
    search: {
      provider: 'postgres-fts'
    },
    migrations: {
      enabled: true,
      autoRun: process.env.NODE_ENV !== 'production',
      directory: './src/db/migrations'
    }
  },
  infrastructure: {
    monitoring: {
      metrics: {
        provider: 'prometheus',
        enabled: true
      },
      logging: {
        provider: 'winston',
        level: process.env.LOG_LEVEL as any || 'info',
        destinations: ['console', 'file']
      },
      tracing: {
        provider: 'jaeger',
        enabled: process.env.NODE_ENV === 'production'
      }
    },
    security: {
      jwt: {
        secret: process.env.JWT_SECRET || 'change-this-in-production',
        expiresIn: '7d',
        issuer: 'synthex-app'
      },
      oauth: {
        providers: ['google']
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keyRotation: true
      }
    },
    deployment: {
      containerized: true,
      orchestrator: 'kubernetes',
      scaling: {
        horizontal: true,
        vertical: false,
        autoScale: true
      }
    }
  }
};

// Environment-specific configurations
export const configs: Record<string, Partial<ThreeTierConfig>> = {
  development: {
    data: {
      primary: {
        provider: 'sqlite',
        connectionString: 'file:./dev.db',
        poolSize: 5,
        ssl: false
      }
    },
    infrastructure: {
      monitoring: {
        logging: {
          level: 'debug',
          destinations: ['console']
        }
      }
    }
  },
  
  staging: {
    presentation: {
      apiGateway: {
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 500
        }
      }
    }
  },
  
  production: {
    presentation: {
      apiGateway: {
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 2000
        }
      }
    },
    business: {
      services: {
        caching: {
          provider: 'redis',
          ttl: 7200, // 2 hours
          maxSize: 10000
        }
      }
    },
    data: {
      cache: {
        cluster: true
      }
    },
    infrastructure: {
      monitoring: {
        logging: {
          level: 'warn',
          destinations: ['file', 'elasticsearch']
        },
        tracing: {
          enabled: true
        }
      }
    }
  }
};

/**
 * Get configuration for current environment
 */
export function getThreeTierConfig(): ThreeTierConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = configs[env] || {};
  
  // Deep merge default config with environment-specific config
  return mergeConfigs(defaultThreeTierConfig, envConfig);
}

/**
 * Deep merge configuration objects
 */
function mergeConfigs(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeConfigs(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}