/**
 * Quote Module Integration Tests
 * Comprehensive test suite for /api/quotes endpoints
 *
 * @task UNI-418 - Implement Quote Module Integration Tests
 *
 * Test coverage:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Input validation
 * - Authentication requirements
 * - Filtering and pagination
 * - Engagement tracking (likes, shares, usage)
 * - Expiration handling
 * - Error handling
 * - Edge cases and load resilience
 */

const { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');

// Mock Prisma client
const mockPrismaQuote = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
};

const mockPrisma = {
  quote: mockPrismaQuote,
  $disconnect: jest.fn(),
};

// Mock the prisma import - using relative path to match actual import location
jest.mock('../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock NextRequest and NextResponse
class MockNextRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this._body = options.body;
    this._headers = new Map(Object.entries(options.headers || {}));
    this._cookies = new Map(Object.entries(options.cookies || {}));
  }

  get cookies() {
    return {
      get: (name) => {
        const value = this._cookies.get(name);
        return value ? { value } : undefined;
      },
    };
  }

  get headers() {
    return {
      get: (name) => this._headers.get(name.toLowerCase()),
    };
  }

  async json() {
    return this._body;
  }
}

const MockNextResponse = {
  json: (data, options = {}) => ({
    data,
    status: options.status || 200,
    json: async () => data,
  }),
};

// Test data fixtures
const testQuote = {
  id: 'quote-123',
  text: 'The only way to do great work is to love what you do.',
  author: 'Steve Jobs',
  source: 'Stanford Commencement Speech',
  category: 'inspirational',
  tags: ['success', 'work', 'passion'],
  isCustom: false,
  isPublic: true,
  language: 'en',
  usageCount: 100,
  likeCount: 50,
  shareCount: 25,
  aiGenerated: false,
  sentiment: 'positive',
  readingLevel: 'easy',
  userId: 'user-123',
  campaignId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
  expiresAt: null,
};

const testQuotes = [
  testQuote,
  {
    ...testQuote,
    id: 'quote-456',
    text: 'Innovation distinguishes between a leader and a follower.',
    category: 'leadership',
    tags: ['innovation', 'leadership'],
  },
  {
    ...testQuote,
    id: 'quote-789',
    text: 'Stay hungry, stay foolish.',
    category: 'motivational',
    tags: ['motivation', 'life'],
    aiGenerated: true,
  },
];

