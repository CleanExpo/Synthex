import { POST } from '@/app/api/brand-dna/extract/route';
import { createMockNextRequest } from '../../helpers/mock-request';

// Mock auth
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn().mockResolvedValue('user-123'),
  unauthorizedResponse: jest.fn(
    () => new Response('Unauthorized', { status: 401 })
  ),
}));

// Mock business scope
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn().mockResolvedValue('org-123'),
}));

// Mock extractor (don't hit real AI or DB)
jest.mock('@/lib/brand-dna/extractor', () => ({
  extractAndPersistBrandDNA: jest.fn().mockResolvedValue(undefined),
}));

// Mock post preview
jest.mock('@/lib/brand-dna/post-preview', () => ({
  generateInstantPostPreview: jest
    .fn()
    .mockResolvedValue("Test post for Jake's Café"),
}));

// Mock website partial scrape (for business name)
jest.mock('@/lib/ai/website-analyzer', () => ({
  analyzeWebsite: jest.fn().mockResolvedValue({
    businessName: "Jake's Café",
    industry: 'café',
    heroCopy: 'Best coffee in Melbourne',
  }),
}));

describe('POST /api/brand-dna/extract', () => {
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
    const { getUserIdFromRequestOrCookies } = require('@/lib/auth/jwt-utils');
    getUserIdFromRequestOrCookies.mockResolvedValueOnce(null);
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: 'https://example.com' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
