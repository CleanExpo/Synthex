/**
 * Testing Module
 * Comprehensive test utilities for SYNTHEX
 *
 * @task UNI-417 - Testing & Quality Assurance Epic
 *
 * @example
 * ```typescript
 * import {
 *   createTestRequest,
 *   TestDatabase,
 *   TestDataFactory,
 * } from '@/lib/testing';
 * ```
 */

// API test helpers
export {
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
  type TestRequestOptions,
  type TestContext,
  type MockUser,
  type MockCampaign,
  type MockPost,
  type MockQuote,
} from './api-test-helpers';

// Database test helpers
export {
  TestDatabase,
  TestDataFactory,
  waitForDatabase,
  createTestDatabase,
  createTestDataFactory,
  type TestUser,
  type TestCampaign,
  type TestPost,
  type TestProject,
  type TestQuote,
  type TestPlatformConnection,
  type TestScenario,
} from './db-test-helpers';
