/**
 * Integration Test Suite for SYNTHEX 2.0
 * Tests all new features and API endpoints
 */

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;
let request: typeof import('supertest');
let app: any;

describeIntegration('SYNTHEX 2.0 Integration Tests', () => {
  let authToken: string;
  let testUserId: string;
  let testTeamId: string;
  let testExperimentId: string;
  let testContentId: string;

  // Setup - Get auth token
  beforeAll(async () => {
    if (!runIntegration) {
      return;
    }

    if (typeof global.TextEncoder === 'undefined') {
      const { TextEncoder } = await import('util');
      global.TextEncoder = TextEncoder;
    }

    const requestModule = await import('supertest');
    request = (requestModule.default || requestModule) as typeof import('supertest');

    const appModule = await import('../index-legacy');
    app = (appModule.default || appModule) as any;

    // Mock authentication for testing
    authToken = 'test-jwt-token';
    testUserId = 'test-user-123';
    testTeamId = 'test-team-456';
  });

  describe('Analytics API', () => {
    test('GET /api/v2/analytics/metrics/realtime should return real-time metrics', async () => {
      const response = await request(app)
        .get('/api/v2/analytics/metrics/realtime')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('GET /api/v2/analytics/metrics/historical should return historical data', async () => {
      const response = await request(app)
        .get('/api/v2/analytics/metrics/historical')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          metrics: ['views', 'engagement']
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/v2/analytics/events/track should track custom event', async () => {
      const response = await request(app)
        .post('/api/v2/analytics/events/track')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: 'content_view',
          eventData: { contentId: 'test-123', platform: 'tiktok' },
          metadata: { source: 'mobile' }
        })
        .expect(201);

      expect(response.body).toHaveProperty('eventId');
      expect(response.body.success).toBe(true);
    });
  });

  describe('A/B Testing API', () => {
    test('POST /api/v2/ab-testing/experiments should create experiment', async () => {
      const response = await request(app)
        .post('/api/v2/ab-testing/experiments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Experiment',
          type: 'simple',
          variants: [
            { id: 'control', name: 'Control', allocation: 50 },
            { id: 'variant', name: 'Variant', allocation: 50 }
          ],
          successMetrics: ['conversion_rate']
        })
        .expect(201);

      expect(response.body).toHaveProperty('experimentId');
      testExperimentId = response.body.experimentId;
    });

    test('GET /api/v2/ab-testing/experiments/:id should return experiment details', async () => {
      const response = await request(app)
        .get(`/api/v2/ab-testing/experiments/${testExperimentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('variants');
    });

    test('POST /api/v2/ab-testing/calculate/sample-size should calculate sample size', async () => {
      const response = await request(app)
        .post('/api/v2/ab-testing/calculate/sample-size')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          baselineConversion: 0.1,
          minimumDetectableEffect: 0.02,
          statisticalPower: 0.8,
          significanceLevel: 0.05
        })
        .expect(200);

      expect(response.body).toHaveProperty('sampleSize');
      expect(typeof response.body.sampleSize).toBe('number');
    });
  });

  describe('AI Content Generation API', () => {
    test('POST /api/v2/ai-content/generate should generate content', async () => {
      const response = await request(app)
        .post('/api/v2/ai-content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Create a viral TikTok caption about sustainability',
          type: 'caption',
          platform: 'tiktok',
          tone: 'friendly',
          length: 'short'
        })
        .expect(200);

      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('generationId');
      testContentId = response.body.generationId;
    });

    test('POST /api/v2/ai-content/variations should generate variations', async () => {
      const response = await request(app)
        .post('/api/v2/ai-content/variations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalContent: 'Save the planet, one post at a time!',
          count: 3,
          variationType: 'tone'
        })
        .expect(200);

      expect(response.body).toHaveProperty('variations');
      expect(Array.isArray(response.body.variations)).toBe(true);
      expect(response.body.variations.length).toBe(3);
    });

    test('POST /api/v2/ai-content/hashtags should generate hashtags', async () => {
      const response = await request(app)
        .post('/api/v2/ai-content/hashtags')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Sustainable fashion tips for eco-conscious consumers',
          platform: 'instagram',
          count: 10,
          includeNiche: true,
          includeTrending: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('hashtags');
      expect(Array.isArray(response.body.hashtags)).toBe(true);
    });
  });

  describe('Team Collaboration API', () => {
    test('POST /api/v2/teams should create team', async () => {
      const response = await request(app)
        .post('/api/v2/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Team',
          description: 'Test team for integration testing',
          type: 'marketing'
        })
        .expect(201);

      expect(response.body).toHaveProperty('teamId');
      testTeamId = response.body.teamId;
    });

    test('GET /api/v2/teams/my-teams should return user teams', async () => {
      const response = await request(app)
        .get('/api/v2/teams/my-teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('teams');
      expect(Array.isArray(response.body.teams)).toBe(true);
    });

    test('POST /api/v2/teams/:id/members should add team member', async () => {
      const response = await request(app)
        .post(`/api/v2/teams/${testTeamId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'newmember@test.com',
          role: 'editor',
          permissions: ['read', 'write']
        })
        .expect(201);

      expect(response.body).toHaveProperty('memberId');
      expect(response.body.success).toBe(true);
    });
  });

  describe('Scheduler API', () => {
    test('POST /api/v2/scheduler/schedule should schedule content', async () => {
      const response = await request(app)
        .post('/api/v2/scheduler/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: testContentId,
          publishAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          platform: 'tiktok',
          timezone: 'America/New_York'
        })
        .expect(201);

      expect(response.body).toHaveProperty('scheduleId');
      expect(response.body).toHaveProperty('status', 'scheduled');
    });

    test('GET /api/v2/scheduler/optimal-times should return optimal posting times', async () => {
      const response = await request(app)
        .get('/api/v2/scheduler/optimal-times')
        .query({
          platform: 'instagram',
          timezone: 'America/Los_Angeles'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('optimalTimes');
      expect(Array.isArray(response.body.optimalTimes)).toBe(true);
    });
  });

  describe('Content Library API', () => {
    test('POST /api/v2/library/items should create library item', async () => {
      const response = await request(app)
        .post('/api/v2/library/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Content',
          content: { text: 'Sample content for testing' },
          type: 'post',
          tags: ['test', 'sample'],
          metadata: { category: 'testing' }
        })
        .expect(201);

      expect(response.body).toHaveProperty('itemId');
      expect(response.body).toHaveProperty('libraryId');
    });

    test('POST /api/v2/library/collections should create collection', async () => {
      const response = await request(app)
        .post('/api/v2/library/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Collection',
          description: 'Collection for testing',
          type: 'manual',
          visibility: 'private'
        })
        .expect(201);

      expect(response.body).toHaveProperty('collectionId');
    });
  });

  describe('Mobile API', () => {
    test('POST /api/v2/mobile/devices/register should register device', async () => {
      const response = await request(app)
        .post('/api/v2/mobile/devices/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'ios',
          deviceName: 'Test iPhone',
          deviceModel: 'iPhone 14',
          osVersion: '16.0',
          appVersion: '2.0.0',
          pushToken: 'test-push-token-123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('deviceId');
      expect(response.body).toHaveProperty('status', 'active');
    });

    test('POST /api/v2/mobile/notifications/send should send notification', async () => {
      const response = await request(app)
        .post('/api/v2/mobile/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUserId,
          title: 'Test Notification',
          body: 'This is a test notification',
          priority: 'normal',
          category: 'test'
        })
        .expect(200);

      expect(response.body).toHaveProperty('notificationId');
      expect(response.body).toHaveProperty('delivered');
    });
  });

  describe('White-label API', () => {
    test('POST /api/v2/white-label/tenants should create tenant', async () => {
      const response = await request(app)
        .post('/api/v2/white-label/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test-tenant',
          companyName: 'Test Company',
          subdomain: 'test',
          tier: 'enterprise',
          config: { maxUsers: 100 },
          adminEmail: 'admin@testcompany.com'
        })
        .expect(201);

      expect(response.body).toHaveProperty('tenantId');
      expect(response.body).toHaveProperty('subdomain', 'test');
    });

    test('PUT /api/v2/white-label/tenants/:id/branding should update branding', async () => {
      const response = await request(app)
        .put('/api/v2/white-label/tenants/test-tenant/branding')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          logoUrl: 'https://example.com/logo.png',
          primaryColor: '#06b6d4',
          secondaryColor: '#0891b2',
          fontHeading: 'Inter',
          fontBody: 'Inter'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Competitor Analysis API', () => {
    test('POST /api/v2/competitors should add competitor', async () => {
      const response = await request(app)
        .post('/api/v2/competitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Competitor',
          domain: 'competitor.com',
          platforms: [
            { platform: 'tiktok', handle: '@competitor' },
            { platform: 'instagram', handle: '@competitor' }
          ]
        })
        .expect(201);

      expect(response.body).toHaveProperty('competitorId');
    });

    test('GET /api/v2/competitors/trending should return trending content', async () => {
      const response = await request(app)
        .get('/api/v2/competitors/trending')
        .query({
          platform: 'tiktok',
          timeframe: 'week',
          limit: 10
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('trending');
      expect(Array.isArray(response.body.trending)).toBe(true);
    });
  });

  describe('Reporting API', () => {
    test('POST /api/v2/reporting/reports should create report', async () => {
      const response = await request(app)
        .post('/api/v2/reporting/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Monthly Performance Report',
          type: 'monthly',
          config: { includeAllPlatforms: true },
          metrics: ['views', 'engagement', 'conversions'],
          formats: ['pdf', 'excel']
        })
        .expect(201);

      expect(response.body).toHaveProperty('reportId');
      expect(response.body).toHaveProperty('status');
    });

    test('GET /api/v2/reporting/insights should return insights', async () => {
      const response = await request(app)
        .get('/api/v2/reporting/insights')
        .query({
          type: 'performance',
          actionable: true,
          minImpact: 5
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('insights');
      expect(Array.isArray(response.body.insights)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('Should enforce rate limits on API endpoints', async () => {
      const requests = [];
      
      // Make 101 requests (limit is 100 per 15 minutes)
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app)
            .get('/api/v2/analytics/metrics/realtime')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('Should return 401 for unauthorized requests', async () => {
      const response = await request(app)
        .get('/api/v2/analytics/metrics/realtime')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('Should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/v2/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    test('Should return 400 for invalid request data', async () => {
      const response = await request(app)
        .post('/api/v2/ai-content/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          type: 'post'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  // Cleanup
  afterAll(async () => {
    // Clean up test data if needed
    console.log('Integration tests completed');
  });
});
