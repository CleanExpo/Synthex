/**
 * Sentry Error Tracking Setup
 * Comprehensive error monitoring and performance tracking
 */

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Sentry configuration
const SENTRY_CONFIG = {
  dsn: process.env.REACT_APP_SENTRY_DSN || process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || '1.0.0',
  sampleRate: 1.0, // Capture 100% of errors
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Custom tags
  tags: {
    platform: 'synthex-marketing',
    component: 'web-app'
  },
  
  // Additional context
  extra: {
    buildTime: new Date().toISOString(),
    userAgent: isBrowser ? navigator.userAgent : 'server'
  }
};

// Sentry client instance
let sentryClient = null;

// Initialize Sentry for browser
async function initBrowserSentry() {
  if (!isBrowser || !SENTRY_CONFIG.dsn) {
    console.warn('Sentry DSN not configured or not in browser environment');
    return null;
  }

  try {
    // Dynamic import for browser
    const Sentry = await import('@sentry/browser');
    const { BrowserTracing } = await import('@sentry/tracing');

    Sentry.init({
      dsn: SENTRY_CONFIG.dsn,
      environment: SENTRY_CONFIG.environment,
      release: SENTRY_CONFIG.release,
      sampleRate: SENTRY_CONFIG.sampleRate,
      tracesSampleRate: SENTRY_CONFIG.tracesSampleRate,
      
      integrations: [
        new BrowserTracing({
          // Capture interactions
          routingInstrumentation: Sentry.routingInstrumentation(
            window.history,
            window.location,
            (location) => location.pathname
          ),
          
          // Track performance for key pages
          tracingOrigins: [
            window.location.hostname,
            'localhost',
            'synthex.social',
            /^\//  // Relative URLs
          ]
        }),
        
        // Custom integrations
        new Sentry.Integrations.Breadcrumbs({
          console: true,
          dom: true,
          fetch: true,
          history: true,
          sentry: true,
          xhr: true
        })
      ],

      // Performance monitoring
      beforeSend(event, hint) {
        // Filter out non-critical errors
        if (event.exception) {
          const error = hint.originalException;
          
          // Skip network errors in development
          if (SENTRY_CONFIG.environment === 'development' && 
              error?.message?.includes('fetch')) {
            return null;
          }
          
          // Skip canceled requests
          if (error?.name === 'AbortError') {
            return null;
          }
        }
        
        // Add user context if available
        const user = getUserContext();
        if (user) {
          event.user = user;
        }
        
        return event;
      },

      // Session tracking
      autoSessionTracking: true,
      
      // Custom tags and context
      tags: SENTRY_CONFIG.tags,
      extra: SENTRY_CONFIG.extra
    });

    // Set up error boundary for React
    setupErrorBoundary(Sentry);
    
    // Set up performance monitoring
    setupPerformanceMonitoring(Sentry);
    
    // Set up custom error handlers
    setupCustomHandlers(Sentry);

    sentryClient = Sentry;
    console.log('Sentry initialized successfully');
    return Sentry;

  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return null;
  }
}

// Initialize Sentry for Node.js
async function initNodeSentry() {
  if (isBrowser || !SENTRY_CONFIG.dsn) {
    return null;
  }

  try {
    // Dynamic import for Node.js
    const Sentry = await import('@sentry/node');
    const { ProfilingIntegration } = await import('@sentry/profiling-node');

    Sentry.init({
      dsn: SENTRY_CONFIG.dsn,
      environment: SENTRY_CONFIG.environment,
      release: SENTRY_CONFIG.release,
      sampleRate: SENTRY_CONFIG.sampleRate,
      tracesSampleRate: SENTRY_CONFIG.tracesSampleRate,
      profilesSampleRate: SENTRY_CONFIG.profilesSampleRate,
      
      integrations: [
        new ProfilingIntegration(),
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Console(),
        new Sentry.Integrations.LocalVariables()
      ],

      beforeSend(event, hint) {
        // Add server context
        event.server_name = process.env.VERCEL_REGION || 'local';
        
        return event;
      },

      tags: SENTRY_CONFIG.tags,
      extra: {
        ...SENTRY_CONFIG.extra,
        nodeVersion: process.version,
        platform: process.platform
      }
    });

    sentryClient = Sentry;
    console.log('Sentry Node.js initialized successfully');
    return Sentry;

  } catch (error) {
    console.error('Failed to initialize Sentry for Node.js:', error);
    return null;
  }
}

