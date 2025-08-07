import request from 'supertest';
import express from 'express';
import { authenticateUser } from '../../src/middleware/auth';
import performanceRoutes from '../../src/routes/performance';
import PerformanceService from '../../src/services/performance';

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateUser: jest.fn((req, res, next) => {
    req.user = { 
      id: 'test-user-123', 
      role: 'admin',
      email: 'test@example.com' 
    };
    next();
  })
}));

describe('Performance API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/performance', performanceRoutes);
  });

  beforeEach(() => {
    // Clear metrics before each test
    PerformanceService.clearMetrics(0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    PerformanceService.clearMetrics(0);
  });

  describe('GET /api/v1/performance/health', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/v1/performance/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('metrics');
    });

    it('should return degraded status when performance is poor', async () => {
      // Add slow metrics to trigger degraded status
      for (let i = 0; i < 10; i++) {
        PerformanceService.recordMetric({
          endpoint: '/api/slow',
          method: 'GET',
          duration: 3000, // Slow response
          statusCode: 200,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      }

      const response = await request(app)
        .get('/api/v1/performance/health')
        .expect(503); // Service Unavailable for degraded

      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.issues.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/performance/stats', () => {
    it('should return performance statistics for admin users', async () => {
      // Add some test metrics
      PerformanceService.recordMetric({
        endpoint: '/api/test',
        method: 'GET',
        duration: 150,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });

      const response = await request(app)
        .get('/api/v1/performance/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('totalRequests', 1);
      expect(response.body.data).toHaveProperty('averageResponseTime', 150);
      expect(response.body.data).toHaveProperty('p50');
      expect(response.body.data).toHaveProperty('p90');
      expect(response.body.data).toHaveProperty('p95');
      expect(response.body.data).toHaveProperty('p99');
    });

    it('should accept timeRange query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/performance/stats?timeRange=1800000') // 30 minutes
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should deny access to non-admin users', async () => {
      // Mock non-admin user
      (authenticateUser as jest.Mock).mockImplementationOnce((req, res, next) => {
        req.user = { 
          id: 'test-user-456', 
          role: 'user',
          email: 'user@example.com' 
        };
        next();
      });

      await request(app)
        .get('/api/v1/performance/stats')
        .expect(403);
    });
  });

  describe('GET /api/v1/performance/endpoint/*', () => {
    it('should return endpoint-specific statistics', async () => {
      const testEndpoint = '/api/users';
      
      // Add metrics for specific endpoint
      PerformanceService.recordMetric({
        endpoint: testEndpoint,
        method: 'GET',
        duration: 200,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });

      const response = await request(app)
        .get(`/api/v1/performance/endpoint${testEndpoint}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('endpoint', testEndpoint);
      expect(response.body.data).toHaveProperty('totalRequests', 1);
      expect(response.body.data).toHaveProperty('averageResponseTime', 200);
    });

    it('should return 404 for endpoints with no data', async () => {
      await request(app)
        .get('/api/v1/performance/endpoint/api/nonexistent')
        .expect(404);
    });
  });

  describe('GET /api/v1/performance/cache/stats', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/v1/performance/cache/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('cache');
      expect(response.body.data).toHaveProperty('compression');
    });
  });

  describe('POST /api/v1/performance/cache/clear', () => {
    it('should clear all cache when no parameters provided', async () => {
      const response = await request(app)
        .post('/api/v1/performance/cache/clear')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('clearedCount');
    });

    it('should clear cache by pattern', async () => {
      const response = await request(app)
        .post('/api/v1/performance/cache/clear')
        .send({ pattern: 'user' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should clear user-specific cache', async () => {
      const response = await request(app)
        .post('/api/v1/performance/cache/clear')
        .send({ userId: 'test-user-123' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/performance/system', () => {
    it('should return system information', async () => {
      const response = await request(app)
        .get('/api/v1/performance/system')
        .expect(200);

      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('memoryUsage');
      expect(response.body.data).toHaveProperty('cpuUsage');
      expect(response.body.data).toHaveProperty('nodeVersion');
      expect(response.body.data).toHaveProperty('platform');
      expect(response.body.data).toHaveProperty('environment');
    });
  });

  describe('GET /api/v1/performance/trends', () => {
    it('should return performance trends', async () => {
      // Add some test metrics first
      for (let i = 0; i < 5; i++) {
        PerformanceService.recordMetric({
          endpoint: '/api/test',
          method: 'GET',
          duration: 100 + i * 50,
          statusCode: 200,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      }

      const response = await request(app)
        .get('/api/v1/performance/trends')
        .expect(200);

      expect(response.body.data).toHaveProperty('trends');
      expect(response.body.data).toHaveProperty('interval');
      expect(response.body.data).toHaveProperty('hours');
      expect(Array.isArray(response.body.data.trends)).toBe(true);
    });

    it('should accept hours and intervals query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/performance/trends?hours=12&intervals=12')
        .expect(200);

      expect(response.body.data.hours).toBe(12);
    });
  });

  describe('GET /api/v1/performance/alerts', () => {
    it('should return performance alerts', async () => {
      const response = await request(app)
        .get('/api/v1/performance/alerts')
        .expect(200);

      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('thresholds');
      expect(response.body.data).toHaveProperty('systemStatus');
      expect(Array.isArray(response.body.data.alerts)).toBe(true);
    });

    it('should include alerts for poor performance', async () => {
      // Add metrics that should trigger alerts
      for (let i = 0; i < 10; i++) {
        PerformanceService.recordMetric({
          endpoint: '/api/slow',
          method: 'GET',
          duration: 6000, // Very slow - should trigger critical alert
          statusCode: 200,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      }

      const response = await request(app)
        .get('/api/v1/performance/alerts')
        .expect(200);

      const criticalAlerts = response.body.data.alerts.filter(
        (alert: any) => alert.type === 'critical'
      );
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/performance/export', () => {
    beforeEach(() => {
      // Add test metrics
      PerformanceService.recordMetric({
        endpoint: '/api/test',
        method: 'GET',
        duration: 150,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });
    });

    it('should export metrics in JSON format by default', async () => {
      const response = await request(app)
        .get('/api/v1/performance/export')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toMatch(/synthex-performance-.*\.json/);
    });

    it('should export metrics in CSV format when requested', async () => {
      const response = await request(app)
        .get('/api/v1/performance/export?format=csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toMatch(/synthex-performance-.*\.csv/);
      expect(response.text).toContain('timestamp,endpoint,method,duration,statusCode,memoryUsed');
    });

    it('should accept timeRange parameter', async () => {
      await request(app)
        .get('/api/v1/performance/export?timeRange=3600000')
        .expect(200);
    });
  });

  describe('POST /api/v1/performance/metrics/clear', () => {
    it('should clear old metrics', async () => {
      // Add a metric
      PerformanceService.recordMetric({
        endpoint: '/api/test',
        method: 'GET',
        duration: 100,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });

      const response = await request(app)
        .post('/api/v1/performance/metrics/clear')
        .send({ olderThanMs: 0 }) // Clear all metrics
        .expect(200);

      expect(response.body.data).toHaveProperty('clearedCount');
      
      // Verify metrics were cleared
      const stats = PerformanceService.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });
});
