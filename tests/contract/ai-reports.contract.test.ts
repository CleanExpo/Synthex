/**
 * AI & Reports API Contract Tests
 *
 * Validates AI chat, AI content generation, report, team, and
 * organization response schemas.
 *
 * @module tests/contract/ai-reports.contract.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  aiConversationSchema,
  aiMessageSchema,
  aiChatResponseSchema,
  reportSchema,
  reportResponseSchema,
  teamMemberSchema,
  organizationSchema,
  healthCheckResponseSchema,
  errorResponseSchema,
  generateContentResponseSchema,
} from '@/lib/schemas';

describe('AI API Contract Tests', () => {
  describe('AI Conversation Schema', () => {
    it('should validate full conversation', () => {
      const conversation = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Marketing Strategy Discussion',
        createdAt: '2025-06-01T00:00:00.000Z',
        updatedAt: '2025-06-01T12:00:00.000Z',
        messageCount: 15,
      };

      const result = aiConversationSchema.safeParse(conversation);
      expect(result.success).toBe(true);
    });

    it('should validate conversation without title', () => {
      const conversation = {
        id: '2',
        title: null,
        messageCount: 0,
      };

      const result = aiConversationSchema.safeParse(conversation);
      expect(result.success).toBe(true);
    });
  });

  describe('AI Message Schema', () => {
    it('should validate user message', () => {
      const message = {
        id: '1',
        role: 'user',
        content: 'Help me write a tweet about AI',
        createdAt: '2025-06-01T00:00:00.000Z',
      };

      const result = aiMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate assistant message', () => {
      const message = {
        id: '2',
        role: 'assistant',
        content: 'Here is your tweet: "AI is transforming how we create content..."',
        createdAt: '2025-06-01T00:01:00.000Z',
      };

      const result = aiMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate system message', () => {
      const message = {
        id: '3',
        role: 'system',
        content: 'You are a helpful marketing assistant.',
      };

      const result = aiMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const invalid = { id: '4', role: 'admin', content: 'test' };
      const result = aiMessageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('AI Chat Response', () => {
    it('should validate chat response with message', () => {
      const response = {
        success: true,
        data: {
          message: {
            id: '1',
            role: 'assistant',
            content: 'Here is your marketing plan...',
            createdAt: '2025-06-01T00:00:00.000Z',
          },
          conversation: {
            id: 'conv-1',
            title: 'Marketing Plan',
            messageCount: 5,
          },
        },
      };

      const result = aiChatResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate chat response with string response', () => {
      const response = {
        success: true,
        data: {
          response: 'Here is your generated content...',
          conversationId: 'conv-1',
        },
      };

      const result = aiChatResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Content Generation Response', () => {
    it('should validate generation response', () => {
      const response = {
        success: true,
        data: {
          content: 'Generated marketing tweet about AI automation',
          variations: [
            'Variation 1: AI is changing marketing...',
            'Variation 2: Transform your content with AI...',
          ],
          metadata: {
            platform: 'twitter',
            tone: 'professional',
            wordCount: 25,
          },
        },
      };

      const result = generateContentResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('Report API Contract Tests', () => {
  describe('Report Schema', () => {
    it('should validate full report', () => {
      const report = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Monthly Analytics Report',
        type: 'analytics',
        status: 'completed',
        data: { totalEngagement: 15000, growth: 12.5 },
        createdAt: '2025-06-01T00:00:00.000Z',
      };

      const result = reportSchema.safeParse(report);
      expect(result.success).toBe(true);
    });

    it('should validate minimal report', () => {
      const report = {
        id: '2',
        title: 'Quick Report',
      };

      const result = reportSchema.safeParse(report);
      expect(result.success).toBe(true);
    });

    it('should reject report without title', () => {
      const invalid = { id: '3' };
      const result = reportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Report List Response', () => {
    it('should validate paginated report response', () => {
      const response = {
        success: true,
        data: [
          { id: '1', title: 'Report A', type: 'analytics', status: 'completed' },
          { id: '2', title: 'Report B', type: 'engagement', status: 'pending' },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      const result = reportResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty report list', () => {
      const response = { success: true, data: [] };
      const result = reportResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('Team & Organization Contract Tests', () => {
  describe('Team Member Schema', () => {
    it('should validate full team member', () => {
      const member = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-1',
        name: 'John Doe',
        email: 'john@synthex.com',
        role: 'admin',
        joinedAt: '2025-01-01T00:00:00.000Z',
      };

      const result = teamMemberSchema.safeParse(member);
      expect(result.success).toBe(true);
    });

    it('should validate member without name', () => {
      const member = {
        id: '2',
        email: 'jane@synthex.com',
        role: 'editor',
      };

      const result = teamMemberSchema.safeParse(member);
      expect(result.success).toBe(true);
    });
  });

  describe('Organization Schema', () => {
    it('should validate full organization', () => {
      const org = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Synthex Inc',
        industry: 'technology',
        teamSize: '10-50',
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const result = organizationSchema.safeParse(org);
      expect(result.success).toBe(true);
    });

    it('should validate organization with nulls', () => {
      const org = {
        id: '2',
        name: 'New Org',
        industry: null,
        teamSize: null,
      };

      const result = organizationSchema.safeParse(org);
      expect(result.success).toBe(true);
    });

    it('should reject organization without name', () => {
      const invalid = { id: '3' };
      const result = organizationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

describe('Health Check Contract Tests', () => {
  describe('Health Check Response', () => {
    it('should validate detailed health response', () => {
      const response = {
        status: 'healthy',
        timestamp: '2025-06-01T00:00:00.000Z',
        uptime: 86400,
        services: {
          database: { status: 'connected', latency: 5 },
          redis: { status: 'connected', latency: 2 },
          ai: { status: 'connected', latency: 150 },
        },
      };

      const result = healthCheckResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate simple health response', () => {
      const response = { ok: true };
      const result = healthCheckResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate degraded health response', () => {
      const response = {
        status: 'degraded',
        services: {
          database: { status: 'connected', latency: 5 },
          redis: { status: 'disconnected' },
        },
      };

      const result = healthCheckResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
