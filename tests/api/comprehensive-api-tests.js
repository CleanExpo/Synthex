/**
 * Comprehensive API Test Suite
 * Tests all API endpoints with various scenarios including authentication, validation, and error handling
 */

import request from 'supertest';
import { jest } from '@jest/globals';

// Mock services for testing
const mockServices = {
  db: {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: { id: 'test-user', email: 'test@example.com' } }))
          }))
        }))
      }))
    }
  },
  
  aiService: {
    generateOptimizedContent: jest.fn(() => ({
      optimizedContent: 'Optimized content for testing',
      hashtags: ['#test', '#api'],
      suggestions: ['Add more engagement'],
      score: 85
    })),
    checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10 }))
  },
  
  emailService: {
    sendWelcomeEmail: jest.fn(() => ({ success: true, messageId: 'test-message-id' })),
    sendPasswordResetEmail: jest.fn(() => ({ success: true, messageId: 'test-reset-id' })),
    sendNotificationEmail: jest.fn(() => ({ success: true, messageId: 'test-notification-id' })),
    getQueueStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false, isConfigured: true })),
    testConnection: jest.fn(() => ({ success: true }))
  },
  
  authService: {
    getUserIdFromRequest: jest.fn(() => 'test-user-id'),
    verifyToken: jest.fn(() => ({ userId: 'test-user-id', email: 'test@example.com' }))
  }
};

// Test data
const testData = {
  validUser: {
    email: 'test@example.com',
    password: 'testpass123',
    name: 'Test User'
  },
  
  validContent: {
    content: 'This is test content for optimization',
    platform: 'instagram'
  },
  
  validEmail: {
    type: 'welcome',
    userEmail: 'test@example.com',
    userName: 'Test User'
  },
  
  authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token'
};

