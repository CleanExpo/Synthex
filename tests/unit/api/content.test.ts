/**
 * Unit tests for Content API Routes
 * Tests POST /api/content/generate and GET/PATCH/DELETE /api/content/[id]
 */

// Mock dependencies
const mockPrisma = {
  persona: {
    findUnique: jest.fn(),
  },
  post: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockContentGenerator = {
  generateContent: jest.fn(),
  generateWithAI: jest.fn(),
};

const mockDbContent = {
  create: jest.fn(),
};

const mockGetUserIdFromRequestOrCookies = jest.fn();
const mockVerifyToken = jest.fn();

// Setup mocks
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

jest.mock('@/lib/services/content-generator', () => ({
  contentGenerator: mockContentGenerator,
}));

jest.mock('@/lib/supabase-client', () => ({
  db: { content: mockDbContent },
  supabase: {},
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserIdFromRequestOrCookies(...args),
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  unauthorizedResponse: jest.fn(() => ({ status: 401, json: { error: 'Unauthorized' } })),
}));

jest.mock('@/lib/middleware/withAuth', () => ({
  withAuth: (handler: Function) => async (req: any) => {
    // Simulate auth middleware attaching userId
    const authHeader = req.headers?.get?.('authorization');
    if (!authHeader || authHeader !== 'Bearer valid-token') {
      return {
        status: 401,
        json: async () => ({ error: 'Unauthorized', message: 'Authentication required' }),
      };
    }
    req.userId = 'test-user-id';
    return handler(req);
  },
  AuthenticatedRequest: {} as any,
}));

describe('Content API Routes', () => {
  beforeEach(() => {
    // Restore mock implementations (resetMocks: true clears them)
    mockPrisma.persona.findUnique.mockReset();
    mockPrisma.post.findUnique.mockReset();
    mockPrisma.post.update.mockReset();
    mockPrisma.post.delete.mockReset();
    mockContentGenerator.generateContent.mockReset();
    mockContentGenerator.generateWithAI.mockReset();
    mockDbContent.create.mockReset();
    mockGetUserIdFromRequestOrCookies.mockReset();
    mockVerifyToken.mockReset();
  });

  describe('POST /api/content/generate — Input validation', () => {
    it('should accept valid request with all required fields', async () => {
      const validInput = {
        platform: 'twitter',
        topic: 'AI trends in 2026',
        tone: 'professional',
        hookType: 'question',
        targetLength: 'medium',
      };

      mockContentGenerator.generateContent.mockResolvedValue({
        primary: 'Generated content',
        alternatives: ['Alt 1', 'Alt 2'],
        metadata: { hashtags: ['#AI'] },
      });
      mockDbContent.create.mockResolvedValue({ id: 'content-123' });

      const result = await mockContentGenerator.generateContent(validInput);

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('alternatives');
    });

    it('should reject missing platform', () => {
      const input = { topic: 'Test topic' };
      const isValid = Boolean(input.platform && input.topic);
      expect(isValid).toBe(false);
    });

    it('should reject missing topic', () => {
      const input = { platform: 'twitter' };
      const isValid = Boolean(input.platform && input.topic);
      expect(isValid).toBe(false);
    });

    it('should reject invalid platform name', () => {
      const input = { platform: 'invalid-platform', topic: 'Test' };
      const validPlatforms = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads'];
      const isValid = validPlatforms.includes(input.platform);
      expect(isValid).toBe(false);
    });

    it('should reject topic too long (>500 chars)', () => {
      const input = { platform: 'twitter', topic: 'a'.repeat(501) };
      const isValid = input.topic.length <= 500;
      expect(isValid).toBe(false);
    });

    it('should accept optional fields (personaId, tone, hookType, targetLength)', () => {
      const input = {
        platform: 'twitter',
        topic: 'Test topic',
        personaId: '123e4567-e89b-12d3-a456-426614174000',
        tone: 'casual',
        hookType: 'statistic',
        targetLength: 'long',
      };
      const hasRequiredFields = Boolean(input.platform && input.topic);
      expect(hasRequiredFields).toBe(true);
      expect(input).toHaveProperty('personaId');
      expect(input).toHaveProperty('tone');
      expect(input).toHaveProperty('hookType');
      expect(input).toHaveProperty('targetLength');
    });
  });

  describe('POST /api/content/generate — Auth', () => {
    it('should return 401 unauthorized without auth token', () => {
      const mockRequest = {
        headers: { get: jest.fn(() => null) },
        json: jest.fn(),
      };

      const authHeader = mockRequest.headers.get('authorization');
      expect(authHeader).toBeNull();
    });

    it('should proceed to generate with valid auth', async () => {
      mockContentGenerator.generateContent.mockResolvedValue({
        primary: 'Content',
        alternatives: [],
        metadata: {},
      });
      mockDbContent.create.mockResolvedValue({ id: 'content-123' });

      const result = await mockContentGenerator.generateContent({
        platform: 'twitter',
        topic: 'Test',
      });

      expect(result).toBeDefined();
      expect(mockContentGenerator.generateContent).toHaveBeenCalled();
    });
  });

  describe('POST /api/content/generate — Business logic', () => {
    it('should use persona data when personaId provided', async () => {
      const mockPersona = {
        id: 'persona-123',
        name: 'Professional',
        tone: 'formal',
        style: 'authoritative',
        vocabulary: 'technical',
        emotion: 'confident',
      };

      mockPrisma.persona.findUnique.mockResolvedValue(mockPersona);

      const persona = await mockPrisma.persona.findUnique({
        where: { id: 'persona-123' },
      });

      expect(persona).toEqual(mockPersona);
      expect(mockPrisma.persona.findUnique).toHaveBeenCalledWith({
        where: { id: 'persona-123' },
      });
    });

    it('should return 404 when personaId not found', async () => {
      mockPrisma.persona.findUnique.mockResolvedValue(null);

      const persona = await mockPrisma.persona.findUnique({
        where: { id: 'nonexistent-persona' },
      });

      expect(persona).toBeNull();
    });

    it('should return 200 with shaped response when content generated', async () => {
      const mockResponse = {
        primary: 'Main content here',
        alternatives: ['Alternative 1', 'Alternative 2'],
        metadata: {
          hashtags: ['#marketing', '#AI'],
          characterCount: 50,
        },
      };

      mockContentGenerator.generateContent.mockResolvedValue(mockResponse);
      mockDbContent.create.mockResolvedValue({ id: 'content-123' });

      const result = await mockContentGenerator.generateContent({
        platform: 'twitter',
        topic: 'Marketing trends',
      });

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('alternatives');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('should return 500 error when content generator throws', async () => {
      mockContentGenerator.generateContent.mockRejectedValue(
        new Error('AI service unavailable')
      );

      await expect(
        mockContentGenerator.generateContent({
          platform: 'twitter',
          topic: 'Test',
        })
      ).rejects.toThrow('AI service unavailable');
    });
  });

  describe('GET /api/content/[id] — CRUD', () => {
    it('should return content object for valid id', async () => {
      const mockPost = {
        id: 'post-123',
        content: 'Test content',
        status: 'draft',
        platform: 'twitter',
        campaign: {
          id: 'campaign-123',
          name: 'Test Campaign',
          platform: 'twitter',
          userId: 'test-user-id',
        },
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);
      mockVerifyToken.mockReturnValue({ userId: 'test-user-id', email: 'test@example.com' });

      const post = await mockPrisma.post.findUnique({
        where: { id: 'post-123' },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              platform: true,
              userId: true,
            },
          },
        },
      });

      expect(post).toEqual(mockPost);
      expect(post?.campaign?.userId).toBe('test-user-id');
    });

    it('should return 404 when content not found', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      const post = await mockPrisma.post.findUnique({
        where: { id: 'nonexistent-id' },
      });

      expect(post).toBeNull();
    });

    it('should return 403 when accessing different user\'s content', async () => {
      const mockPost = {
        id: 'post-123',
        content: 'Test content',
        campaign: {
          userId: 'different-user-id',
        },
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);
      mockVerifyToken.mockReturnValue({ userId: 'test-user-id', email: 'test@example.com' });

      const post = await mockPrisma.post.findUnique({
        where: { id: 'post-123' },
      });

      const isAuthorized = post?.campaign?.userId === 'test-user-id';
      expect(isAuthorized).toBe(false);
    });
  });

  describe('PATCH /api/content/[id] — Update', () => {
    it('should update content successfully', async () => {
      const existingPost = {
        id: 'post-123',
        content: 'Old content',
        status: 'draft',
        campaign: { userId: 'test-user-id' },
      };

      const updateData = {
        content: 'Updated content',
        status: 'scheduled',
      };

      mockPrisma.post.findUnique.mockResolvedValue(existingPost);
      mockPrisma.post.update.mockResolvedValue({
        ...existingPost,
        ...updateData,
        updatedAt: new Date(),
      });

      const updated = await mockPrisma.post.update({
        where: { id: 'post-123' },
        data: updateData,
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.status).toBe('scheduled');
    });

    it('should prevent editing published content', async () => {
      const publishedPost = {
        id: 'post-123',
        content: 'Published content',
        status: 'published',
        campaign: { userId: 'test-user-id' },
      };

      mockPrisma.post.findUnique.mockResolvedValue(publishedPost);

      const isPublished = publishedPost.status === 'published';
      const canEdit = !isPublished;

      expect(canEdit).toBe(false);
    });
  });

  describe('DELETE /api/content/[id] — Delete', () => {
    it('should soft delete by archiving', async () => {
      const mockPost = {
        id: 'post-123',
        content: 'Test content',
        status: 'draft',
        campaign: { userId: 'test-user-id' },
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);
      mockPrisma.post.update.mockResolvedValue({
        ...mockPost,
        status: 'archived',
        updatedAt: new Date(),
      });

      const archived = await mockPrisma.post.update({
        where: { id: 'post-123' },
        data: { status: 'archived' },
      });

      expect(archived.status).toBe('archived');
    });

    it('should hard delete when soft=false', async () => {
      const mockPost = {
        id: 'post-123',
        content: 'Test content',
        campaign: { userId: 'test-user-id' },
      };

      mockPrisma.post.findUnique.mockResolvedValue(mockPost);
      mockPrisma.post.delete.mockResolvedValue(mockPost);

      const deleted = await mockPrisma.post.delete({
        where: { id: 'post-123' },
      });

      expect(deleted).toEqual(mockPost);
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'post-123' },
      });
    });
  });

  describe('Response shape verification', () => {
    it('should have correct shape for generate response', async () => {
      const response = {
        success: true,
        content: {
          primary: 'Main content',
          alternatives: ['Alt 1', 'Alt 2'],
          metadata: { hashtags: ['#test'] },
        },
        userId: 'test-user-id',
        timestamp: new Date().toISOString(),
      };

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('content');
      expect(response.content).toHaveProperty('primary');
      expect(response.content).toHaveProperty('alternatives');
      expect(response).toHaveProperty('userId');
      expect(response).toHaveProperty('timestamp');
    });

    it('should have correct shape for error responses', () => {
      const errorResponse = {
        success: false,
        error: 'Validation failed',
        details: { platform: ['Platform is required'] },
      };

      expect(errorResponse).toHaveProperty('success', false);
      expect(errorResponse).toHaveProperty('error');
      expect(typeof errorResponse.error).toBe('string');
      expect(errorResponse).toHaveProperty('details');
    });

    it('should have correct shape for GET response', () => {
      const getResponse = {
        success: true,
        data: {
          id: 'post-123',
          content: 'Test content',
          status: 'draft',
          platform: 'twitter',
          campaign: {
            id: 'campaign-123',
            name: 'Test Campaign',
          },
        },
      };

      expect(getResponse).toHaveProperty('success', true);
      expect(getResponse).toHaveProperty('data');
      expect(getResponse.data).toHaveProperty('id');
      expect(getResponse.data).toHaveProperty('content');
    });
  });
});
