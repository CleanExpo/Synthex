/**
 * approvals_list_pending must show the work a human actually has to approve
 * (seam audit 06 §B8): studio drafts awaiting approval and released-pending
 * social cuts parked in the publish queue as queued_human_gated — not only
 * MarketingAgencyClaim rows. Every query stays scoped to ctx.organizationId.
 */

const mockClaimFindMany = jest.fn();
const mockDraftFindMany = jest.fn();
const mockQueueFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgencyClaim: {
      findMany: (...a: unknown[]) => mockClaimFindMany(...a),
    },
    studioContentDraft: {
      findMany: (...a: unknown[]) => mockDraftFindMany(...a),
    },
    publishQueueItem: {
      findMany: (...a: unknown[]) => mockQueueFindMany(...a),
    },
  },
}));

import { APPROVALS_TOOLS } from '@/lib/services/ai/studio-tools/approvals-tools';

const tool = APPROVALS_TOOLS.find(t => t.name === 'approvals_list_pending')!;
const ctx = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'studio' as const,
};

beforeEach(() => {
  mockClaimFindMany.mockResolvedValue([
    {
      id: 'c1',
      campaignId: 'camp1',
      statement: '30% more leads',
      claimType: 'performance',
      approvalStatus: 'pending',
      evidenceStatus: 'blocked',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
  ]);
  mockDraftFindMany.mockResolvedValue([
    {
      id: 'd1',
      clientSlug: 'carsi',
      topic: 'Mould after floods',
      status: 'awaiting_approval',
      videoUrl: null,
      createdAt: new Date('2026-10-02T00:00:00Z'),
    },
  ]);
  mockQueueFindMany.mockResolvedValue([
    {
      id: 'q1',
      slotId: 'social-cut:cut-9',
      platform: 'instagram',
      status: 'queued_human_gated',
      scheduledAt: new Date('2026-10-03T00:00:00Z'),
      createdAt: new Date('2026-10-02T12:00:00Z'),
    },
  ]);
});

describe('approvals_list_pending lists every approval surface for the org', () => {
  it('returns the awaiting_approval studio draft and the queued_human_gated cut alongside claims', async () => {
    const out = (await tool.execute({}, ctx)) as Record<string, unknown>;
    // Validates against the declared output contract (what the MCP SDK checks).
    (tool.outputSchema as { parse: (v: unknown) => unknown }).parse(out);

    expect(out.claims).toEqual([
      expect.objectContaining({
        id: 'c1',
        createdAt: '2026-10-01T00:00:00.000Z',
      }),
    ]);
    expect(out.drafts).toEqual([
      expect.objectContaining({
        id: 'd1',
        clientSlug: 'carsi',
        status: 'awaiting_approval',
        createdAt: '2026-10-02T00:00:00.000Z',
      }),
    ]);
    expect(out.queueItems).toEqual([
      expect.objectContaining({
        id: 'q1',
        slotId: 'social-cut:cut-9',
        status: 'queued_human_gated',
        scheduledAt: '2026-10-03T00:00:00.000Z',
      }),
    ]);
  });

  it('scopes both new queries to the caller org and the human-gated status', async () => {
    await tool.execute({}, ctx);
    expect(mockDraftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org1', status: 'awaiting_approval' },
      })
    );
    expect(mockQueueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org1', status: 'queued_human_gated' },
      })
    );
  });
});
