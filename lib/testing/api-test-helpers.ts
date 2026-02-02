/**
 * API Test Helpers
 * Utilities for testing Next.js API routes
 *
 * @task UNI-417 - Testing & Quality Assurance Epic
 *
 * Usage:
 * ```typescript
 * import { createTestRequest, createTestContext, mockNextResponse } from '@/lib/testing';
 *
 * describe('GET /api/users', () => {
 *   it('returns users', async () => {
 *     const request = createTestRequest('GET', '/api/users', {
 *       headers: { Authorization: 'Bearer test-token' }
 *     });
 *
 *     const response = await GET(request);
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 */

import { NextRequest } from 'next/server';

// Declare Jest globals for test helper functions
declare const expect: {
  (value: unknown): {
    toBe: (expected: unknown) => void;
    toBeGreaterThanOrEqual: (expected: number) => void;
    toBeLessThan: (expected: number) => void;
    toContain: (expected: string) => void;
    toMatch: (expected: string | RegExp) => void;
    not: {
      toBeNull: () => void;
    };
  };
};

// ============================================================================
// REQUEST CREATION
// ============================================================================

export interface TestRequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
  cookies?: Record<string, string>;
}

/**
 * Create a mock NextRequest for testing API routes
 */
export function createTestRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/test',
  options: TestRequestOptions = {}
): NextRequest {
  const { body, headers = {}, searchParams = {}, cookies = {} } = options;

  // Build URL with search params
  const urlObj = new URL(url, 'http://localhost:3000');
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  // Build headers
  const requestHeaders = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    requestHeaders.set(key, value);
  });

  // Add cookies if provided
  if (Object.keys(cookies).length > 0) {
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    requestHeaders.set('Cookie', cookieString);
  }

  // Create request init with explicit type to avoid signal compatibility issues
  const init: {
    method: string;
    headers: Headers;
    body?: BodyInit;
  } = {
    method,
    headers: requestHeaders,
  };

  // Add body for non-GET requests
  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }
  }

  return new NextRequest(urlObj.toString(), init);
}

/**
 * Create authenticated test request
 */
export function createAuthenticatedRequest(
  method: string,
  url: string,
  userId: string = 'test-user-123',
  options: TestRequestOptions = {}
): NextRequest {
  return createTestRequest(method, url, {
    ...options,
    headers: {
      Authorization: `Bearer test-token-${userId}`,
      'X-User-Id': userId,
      ...options.headers,
    },
  });
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Extract JSON body from NextResponse
 */
export async function getResponseJson<T = any>(response: Response): Promise<T> {
  return response.json();
}

/**
 * Assert response status and return body
 */
export async function expectStatus<T = any>(
  response: Response,
  expectedStatus: number
): Promise<T> {
  expect(response.status).toBe(expectedStatus);
  return getResponseJson<T>(response);
}

/**
 * Assert successful response (2xx status)
 */
export async function expectSuccess<T = any>(response: Response): Promise<T> {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
  return getResponseJson<T>(response);
}

/**
 * Assert error response
 */
export async function expectError(
  response: Response,
  expectedStatus: number,
  expectedMessage?: string | RegExp
): Promise<{ error: string }> {
  expect(response.status).toBe(expectedStatus);
  const body = await getResponseJson<{ error: string }>(response);

  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(body.error).toContain(expectedMessage);
    } else {
      expect(body.error).toMatch(expectedMessage);
    }
  }

  return body;
}

// ============================================================================
// API ROUTE TESTING CONTEXT
// ============================================================================

export interface TestContext {
  request: NextRequest;
  params?: Record<string, string>;
  searchParams?: URLSearchParams;
}

/**
 * Create test context for route handlers
 */
export function createTestContext(
  method: string = 'GET',
  url: string = '/api/test',
  options: TestRequestOptions & { params?: Record<string, string> } = {}
): TestContext {
  const { params, ...requestOptions } = options;
  const request = createTestRequest(method, `http://localhost:3000${url}`, requestOptions);

  return {
    request,
    params,
    searchParams: new URL(request.url).searchParams,
  };
}

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Create mock user for tests
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const id = overrides.id || `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    email: `${id}@test.example.com`,
    name: 'Test User',
    authProvider: 'local',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  authProvider: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create mock campaign for tests
 */
export function createMockCampaign(
  userId: string,
  overrides: Partial<MockCampaign> = {}
): MockCampaign {
  const id = overrides.id || `campaign_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    name: 'Test Campaign',
    description: 'A test campaign',
    status: 'draft',
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface MockCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create mock post for tests
 */
export function createMockPost(
  campaignId: string,
  overrides: Partial<MockPost> = {}
): MockPost {
  const id = overrides.id || `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    content: 'Test post content',
    platform: 'twitter',
    status: 'draft',
    campaignId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface MockPost {
  id: string;
  content: string;
  platform: string;
  status: string;
  campaignId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create mock quote for tests
 */
export function createMockQuote(overrides: Partial<MockQuote> = {}): MockQuote {
  const id = overrides.id || `quote_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    content: 'Test quote content',
    author: 'Test Author',
    aiGenerated: false,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface MockQuote {
  id: string;
  content: string;
  author?: string;
  aiGenerated: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert response has required headers
 */
export function expectHeaders(response: Response, headers: Record<string, string | RegExp>): void {
  Object.entries(headers).forEach(([key, value]) => {
    const headerValue = response.headers.get(key);
    expect(headerValue).not.toBeNull();

    if (typeof value === 'string') {
      expect(headerValue).toBe(value);
    } else {
      expect(headerValue).toMatch(value);
    }
  });
}

/**
 * Assert response is JSON
 */
export function expectJsonResponse(response: Response): void {
  const contentType = response.headers.get('Content-Type');
  expect(contentType).toMatch(/application\/json/);
}

/**
 * Assert rate limit headers present
 */
export function expectRateLimitHeaders(response: Response): void {
  expect(response.headers.get('X-RateLimit-Limit')).not.toBeNull();
  expect(response.headers.get('X-RateLimit-Remaining')).not.toBeNull();
  expect(response.headers.get('X-RateLimit-Reset')).not.toBeNull();
}

// ============================================================================
// TIMING HELPERS
// ============================================================================

/**
 * Measure API response time
 */
export async function measureResponseTime(
  handler: () => Promise<Response>
): Promise<{ response: Response; duration: number }> {
  const start = Date.now();
  const response = await handler();
  const duration = Date.now() - start;
  return { response, duration };
}

/**
 * Assert response time is within limit
 */
export async function expectResponseTime(
  handler: () => Promise<Response>,
  maxMs: number
): Promise<Response> {
  const { response, duration } = await measureResponseTime(handler);
  expect(duration).toBeLessThan(maxMs);
  return response;
}

export default {
  createTestRequest,
  createAuthenticatedRequest,
  createTestContext,
  createMockUser,
  createMockCampaign,
  createMockPost,
  createMockQuote,
  getResponseJson,
  expectStatus,
  expectSuccess,
  expectError,
  expectHeaders,
  expectJsonResponse,
  expectRateLimitHeaders,
  measureResponseTime,
  expectResponseTime,
};
