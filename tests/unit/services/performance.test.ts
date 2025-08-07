import PerformanceService from '../../../src/services/performance';
import AuditService from '../../../src/services/audit';

// Mock AuditService
jest.mock('../../../src/services/audit', () => ({
  default: {
    log: jest.fn()
  }
}));

describe('PerformanceService', () => {
  beforeEach(() => {
    // Clear metrics before each test
    PerformanceService.clearMetrics(0);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    PerformanceService.clearMetrics(0);
  });

  describe('recordMetric', () => {
    it('should record a performance metric', () => {
      const metricData = {
        endpoint: '/api/test',
        method: 'GET',
        duration: 150,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        userId: 'test-user-123'
      };

      PerformanceService.recordMetric(metricData);
      const stats = PerformanceService.getStats();
      
      expect(stats.totalRequests).toBe(1);
      expect(stats.averageResponseTime).toBe(150);
    });

    it('should log slow requests', async () => {
      const slowMetricData = {
        endpoint: '/api/slow',
        method: 'GET',
        duration: 12000, // 12 seconds - critical slow request
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        userId: 'test-user-123'
      };

      PerformanceService.recordMetric(slowMetricData);
      
      // Should log to audit service for critical slow requests
      expect(AuditService.log).toHaveBeenCalledWith({
        userId: 'test-user-123',
        action: 'slow_request_detected',
        resource: 'performance',
        details: {
          endpoint: '/api/slow',
          method: 'GET',
          duration: 12000,
          statusCode: 200
        },
        severity: 'high',
        category: 'system',
        outcome: 'warning'
      });
    });
  });

  describe('getStats', () => {
    it('should return empty stats when no metrics exist', () => {
      const stats = PerformanceService.getStats();
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.errorRate).toBe(0);
    });

    it('should calculate correct statistics', () => {
      // Add test metrics
      const metrics = [
        { endpoint: '/api/test', method: 'GET', duration: 100, statusCode: 200 },
        { endpoint: '/api/test', method: 'POST', duration: 200, statusCode: 201 },
        { endpoint: '/api/error', method: 'GET', duration: 300, statusCode: 500 },
        { endpoint: '/api/test', method: 'GET', duration: 400, statusCode: 200 }
      ];

      metrics.forEach(metric => {
        PerformanceService.recordMetric({
          ...metric,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      });

      const stats = PerformanceService.getStats();
      
      expect(stats.totalRequests).toBe(4);
      expect(stats.averageResponseTime).toBe(250); // (100+200+300+400)/4
      expect(stats.errorRate).toBe(0.25); // 1 error out of 4 requests
    });

    it('should calculate percentiles correctly', () => {
      // Add metrics with known durations for percentile testing
      const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      
      durations.forEach(duration => {
        PerformanceService.recordMetric({
          endpoint: '/api/test',
          method: 'GET',
          duration,
          statusCode: 200,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      });

      const stats = PerformanceService.getStats();
      
      // For 10 sorted values: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
      expect(stats.p50).toBe(500); // 50th percentile (median)
      expect(stats.p90).toBe(900); // 90th percentile
      expect(stats.p95).toBe(900); // 95th percentile (index 9)
      expect(stats.p99).toBe(1000); // 99th percentile
    });
  });

  describe('getEndpointStats', () => {
    it('should return null for non-existent endpoint', () => {
      const stats = PerformanceService.getEndpointStats('/api/nonexistent');
      expect(stats).toBeNull();
    });

    it('should return correct endpoint statistics', () => {
      // Add metrics for specific endpoint
      const testEndpoint = '/api/users';
      PerformanceService.recordMetric({
        endpoint: testEndpoint,
        method: 'GET',
        duration: 150,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });
      
      PerformanceService.recordMetric({
        endpoint: testEndpoint,
        method: 'POST',
        duration: 250,
        statusCode: 201,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });

      const stats = PerformanceService.getEndpointStats(testEndpoint);
      
      expect(stats).toBeDefined();
      expect(stats.endpoint).toBe(testEndpoint);
      expect(stats.totalRequests).toBe(2);
      expect(stats.averageResponseTime).toBe(200);
      expect(stats.methodBreakdown).toHaveLength(2);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for good metrics', () => {
      // Add fast, successful requests
      for (let i = 0; i < 10; i++) {
        PerformanceService.recordMetric({
          endpoint: '/api/test',
          method: 'GET',
          duration: 100, // Fast response
          statusCode: 200, // Success
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      }

      const health = PerformanceService.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.issues).toHaveLength(0);
    });

    it('should return degraded status for slow responses', () => {
      // Add slow requests
      for (let i = 0; i < 10; i++) {
        PerformanceService.recordMetric({
          endpoint: '/api/slow',
          method: 'GET',
          duration: 3000, // Slow response (>2000ms threshold)
          statusCode: 200,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      }

      const health = PerformanceService.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.issues).toContain('High average response time');
    });

    it('should return degraded status for high error rate', () => {
      // Add requests with high error rate
      for (let i = 0; i < 10; i++) {
        PerformanceService.recordMetric({
          endpoint: '/api/error',
          method: 'GET',
          duration: 100,
          statusCode: i < 8 ? 500 : 200, // 80% error rate
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      }

      const health = PerformanceService.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.issues).toContain('High error rate');
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics when no time specified', () => {
      // Add some metrics
      PerformanceService.recordMetric({
        endpoint: '/api/test',
        method: 'GET',
        duration: 100,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });

      const cleared = PerformanceService.clearMetrics();
      const stats = PerformanceService.getStats();
      
      expect(cleared).toBe(1);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('exportMetrics', () => {
    beforeEach(() => {
      // Add test metrics
      PerformanceService.recordMetric({
        endpoint: '/api/test',
        method: 'GET',
        duration: 100,
        statusCode: 200,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      });
    });

    it('should export metrics in JSON format', () => {
      const exported = PerformanceService.exportMetrics('json');
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('endpoint', '/api/test');
    });

    it('should export metrics in CSV format', () => {
      const exported = PerformanceService.exportMetrics('csv');
      const lines = exported.split('\n');
      
      expect(lines[0]).toBe('timestamp,endpoint,method,duration,statusCode,memoryUsed');
      expect(lines[1]).toContain('/api/test,GET,100,200');
    });
  });
});
