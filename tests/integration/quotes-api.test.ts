/**
 * Quotes API Integration Tests
 *
 * @task UNI-422 - Implement Integration Test Automation
 *
 * Tests the quotes API endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('Quotes API Integration Tests', () => {
  let authToken: string;
  let testQuoteId: string;
  const createdQuoteIds: string[] = [];

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/auth/unified-login')
      .send({
        email: process.env.TEST_USER_EMAIL || 'test@example.com',
        password: process.env.TEST_USER_PASSWORD || 'Test123!@#',
      });

    if (loginResponse.body.token) {
      authToken = loginResponse.body.token;
    } else if (loginResponse.body.data?.token) {
      authToken = loginResponse.body.data.token;
    }
  });

  afterAll(async () => {
    // Clean up created quotes
    for (const quoteId of createdQuoteIds) {
      try {
        await request(API_URL)
          .delete(`/api/quotes/${quoteId}`)
          .set('Authorization', `Bearer ${authToken}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('POST /api/quotes', () => {
    it('should create a new quote', async () => {
      const quoteData = {
        text: 'Integration test quote - ' + Date.now(),
        author: 'Test Author',
        category: 'motivational',
        tags: ['test', 'integration'],
        isPublic: true,
      };

      const response = await request(API_URL)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(quoteData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.quote).toHaveProperty('id');
      expect(response.body.quote.text).toBe(quoteData.text);
      expect(response.body.quote.author).toBe(quoteData.author);
      expect(response.body.quote.category).toBe(quoteData.category);

      testQuoteId = response.body.quote.id;
      createdQuoteIds.push(testQuoteId);
    });

    it('should require authentication', async () => {
      const response = await request(API_URL)
        .post('/api/quotes')
        .send({
          text: 'Unauthorized quote',
          category: 'general',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(API_URL)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing text and category
          author: 'Test Author',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate text length', async () => {
      const response = await request(API_URL)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'A', // Too short
          category: 'general',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate category values', async () => {
      const response = await request(API_URL)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Valid quote text',
          category: 'invalid_category',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/quotes', () => {
    it('should list quotes', async () => {
      const response = await request(API_URL)
        .get('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('quotes');
      expect(Array.isArray(response.body.quotes)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(API_URL)
        .get('/api/quotes?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.quotes.length).toBeLessThanOrEqual(5);
    });

    it('should filter by category', async () => {
      const response = await request(API_URL)
        .get('/api/quotes?category=motivational')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.quotes.length > 0) {
        response.body.quotes.forEach((quote: any) => {
          expect(quote.category).toBe('motivational');
        });
      }
    });

    it('should filter by AI-generated', async () => {
      const response = await request(API_URL)
        .get('/api/quotes?aiGenerated=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.quotes.length > 0) {
        response.body.quotes.forEach((quote: any) => {
          expect(quote.aiGenerated).toBe(true);
        });
      }
    });

    it('should support tag filtering', async () => {
      const response = await request(API_URL)
        .get('/api/quotes?tags=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should require authentication', async () => {
      const response = await request(API_URL)
        .get('/api/quotes')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/quotes/:id', () => {
    it('should get a specific quote', async () => {
      if (!testQuoteId) {
        console.log('Skipping - no test quote created');
        return;
      }

      const response = await request(API_URL)
        .get(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.quote.id).toBe(testQuoteId);
    });

    it('should return 404 for non-existent quote', async () => {
      const response = await request(API_URL)
        .get('/api/quotes/nonexistent-id-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/quotes/:id', () => {
    it('should update a quote', async () => {
      if (!testQuoteId) {
        console.log('Skipping - no test quote created');
        return;
      }

      const updates = {
        text: 'Updated integration test quote - ' + Date.now(),
        author: 'Updated Author',
      };

      const response = await request(API_URL)
        .put(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.quote.text).toBe(updates.text);
      expect(response.body.quote.author).toBe(updates.author);
    });

    it('should not update non-existent quote', async () => {
      const response = await request(API_URL)
        .put('/api/quotes/nonexistent-id-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Updated text' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate update data', async () => {
      if (!testQuoteId) {
        console.log('Skipping - no test quote created');
        return;
      }

      const response = await request(API_URL)
        .put(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: '' }) // Empty text
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PATCH /api/quotes/:id (Engagement)', () => {
    it('should track like engagement', async () => {
      if (!testQuoteId) {
        console.log('Skipping - no test quote created');
        return;
      }

      // Get current like count
      const before = await request(API_URL)
        .get(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const beforeLikes = before.body.quote?.likeCount || 0;

      const response = await request(API_URL)
        .patch(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'like' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.quote.likeCount).toBe(beforeLikes + 1);
    });

    it('should track usage engagement', async () => {
      if (!testQuoteId) {
        console.log('Skipping - no test quote created');
        return;
      }

      const response = await request(API_URL)
        .patch(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'use' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.quote).toHaveProperty('usageCount');
    });

    it('should track share engagement', async () => {
      if (!testQuoteId) {
        console.log('Skipping - no test quote created');
        return;
      }

      const response = await request(API_URL)
        .patch(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'share' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.quote).toHaveProperty('shareCount');
    });

    it('should reject invalid actions', async () => {
      if (!testQuoteId) {
        console.log('Skipping - no test quote created');
        return;
      }

      const response = await request(API_URL)
        .patch(`/api/quotes/${testQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'invalid_action' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/quotes/:id', () => {
    it('should delete a quote', async () => {
      // Create a quote specifically for deletion
      const createResponse = await request(API_URL)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Quote to delete - ' + Date.now(),
          category: 'general',
        });

      const deleteQuoteId = createResponse.body.quote.id;

      const response = await request(API_URL)
        .delete(`/api/quotes/${deleteQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify quote is deleted
      await request(API_URL)
        .get(`/api/quotes/${deleteQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent quote', async () => {
      const response = await request(API_URL)
        .delete('/api/quotes/nonexistent-id-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/quotes (Bulk Delete)', () => {
    it('should bulk delete quotes', async () => {
      // Create quotes for bulk deletion
      const ids: string[] = [];

      for (let i = 0; i < 3; i++) {
        const createResponse = await request(API_URL)
          .post('/api/quotes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: `Bulk delete quote ${i} - ${Date.now()}`,
            category: 'general',
          });

        if (createResponse.body.quote?.id) {
          ids.push(createResponse.body.quote.id);
        }
      }

      if (ids.length === 0) {
        console.log('Skipping - no quotes created for bulk delete');
        return;
      }

      const response = await request(API_URL)
        .delete('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.deleted).toBe(ids.length);
    });

    it('should require ids array', async () => {
      const response = await request(API_URL)
        .delete('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing ids
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle empty ids array', async () => {
      const response = await request(API_URL)
        .delete('/api/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: [] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Quotes API Performance', () => {
    it('should respond within acceptable time', async () => {
      const startTime = Date.now();
      await request(API_URL)
        .get('/api/quotes?limit=10')
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // 2 seconds max
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(API_URL)
          .get('/api/quotes')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect([200, 401]).toContain(response.status);
      });
    });
  });
});
