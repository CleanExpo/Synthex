/**
 * Jest Test Setup
 * Global test configuration and setup for all test suites
 */

import { jest } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global mocks
global.console = {
  ...console,
  // Suppress specific log levels during tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // Keep errors for debugging
};

// Mock external services
jest.mock('../src/lib/supabase.js', () => ({
  db: {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ 
              data: { id: 'test-user', email: 'test@example.com' }, 
              error: null 
            })),
            limit: jest.fn(() => Promise.resolve({ 
              data: [], 
              error: null 
            }))
          })),
          gte: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ 
              data: [], 
              error: null 
            }))
          })),
          insert: jest.fn(() => Promise.resolve({ 
            data: { id: 'new-id' }, 
            error: null 
          })),
          update: jest.fn(() => Promise.resolve({ 
            data: { id: 'updated-id' }, 
            error: null 
          })),
          delete: jest.fn(() => Promise.resolve({ 
            data: null, 
            error: null 
          }))
        })),
        count: jest.fn(() => Promise.resolve({ count: 10, error: null }))
      }))
    },
    users: {
      getProfile: jest.fn(() => Promise.resolve({ id: 'test-user' })),
      updateProfile: jest.fn(() => Promise.resolve({ id: 'test-user' })),
      createProfile: jest.fn(() => Promise.resolve({ id: 'new-user' }))
    },
    content: {
      saveOptimizedContent: jest.fn(() => Promise.resolve({ id: 'content-id' })),
      getUserContent: jest.fn(() => Promise.resolve([])),
      deleteContent: jest.fn(() => Promise.resolve(true))
    },
    analytics: {
      trackOptimization: jest.fn(() => Promise.resolve(true)),
      getUserAnalytics: jest.fn(() => Promise.resolve({}))
    }
  }
}));

jest.mock('../src/lib/redis.js', () => ({
  redisService: {
    isConnected: true,
    set: jest.fn(() => Promise.resolve(true)),
    get: jest.fn(() => Promise.resolve(null)),
    del: jest.fn(() => Promise.resolve(true)),
    createSession: jest.fn(() => Promise.resolve('session-id')),
    getSession: jest.fn(() => Promise.resolve({ userId: 'test-user' })),
    updateSession: jest.fn(() => Promise.resolve(true)),
    deleteSession: jest.fn(() => Promise.resolve(true)),
    healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
    publish: jest.fn(() => Promise.resolve(true)),
    subscribe: jest.fn(() => Promise.resolve({}))
  }
}));

jest.mock('../src/lib/ai.js', () => ({
  aiService: {
    generateOptimizedContent: jest.fn(() => Promise.resolve({
      optimizedContent: 'Optimized test content',
      hashtags: ['#test', '#api'],
      suggestions: ['Add more engagement'],
      score: 85
    })),
    generateHashtags: jest.fn(() => Promise.resolve(['#test', '#hashtag'])),
    generateContentIdeas: jest.fn(() => Promise.resolve(['Idea 1', 'Idea 2'])),
    analyzeContent: jest.fn(() => Promise.resolve({
      sentiment: 0.8,
      readability: 7.5,
      engagement: 8.2
    })),
    checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10 }))
  }
}));

jest.mock('../src/lib/email.js', () => ({
  emailService: {
    sendWelcomeEmail: jest.fn(() => Promise.resolve({ 
      success: true, 
      messageId: 'test-message-id' 
    })),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve({ 
      success: true, 
      messageId: 'test-reset-id' 
    })),
    sendNotificationEmail: jest.fn(() => Promise.resolve({ 
      success: true, 
      messageId: 'test-notification-id' 
    })),
    sendEmail: jest.fn(() => Promise.resolve({ 
      success: true, 
      messageId: 'test-generic-id' 
    })),
    getQueueStatus: jest.fn(() => ({ 
      queueLength: 0, 
      isProcessing: false, 
      isConfigured: true 
    })),
    testConnection: jest.fn(() => Promise.resolve({ success: true }))
  }
}));

jest.mock('../src/lib/auth.js', () => ({
  authService: {
    getUserIdFromRequest: jest.fn(() => 'test-user-id'),
    verifyToken: jest.fn(() => ({ 
      userId: 'test-user-id', 
      email: 'test@example.com' 
    })),
    generateToken: jest.fn(() => 'test-jwt-token'),
    hashPassword: jest.fn(() => Promise.resolve('hashed-password')),
    comparePassword: jest.fn(() => Promise.resolve(true)),
    createUser: jest.fn(() => Promise.resolve({ 
      id: 'new-user-id', 
      email: 'new@example.com' 
    }))
  }
}));

jest.mock('../src/lib/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    critical: jest.fn(),
    logRequest: jest.fn(),
    logApiCall: jest.fn(),
    logDatabaseQuery: jest.fn(),
    logAIOperation: jest.fn(),
    logSecurityEvent: jest.fn()
  }
}));

// Mock WebSocket for testing
jest.mock('../src/lib/websocket.js', () => ({
  webSocketService: {
    initialize: jest.fn(),
    broadcast: jest.fn(),
    broadcastToUser: jest.fn(),
    sendNotification: jest.fn(),
    getStats: jest.fn(() => ({ totalConnections: 0, authenticatedUsers: 0 }))
  }
}));

// Mock CDN service
jest.mock('../src/lib/cdn.js', () => ({
  cdnService: {
    getAssetUrl: jest.fn((path) => path),
    generateSrcSet: jest.fn(() => ''),
    preloadAssets: jest.fn(),
    getCacheHeaders: jest.fn(() => ({})),
    healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' }))
  }
}));

// Mock rate limiter
jest.mock('../src/lib/rate-limiter.js', () => ({
  rateLimiter: {
    createLimiter: jest.fn(() => (req, res, next) => next()),
    createPlanLimiter: jest.fn(() => (req, res, next) => next()),
    checkLimit: jest.fn(() => Promise.resolve({ allowed: true, remaining: 10 }))
  },
  limiters: {
    general: (req, res, next) => next(),
    auth: (req, res, next) => next(),
    api: (req, res, next) => next(),
    ai: (req, res, next) => next()
  }
}));

// Global test utilities
global.testUtils = {
  // Create mock request object
  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    url: '/api/test',
    headers: {},
    body: {},
    query: {},
    params: {},
    user: null,
    ip: '127.0.0.1',
    id: 'test-request-id',
    ...overrides
  }),

  // Create mock response object
  createMockResponse: () => {
    const res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
      send: jest.fn(() => res),
      set: jest.fn(() => res),
      setHeader: jest.fn(() => res),
      end: jest.fn(() => res),
      clearCookie: jest.fn(() => res),
      statusCode: 200,
      headers: {}
    };
    return res;
  },

  // Create mock user
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    plan: 'free',
    permissions: [],
    ...overrides
  }),

  // Wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate test JWT token
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { 
        userId: 'test-user-id', 
        email: 'test@example.com', 
        ...payload 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }
};

// Global cleanup
afterEach(() => {
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset environment for each test
  process.env.NODE_ENV = 'test';
});

// Global error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress specific warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  
  // Suppress known test warnings
  if (message.includes('deprecated') || 
      message.includes('experimental') ||
      message.includes('warning')) {
    return;
  }
  
  originalWarn.apply(console, args);
};

export default {};