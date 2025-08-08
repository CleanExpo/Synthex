/**
 * SYNTHEX Application Configuration
 * Central configuration management for all services
 */

require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? './config/.env.production' : '.env' });

module.exports = {
  // Core Application Settings
  app: {
    name: process.env.APP_NAME || 'SYNTHEX',
    version: process.env.APP_VERSION || '2.0.0',
    env: process.env.NODE_ENV || 'development',
    url: process.env.APP_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:3000/api',
    cdnUrl: process.env.CDN_URL || '',
    debug: process.env.DEBUG === 'true',
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
    maintenanceMessage: process.env.MAINTENANCE_MESSAGE || 'Under maintenance'
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    timeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 104857600
  },

  // Database Configuration
  database: {
    connection: process.env.DB_CONNECTION || 'postgresql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_DATABASE || 'synthex',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10
    }
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'synthex:',
    ttl: parseInt(process.env.REDIS_CACHE_TTL) || 3600
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    secure: process.env.SESSION_SECURE === 'true',
    httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  // Email Configuration
  mail: {
    driver: process.env.MAIL_DRIVER || 'smtp',
    host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.MAIL_PORT) || 587,
    username: process.env.MAIL_USERNAME || '',
    password: process.env.MAIL_PASSWORD || '',
    encryption: process.env.MAIL_ENCRYPTION || 'tls',
    from: {
      address: process.env.MAIL_FROM_ADDRESS || 'noreply@synthex.app',
      name: process.env.MAIL_FROM_NAME || 'SYNTHEX'
    },
    providers: {
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY || ''
      },
      mailgun: {
        apiKey: process.env.MAILGUN_API_KEY || '',
        domain: process.env.MAILGUN_DOMAIN || ''
      },
      ses: {
        key: process.env.AWS_SES_KEY || '',
        secret: process.env.AWS_SES_SECRET || '',
        region: process.env.AWS_SES_REGION || 'us-east-1'
      }
    }
  },

  // AI Providers Configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      organization: process.env.OPENAI_ORGANIZATION || '',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4096,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 4096
    },
    google: {
      apiKey: process.env.GOOGLE_AI_KEY || '',
      model: process.env.GOOGLE_AI_MODEL || 'gemini-pro'
    },
    custom: {
      endpoint: process.env.CUSTOM_AI_ENDPOINT || '',
      apiKey: process.env.CUSTOM_AI_KEY || ''
    }
  },

  // Social Media Platforms
  social: {
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      redirectUri: process.env.TIKTOK_REDIRECT_URI || ''
    },
    instagram: {
      clientId: process.env.INSTAGRAM_CLIENT_ID || '',
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
      redirectUri: process.env.INSTAGRAM_REDIRECT_URI || ''
    },
    facebook: {
      appId: process.env.FACEBOOK_APP_ID || '',
      appSecret: process.env.FACEBOOK_APP_SECRET || '',
      redirectUri: process.env.FACEBOOK_REDIRECT_URI || ''
    },
    twitter: {
      apiKey: process.env.TWITTER_API_KEY || '',
      apiSecret: process.env.TWITTER_API_SECRET || '',
      bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
      accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
      accessSecret: process.env.TWITTER_ACCESS_SECRET || ''
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      redirectUri: process.env.LINKEDIN_REDIRECT_URI || ''
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY || '',
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || ''
    },
    pinterest: {
      appId: process.env.PINTEREST_APP_ID || '',
      appSecret: process.env.PINTEREST_APP_SECRET || ''
    },
    snapchat: {
      clientId: process.env.SNAPCHAT_CLIENT_ID || '',
      clientSecret: process.env.SNAPCHAT_CLIENT_SECRET || ''
    }
  },

  // Analytics Configuration
  analytics: {
    google: {
      trackingId: process.env.GOOGLE_ANALYTICS_ID || ''
    },
    mixpanel: {
      token: process.env.MIXPANEL_TOKEN || ''
    },
    segment: {
      writeKey: process.env.SEGMENT_WRITE_KEY || ''
    },
    amplitude: {
      apiKey: process.env.AMPLITUDE_API_KEY || ''
    },
    hotjar: {
      siteId: process.env.HOTJAR_SITE_ID || ''
    }
  },

  // Push Notifications
  notifications: {
    fcm: {
      serverKey: process.env.FCM_SERVER_KEY || '',
      senderId: process.env.FCM_SENDER_ID || ''
    },
    apns: {
      keyId: process.env.APNS_KEY_ID || '',
      teamId: process.env.APNS_TEAM_ID || '',
      bundleId: process.env.APNS_BUNDLE_ID || '',
      production: process.env.APNS_PRODUCTION === 'true'
    },
    oneSignal: {
      appId: process.env.ONESIGNAL_APP_ID || '',
      apiKey: process.env.ONESIGNAL_API_KEY || ''
    }
  },

  // Cloud Storage
  storage: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      bucket: process.env.AWS_BUCKET || '',
      cloudFrontUrl: process.env.AWS_CLOUDFRONT_URL || ''
    },
    gcs: {
      projectId: process.env.GCS_PROJECT_ID || '',
      keyFile: process.env.GCS_KEY_FILE || '',
      bucket: process.env.GCS_BUCKET || ''
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || ''
    }
  },

  // CDN Configuration
  cdn: {
    enabled: process.env.CDN_ENABLED === 'true',
    provider: process.env.CDN_PROVIDER || 'cloudflare',
    cloudflare: {
      zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
      apiToken: process.env.CLOUDFLARE_API_TOKEN || ''
    },
    cacheMaxAge: parseInt(process.env.CDN_CACHE_MAX_AGE) || 31536000,
    cachePublic: process.env.CDN_CACHE_PUBLIC === 'true'
  },

  // WebSocket Configuration
  websocket: {
    enabled: process.env.WS_ENABLED === 'true',
    port: parseInt(process.env.WS_PORT) || 3001,
    cors: {
      origin: process.env.WS_CORS_ORIGIN || '*'
    },
    pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 30000,
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 60000
  },

  // Rate Limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS === 'true'
  },

  // Security Configuration
  security: {
    cors: {
      enabled: process.env.CORS_ENABLED === 'true',
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
      credentials: process.env.CORS_CREDENTIALS === 'true'
    },
    helmet: {
      enabled: process.env.HELMET_ENABLED === 'true'
    },
    csrf: {
      enabled: process.env.CSRF_ENABLED === 'true',
      secret: process.env.CSRF_SECRET || ''
    },
    bcrypt: {
      rounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
    }
  },

  // Monitoring & Logging
  monitoring: {
    log: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'combined',
      toFile: process.env.LOG_TO_FILE === 'true',
      filePath: process.env.LOG_FILE_PATH || './logs/app.log',
      rotation: process.env.LOG_ROTATION || 'daily',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d'
    },
    sentry: {
      dsn: process.env.SENTRY_DSN || '',
      environment: process.env.SENTRY_ENVIRONMENT || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1
    },
    newRelic: {
      appName: process.env.NEW_RELIC_APP_NAME || '',
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY || ''
    },
    datadog: {
      apiKey: process.env.DATADOG_API_KEY || '',
      appKey: process.env.DATADOG_APP_KEY || ''
    }
  },

  // A/B Testing
  abTesting: {
    enabled: process.env.AB_TESTING_ENABLED === 'true',
    optimizely: {
      sdkKey: process.env.OPTIMIZELY_SDK_KEY || ''
    },
    googleOptimize: {
      id: process.env.GOOGLE_OPTIMIZE_ID || ''
    },
    splitIo: {
      apiKey: process.env.SPLIT_IO_API_KEY || ''
    }
  },

  // Payment Processing
  payment: {
    stripe: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      prices: {
        basic: process.env.STRIPE_PRICE_ID_BASIC || '',
        pro: process.env.STRIPE_PRICE_ID_PRO || '',
        enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || ''
      }
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
      mode: process.env.PAYPAL_MODE || 'sandbox'
    }
  },

  // White-label Configuration
  whiteLabel: {
    enabled: process.env.WHITE_LABEL_ENABLED === 'true',
    multiTenant: process.env.MULTI_TENANT_ENABLED === 'true',
    customDomain: process.env.CUSTOM_DOMAIN_ENABLED === 'true',
    sso: {
      enabled: process.env.SSO_ENABLED === 'true',
      saml: {
        entryPoint: process.env.SAML_ENTRY_POINT || '',
        issuer: process.env.SAML_ISSUER || '',
        certPath: process.env.SAML_CERT_PATH || ''
      },
      oauth: {
        clientId: process.env.OAUTH_CLIENT_ID || '',
        clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
        authorizationUrl: process.env.OAUTH_AUTHORIZATION_URL || '',
        tokenUrl: process.env.OAUTH_TOKEN_URL || ''
      },
      ldap: {
        url: process.env.LDAP_URL || '',
        bindDn: process.env.LDAP_BIND_DN || '',
        bindCredentials: process.env.LDAP_BIND_CREDENTIALS || '',
        searchBase: process.env.LDAP_SEARCH_BASE || ''
      }
    }
  },

  // Feature Flags
  features: {
    analyticsDashboard: process.env.FEATURE_ANALYTICS_DASHBOARD === 'true',
    abTesting: process.env.FEATURE_AB_TESTING === 'true',
    competitorAnalysis: process.env.FEATURE_COMPETITOR_ANALYSIS === 'true',
    aiContentGeneration: process.env.FEATURE_AI_CONTENT_GENERATION === 'true',
    teamCollaboration: process.env.FEATURE_TEAM_COLLABORATION === 'true',
    whiteLabel: process.env.FEATURE_WHITE_LABEL === 'true',
    advancedScheduler: process.env.FEATURE_ADVANCED_SCHEDULER === 'true',
    contentLibrary: process.env.FEATURE_CONTENT_LIBRARY === 'true',
    mobileApi: process.env.FEATURE_MOBILE_API === 'true',
    automatedReporting: process.env.FEATURE_AUTOMATED_REPORTING === 'true',
    realTimeSync: process.env.FEATURE_REAL_TIME_SYNC === 'true',
    predictiveAnalytics: process.env.FEATURE_PREDICTIVE_ANALYTICS === 'true',
    contentModeration: process.env.FEATURE_CONTENT_MODERATION === 'true',
    internationalization: process.env.FEATURE_INTERNATIONALIZATION === 'true',
    backupSystem: process.env.FEATURE_BACKUP_SYSTEM === 'true'
  },

  // Scheduler Configuration
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
    maxConcurrentJobs: parseInt(process.env.SCHEDULER_MAX_CONCURRENT_JOBS) || 10,
    retryAttempts: parseInt(process.env.SCHEDULER_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.SCHEDULER_RETRY_DELAY) || 60000
  },

  // Backup Configuration
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    s3Bucket: process.env.BACKUP_S3_BUCKET || '',
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || ''
  },

  // Internationalization
  i18n: {
    defaultLocale: process.env.DEFAULT_LOCALE || 'en',
    supportedLocales: process.env.SUPPORTED_LOCALES ? process.env.SUPPORTED_LOCALES.split(',') : ['en'],
    localeDetection: process.env.LOCALE_DETECTION === 'true',
    translationApiKey: process.env.TRANSLATION_API_KEY || ''
  },

  // Content Moderation
  moderation: {
    enabled: process.env.MODERATION_ENABLED === 'true',
    perspective: {
      apiKey: process.env.PERSPECTIVE_API_KEY || ''
    },
    azure: {
      key: process.env.AZURE_CONTENT_MODERATOR_KEY || '',
      endpoint: process.env.AZURE_CONTENT_MODERATOR_ENDPOINT || ''
    }
  },

  // Performance Optimization
  performance: {
    compression: process.env.ENABLE_COMPRESSION === 'true',
    caching: process.env.ENABLE_CACHING === 'true',
    cacheTtl: parseInt(process.env.CACHE_TTL) || 3600,
    minification: process.env.ENABLE_MINIFICATION === 'true',
    lazyLoading: process.env.ENABLE_LAZY_LOADING === 'true',
    imageOptimization: process.env.ENABLE_IMAGE_OPTIMIZATION === 'true'
  },

  // Deployment Configuration
  deployment: {
    env: process.env.DEPLOYMENT_ENV || 'development',
    region: process.env.DEPLOYMENT_REGION || 'us-east-1',
    autoScaling: {
      enabled: process.env.AUTO_SCALING_ENABLED === 'true',
      minInstances: parseInt(process.env.MIN_INSTANCES) || 1,
      maxInstances: parseInt(process.env.MAX_INSTANCES) || 10
    },
    healthCheck: {
      path: process.env.HEALTH_CHECK_PATH || '/health',
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30
    }
  },

  // Miscellaneous
  misc: {
    timezone: process.env.TIMEZONE || 'UTC',
    dateFormat: process.env.DATE_FORMAT || 'YYYY-MM-DD',
    timeFormat: process.env.TIME_FORMAT || 'HH:mm:ss',
    currency: process.env.CURRENCY || 'USD',
    language: process.env.LANGUAGE || 'en-US'
  }
};