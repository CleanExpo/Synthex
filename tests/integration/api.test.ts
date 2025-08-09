import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const prisma = new PrismaClient();

describe('API Integration Tests', () => {
  let authToken: string;
  let refreshToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test database
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Authentication Endpoints', () => {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'Test123!@#',
      name: 'Test User'
    };

    describe('POST /api/v1/auth/register', () => {
      it('should register a new user', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/register')
          .send(testUser)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data).toHaveProperty('refreshToken');
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data.user.email).toBe(testUser.email);

        authToken = response.body.data.token;
        refreshToken = response.body.data.refreshToken;
        userId = response.body.data.user.id;
      });

      it('should not register duplicate email', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/register')
          .send(testUser)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      });

      it('should validate email format', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/register')
          .send({
            ...testUser,
            email: 'invalid-email'
          })
          .expect(400);

        expect(response.body.error).toContain('email');
      });

      it('should enforce password requirements', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/register')
          .send({
            ...testUser,
            email: 'another@example.com',
            password: 'weak'
          })
          .expect(400);

        expect(response.body.error).toContain('password');
      });
    });

    describe('POST /api/v1/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data).toHaveProperty('refreshToken');
      });

      it('should reject invalid credentials', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!'
          })
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should handle non-existent user', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'Password123!'
          })
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/v1/auth/refresh', () => {
      it('should refresh access token', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data.token).not.toBe(authToken);
      });

      it('should reject invalid refresh token', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/v1/auth/logout', () => {
      it('should logout user', async () => {
        const response = await request(API_URL)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });
  });

  describe('User Management Endpoints', () => {
    beforeEach(async () => {
      // Login to get fresh token
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Test123!@#'
        });
      
      if (response.body.success) {
        authToken = response.body.data.token;
        userId = response.body.data.user.id;
      }
    });

    describe('GET /api/v1/user/profile', () => {
      it('should get user profile', async () => {
        const response = await request(API_URL)
          .get('/api/v1/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('email');
        expect(response.body.data).toHaveProperty('name');
      });

      it('should require authentication', async () => {
        const response = await request(API_URL)
          .get('/api/v1/user/profile')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PUT /api/v1/user/profile', () => {
      it('should update user profile', async () => {
        const updates = {
          name: 'Updated Name',
          bio: 'Test bio'
        };

        const response = await request(API_URL)
          .put('/api/v1/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.name).toBe(updates.name);
        expect(response.body.data.bio).toBe(updates.bio);
      });

      it('should not update email without verification', async () => {
        const response = await request(API_URL)
          .put('/api/v1/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ email: 'newemail@example.com' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('DELETE /api/v1/user/account', () => {
      it('should delete user account', async () => {
        // Create a new user for deletion
        const tempUser = await request(API_URL)
          .post('/api/v1/auth/register')
          .send({
            email: `delete-${Date.now()}@example.com`,
            password: 'Delete123!@#',
            name: 'Delete User'
          });

        const tempToken = tempUser.body.data.token;

        const response = await request(API_URL)
          .delete('/api/v1/user/account')
          .set('Authorization', `Bearer ${tempToken}`)
          .send({ confirm: true })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);

        // Verify user cannot login
        const loginAttempt = await request(API_URL)
          .post('/api/v1/auth/login')
          .send({
            email: tempUser.body.data.user.email,
            password: 'Delete123!@#'
          })
          .expect(401);
      });
    });
  });

  describe('Content Management Endpoints', () => {
    let postId: string;

    describe('POST /api/v1/posts', () => {
      it('should create a new post', async () => {
        const postData = {
          title: 'Test Post',
          content: 'This is a test post content',
          platforms: ['twitter', 'facebook'],
          scheduledAt: new Date(Date.now() + 86400000).toISOString()
        };

        const response = await request(API_URL)
          .post('/api/v1/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(postData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.title).toBe(postData.title);
        expect(response.body.data.platforms).toEqual(postData.platforms);

        postId = response.body.data.id;
      });

      it('should validate required fields', async () => {
        const response = await request(API_URL)
          .post('/api/v1/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Incomplete Post' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toContain('required');
      });
    });

    describe('GET /api/v1/posts', () => {
      it('should list user posts', async () => {
        const response = await request(API_URL)
          .get('/api/v1/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('should support pagination', async () => {
        const response = await request(API_URL)
          .get('/api/v1/posts?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('pagination');
        expect(response.body.pagination).toHaveProperty('page', 1);
        expect(response.body.pagination).toHaveProperty('limit', 10);
      });

      it('should filter by platform', async () => {
        const response = await request(API_URL)
          .get('/api/v1/posts?platform=twitter')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        response.body.data.forEach((post: any) => {
          expect(post.platforms).toContain('twitter');
        });
      });
    });

    describe('PUT /api/v1/posts/:id', () => {
      it('should update a post', async () => {
        const updates = {
          title: 'Updated Post Title',
          content: 'Updated content'
        };

        const response = await request(API_URL)
          .put(`/api/v1/posts/${postId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.title).toBe(updates.title);
        expect(response.body.data.content).toBe(updates.content);
      });

      it('should not update published posts', async () => {
        // First publish the post
        await request(API_URL)
          .post(`/api/v1/posts/${postId}/publish`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Try to update
        const response = await request(API_URL)
          .put(`/api/v1/posts/${postId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Cannot Update' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('DELETE /api/v1/posts/:id', () => {
      it('should delete a post', async () => {
        // Create a post to delete
        const newPost = await request(API_URL)
          .post('/api/v1/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Post to Delete',
            content: 'Will be deleted',
            platforms: ['twitter']
          });

        const deleteId = newPost.body.data.id;

        const response = await request(API_URL)
          .delete(`/api/v1/posts/${deleteId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);

        // Verify post is deleted
        await request(API_URL)
          .get(`/api/v1/posts/${deleteId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/v1/analytics/overview', () => {
      it('should get analytics overview', async () => {
        const response = await request(API_URL)
          .get('/api/v1/analytics/overview?range=week')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('totalReach');
        expect(response.body.data).toHaveProperty('engagement');
        expect(response.body.data).toHaveProperty('totalPosts');
      });

      it('should support different time ranges', async () => {
        const ranges = ['day', 'week', 'month'];
        
        for (const range of ranges) {
          const response = await request(API_URL)
            .get(`/api/v1/analytics/overview?range=${range}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          expect(response.body.range).toBe(range);
        }
      });
    });

    describe('GET /api/v1/analytics/platforms/:platform', () => {
      it('should get platform-specific analytics', async () => {
        const platforms = ['instagram', 'facebook', 'twitter', 'linkedin'];
        
        for (const platform of platforms) {
          const response = await request(API_URL)
            .get(`/api/v1/analytics/platforms/${platform}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          expect(response.body.platform).toBe(platform);
          expect(response.body.data).toHaveProperty('followers');
          expect(response.body.data).toHaveProperty('avgEngagement');
        }
      });

      it('should handle invalid platform', async () => {
        const response = await request(API_URL)
          .get('/api/v1/analytics/platforms/invalid')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/v1/analytics/export', () => {
      it('should export analytics as CSV', async () => {
        const response = await request(API_URL)
          .post('/api/v1/analytics/export/csv')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ range: 'week', type: 'overview' })
          .expect(200);

        expect(response.headers['content-type']).toContain('csv');
      });

      it('should export analytics as Excel', async () => {
        const response = await request(API_URL)
          .post('/api/v1/analytics/export/excel')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ range: 'month' })
          .expect(200);

        expect(response.headers['content-type']).toContain('spreadsheet');
      });

      it('should export analytics as PDF', async () => {
        const response = await request(API_URL)
          .post('/api/v1/analytics/export/pdf')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ range: 'week' })
          .expect(200);

        expect(response.headers['content-type']).toContain('pdf');
      });
    });
  });

  describe('Team Collaboration Endpoints', () => {
    let teamId: string;
    let inviteCode: string;

    describe('POST /api/v1/teams', () => {
      it('should create a new team', async () => {
        const teamData = {
          name: 'Test Team',
          description: 'A test team for integration testing'
        };

        const response = await request(API_URL)
          .post('/api/v1/teams')
          .set('Authorization', `Bearer ${authToken}`)
          .send(teamData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.name).toBe(teamData.name);

        teamId = response.body.data.id;
      });
    });

    describe('POST /api/v1/teams/:id/invite', () => {
      it('should create team invitation', async () => {
        const response = await request(API_URL)
          .post(`/api/v1/teams/${teamId}/invite`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            email: 'invite@example.com',
            role: 'member'
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('inviteCode');

        inviteCode = response.body.data.inviteCode;
      });
    });

    describe('POST /api/v1/teams/join', () => {
      it('should join team with invite code', async () => {
        // Create a new user to join
        const newUser = await request(API_URL)
          .post('/api/v1/auth/register')
          .send({
            email: `member-${Date.now()}@example.com`,
            password: 'Member123!@#',
            name: 'Team Member'
          });

        const memberToken = newUser.body.data.token;

        const response = await request(API_URL)
          .post('/api/v1/teams/join')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ inviteCode })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.teamId).toBe(teamId);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Make many requests quickly
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(API_URL)
            .get('/api/v1/posts')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(API_URL)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle database errors gracefully', async () => {
      // Disconnect database temporarily
      await prisma.$disconnect();

      const response = await request(API_URL)
        .get('/api/v1/posts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      // Reconnect
      await prisma.$connect();
    });
  });
});