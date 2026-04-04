/**
 * Unit Tests for Industry Content API Routes
 * Tests POST /api/content/industry
 *     GET  /api/content/industry/templates
 *
 * SYN-446 — Add test coverage for recently added API routes
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ---------------------------------------------------------------------------
// Mocks — factories declare shape only; implementations set in beforeEach
// ---------------------------------------------------------------------------

const mockPrisma = {
  industryTemplate: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn((body: unknown, status: number) => {
  return new Response(JSON.stringify(body), { status });
});

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) =>
      mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

const mockContentGenerator = {
  generateWithAI: jest.fn(),
};

jest.mock('@/lib/services/content-generator', () => ({
  contentGenerator: mockContentGenerator,
}));

const mockScoreEngagement = jest.fn();

jest.mock('@/lib/content/engagement-scorer', () => ({
  scoreEngagement: (...args: unknown[]) => mockScoreEngagement(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockSeedIndustryTemplates = jest.fn();

jest.mock('@/lib/content/industry-templates', () => ({
  seedIndustryTemplates: (...args: unknown[]) =>
    mockSeedIndustryTemplates(...args),
}));

// ---------------------------------------------------------------------------
// Import handlers AFTER all mocks are declared
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/content/industry/route';
import { GET } from '@/app/api/content/industry/templates/route';

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const AUTHENTICATED_CONTEXT = {
  allowed: true,
  context: { userId: 'user-123' },
};

const MOCK_TEMPLATE = {
  id: 'tmpl-1',
  industry: 'trades',
  scenarioName: 'After-job reveal',
  promptTemplate:
    'Write a post for {{businessName}} in {{location}}. Tone: {{tone}}.',
  exampleOutput: 'Great job done in {{location}} by {{businessName}}!',
};

// ---------------------------------------------------------------------------
// POST /api/content/industry
// ---------------------------------------------------------------------------

describe('POST /api/content/industry', () => {
  beforeEach(() => {
    mockSecurityCheck.mockResolvedValue(AUTHENTICATED_CONTEXT);
    mockGetEffectiveOrganizationId.mockResolvedValue('org-456');
    mockPrisma.industryTemplate.findFirst.mockResolvedValue(MOCK_TEMPLATE);
    mockContentGenerator.generateWithAI.mockResolvedValue(
      'Your plumbing experts in Melbourne!'
    );
    mockScoreEngagement.mockReturnValue({
      score: 72,
      grade: 'B',
      suggestions: [],
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const req = createMockNextRequest({
      method: 'POST',
      body: {
        industry: 'trades',
        scenarioName: 'After-job reveal',
        variables: { businessName: 'AcmePlumbing', location: 'Melbourne' },
      },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      401,
      expect.anything()
    );
  });

  it('returns 401 when userId is absent from security context', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: undefined },
    });

    const req = createMockNextRequest({
      method: 'POST',
      body: {
        industry: 'trades',
        scenarioName: 'After-job reveal',
        variables: {},
      },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Unauthorised' },
      401,
      expect.anything()
    );
  });

  it('returns 403 when user has no organisation context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);

    const req = createMockNextRequest({
      method: 'POST',
      body: {
        industry: 'trades',
        scenarioName: 'After-job reveal',
        variables: {},
      },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('organisation'),
      }),
      403,
      expect.anything()
    );
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/content/industry',
    });
    (req as any).json = async () => {
      throw new SyntaxError('Unexpected token');
    };

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Invalid JSON body.' },
      400,
      expect.anything()
    );
  });

  it('returns 400 when industry field is missing', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { scenarioName: 'After-job reveal', variables: {} },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 400 when scenarioName field is missing', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { industry: 'trades', variables: {} },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 404 when no template matches the industry + scenarioName', async () => {
    mockPrisma.industryTemplate.findFirst.mockResolvedValue(null);

    const req = createMockNextRequest({
      method: 'POST',
      body: {
        industry: 'nonexistent',
        scenarioName: 'No such scenario',
        variables: {},
      },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Template not found' }),
      404,
      expect.anything()
    );
  });

  it('returns 500 when AI content generation fails', async () => {
    mockContentGenerator.generateWithAI.mockRejectedValue(
      new Error('AI service down')
    );

    const req = createMockNextRequest({
      method: 'POST',
      body: {
        industry: 'trades',
        scenarioName: 'After-job reveal',
        variables: { businessName: 'AcmePlumbing', location: 'Melbourne' },
      },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Content generation failed. Please try again.',
      }),
      500,
      expect.anything()
    );
  });

  it('returns 200 with generated content and engagement score on success', async () => {
    const generatedText = 'Amazing plumbing work in Melbourne! Book now.';
    mockContentGenerator.generateWithAI.mockResolvedValue(generatedText);

    const req = createMockNextRequest({
      method: 'POST',
      body: {
        industry: 'trades',
        scenarioName: 'After-job reveal',
        variables: {
          businessName: 'AcmePlumbing',
          location: 'Melbourne',
          tone: 'friendly',
        },
      },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        content: generatedText,
        score: expect.objectContaining({ score: 72, grade: 'B' }),
      }),
      200,
      expect.anything()
    );
  });

  it('interpolates template variables into the prompt before calling AI', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: {
        industry: 'trades',
        scenarioName: 'After-job reveal',
        variables: {
          businessName: 'AcmePlumbing',
          location: 'Melbourne',
          tone: 'friendly',
        },
      },
      url: 'http://localhost:3000/api/content/industry',
    });

    await POST(req as any);

    const calledPrompt = mockContentGenerator.generateWithAI.mock
      .calls[0][0] as string;
    expect(calledPrompt).toContain('AcmePlumbing');
    expect(calledPrompt).toContain('Melbourne');
    // Template placeholder should have been replaced
    expect(calledPrompt).not.toContain('{{businessName}}');
    expect(calledPrompt).not.toContain('{{location}}');
  });
});

// ---------------------------------------------------------------------------
// GET /api/content/industry/templates
// ---------------------------------------------------------------------------

describe('GET /api/content/industry/templates', () => {
  const TEMPLATE_LIST = [
    {
      id: 'tmpl-1',
      scenarioName: 'After-job reveal',
      exampleOutput: 'Output A',
    },
    {
      id: 'tmpl-2',
      scenarioName: 'Emergency availability',
      exampleOutput: 'Output B',
    },
  ];

  beforeEach(() => {
    mockSecurityCheck.mockResolvedValue(AUTHENTICATED_CONTEXT);
    mockPrisma.industryTemplate.count.mockResolvedValue(24); // non-zero = already seeded
    mockPrisma.industryTemplate.findMany.mockResolvedValue(TEMPLATE_LIST);
    mockSeedIndustryTemplates.mockResolvedValue(24);
  });

  it('returns 401 when not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/content/industry/templates?industry=trades',
    });

    await GET(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      401,
      expect.anything()
    );
  });

  it('returns 400 when industry query param is missing', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/content/industry/templates',
    });

    await GET(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Missing required query parameter: industry' },
      400,
      expect.anything()
    );
  });

  it('returns 400 when industry query param is an empty string', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/content/industry/templates?industry=',
    });

    await GET(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Missing required query parameter: industry' },
      400,
      expect.anything()
    );
  });

  it('returns 200 with templates for the requested industry', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/content/industry/templates?industry=trades',
    });

    await GET(req as any);

    expect(mockPrisma.industryTemplate.findMany).toHaveBeenCalledWith({
      where: { industry: 'trades' },
      select: { id: true, scenarioName: true, exampleOutput: true },
      orderBy: { scenarioName: 'asc' },
    });

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { templates: TEMPLATE_LIST },
      200,
      expect.anything()
    );
  });

  it('seeds templates when the table is empty, then returns results', async () => {
    mockPrisma.industryTemplate.count.mockResolvedValue(0);

    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/content/industry/templates?industry=cafe',
    });

    await GET(req as any);

    expect(mockSeedIndustryTemplates).toHaveBeenCalledTimes(1);
    expect(mockPrisma.industryTemplate.findMany).toHaveBeenCalled();
  });

  it('does not seed when templates already exist', async () => {
    mockPrisma.industryTemplate.count.mockResolvedValue(24);

    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/content/industry/templates?industry=gym',
    });

    await GET(req as any);

    expect(mockSeedIndustryTemplates).not.toHaveBeenCalled();
  });

  it('trims whitespace from the industry query param', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/content/industry/templates?industry=%20salon%20',
    });

    await GET(req as any);

    expect(mockPrisma.industryTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { industry: 'salon' } })
    );
  });
});
