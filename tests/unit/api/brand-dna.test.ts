import { POST } from '@/app/api/brand-dna/extract/route';
import { createMockNextRequest } from '../../helpers/mock-request';

// Mock auth — use function wrappers so resetMocks doesn't break them
const mockGetUserId = jest.fn();
const mockUnauthorizedResponse = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: (...args: unknown[]) =>
    mockUnauthorizedResponse(...args),
}));

// Mock business scope
const mockGetEffectiveOrgId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrgId(...args),
}));

// Mock extractor (don't hit real AI or DB)
const mockExtractAndPersist = jest.fn();
jest.mock('@/lib/brand-dna/extractor', () => ({
  extractAndPersistBrandDNA: (...args: unknown[]) =>
    mockExtractAndPersist(...args),
}));

// Mock post preview
const mockGeneratePreview = jest.fn();
jest.mock('@/lib/brand-dna/post-preview', () => ({
  generateInstantPostPreview: (...args: unknown[]) =>
    mockGeneratePreview(...args),
}));

// Mock website partial scrape (for business name)
const mockAnalyzeWebsite = jest.fn();
jest.mock('@/lib/ai/website-analyzer', () => ({
  analyzeWebsite: (...args: unknown[]) => mockAnalyzeWebsite(...args),
}));

describe('POST /api/brand-dna/extract', () => {
  beforeEach(() => {
    // Re-apply implementations after resetMocks clears them
    mockGetUserId.mockResolvedValue('user-123');
    mockGetEffectiveOrgId.mockResolvedValue('org-123');
    mockExtractAndPersist.mockResolvedValue(undefined);
    mockGeneratePreview.mockResolvedValue("Test post for Jake's Café");
    mockAnalyzeWebsite.mockResolvedValue({
      businessName: "Jake's Café",
      industry: 'café',
      heroCopy: 'Best coffee in Melbourne',
    });
    const { NextResponse } = require('next/server');
    mockUnauthorizedResponse.mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
  });

  it('returns 400 for missing url', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: {},
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 with preview and extracting status', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: 'https://jakes-cafe.com.au' },
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('extracting');
    expect(data.preview.firstPost).toBeTruthy();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValueOnce(null);
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: 'https://example.com' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