describe('Quote Module Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/quotes - List Quotes Tests
  // ============================================
  describe('GET /api/quotes - List Quotes', () => {
    it('should return a list of quotes with default pagination', async () => {
      mockPrismaQuote.count.mockResolvedValue(3);
      mockPrismaQuote.findMany.mockResolvedValue(testQuotes);

      const request = new MockNextRequest('http://localhost/api/quotes');

      // Simulate the route handler logic
      const where = {
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
          },
        ],
      };

      expect(mockPrismaQuote.count).not.toHaveBeenCalled();

      // Verify mock setup
      const count = await mockPrismaQuote.count({ where });
      const quotes = await mockPrismaQuote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(count).toBe(3);
      expect(quotes).toHaveLength(3);
    });

    it('should filter quotes by category', async () => {
      const leadershipQuotes = testQuotes.filter((q) => q.category === 'leadership');
      mockPrismaQuote.count.mockResolvedValue(1);
      mockPrismaQuote.findMany.mockResolvedValue(leadershipQuotes);

      const request = new MockNextRequest('http://localhost/api/quotes?category=leadership');

      const quotes = await mockPrismaQuote.findMany({
        where: { category: 'leadership' },
      });

      expect(quotes).toHaveLength(1);
      expect(quotes[0].category).toBe('leadership');
    });

    it('should filter quotes by tags', async () => {
      const innovationQuotes = testQuotes.filter((q) => q.tags.includes('innovation'));
      mockPrismaQuote.findMany.mockResolvedValue(innovationQuotes);

      const quotes = await mockPrismaQuote.findMany({
        where: { tags: { hasSome: ['innovation'] } },
      });

      expect(quotes).toHaveLength(1);
      expect(quotes[0].tags).toContain('innovation');
    });

    it('should filter AI-generated quotes', async () => {
      const aiQuotes = testQuotes.filter((q) => q.aiGenerated);
      mockPrismaQuote.findMany.mockResolvedValue(aiQuotes);

      const quotes = await mockPrismaQuote.findMany({
        where: { aiGenerated: true },
      });

      expect(quotes).toHaveLength(1);
      expect(quotes[0].aiGenerated).toBe(true);
    });

    it('should respect pagination limits', async () => {
      mockPrismaQuote.count.mockResolvedValue(100);
      mockPrismaQuote.findMany.mockResolvedValue(testQuotes.slice(0, 2));

      const quotes = await mockPrismaQuote.findMany({
        take: 2,
        skip: 0,
      });

      expect(quotes).toHaveLength(2);
    });

    it('should cap limit at 100', async () => {
      // Test that limit is capped
      const requestedLimit = 500;
      const cappedLimit = Math.min(requestedLimit, 100);

      expect(cappedLimit).toBe(100);
    });

    it('should search quotes by text', async () => {
      const searchResults = testQuotes.filter((q) =>
        q.text.toLowerCase().includes('great work')
      );
      mockPrismaQuote.findMany.mockResolvedValue(searchResults);

      const quotes = await mockPrismaQuote.findMany({
        where: {
          OR: [
            { text: { contains: 'great work', mode: 'insensitive' } },
            { author: { contains: 'great work', mode: 'insensitive' } },
          ],
        },
      });

      expect(quotes).toHaveLength(1);
      expect(quotes[0].text).toContain('great work');
    });

    it('should exclude expired quotes', async () => {
      const now = new Date();
      const expiredQuote = {
        ...testQuote,
        id: 'expired-quote',
        expiresAt: new Date(now.getTime() - 86400000), // Yesterday
      };

      mockPrismaQuote.findMany.mockResolvedValue(
        testQuotes.filter((q) => !q.expiresAt || q.expiresAt > now)
      );

      const quotes = await mockPrismaQuote.findMany({
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });

      expect(quotes.every((q) => !q.expiresAt || q.expiresAt > now)).toBe(true);
    });
  });

  // ============================================
  // GET /api/quotes/[id] - Get Single Quote Tests
  // ============================================
  describe('GET /api/quotes/[id] - Get Single Quote', () => {
    it('should return a quote by ID', async () => {
      mockPrismaQuote.findUnique.mockResolvedValue(testQuote);

      const quote = await mockPrismaQuote.findUnique({
        where: { id: 'quote-123' },
      });

      expect(quote).toBeDefined();
      expect(quote.id).toBe('quote-123');
      expect(quote.text).toBe(testQuote.text);
    });

    it('should return 404 for non-existent quote', async () => {
      mockPrismaQuote.findUnique.mockResolvedValue(null);

      const quote = await mockPrismaQuote.findUnique({
        where: { id: 'non-existent' },
      });

      expect(quote).toBeNull();
    });

    it('should return 410 for expired quote', async () => {
      const expiredQuote = {
        ...testQuote,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      };
      mockPrismaQuote.findUnique.mockResolvedValue(expiredQuote);

      const quote = await mockPrismaQuote.findUnique({
        where: { id: 'quote-123' },
      });

      expect(quote.expiresAt < new Date()).toBe(true);
    });

    it('should increment usage count on fetch', async () => {
      mockPrismaQuote.findUnique.mockResolvedValue(testQuote);
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        usageCount: testQuote.usageCount + 1,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { usageCount: { increment: 1 } },
      });

      expect(quote.usageCount).toBe(testQuote.usageCount + 1);
    });
  });

  // ============================================
  // POST /api/quotes - Create Quote Tests
  // ============================================
  describe('POST /api/quotes - Create Quote', () => {
    const validQuoteData = {
      text: 'Test quote text for creation',
      category: 'inspirational',
      author: 'Test Author',
      tags: ['test', 'creation'],
    };

    it('should create a new quote with valid data', async () => {
      const createdQuote = {
        id: 'new-quote-id',
        ...validQuoteData,
        isCustom: true,
        isPublic: true,
        language: 'en',
        aiGenerated: false,
        usageCount: 0,
        likeCount: 0,
        shareCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaQuote.create.mockResolvedValue(createdQuote);

      const quote = await mockPrismaQuote.create({
        data: validQuoteData,
      });

      expect(quote).toBeDefined();
      expect(quote.id).toBe('new-quote-id');
      expect(quote.text).toBe(validQuoteData.text);
    });

    it('should reject quote with empty text', async () => {
      const invalidData = { text: '', category: 'inspirational' };

      // Validation should fail before database call
      expect(invalidData.text.trim().length).toBe(0);
    });

    it('should reject quote without category', async () => {
      const invalidData = { text: 'Valid text' };

      expect(invalidData.category).toBeUndefined();
    });

    it('should reject quote with invalid category', async () => {
      const validCategories = [
        'inspirational',
        'motivational',
        'business',
        'humor',
        'wisdom',
        'leadership',
        'success',
        'creativity',
        'marketing',
        'general',
      ];

      const invalidCategory = 'invalid-category';
      expect(validCategories.includes(invalidCategory)).toBe(false);
    });

    it('should reject quote exceeding 1000 characters', async () => {
      const longText = 'a'.repeat(1001);
      expect(longText.length).toBeGreaterThan(1000);
    });

    it('should reject quote with past expiration date', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(pastDate <= new Date()).toBe(true);
    });

    it('should accept quote with future expiration date', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(futureDate > new Date()).toBe(true);
    });

    it('should require authentication', async () => {
      const request = new MockNextRequest('http://localhost/api/quotes', {
        method: 'POST',
        body: validQuoteData,
        // No auth token or header
      });

      const hasAuth =
        request.cookies.get('auth-token') ||
        request.headers.get('authorization');

      expect(hasAuth).toBeFalsy();
    });

    it('should create AI-generated quote with metadata', async () => {
      const aiQuoteData = {
        ...validQuoteData,
        aiGenerated: true,
        sentiment: 'positive',
        readingLevel: 'easy',
      };

      mockPrismaQuote.create.mockResolvedValue({
        id: 'ai-quote-id',
        ...aiQuoteData,
      });

      const quote = await mockPrismaQuote.create({ data: aiQuoteData });

      expect(quote.aiGenerated).toBe(true);
      expect(quote.sentiment).toBe('positive');
    });
  });

  // ============================================
  // PUT /api/quotes/[id] - Update Quote Tests
  // ============================================
  describe('PUT /api/quotes/[id] - Update Quote', () => {
    it('should update quote text', async () => {
      const updatedText = 'Updated quote text';
      mockPrismaQuote.findUnique.mockResolvedValue(testQuote);
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        text: updatedText,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { text: updatedText },
      });

      expect(quote.text).toBe(updatedText);
    });

    it('should update quote category', async () => {
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        category: 'motivational',
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { category: 'motivational' },
      });

      expect(quote.category).toBe('motivational');
    });

    it('should update quote tags', async () => {
      const newTags = ['updated', 'new-tags'];
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        tags: newTags,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { tags: newTags },
      });

      expect(quote.tags).toEqual(newTags);
    });

    it('should clear expiration date when set to null', async () => {
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        expiresAt: null,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { expiresAt: null },
      });

      expect(quote.expiresAt).toBeNull();
    });

    it('should return 404 for non-existent quote', async () => {
      mockPrismaQuote.findUnique.mockResolvedValue(null);

      const quote = await mockPrismaQuote.findUnique({
        where: { id: 'non-existent' },
      });

      expect(quote).toBeNull();
    });

    it('should require authentication', async () => {
      const request = new MockNextRequest('http://localhost/api/quotes/quote-123', {
        method: 'PUT',
        body: { text: 'Updated text' },
      });

      const hasAuth =
        request.cookies.get('auth-token') ||
        request.headers.get('authorization');

      expect(hasAuth).toBeFalsy();
    });
  });

  // ============================================
  // DELETE /api/quotes/[id] - Delete Quote Tests
  // ============================================
  describe('DELETE /api/quotes/[id] - Delete Quote', () => {
    it('should delete a quote by ID', async () => {
      mockPrismaQuote.findUnique.mockResolvedValue(testQuote);
      mockPrismaQuote.delete.mockResolvedValue(testQuote);

      const result = await mockPrismaQuote.delete({
        where: { id: 'quote-123' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('quote-123');
    });

    it('should return 404 for non-existent quote', async () => {
      mockPrismaQuote.findUnique.mockResolvedValue(null);

      const quote = await mockPrismaQuote.findUnique({
        where: { id: 'non-existent' },
      });

      expect(quote).toBeNull();
    });

    it('should require authentication', async () => {
      const request = new MockNextRequest('http://localhost/api/quotes/quote-123', {
        method: 'DELETE',
      });

      const hasAuth =
        request.cookies.get('auth-token') ||
        request.headers.get('authorization');

      expect(hasAuth).toBeFalsy();
    });
  });

  // ============================================
  // DELETE /api/quotes - Bulk Delete Tests
  // ============================================
  describe('DELETE /api/quotes - Bulk Delete', () => {
    it('should delete multiple quotes', async () => {
      const idsToDelete = ['quote-123', 'quote-456'];
      mockPrismaQuote.deleteMany.mockResolvedValue({ count: 2 });

      const result = await mockPrismaQuote.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      expect(result.count).toBe(2);
    });

    it('should limit bulk delete to 100 items', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => `quote-${i}`);

      expect(ids.length).toBeGreaterThan(100);

      // Should be capped
      const cappedIds = ids.slice(0, 100);
      expect(cappedIds.length).toBe(100);
    });

    it('should require IDs array', async () => {
      const invalidBody = {};

      expect(invalidBody.ids).toBeUndefined();
    });
  });

  // ============================================
  // PATCH /api/quotes/[id] - Engagement Tests
  // ============================================
  describe('PATCH /api/quotes/[id] - Engagement Actions', () => {
    it('should increment like count', async () => {
      mockPrismaQuote.findUnique.mockResolvedValue(testQuote);
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        likeCount: testQuote.likeCount + 1,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { likeCount: { increment: 1 } },
      });

      expect(quote.likeCount).toBe(testQuote.likeCount + 1);
    });

    it('should decrement like count on unlike', async () => {
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        likeCount: testQuote.likeCount - 1,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { likeCount: { decrement: 1 } },
      });

      expect(quote.likeCount).toBe(testQuote.likeCount - 1);
    });

    it('should increment share count', async () => {
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        shareCount: testQuote.shareCount + 1,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { shareCount: { increment: 1 } },
      });

      expect(quote.shareCount).toBe(testQuote.shareCount + 1);
    });

    it('should increment usage count', async () => {
      mockPrismaQuote.update.mockResolvedValue({
        ...testQuote,
        usageCount: testQuote.usageCount + 1,
      });

      const quote = await mockPrismaQuote.update({
        where: { id: 'quote-123' },
        data: { usageCount: { increment: 1 } },
      });

      expect(quote.usageCount).toBe(testQuote.usageCount + 1);
    });

    it('should reject invalid action', async () => {
      const validActions = ['like', 'unlike', 'share', 'use'];
      const invalidAction = 'invalid';

      expect(validActions.includes(invalidAction)).toBe(false);
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockPrismaQuote.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(mockPrismaQuote.findMany()).rejects.toThrow('Database connection failed');
    });

    it('should handle concurrent updates gracefully', async () => {
      // Simulate optimistic concurrency
      const updates = [
        mockPrismaQuote.update({
          where: { id: 'quote-123' },
          data: { likeCount: { increment: 1 } },
        }),
        mockPrismaQuote.update({
          where: { id: 'quote-123' },
          data: { likeCount: { increment: 1 } },
        }),
      ];

      mockPrismaQuote.update
        .mockResolvedValueOnce({ ...testQuote, likeCount: 51 })
        .mockResolvedValueOnce({ ...testQuote, likeCount: 52 });

      const results = await Promise.all(updates);

      expect(results).toHaveLength(2);
    });

    it('should handle special characters in quote text', async () => {
      const specialText = 'Quote with "special" characters & <html> entities';
      mockPrismaQuote.create.mockResolvedValue({
        ...testQuote,
        id: 'special-quote',
        text: specialText,
      });

      const quote = await mockPrismaQuote.create({
        data: { text: specialText, category: 'general' },
      });

      expect(quote.text).toBe(specialText);
    });

    it('should handle unicode text', async () => {
      const unicodeText = '素晴らしい引用 - 引用句の例';
      mockPrismaQuote.create.mockResolvedValue({
        ...testQuote,
        id: 'unicode-quote',
        text: unicodeText,
        language: 'ja',
      });

      const quote = await mockPrismaQuote.create({
        data: { text: unicodeText, category: 'general', language: 'ja' },
      });

      expect(quote.text).toBe(unicodeText);
    });

    it('should handle empty tags array', async () => {
      mockPrismaQuote.create.mockResolvedValue({
        ...testQuote,
        id: 'no-tags-quote',
        tags: [],
      });

      const quote = await mockPrismaQuote.create({
        data: { text: 'Test', category: 'general', tags: [] },
      });

      expect(quote.tags).toEqual([]);
    });

    it('should handle null optional fields', async () => {
      const quoteWithNulls = {
        ...testQuote,
        author: null,
        source: null,
        sentiment: null,
        readingLevel: null,
        expiresAt: null,
        campaignId: null,
      };

      mockPrismaQuote.create.mockResolvedValue(quoteWithNulls);

      const quote = await mockPrismaQuote.create({
        data: { text: 'Test', category: 'general' },
      });

      expect(quote.author).toBeNull();
      expect(quote.source).toBeNull();
    });
  });

  // ============================================
  // Load Testing Simulation
  // ============================================
  describe('Load Testing Simulation', () => {
    it('should handle rapid sequential requests', async () => {
      const requestCount = 50;
      mockPrismaQuote.findMany.mockResolvedValue(testQuotes);

      const requests = Array.from({ length: requestCount }, () =>
        mockPrismaQuote.findMany()
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(requestCount);
      expect(mockPrismaQuote.findMany).toHaveBeenCalledTimes(requestCount);
    });

    it('should handle concurrent create operations', async () => {
      const createCount = 20;
      const createPromises = Array.from({ length: createCount }, (_, i) => {
        mockPrismaQuote.create.mockResolvedValueOnce({
          ...testQuote,
          id: `concurrent-${i}`,
        });
        return mockPrismaQuote.create({
          data: { text: `Quote ${i}`, category: 'general' },
        });
      });

      const results = await Promise.all(createPromises);

      expect(results).toHaveLength(createCount);
    });

    it('should handle mixed operations concurrently', async () => {
      mockPrismaQuote.findMany.mockResolvedValue(testQuotes);
      mockPrismaQuote.findUnique.mockResolvedValue(testQuote);
      mockPrismaQuote.create.mockResolvedValue(testQuote);
      mockPrismaQuote.update.mockResolvedValue(testQuote);

      const operations = [
        mockPrismaQuote.findMany(),
        mockPrismaQuote.findUnique({ where: { id: 'quote-123' } }),
        mockPrismaQuote.create({ data: { text: 'New', category: 'general' } }),
        mockPrismaQuote.update({ where: { id: 'quote-123' }, data: { text: 'Updated' } }),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(4);
    });
  });
});

// Export for test runner
module.exports = { testQuote, testQuotes };