describe('Comprehensive API Test Suite', () => {
  let app;
  
  beforeAll(async () => {
    // Setup test app with mocked services
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';
    
    // Mock the services
    jest.doMock('../src/lib/supabase.js', () => ({ db: mockServices.db }));
    jest.doMock('../src/lib/ai.js', () => ({ aiService: mockServices.aiService }));
    jest.doMock('../src/lib/email.js', () => ({ emailService: mockServices.emailService }));
    jest.doMock('../src/lib/auth.js', () => ({ authService: mockServices.authService }));
    
    // Import app after mocking
    const { createApp } = await import('../src/app.js');
    app = createApp();
  });

  afterAll(async () => {
    // Cleanup
    jest.restoreAllMocks();
  });

  describe('Health Check Endpoints', () => {
    describe('GET /api/health', () => {
      it('should return system health status', async () => {
        const response = await request(app)
          .get('/api/health')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('services');
        expect(response.body.services).toHaveProperty('database');
      });

      it('should handle health check failures gracefully', async () => {
        // Mock a service failure
        mockServices.db.supabase.from.mockImplementationOnce(() => {
          throw new Error('Database connection failed');
        });

        const response = await request(app)
          .get('/api/health')
          .expect(503);

        expect(response.body).toHaveProperty('status', 'unhealthy');
        expect(response.body).toHaveProperty('errors');
      });
    });
  });

  describe('Documentation Endpoints', () => {
    describe('GET /api/docs', () => {
      it('should return HTML documentation by default', async () => {
        const response = await request(app)
          .get('/api/docs')
          .expect(200);

        expect(response.headers['content-type']).toContain('text/html');
        expect(response.text).toContain('API Documentation');
      });

      it('should return JSON documentation when requested', async () => {
        const response = await request(app)
          .get('/api/docs?format=json')
          .expect(200);

        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).toHaveProperty('openapi');
        expect(response.body).toHaveProperty('info');
        expect(response.body).toHaveProperty('paths');
      });

      it('should return OpenAPI specification', async () => {
        const response = await request(app)
          .get('/api/docs?format=openapi')
          .expect(200);

        expect(response.body).toHaveProperty('openapi', '3.0.3');
        expect(response.body.info).toHaveProperty('title');
        expect(response.body.info).toHaveProperty('version');
      });

      it('should handle unsupported formats', async () => {
        const response = await request(app)
          .get('/api/docs?format=xml')
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Unsupported format');
      });
    });
  });

  describe('AI Endpoints', () => {
    describe('POST /api/ai', () => {
      it('should optimize content successfully with valid token', async () => {
        const response = await request(app)
          .post('/api/ai')
          .set('Authorization', `Bearer ${testData.authToken}`)
          .send({
            action: 'optimize',
            platform: 'instagram',
            content: testData.validContent.content
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('optimizedContent');
        expect(response.body.data).toHaveProperty('hashtags');
        expect(response.body.data).toHaveProperty('score');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/ai')
          .send({
            action: 'optimize',
            platform: 'instagram',
            content: testData.validContent.content
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Authentication required');
      });

      it('should validate required parameters', async () => {
        const response = await request(app)
          .post('/api/ai')
          .set('Authorization', `Bearer ${testData.authToken}`)
          .send({
            action: 'optimize'
            // Missing platform and content
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle unsupported platforms', async () => {
        const response = await request(app)
          .post('/api/ai')
          .set('Authorization', `Bearer ${testData.authToken}`)
          .send({
            action: 'optimize',
            platform: 'unsupported_platform',
            content: testData.validContent.content
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle rate limiting', async () => {
        mockServices.aiService.checkRateLimit.mockReturnValueOnce({
          allowed: false,
          message: 'Rate limit exceeded',
          resetTime: Date.now() + 60000
        });

        const response = await request(app)
          .post('/api/ai')
          .set('Authorization', `Bearer ${testData.authToken}`)
          .send({
            action: 'optimize',
            platform: 'instagram',
            content: testData.validContent.content
          })
          .expect(429);

        expect(response.body).toHaveProperty('error');
      });

      it('should generate hashtags', async () => {
        const response = await request(app)
          .post('/api/ai')
          .set('Authorization', `Bearer ${testData.authToken}`)
          .send({
            action: 'generate-hashtags',
            platform: 'instagram',
            content: testData.validContent.content,
            count: 5
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('hashtags');
      });

      it('should handle AI service errors', async () => {
        mockServices.aiService.generateOptimizedContent.mockImplementationOnce(() => {
          throw new Error('AI service unavailable');
        });

        const response = await request(app)
          .post('/api/ai')
          .set('Authorization', `Bearer ${testData.authToken}`)
          .send({
            action: 'optimize',
            platform: 'instagram',
            content: testData.validContent.content
          })
          .expect(500);

        expect(response.body).toHaveProperty('error', 'AI processing failed');
      });
    });
  });

  describe('Email Endpoints', () => {
    describe('POST /api/email', () => {
      it('should send welcome email successfully', async () => {
        const response = await request(app)
          .post('/api/email')
          .send(testData.validEmail)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('messageId');
        expect(mockServices.emailService.sendWelcomeEmail).toHaveBeenCalledWith(
          testData.validEmail.userEmail,
          testData.validEmail.userName,
          'https://synthex.social/dashboard'
        );
      });

      it('should send password reset email', async () => {
        const resetData = {
          type: 'password-reset',
          userEmail: 'test@example.com',
          userName: 'Test User',
          resetToken: 'reset-token-123'
        };

        const response = await request(app)
          .post('/api/email')
          .send(resetData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(mockServices.emailService.sendPasswordResetEmail).toHaveBeenCalled();
      });

      it('should send notification email', async () => {
        const notificationData = {
          type: 'notification',
          userEmail: 'test@example.com',
          userName: 'Test User',
          title: 'Test Notification',
          content: 'This is a test notification'
        };

        const response = await request(app)
          .post('/api/email')
          .send(notificationData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should validate email type', async () => {
        const response = await request(app)
          .post('/api/email')
          .send({
            userEmail: 'test@example.com',
            userName: 'Test User'
            // Missing type
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Email type is required');
      });

      it('should validate email parameters', async () => {
        const response = await request(app)
          .post('/api/email')
          .send({
            type: 'welcome'
            // Missing required parameters
          })
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should handle email service failures', async () => {
        mockServices.emailService.sendWelcomeEmail.mockImplementationOnce(() => ({
          success: false,
          error: 'SMTP connection failed'
        }));

        const response = await request(app)
          .post('/api/email')
          .send(testData.validEmail)
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/email', () => {
      it('should return email service status', async () => {
        const response = await request(app)
          .get('/api/email')
          .expect(200);

        expect(response.body).toHaveProperty('service');
        expect(response.body.service).toHaveProperty('configured');
        expect(response.body.service).toHaveProperty('queue');
        expect(response.body).toHaveProperty('stats');
      });
    });
  });

  describe('Metrics Endpoints', () => {
    describe('GET /api/metrics', () => {
      it('should return all metrics by default', async () => {
        const response = await request(app)
          .get('/api/metrics')
          .expect(200);

        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('timeframe');
      });

      it('should support different metric types', async () => {
        const types = ['system', 'users', 'content', 'performance'];

        for (const type of types) {
          const response = await request(app)
            .get(`/api/metrics?type=${type}`)
            .expect(200);

          expect(response.body).toHaveProperty(type);
        }
      });

      it('should support different timeframes', async () => {
        const timeframes = ['1h', '6h', '24h', '7d', '30d'];

        for (const timeframe of timeframes) {
          const response = await request(app)
            .get(`/api/metrics?timeframe=${timeframe}`)
            .expect(200);

          expect(response.body).toHaveProperty('timeframe', timeframe);
        }
      });

      it('should handle metrics service errors gracefully', async () => {
        // Mock a database error
        mockServices.db.supabase.from.mockImplementationOnce(() => {
          throw new Error('Database query failed');
        });

        const response = await request(app)
          .get('/api/metrics')
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testData.validUser.email,
            password: testData.validUser.password
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('email', testData.validUser.email);
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testData.validUser.email,
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate email format', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: testData.validUser.password
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should require both email and password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testData.validUser.email
            // Missing password
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Platform Optimization Endpoints', () => {
    const platforms = ['instagram', 'facebook', 'twitter', 'linkedin'];

    platforms.forEach(platform => {
      describe(`POST /api/optimize/${platform}`, () => {
        it(`should optimize content for ${platform}`, async () => {
          const response = await request(app)
            .post(`/api/optimize/${platform}`)
            .set('Authorization', `Bearer ${testData.authToken}`)
            .send({
              content: testData.validContent.content,
              options: {
                includeHashtags: true,
                tone: 'professional'
              }
            })
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          expect(response.body).toHaveProperty('optimizedContent');
          expect(response.body).toHaveProperty('hashtags');
          expect(response.body).toHaveProperty('metrics');
        });

        it(`should require authentication for ${platform}`, async () => {
          const response = await request(app)
            .post(`/api/optimize/${platform}`)
            .send({
              content: testData.validContent.content
            })
            .expect(401);

          expect(response.body).toHaveProperty('error');
        });

        it(`should validate content for ${platform}`, async () => {
          const response = await request(app)
            .post(`/api/optimize/${platform}`)
            .set('Authorization', `Bearer ${testData.authToken}`)
            .send({
              // Missing content
            })
            .expect(400);

          expect(response.body).toHaveProperty('error');
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/ai')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle internal server errors gracefully', async () => {
      // Mock an internal server error
      mockServices.db.supabase.from.mockImplementationOnce(() => {
        throw new Error('Internal server error');
      });

      const response = await request(app)
        .get('/api/metrics')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).not.toContain('Internal server error'); // Should be sanitized in production
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limits to endpoints', async () => {
      // Make multiple requests rapidly
      const promises = Array(20).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    it('should include security headers in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Request Validation', () => {
    it('should validate content length limits', async () => {
      const longContent = 'x'.repeat(10001); // Exceeds limit

      const response = await request(app)
        .post('/api/ai')
        .set('Authorization', `Bearer ${testData.authToken}`)
        .send({
          action: 'optimize',
          platform: 'instagram',
          content: longContent
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate email formats', async () => {
      const response = await request(app)
        .post('/api/email')
        .send({
          type: 'welcome',
          userEmail: 'invalid-email-format',
          userName: 'Test User'
        })
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

// Load testing utilities
export const loadTests = {
  async runConcurrentRequests(endpoint, count = 100) {
    const startTime = Date.now();
    const promises = Array(count).fill().map(() =>
      request(app).get(endpoint)
    );
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    return {
      totalTime: endTime - startTime,
      averageTime: (endTime - startTime) / count,
      successCount: results.filter(r => r.status < 400).length,
      errorCount: results.filter(r => r.status >= 400).length,
      results
    };
  },

  async stressTest(endpoint, duration = 30000) {
    const startTime = Date.now();
    const results = [];
    
    while (Date.now() - startTime < duration) {
      try {
        const response = await request(app).get(endpoint);
        results.push(response.status);
      } catch (error) {
        results.push(500);
      }
    }
    
    return {
      duration: Date.now() - startTime,
      totalRequests: results.length,
      requestsPerSecond: results.length / (duration / 1000),
      successRate: results.filter(s => s < 400).length / results.length * 100,
      statusCodes: results.reduce((acc, code) => {
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {})
    };
  }
};

export default { testData, mockServices };