// Set up error boundary for React components
function setupErrorBoundary(Sentry) {
  // Global error handler
  window.addEventListener('error', (event) => {
    Sentry.captureException(event.error, {
      tags: { errorType: 'global_error' },
      contexts: {
        error_info: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      }
    });
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason, {
      tags: { errorType: 'unhandled_rejection' },
      extra: { promise: event.promise }
    });
  });
}

// Set up performance monitoring
function setupPerformanceMonitoring(Sentry) {
  // Monitor page load performance
  if ('performance' in window && 'getEntriesByType' in performance) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          Sentry.addBreadcrumb({
            category: 'performance',
            message: 'Page load completed',
            data: {
              loadTime: navigation.loadEventEnd - navigation.loadEventStart,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              firstContentfulPaint: getFirstContentfulPaint()
            },
            level: 'info'
          });
        }
      }, 0);
    });
  }
  
  // Monitor API calls
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const startTime = Date.now();
    
    try {
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - startTime;
      
      // Log slow API calls
      if (duration > 2000) {
        Sentry.addBreadcrumb({
          category: 'http',
          message: 'Slow API call detected',
          data: { url, duration, status: response.status },
          level: 'warning'
        });
      }
      
      return response;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { errorType: 'api_error' },
        extra: { url, duration: Date.now() - startTime }
      });
      throw error;
    }
  };
}

// Set up custom error handlers
function setupCustomHandlers(Sentry) {
  // Track user interactions
  ['click', 'input', 'submit'].forEach(eventType => {
    document.addEventListener(eventType, (event) => {
      const target = event.target;
      const tagName = target.tagName.toLowerCase();
      const id = target.id;
      const className = target.className;
      
      Sentry.addBreadcrumb({
        category: 'user',
        message: `User ${eventType}`,
        data: { tagName, id, className },
        level: 'info'
      });
    });
  });
  
  // Track route changes (for SPAs)
  if (window.history) {
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: 'Route change',
        data: { url: args[2] },
        level: 'info'
      });
      return originalPushState.apply(this, args);
    };
  }
}

// Get user context
function getUserContext() {
  try {
    // Try to get user from localStorage or other sources
    const userStr = localStorage.getItem('user') || localStorage.getItem('synthex_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return {
        id: user.id,
        email: user.email,
        username: user.username || user.name,
        plan: user.plan
      };
    }
  } catch (error) {
    // Ignore parsing errors
  }
  return null;
}

// Get First Contentful Paint
function getFirstContentfulPaint() {
  try {
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcpEntry ? fcpEntry.startTime : null;
  } catch (error) {
    return null;
  }
}

// Public API
export const SentryService = {
  // Initialize Sentry
  async init() {
    if (isBrowser) {
      return await initBrowserSentry();
    } else {
      return await initNodeSentry();
    }
  },

  // Capture exception
  captureException(error, context = {}) {
    if (sentryClient) {
      return sentryClient.captureException(error, context);
    } else {
      console.error('Sentry not initialized:', error);
      return null;
    }
  },

  // Capture message
  captureMessage(message, level = 'info', context = {}) {
    if (sentryClient) {
      return sentryClient.captureMessage(message, level, context);
    } else {
      console.log('Sentry not initialized:', message);
      return null;
    }
  },

  // Add breadcrumb
  addBreadcrumb(breadcrumb) {
    if (sentryClient) {
      sentryClient.addBreadcrumb(breadcrumb);
    }
  },

  // Set user context
  setUser(user) {
    if (sentryClient) {
      sentryClient.setUser(user);
    }
  },

  // Set tags
  setTags(tags) {
    if (sentryClient) {
      sentryClient.setTags(tags);
    }
  },

  // Set context
  setContext(key, context) {
    if (sentryClient) {
      sentryClient.setContext(key, context);
    }
  },

  // Start transaction
  startTransaction(transactionContext) {
    if (sentryClient) {
      return sentryClient.startTransaction(transactionContext);
    }
    return null;
  },

  // Check if initialized
  isInitialized() {
    return sentryClient !== null;
  },

  // Get client
  getClient() {
    return sentryClient;
  }
};

// Auto-initialize in browser
if (isBrowser && SENTRY_CONFIG.dsn) {
  SentryService.init().catch(error => {
    console.error('Failed to auto-initialize Sentry:', error);
  });
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.synthexSentry = SentryService;
}

export default SentryService;