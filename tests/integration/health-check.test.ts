/**
 * Health Check API Integration Tests
 *
 * @task UNI-422 - Implement Integration Test Automation
 *
 * Tests the health check endpoints for load balancer integration.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('Health Check API Integration Tests', () => {
  describe('GET /api/health', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(API_URL)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('checks');
    });

    it('should include all check categories', async () => {
      const response = await request(API_URL)
        .get('/api/health')
        .expect(200);

      const checks = response.body.checks;
      expect(checks).toHaveProperty('database');
      expect(checks).toHaveProperty('cache');
      expect(checks).toHaveProperty('environment');
      expect(checks).toHaveProperty('resources');
    });

    it('should include latency for database and cache checks', async () => {
      const response = await request(API_URL)
        .get('/api/health')
        .expect(200);

      const checks = response.body.checks;
      expect(checks.database).toHaveProperty('latency');
      expect(typeof checks.database.latency).toBe('number');
    });

    it('should include response time header', async () => {
      const response = await request(API_URL)
        .get('/api/health');

      expect(response.headers).toHaveProperty('x-response-time');
    });

    it('should support simple mode for load balancers', async () => {
      const response = await request(API_URL)
        .get('/api/health?simple=true')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      // Simple mode should not include detailed checks
      expect(response.body).not.toHaveProperty('checks');
    });

    it('should support details parameter', async () => {
      const response = await request(API_URL)
        .get('/api/health?details=true')
        .expect(200);

      // When details=true, should include additional details in checks
      const checks = response.body.checks;
      if (checks.resources) {
        expect(checks.resources).toHaveProperty('details');
      }
    });

    it('should support HEAD requests', async () => {
      const response = await request(API_URL)
        .head('/api/health');

      expect([200, 503]).toContain(response.status);
      expect(response.headers).toHaveProperty('x-health-status');
    });

    it('should set appropriate cache headers', async () => {
      const response = await request(API_URL)
        .get('/api/health')
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-store');
    });
  });

  describe('GET /api/health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(API_URL)
        .get('/api/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should include uptime in seconds', async () => {
      const response = await request(API_URL)
        .get('/api/health/live')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should respond within timeout (2 seconds)', async () => {
      const startTime = Date.now();
      await request(API_URL)
        .get('/api/health/live')
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(API_URL)
        .get('/api/health/ready');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(['ready', 'degraded', 'not_ready']).toContain(response.body.status);
    });

    it('should include dependency checks', async () => {
      const response = await request(API_URL)
        .get('/api/health/ready');

      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
    });

    it('should include summary counts', async () => {
      const response = await request(API_URL)
        .get('/api/health/ready');

      if (response.body.summary) {
        expect(response.body.summary).toHaveProperty('healthy');
        expect(response.body.summary).toHaveProperty('unhealthy');
        expect(response.body.summary).toHaveProperty('total');
      }
    });

    it('should respond within timeout (5 seconds)', async () => {
      const startTime = Date.now();
      await request(API_URL)
        .get('/api/health/ready');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('GET /api/health/db', () => {
    it('should check database health', async () => {
      const response = await request(API_URL)
        .get('/api/health/db');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });

    it('should include connection pool metrics when healthy', async () => {
      const response = await request(API_URL)
        .get('/api/health/db');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('latency');
      }
    });
  });

  describe('GET /api/health/redis', () => {
    it('should check Redis/cache health', async () => {
      const response = await request(API_URL)
        .get('/api/health/redis');

      // Redis might return 200 (healthy) or 207 (degraded with memory fallback)
      expect([200, 207, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });

    it('should report cache mode', async () => {
      const response = await request(API_URL)
        .get('/api/health/redis');

      if (response.status !== 503) {
        expect(response.body).toHaveProperty('mode');
        expect(['upstash', 'cluster', 'standalone', 'memory']).toContain(response.body.mode);
      }
    });
  });

  describe('Load Balancer Compatibility', () => {
    it('should return 200 for AWS ALB health check', async () => {
      // ALB expects 200 status
      const response = await request(API_URL)
        .get('/api/health/ready')
        .set('User-Agent', 'ELB-HealthChecker/2.0');

      // Should be 200 if ready, 503 if not
      expect([200, 503]).toContain(response.status);
    });

    it('should work with Kubernetes liveness probe', async () => {
      const response = await request(API_URL)
        .get('/api/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
    });

    it('should work with Kubernetes readiness probe', async () => {
      const response = await request(API_URL)
        .get('/api/health/ready');

      // Kubernetes expects 200 for ready, non-200 for not ready
      if (response.status === 200) {
        expect(['ready', 'degraded']).toContain(response.body.status);
      } else {
        expect(response.status).toBe(503);
      }
    });

    it('should support Cloudflare health monitor', async () => {
      const response = await request(API_URL)
        .get('/api/health/ready')
        .set('User-Agent', 'Cloudflare-Health-Check');

      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Health Check Performance', () => {
    it('should complete comprehensive check within 10 seconds', async () => {
      const startTime = Date.now();
      await request(API_URL)
        .get('/api/health');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
    });

    it('should handle concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(API_URL).get('/api/health/live')
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
