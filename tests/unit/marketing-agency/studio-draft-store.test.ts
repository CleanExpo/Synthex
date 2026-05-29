/**
 * Unit tests for the studio draft store (SYN-1005 / VS-6) — org-scoping enforced.
 */

import {
  saveStudioDraft,
  listStudioDrafts,
  approveStudioDraft,
  type StudioDraftDelegate,
} from '@/lib/marketing-agency/studio/draft-store';

function mockDelegate() {
  const create = jest.fn().mockResolvedValue({ id: 'd1' });
  const findMany = jest.fn().mockResolvedValue([]);
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const delegate = { create, findMany, updateMany } as unknown as StudioDraftDelegate;
  return { delegate, create, findMany, updateMany };
}

describe('saveStudioDraft', () => {
  it('creates an org-scoped draft in awaiting_approval', async () => {
    const { delegate, create } = mockDelegate();
    await saveStudioDraft(
      {
        organizationId: 'org-A',
        clientSlug: 'restoreassist',
        topic: 'Response times',
        script: 'body',
        platforms: ['linkedin', 'youtube'],
      },
      delegate
    );
    const data = create.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-A');
    expect(data.status).toBe('awaiting_approval');
    expect(data.platforms).toEqual(['linkedin', 'youtube']);
    expect(data.videoProvider).toBe('heygen');
  });
});

describe('listStudioDrafts', () => {
  it('scopes by org + client and caps the limit', async () => {
    const { delegate, findMany } = mockDelegate();
    await listStudioDrafts(
      { organizationId: 'org-A', clientSlug: 'restoreassist', limit: 999 },
      delegate
    );
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: 'org-A', clientSlug: 'restoreassist' });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(100); // capped
  });

  it('omits clientSlug from the filter when not provided', async () => {
    const { delegate, findMany } = mockDelegate();
    await listStudioDrafts({ organizationId: 'org-A' }, delegate);
    expect(findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org-A' });
  });
});

describe('approveStudioDraft (human-approval gate)', () => {
  it('updates only when id + org + awaiting_approval match, and returns the count', async () => {
    const { delegate, updateMany } = mockDelegate();
    const count = await approveStudioDraft(
      { organizationId: 'org-A', id: 'd1', approvedBy: 'phill' },
      delegate
    );
    expect(count).toBe(1);
    const args = updateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      id: 'd1',
      organizationId: 'org-A',
      status: 'awaiting_approval',
    });
    expect(args.data.status).toBe('approved');
    expect(args.data.approvedBy).toBe('phill');
  });

  it('returns 0 for a cross-org approval attempt (org is in the WHERE clause)', async () => {
    const { delegate, updateMany } = mockDelegate();
    updateMany.mockResolvedValue({ count: 0 }); // wrong org → no row matched
    const count = await approveStudioDraft(
      { organizationId: 'org-B', id: 'd1', approvedBy: 'attacker' },
      delegate
    );
    expect(count).toBe(0);
    expect(updateMany.mock.calls[0][0].where.organizationId).toBe('org-B');
  });
});
