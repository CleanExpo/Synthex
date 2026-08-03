import { createMockNextRequest } from '../../helpers/mock-request';

const mockRunPipeline = jest.fn();
const mockAssertExternalUrlSafe = jest.fn();
const mockCreateScan = jest.fn();
const mockUpdateScans = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/ai/onboarding-pipeline', () => ({
  runOnboardingPipeline: mockRunPipeline,
}));
jest.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve({ ok: true })),
  extractClientIp: jest.fn(() => '1.2.3.4'),
}));
jest.mock('@/lib/security/validate-url', () => ({
  assertExternalUrlSafe: mockAssertExternalUrlSafe,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    opportunityMapScan: {
      create: mockCreateScan,
      updateMany: mockUpdateScans,
    },
    $transaction: mockTransaction,
  },
}));

import { checkRateLimit } from '@/lib/auth/rate-limit';

const mockCheckRateLimit = checkRateLimit as jest.Mock;

function request(
  path: string,
  body: unknown,
  origin = 'http://localhost:3000'
) {
  return createMockNextRequest({
    method: 'POST',
    url: `http://localhost:3000${path}`,
    headers: { origin, 'content-type': 'application/json' },
    body,
  });
}

const analysis = {
  businessName: 'Acme Restoration',
  industry: 'agency',
  description: 'Commercial restoration services.',
  teamSize: 'small',
  logoUrl: null,
  faviconUrl: null,
  brandColours: { primary: '' },
  seoSignals: {
    title: 'Acme',
    metaDescription: 'Commercial restoration services.',
    h1: 'Commercial restoration',
    h1Count: 1,
    h2Count: 2,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    imagesWithoutAlt: 0,
    totalImages: 1,
    wordCount: 500,
  },
  seoScore: 60,
  pageSpeed: { mobile: null, desktop: null },
  overallHealth: 'good',
  healthSummary: 'Solid foundation.',
  quickWins: [],
  contentGaps: [],
  keywordOpportunities: [],
  socialProfiles: [],
  socialHandles: {},
  keyTopics: ['restoration'],
  targetAudience: 'Property managers',
  suggestedTone: 'professional',
  suggestedPersonaName: 'Acme',
  confidence: 72,
  dataRequired: [],
  sampleCaption: null,
  structuredData: {},
  url: 'https://acme.example.com',
};

describe('Opportunity Map public routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockAssertExternalUrlSafe.mockResolvedValue(undefined);
    mockRunPipeline.mockResolvedValue(analysis);
    mockCreateScan.mockResolvedValue({ id: 'scan_123456789' });
    mockUpdateScans.mockResolvedValue({ count: 1 });
    process.env.MARKETING_LEADS_ORG_ID = 'org-marketing';
  });

  afterEach(() => delete process.env.MARKETING_LEADS_ORG_ID);

  it('guards the website before intelligence runs and persists the shown map', async () => {
    const { POST } = await import('@/app/api/opportunity-map/route');
    const response = await POST(
      request('/api/opportunity-map', {
        businessName: 'Acme Restoration',
        context: 'https://acme.example.com\nWe need more commercial enquiries.',
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockAssertExternalUrlSafe).toHaveBeenCalledWith(
      'https://acme.example.com'
    );
    expect(mockAssertExternalUrlSafe.mock.invocationCallOrder[0]).toBeLessThan(
      mockRunPipeline.mock.invocationCallOrder[0]
    );
    expect(mockCreateScan).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fitScore: body.map.fit.score }),
      })
    );
  });

  it('rejects cross-origin scans before any website or model work', async () => {
    const { POST } = await import('@/app/api/opportunity-map/route');
    const response = await POST(
      request(
        '/api/opportunity-map',
        { context: 'https://acme.example.com' },
        'https://attacker.example'
      ) as never
    );

    expect(response.status).toBe(403);
    expect(mockAssertExternalUrlSafe).not.toHaveBeenCalled();
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  it('creates one consent-bound qualified Lead and links the scan atomically', async () => {
    const tx = {
      opportunityMapScan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'scan_123456789',
          businessName: 'Acme Restoration',
          website: 'https://acme.example.com',
          fitState: 'qualified',
          source: null,
          medium: null,
          campaign: null,
          leadId: null,
          result: {
            fit: { score: 72, state: 'qualified' },
            opportunities: [],
            serviceRecommendation: {},
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      lead: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'lead_123', stage: 'qualified' }),
      },
    };
    mockTransaction.mockImplementation(callback => callback(tx));
    const { POST } = await import('@/app/api/opportunity-map/handoff/route');
    const response = await POST(
      request('/api/opportunity-map/handoff', {
        scanId: 'scan_123456789',
        name: 'Alex Example',
        email: 'alex@example.com',
        consent: true,
      }) as never
    );

    expect(response.status).toBe(200);
    expect(tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-marketing',
          stage: 'qualified',
          rawPayload: expect.objectContaining({
            consent: expect.objectContaining({
              policyVersion: 'nexus-opportunity-map-contact-v1',
            }),
          }),
        }),
      })
    );
    expect(tx.opportunityMapScan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: 'lead_123' }),
      })
    );
  });

  it('rejects a handoff without literal consent before opening a transaction', async () => {
    const { POST } = await import('@/app/api/opportunity-map/handoff/route');
    const response = await POST(
      request('/api/opportunity-map/handoff', {
        scanId: 'scan_123456789',
        name: 'Alex Example',
        email: 'alex@example.com',
        consent: false,
      }) as never
    );

    expect(response.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('stores explicit usefulness feedback without creating a Lead', async () => {
    const { POST } = await import('@/app/api/opportunity-map/feedback/route');
    const response = await POST(
      request('/api/opportunity-map/feedback', {
        scanId: 'scan_123456789',
        useful: false,
        missing: 'I could not see how the recommendation would create leads.',
      }) as never
    );

    expect(response.status).toBe(200);
    expect(mockUpdateScans).toHaveBeenCalledWith({
      where: { id: 'scan_123456789' },
      data: expect.objectContaining({
        feedbackUseful: false,
        feedbackMissing:
          'I could not see how the recommendation would create leads.',
        feedbackSubmittedAt: expect.any(Date),
      }),
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('requires an explanation when the map was not useful', async () => {
    const { POST } = await import('@/app/api/opportunity-map/feedback/route');
    const response = await POST(
      request('/api/opportunity-map/feedback', {
        scanId: 'scan_123456789',
        useful: false,
      }) as never
    );

    expect(response.status).toBe(400);
    expect(mockUpdateScans).not.toHaveBeenCalled();
  });
});
