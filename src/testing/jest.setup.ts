/**
 * Jest Setup Configuration
 * Global test setup and utilities for the SYNTHEX API test suite
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Global test setup
beforeAll(async () => {
  // Global setup before all tests
  console.log('🚀 Starting SYNTHEX API test suite...');
});

afterAll(async () => {
  // Global cleanup after all tests
  console.log('✅ SYNTHEX API test suite completed');
});

beforeEach(async () => {
  // Setup before each test
  // Clear any cached modules or state
  jest.clearAllMocks();
});

afterEach(async () => {
  // Cleanup after each test
  // Reset any test state
});

// Custom matchers and utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidApiResponse(): R;
      toHaveValidStructure(structure: any): R;
      toBeValidUuid(): R;
      toBeValidEmail(): R;
      toBeValidDate(): R;
    }
  }
}

// Custom Jest matchers for API testing
expect.extend({
  toBeValidApiResponse(received: any) {
    const pass = (
      typeof received === 'object' &&
      received !== null &&
      typeof received.success === 'boolean' &&
      typeof received.metadata === 'object' &&
      received.metadata !== null &&
      typeof received.metadata.timestamp === 'string'
    );

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid API response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid API response with success, metadata.timestamp fields`,
        pass: false,
      };
    }
  },

  toHaveValidStructure(received: any, structure: any) {
    const checkStructure = (obj: any, struct: any, path = ''): boolean => {
      for (const key in struct) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (!(key in obj)) {
          throw new Error(`Missing property: ${currentPath}`);
        }
        
        const expectedType = struct[key];
        const actualValue = obj[key];
        
        if (expectedType === 'string' && typeof actualValue !== 'string') {
          throw new Error(`Expected ${currentPath} to be string, got ${typeof actualValue}`);
        }
        
        if (expectedType === 'number' && typeof actualValue !== 'number') {
          throw new Error(`Expected ${currentPath} to be number, got ${typeof actualValue}`);
        }
        
        if (expectedType === 'boolean' && typeof actualValue !== 'boolean') {
          throw new Error(`Expected ${currentPath} to be boolean, got ${typeof actualValue}`);
        }
        
        if (expectedType === 'array' && !Array.isArray(actualValue)) {
          throw new Error(`Expected ${currentPath} to be array, got ${typeof actualValue}`);
        }
        
        if (typeof expectedType === 'object' && expectedType !== null && !Array.isArray(expectedType)) {
          if (typeof actualValue !== 'object' || actualValue === null) {
            throw new Error(`Expected ${currentPath} to be object, got ${typeof actualValue}`);
          }
          checkStructure(actualValue, expectedType, currentPath);
        }
      }
      return true;
    };

    try {
      checkStructure(received, structure);
      return {
        message: () => `expected object not to have valid structure`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `expected object to have valid structure: ${(error as Error).message}`,
        pass: false,
      };
    }
  },

  toBeValidUuid(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const pass = typeof received === 'string' && emailRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidDate(received: string) {
    const pass = typeof received === 'string' && !isNaN(Date.parse(received));

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date string`,
        pass: false,
      };
    }
  },
});

// Test utilities
export class TestHelpers {
  /**
   * Generate test user data
   */
  static generateTestUser(overrides: any = {}) {
    return {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    };
  }

  /**
   * Generate random string
   */
  static randomString(length: number = 10): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * Generate random email
   */
  static randomEmail(): string {
    return `test-${this.randomString()}@example.com`;
  }

  /**
   * Generate UUID v4
   */
  static generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Wait for specified milliseconds
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    let attempt = 1;
    
    while (attempt <= maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.wait(delay);
        attempt++;
      }
    }
    
    throw new Error('Max retry attempts exceeded');
  }

  /**
   * Create test database transaction
   */
  static async withTestTransaction<T>(fn: () => Promise<T>): Promise<T> {
    // Implementation would depend on your database setup
    // This is a placeholder for transaction management in tests
    try {
      const result = await fn();
      return result;
    } catch (error) {
      // Rollback transaction
      throw error;
    }
  }

  /**
   * Mock external dependencies
   */
  static mockExternalServices() {
    // Mock Redis
    jest.mock('ioredis', () => ({
      default: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      }))
    }));

    // Mock Winston logger
    jest.mock('winston', () => ({
      createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        child: jest.fn(() => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }))
      })),
      format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        errors: jest.fn(),
        json: jest.fn(),
        colorize: jest.fn(),
        printf: jest.fn(),
        metadata: jest.fn(),
      },
      transports: {
        Console: jest.fn(),
        File: jest.fn(),
      }
    }));
  }

  /**
   * Verify API response structure
   */
  static verifyApiResponseStructure(response: any, hasData: boolean = true) {
    expect(response).toBeValidApiResponse();
    
    if (hasData) {
      expect(response.data).toBeDefined();
    }
    
    if (response.errors) {
      expect(Array.isArray(response.errors)).toBe(true);
      response.errors.forEach((error: any) => {
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('message');
      });
    }
    
    expect(response.metadata.timestamp).toBeValidDate();
    
    if (response.metadata.correlationId) {
      expect(typeof response.metadata.correlationId).toBe('string');
    }
  }

  /**
   * Verify user object structure
   */
  static verifyUserStructure(user: any) {
    expect(user).toHaveValidStructure({
      id: 'string',
      email: 'string',
      firstName: 'string',
      lastName: 'string',
      role: 'string',
      isActive: 'boolean',
      createdAt: 'string',
      updatedAt: 'string'
    });
    
    expect(user.id).toBeValidUuid();
    expect(user.email).toBeValidEmail();
    expect(user.createdAt).toBeValidDate();
    expect(user.updatedAt).toBeValidDate();
  }

  /**
   * Verify pagination metadata
   */
  static verifyPaginationMetadata(metadata: any) {
    expect(metadata.pagination).toHaveValidStructure({
      page: 'number',
      limit: 'number',
      total: 'number',
      hasMore: 'boolean'
    });
    
    expect(metadata.pagination.page).toBeGreaterThan(0);
    expect(metadata.pagination.limit).toBeGreaterThan(0);
    expect(metadata.pagination.total).toBeGreaterThanOrEqual(0);
  }
}

// Export test configuration
export const testConfig = {
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  testTimeout: 30000,
  retryAttempts: 3,
  testUserPrefix: 'test-user',
  cleanupDelay: 1000,
};

// Initialize mocks if in test environment
if (process.env.NODE_ENV === 'test') {
  TestHelpers.mockExternalServices();
}

export { TestHelpers as default };