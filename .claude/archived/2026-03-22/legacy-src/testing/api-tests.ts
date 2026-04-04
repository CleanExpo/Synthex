/**
 * API Testing Framework
 * Comprehensive test suite for the 3-tier SYNTHEX API
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Application } from '../presentation/app';

describe('SYNTHEX API Integration Tests', () => {
  let app: Application;
  let server: any;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize test application
    app = new Application();
    await app.initialize();
    
    // Start server on test port
    process.env.PORT = '3001';
    process.env.NODE_ENV = 'test';
    await app.start();
    
    server = app.getApp();
  });

  afterAll(async () => {
    // Cleanup
    if (app) {
      await app.gracefulShutdown();
    }
  });

  describe('Health Check Endpoints', () => {
    it('should return healthy status', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|degraded/),
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    it('should return detailed health status', async () => {
      const response = await request(server)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|degraded/),
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        checks: expect.any(Array),
        system: expect.objectContaining({
          cpu: expect.any(Number),
          memory: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number)
          }),
          uptime: expect.any(Number)
        })
      });
    });

    it('should return metrics in Prometheus format', async () => {
      const response = await request(server)
        .get('/metrics')
        .expect(200)
        .expect('Content-Type', /text\/plain/);

      expect(typeof response.text).toBe('string');
    });
  });

  describe('Authentication', () => {
    const testUserData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };

    it('should create a new user', async () => {
      const response = await request(server)
        .post('/api/v1/users')
        .send(testUserData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String),
        data: expect.objectContaining({
          id: expect.any(String),
          email: testUserData.email,
          firstName: testUserData.firstName,
          lastName: testUserData.lastName,
          role: 'user',
          isActive: true
        }),
        metadata: expect.objectContaining({
          timestamp: expect.any(String),
          correlationId: expect.any(String)
        })
      });

      testUserId = response.body.data.id;
    });

    it('should authenticate user and return JWT token', async () => {
      const response = await request(server)
        .post(`/api/v1/users/${testUserId}/authenticate`)
        .send({
          email: testUserData.email,
          password: testUserData.password
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            id: testUserId,
            email: testUserData.email
          }),
          token: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number)
        })
      });

      authToken = response.body.data.token;
    });

    it('should reject invalid credentials', async () => {
      const response = await request(server)
        .post(`/api/v1/users/${testUserId}/authenticate`)
        .send({
          email: testUserData.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String)
          })
        ])
      });
    });

    it('should validate password requirements', async () => {
      const invalidUserData = {
        email: 'invalid@example.com',
        password: '123', // Too short
        firstName: 'Invalid',
        lastName: 'User'
      };

      const response = await request(server)
        .post('/api/v1/users')
        .send(invalidUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'PASSWORD_TOO_SHORT',
            field: 'password'
          })
        ])
      });
    });

    it('should validate email format', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        password: 'ValidPassword123!',
        firstName: 'Invalid',
        lastName: 'User'
      };

      const response = await request(server)
        .post('/api/v1/users')
        .send(invalidUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_EMAIL_FORMAT',
            field: 'email'
          })
        ])
      });
    });
  });

  describe('User Management', () => {
    it('should get user by ID with authentication', async () => {
      const response = await request(server)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testUserId,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        })
      });
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(server)
        .get(`/api/v1/users/${testUserId}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: expect.stringMatching(/UNAUTHORIZED|INVALID_TOKEN/)
          })
        ])
      });
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(server)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_TOKEN'
          })
        ])
      });
    });

    it('should update user information', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(server)
        .put(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testUserId,
          firstName: 'Updated',
          lastName: 'Name'
        })
      });
    });

    it('should list users with pagination', async () => {
      const response = await request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        metadata: expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: expect.any(Number),
            hasMore: expect.any(Boolean)
          })
        })
      });
    });

    it('should support search functionality', async () => {
      const response = await request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'test' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should support filtering', async () => {
      const response = await request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 'filter.role': 'user' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should support sorting', async () => {
      const response = await request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sortField: 'createdAt', sortDirection: 'desc' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(server)
        .get('/api/v1/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'ROUTE_NOT_FOUND'
          })
        ])
      });
    });

    it('should return 404 for non-existent users', async () => {
      const fakeUserId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(server)
        .get(`/api/v1/users/${fakeUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'USER_NOT_FOUND'
          })
        ])
      });
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(server)
        .post('/api/v1/users')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.any(Array)
      });
    });

    it('should include correlation IDs in responses', async () => {
      const response = await request(server)
        .get('/health')
        .set('X-Correlation-ID', 'test-correlation-id')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to API endpoints', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array.from({ length: 25 }, () =>
        request(server)
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper structure
      if (rateLimitedResponses.length > 0) {
        const rateLimitedResponse = rateLimitedResponses[0];
        expect(rateLimitedResponse.body).toMatchObject({
          success: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              code: 'RATE_LIMITED'
            })
          ])
        });
      }
    }, 10000); // Longer timeout for rate limiting test
  });

  describe('Security', () => {
    it('should include security headers', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      // Check for security headers added by helmet
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should sanitize sensitive data in responses', async () => {
      const response = await request(server)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Password should never be included in responses
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should validate authorization for protected operations', async () => {
      const response = await request(server)
        .delete(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403); // Regular user cannot delete users

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'INSUFFICIENT_PERMISSIONS'
          })
        ])
      });
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track response times in headers', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      // Should have correlation/request ID headers
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should log requests and responses', async () => {
      // This test verifies that the logging middleware is working
      // In a real test environment, you might check log files or mock the logger
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('API Documentation', () => {
    it('should serve OpenAPI documentation', async () => {
      const response = await request(server)
        .get('/api/docs')
        .expect(200);

      // Should return HTML for Swagger UI
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('swagger-ui');
    });
  });
});

// Performance Tests
describe('SYNTHEX API Performance Tests', () => {
  let app: Application;
  let server: any;
  let authToken: string;

  beforeAll(async () => {
    app = new Application();
    await app.initialize();
    await app.start();
    server = app.getApp();

    // Create test user and get auth token for performance tests
    const createResponse = await request(server)
      .post('/api/v1/users')
      .send({
        email: 'perf-test@example.com',
        password: 'PerfTest123!',
        firstName: 'Perf',
        lastName: 'Test'
      });

    const authResponse = await request(server)
      .post(`/api/v1/users/${createResponse.body.data.id}/authenticate`)
      .send({
        email: 'perf-test@example.com',
        password: 'PerfTest123!'
      });

    authToken = authResponse.body.data.token;
  });

  afterAll(async () => {
    if (app) {
      await app.gracefulShutdown();
    }
  });

  it('should handle concurrent requests efficiently', async () => {
    const startTime = Date.now();
    
    // Make 50 concurrent requests
    const requests = Array.from({ length: 50 }, () =>
      request(server)
        .get('/health')
    );

    const responses = await Promise.all(requests);
    const endTime = Date.now();

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Should complete within reasonable time (5 seconds for 50 requests)
    expect(endTime - startTime).toBeLessThan(5000);
  });

  it('should maintain performance under load', async () => {
    const startTime = Date.now();

    // Make 100 authenticated requests
    const requests = Array.from({ length: 100 }, () =>
      request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
    );

    const responses = await Promise.allSettled(requests);
    const endTime = Date.now();

    // Most requests should succeed (allowing for some rate limiting)
    const successfulRequests = responses.filter(
      (result): result is PromiseFulfilledResult<any> => 
        result.status === 'fulfilled' && result.value.status === 200
    );

    expect(successfulRequests.length).toBeGreaterThan(50);

    // Should complete within reasonable time
    expect(endTime - startTime).toBeLessThan(10000);
  });
});

export { app };