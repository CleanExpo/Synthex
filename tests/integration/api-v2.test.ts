/**
 * API v2 Integration Tests
 * Comprehensive testing for all new endpoints
 */

import request from 'supertest';
import app from '../../src/index';
import { db } from '../../src/lib/database';

describe('API v2 Integration Tests', () => {
  let authToken: string;
  
  beforeAll(async () => {
    await db.initialize();
  });
  
  afterAll(async () => {
    await db.cleanup();
  });
  
  describe('Authentication', () => {
    test('POST /api/v2/auth/register', async () => {
      const response = await request(app)
        .post('/api/v2/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'Test User'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });
    
    test('POST /api/v2/auth/login', async () => {
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      authToken = response.body.token;
    });
    
    test('Should enforce rate limiting on login', async () => {
      const promises = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/v2/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' })
      );
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
  
  describe('Analytics Endpoints', () => {
    test('GET /api/v2/analytics', async () => {
      const response = await request(app)
        .get('/api/v2/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ platform: 'twitter' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /api/v2/analytics/realtime', async () => {
      const response = await request(app)
        .get('/api/v2/analytics/realtime')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
    });
    
    test('GET /api/v2/analytics/insights', async () => {
      const response = await request(app)
        .get('/api/v2/analytics/insights')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('insights');
    });
  });
  
  describe('AI Content Generation', () => {
    test('POST /api/v2/ai-content/generate', async () => {
      const response = await request(app)
        .post('/api/v2/ai-content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Create a social media post about productivity',
          platform: 'twitter',
          tone: 'professional'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('content');
      expect(response.body.content).toBeTruthy();
    });
    
    test('POST /api/v2/ai-content/optimize', async () => {
      const response = await request(app)
        .post('/api/v2/ai-content/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test post',
          platform: 'instagram'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('optimizedContent');
    });
  });
  
  describe('A/B Testing', () => {
    let testId: string;
    
    test('POST /api/v2/ab-testing/tests', async () => {
      const response = await request(app)
        .post('/api/v2/ab-testing/tests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Campaign',
          variations: [
            { name: 'A', content: 'Version A' },
            { name: 'B', content: 'Version B' }
          ]
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      testId = response.body.id;
    });
    
    test('GET /api/v2/ab-testing/tests/:id/results', async () => {
      const response = await request(app)
        .get(`/api/v2/ab-testing/tests/${testId}/results`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
    });
  });
  
  describe('Team Collaboration', () => {
    test('GET /api/v2/teams/members', async () => {
      const response = await request(app)
        .get('/api/v2/teams/members')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });
    
    test('POST /api/v2/teams/invite', async () => {
      const response = await request(app)
        .post('/api/v2/teams/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'teammate@example.com',
          role: 'editor'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('invitation');
    });
  });
  
  describe('Content Scheduler', () => {
    let postId: string;
    
    test('POST /api/v2/scheduler/posts', async () => {
      const response = await request(app)
        .post('/api/v2/scheduler/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Scheduled post content',
          platform: 'twitter',
          scheduledFor: new Date(Date.now() + 86400000).toISOString()
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      postId = response.body.id;
    });
    
    test('GET /api/v2/scheduler/posts', async () => {
      const response = await request(app)
        .get('/api/v2/scheduler/posts')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('posts');
      expect(Array.isArray(response.body.posts)).toBe(true);
    });
    
    test('DELETE /api/v2/scheduler/posts/:id', async () => {
      const response = await request(app)
        .delete(`/api/v2/scheduler/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(204);
    });
  });
  
  describe('Competitor Analysis', () => {
    test('GET /api/v2/competitors', async () => {
      const response = await request(app)
        .get('/api/v2/competitors')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('competitors');
    });
    
    test('POST /api/v2/competitors', async () => {
      const response = await request(app)
        .post('/api/v2/competitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Competitor Inc',
          website: 'https://competitor.com',
          platforms: ['twitter', 'instagram']
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });
  
  describe('Security Features', () => {
    test('Should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/v2/analytics');
      
      expect(response.status).toBe(401);
    });
    
    test('Should include security headers', async () => {
      const response = await request(app)
        .get('/api/v2/health');
      
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });
    
    test('Should sanitize input', async () => {
      const response = await request(app)
        .post('/api/v2/ai-content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: '<script>alert("XSS")</script>',
          platform: 'twitter'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.content).not.toContain('<script>');
    });
  });
  
  describe('Feature Flags', () => {
    test('GET /api/v2/features', async () => {
      const response = await request(app)
        .get('/api/v2/features')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('features');
      expect(typeof response.body.features).toBe('object');
    });
  });
  
  describe('Performance Metrics', () => {
    test('GET /api/v2/performance/metrics', async () => {
      const response = await request(app)
        .get('/api/v2/performance/metrics')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
    });
    
    test('GET /api/v2/health', async () => {
      const response = await request(app)
        .get('/api/v2/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });
  });
  
  describe('Internationalization', () => {
    test('Should respect Accept-Language header', async () => {
      const response = await request(app)
        .get('/api/v2/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'es');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-language']).toContain('es');
    });
    
    test('Should support multiple locales', async () => {
      const locales = ['en', 'es', 'fr', 'de', 'zh'];
      
      for (const locale of locales) {
        const response = await request(app)
          .get('/api/v2/health')
          .set('Accept-Language', locale);
        
        expect(response.status).toBe(200);
      }
    });
  });
});
