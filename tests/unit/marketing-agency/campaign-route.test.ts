import { POST } from '@/app/api/marketing-agency/campaigns/route';
import { generateToken } from '@/lib/auth/jwt-utils';
import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { prisma } from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: { campaign: { create: jest.fn() } },
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: jest.fn(),
}));

const mockCreate = jest.mocked(prisma.campaign.create);
const mockOrgId = jest.mocked(getEffectiveOrganizationId);

const VALID_INPUT = {
  campaignId: 'camp-2026-06',
  business: {
    slug: 'restoreassist',
    name: 'RestoreAssist',
    positioning: 'Disaster recovery experts',
    audience: ['property managers'],
    offers: ['water damage restoration'],
    voiceRules: ['authoritative'],
    forbiddenClaims: ['guaranteed insurance payout'],
  },
  objective: 'Establish category authority in 14 days',
  operatingMandate: 'Owned-media only; evidence-backed claims',
  sources: [
    { id: 's1', label: 'IICRC standard', sourceType: 'standard', checkedAt: '2026-06-16' },
  ],
};

describe('marketing agency campaign route', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    // @ts-expect-error — minimal Campaign row for the test
    mockCreate.mockResolvedValue({ id: 'camp-123' });
    mockOrgId.mockReset();
    mockOrgId.mockResolvedValue('org-1');
  });

  it('returns 401 when unauthenticated', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost/api/marketing-agency/campaigns',
      method: 'POST',
      body: VALID_INPUT,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorised');
  });

  it('returns 400 when the input is invalid', async () => {
    const token = generateToken({ userId: 'user-1', email: 'user@example.com' });
    const request = createMockNextRequest({
      url: 'http://localhost/api/marketing-agency/campaigns',
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { campaignId: 'x' }, // missing business/objective/operatingMandate
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it('generates a real authority campaign and persists it (no mock)', async () => {
    const token = generateToken({ userId: 'user-1', email: 'user@example.com' });
    const request = createMockNextRequest({
      url: 'http://localhost/api/marketing-agency/campaigns',
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: VALID_INPUT,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    // DB-backed id, not a mock fixture
    expect(body.campaignId).toBe('camp-123');
    // real generator output (a populated calendar)
    expect(Array.isArray(body.campaignPack.calendar)).toBe(true);
    expect(body.campaignPack.calendar.length).toBeGreaterThan(0);
    // persisted org-scoped to the existing Campaign model
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0] as {
      data: { userId: string; organizationId: string | null; content: unknown };
    };
    expect(createArg.data.userId).toBe('user-1');
    expect(createArg.data.organizationId).toBe('org-1');
    expect(createArg.data.content).toBeDefined();
  });
});
