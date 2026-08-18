import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserIdFromRequestOrCookies = jest.fn();
const mockGetEffectiveOrganizationId = jest.fn();
const mockGenerateCampaignConceptStudio = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => {
  const actual = jest.requireActual('@/lib/auth/jwt-utils');
  return {
    __esModule: true,
    ...actual,
    getUserIdFromRequestOrCookies: (...args: unknown[]) =>
      mockGetUserIdFromRequestOrCookies(...args),
  };
});

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/services/campaign-concept-studio', () => {
  const actual = jest.requireActual('@/lib/services/campaign-concept-studio');
  return {
    __esModule: true,
    ...actual,
    generateCampaignConceptStudio: (...args: unknown[]) =>
      mockGenerateCampaignConceptStudio(...args),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { POST } from '@/app/api/campaign-concept-studio/generate/route';
import { __resetCampaignStudioRateLimitForTests } from '@/app/api/campaign-concept-studio/generate/route';
import { CAMPAIGN_STUDIO_CHANNELS } from '@/lib/types/campaign-concept-studio';

const VALID_REQUEST = {
  campaignBrief: 'Launch a spring campaign for our new product feature.',
  targetAudience: 'Local service businesses and their decision makers.',
  productDetails:
    'An AI assistant that drafts creative variants and automatically schedules posts across social channels.',
  tone: 'confident',
  channels: [CAMPAIGN_STUDIO_CHANNELS[0], CAMPAIGN_STUDIO_CHANNELS[1]],
};

const SERVICE_RESPONSE = {
  concept: {
    concept: 'High-impact campaign bundle',
    positioning: 'Reliable, easy-to-use campaign planning',
    valueProposition: 'Reduce launch prep by automating first draft assets',
  },
  copyVariants: [
    { headline: 'Variant 1', body: 'Launch fast with confidence.' },
    { headline: 'Variant 2', body: 'Ship your campaign in one pass.' },
    { headline: 'Variant 3', body: 'Built for teams that move quickly.' },
  ],
  launchChecklist: ['Review copy in legal voice', 'Upload brand assets'],
  imagePrompts: [
    {
      channel: CAMPAIGN_STUDIO_CHANNELS[0],
      prompt: 'Hero shot of modern team planning campaign',
      status: 'ready',
      imageUrl: 'https://example.com/image.svg',
      providerImageModel: 'gpt-image-1',
    },
  ],
  model: { textModel: 'gpt-4.1', imageModel: 'gpt-image-1' },
  usage: {
    inputTokens: 120,
    outputTokens: 450,
    totalTokens: 570,
  },
};

function request(body: unknown) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/campaign-concept-studio/generate',
    body,
  });
}

describe('POST /api/campaign-concept-studio/generate', () => {
  beforeEach(() => {
    __resetCampaignStudioRateLimitForTests();
    process.env.CAMPAIGN_STUDIO_RATE_LIMIT_PER_MINUTE = '20';
    jest.clearAllMocks();
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
    mockGenerateCampaignConceptStudio.mockResolvedValue(SERVICE_RESPONSE);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

    const res = await POST(request(VALID_REQUEST));

    expect(res.status).toBe(401);
    expect(mockGenerateCampaignConceptStudio).not.toHaveBeenCalled();
  });

  it('returns 403 when no organisation is available', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);

    const res = await POST(request(VALID_REQUEST));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('No organisation resolved');
    expect(mockGenerateCampaignConceptStudio).not.toHaveBeenCalled();
  });

  it('returns 400 when request JSON is malformed', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/campaign-concept-studio/generate',
        body: '{broken-json',
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 when request validation fails', async () => {
    const res = await POST(
      request({
        campaignBrief: 'short',
        targetAudience: 'short',
        productDetails: 'short',
        tone: 'confident',
        channels: [],
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();

    expect(json.error).toBe('Validation failed');
    expect(json.details).toMatchObject({
      campaignBrief: expect.any(Array),
      targetAudience: expect.any(Array),
      productDetails: expect.any(Array),
      channels: expect.any(Array),
    });
  });

  it('returns 500 when generator returns an invalid response contract', async () => {
    mockGenerateCampaignConceptStudio.mockResolvedValue({
      ...SERVICE_RESPONSE,
      model: {
        textModel: 'gpt-4.1',
      },
    });

    const res = await POST(request(VALID_REQUEST));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe(
      'Unexpected payload shape returned by generator service'
    );
    expect(json.details).toMatchObject({
      model: expect.any(Array),
    });
  });

  it('calls the generator with enriched context and returns a validated payload', async () => {
    const res = await POST(request(VALID_REQUEST));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.payload.concept.concept).toBe(SERVICE_RESPONSE.concept.concept);
    expect(json.payload.copyVariants).toHaveLength(3);

    expect(mockGenerateCampaignConceptStudio).toHaveBeenCalledTimes(1);
    const [, context] = mockGenerateCampaignConceptStudio.mock.calls[0];

    expect(context.userId).toBe('user-1');
    expect(context.organizationId).toBe('org-1');
    expect(typeof context.traceId).toBe('string');
    expect(context.traceId).toMatch(/^[0-9a-fA-F-]{36}$/);
  });

  it('returns 502 when generation fails', async () => {
    mockGenerateCampaignConceptStudio.mockRejectedValue(
      new Error('OpenAI gateway unavailable')
    );

    const res = await POST(request(VALID_REQUEST));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe('OpenAI gateway unavailable');
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    process.env.CAMPAIGN_STUDIO_RATE_LIMIT_PER_MINUTE = '1';

    const first = await POST(request(VALID_REQUEST));
    expect(first.status).toBe(200);

    const second = await POST(request(VALID_REQUEST));
    const json = await second.json();

    expect(second.status).toBe(429);
    expect(json.error).toBe(
      'Request limit exceeded. Please wait before generating another campaign concept.'
    );
    expect(second.headers.get('retry-after')).toBe('60');

    expect(mockGenerateCampaignConceptStudio).toHaveBeenCalledTimes(1);
  });
});
