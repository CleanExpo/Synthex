/**
 * Unit tests for the studio draft store (SYN-1005 / VS-6) — org-scoping enforced.
 */

import {
  saveStudioDraft,
  listStudioDrafts,
  approveStudioDraft,
  type StudioDraftDelegate,
} from '@/lib/marketing-agency/studio/draft-store';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function mockDelegate() {
  const create = jest.fn().mockResolvedValue({ id: 'd1' });
  const upsert = jest.fn().mockResolvedValue({ id: 'd1' });
  const findFirst = jest.fn().mockResolvedValue(null);
  const findMany = jest.fn().mockResolvedValue([]);
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const delegate = {
    create,
    upsert,
    findFirst,
    findMany,
    updateMany,
  } as unknown as StudioDraftDelegate;
  return { delegate, create, upsert, findFirst, findMany, updateMany };
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

  it('upserts by org + client + dedupe key without resetting approval status', async () => {
    const { delegate, create, upsert } = mockDelegate();
    await saveStudioDraft(
      {
        organizationId: 'org-A',
        clientSlug: 'carsi',
        topic: 'Did you know: CECs',
        script: 'body',
        platforms: ['linkedin'],
        dedupeKey: 'campaign:did-you-know-cecs',
      },
      delegate
    );

    expect(create).not.toHaveBeenCalled();
    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      organizationId_clientSlug_dedupeKey: {
        organizationId: 'org-A',
        clientSlug: 'carsi',
        dedupeKey: 'campaign:did-you-know-cecs',
      },
    });
    expect(args.create.status).toBe('awaiting_approval');
    expect(args.update.status).toBeUndefined();
    expect(args.update.dedupeKey).toBe('campaign:did-you-know-cecs');
  });

  it('never overwrites a draft that has left awaiting_approval: a re-seed returns the approved row untouched', async () => {
    // The approved row carries the script a human approved, the approval
    // record and the scheduled Posts. A regenerated version is a new draft.
    const { delegate, upsert, findFirst } = mockDelegate();
    const approved = {
      id: 'd1',
      status: 'approved',
      script: 'the approved body',
      metadata: { studioSchedule: { scheduled: [{ postId: 'p1' }] } },
    };
    findFirst.mockResolvedValue(approved);

    const result = await saveStudioDraft(
      {
        organizationId: 'org-A',
        clientSlug: 'carsi',
        topic: 'Did you know: CECs',
        script: 'a regenerated body nobody approved',
        platforms: ['linkedin'],
        dedupeKey: 'campaign:did-you-know-cecs',
        metadata: { externalPublishingAllowed: false },
      },
      delegate
    );

    expect(upsert).not.toHaveBeenCalled();
    expect(result).toBe(approved);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-A',
        clientSlug: 'carsi',
        dedupeKey: 'campaign:did-you-know-cecs',
      },
    });
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
    expect(args.where).toEqual({
      organizationId: 'org-A',
      clientSlug: 'restoreassist',
    });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(100); // capped
  });

  it('omits clientSlug from the filter when not provided', async () => {
    const { delegate, findMany } = mockDelegate();
    await listStudioDrafts({ organizationId: 'org-A' }, delegate);
    expect(findMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-A',
    });
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
