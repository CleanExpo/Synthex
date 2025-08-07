import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';

// Mock console methods to reduce test output noise
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    organization: 'test-org',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createMockRequest: (overrides = {}) => ({
    body: {},
    query: {},
    params: {},
    headers: {},
    user: null,
    ip: '127.0.0.1',
    get: jest.fn(),
    ...overrides
  }),

  createMockResponse: () => {
    const res: any = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
      send: jest.fn(() => res),
      end: jest.fn(() => res),
      set: jest.fn(() => res),
      setHeader: jest.fn(() => res),
      getHeader: jest.fn(),
      removeHeader: jest.fn(() => res),
      cookie: jest.fn(() => res),
      clearCookie: jest.fn(() => res)
    };
    return res;
  },

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  generateRandomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

// Extend Jest matchers
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    return {
      message: () => `expected ${received} to be a valid Date`,
      pass
    };
  },

  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass
    };
  },

  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);
    return {
      message: () => `expected ${received} to be a valid email`,
      pass
    };
  },

  toHaveValidApiResponse(received) {
    const hasSuccess = received.hasOwnProperty('success');
    const hasData = received.hasOwnProperty('data');
    const hasMessage = received.hasOwnProperty('message');
    const pass = hasSuccess && hasData && hasMessage;
    
    return {
      message: () => `expected ${JSON.stringify(received)} to have valid API response structure (success, data, message)`,
      pass
    };
  }
});

// Type declarations for global utilities
declare global {
  var testUtils: {
    createMockUser: (overrides?: any) => any;
    createMockRequest: (overrides?: any) => any;
    createMockResponse: () => any;
    sleep: (ms: number) => Promise<void>;
    generateRandomString: (length?: number) => string;
  };

  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toHaveValidApiResponse(): R;
    }
  }
}

// Clean up after all tests
afterAll(async () => {
  // Close any open connections, clean up resources
  await new Promise(resolve => setTimeout(resolve, 100));
});
