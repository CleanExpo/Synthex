/** @jest-environment node */
import { createOpportunityReviewService } from '@/lib/opportunity-review/service';
import { proposalFixture } from './fixtures';
import { database } from './test-store';

const context = { organizationId: 'org-one', userId: 'operator-one' };
const capture = {
  clientRequestId: 'f14a399b-d3eb-4507-9f92-736fc96aee81',
  proposal: proposalFixture,
};

test('manual capture persists a production-blocked review proposal', async () => {
  const service = createOpportunityReviewService(database());
  const saved = await service.createProposal(context, capture);
  expect(saved.item).toMatchObject({
    revision: 1,
    status: 'pending',
    approvalGate: 'production_blocked',
    scenarioState: 'blocked',
    executionBlocked: true,
    review: { state: 'pending' },
    proposal: {
      spendBoundary: { currency: 'AUD', maxSpend: 0 },
      demandValidated: false,
      revenueValidated: false,
    },
  });
  expect(await service.listProposals(context)).toEqual([saved.item]);
});

test('acceptance permits a blocked review export without approving execution', async () => {
  const service = createOpportunityReviewService(database());
  const saved = await service.createProposal(context, capture);
  const accepted = await service.reviewProposal(context, {
    id: saved.item.id,
    expectedRevision: 1,
    action: 'accept',
    note: 'Evidence supports further manual validation.',
  });
  expect(accepted).toMatchObject({
    revision: 2,
    status: 'pending',
    approvalGate: 'production_blocked',
    executionBlocked: true,
    review: { state: 'accepted' },
  });
  const bundle = await service.exportProposal(context, saved.item.id);
  expect(bundle).toMatchObject({
    version: 1,
    revision: 2,
    packetId: saved.item.id,
    executionBlocked: true,
    review: { state: 'accepted' },
    opportunity: {
      name: proposalFixture.title,
      stage: 'blocked_review',
      status: 'blocked_review',
      source: 'synthex',
      next_action: proposalFixture.nextValidationStep,
    },
  });
  expect(Object.keys(bundle).sort()).toEqual([
    'executionBlocked',
    'opportunity',
    'packetId',
    'proposal',
    'review',
    'revision',
    'version',
  ]);
});

test('a pending proposal cannot be exported', async () => {
  const service = createOpportunityReviewService(database());
  const saved = await service.createProposal(context, capture);
  await expect(
    service.exportProposal(context, saved.item.id)
  ).rejects.toMatchObject({ code: 'review_required', status: 409 });
});

test('source claims without separate Unite evidence cannot be accepted', async () => {
  const service = createOpportunityReviewService(database());
  const saved = await service.createProposal(context, {
    ...capture,
    proposal: { ...capture.proposal, uniteEvidence: [] },
  });
  await expect(
    service.reviewProposal(context, {
      id: saved.item.id,
      expectedRevision: 1,
      action: 'accept',
      note: 'Source claims alone',
    })
  ).rejects.toMatchObject({ code: 'unite_evidence_required' });
});

test('an evidence request blocks acceptance and export until new evidence is added and reviewed', async () => {
  const service = createOpportunityReviewService(database());
  const saved = await service.createProposal(context, capture);
  const requested = await service.reviewProposal(context, {
    id: saved.item.id,
    expectedRevision: 1,
    action: 'request-evidence',
    note: 'Need another independent observation.',
  });
  expect(requested.review.state).toBe('evidence_requested');
  await expect(
    service.reviewProposal(context, {
      id: saved.item.id,
      expectedRevision: 2,
      action: 'accept',
      note: 'Try acceptance too early',
    })
  ).rejects.toMatchObject({ code: 'new_evidence_required' });
  await expect(
    service.exportProposal(context, saved.item.id)
  ).rejects.toMatchObject({ code: 'review_required' });
  await expect(
    service.reviewProposal(context, {
      id: saved.item.id,
      expectedRevision: 2,
      action: 'add-evidence',
      note: 'Duplicated observation with a new date',
      uniteEvidence: [
        {
          ...proposalFixture.uniteEvidence[0],
          capturedAt: '2026-10-07T01:00:00.000Z',
        },
      ],
    })
  ).rejects.toMatchObject({ code: 'duplicate_evidence' });
  const added = await service.reviewProposal(context, {
    id: saved.item.id,
    expectedRevision: 2,
    action: 'add-evidence',
    note: 'Independent observation',
    uniteEvidence: [
      {
        reference: 'Second interview',
        observation: 'Another operator described the same friction.',
        capturedAt: '2026-10-07T01:00:00.000Z',
      },
    ],
  });
  expect(added).toMatchObject({ revision: 3, review: { state: 'pending' } });
  await expect(
    service.exportProposal(context, saved.item.id)
  ).rejects.toMatchObject({ code: 'review_required' });
  const accepted = await service.reviewProposal(context, {
    id: saved.item.id,
    expectedRevision: 3,
    action: 'accept',
    note: 'Review complete',
  });
  expect(accepted.review.state).toBe('accepted');
});

test('rejection is terminal for every subsequent review action', async () => {
  const service = createOpportunityReviewService(database());
  const saved = await service.createProposal(context, capture);
  const rejected = await service.reviewProposal(context, {
    id: saved.item.id,
    expectedRevision: 1,
    action: 'reject',
    note: 'Validation is not justified.',
  });
  expect(rejected).toMatchObject({
    status: 'blocked',
    revision: 2,
    review: { state: 'rejected' },
    executionBlocked: true,
  });
  for (const action of [
    'accept',
    'reject',
    'request-evidence',
    'add-evidence',
  ]) {
    await expect(
      service.reviewProposal(context, {
        id: saved.item.id,
        expectedRevision: 2,
        action,
        note: 'Retry review',
        ...(action === 'add-evidence'
          ? {
              uniteEvidence: [
                {
                  reference: 'New ref',
                  observation: 'New content',
                  capturedAt: '2026-10-07T01:00:00.000Z',
                },
              ],
            }
          : {}),
      })
    ).rejects.toMatchObject({ code: 'rejected_terminal' });
  }
  await expect(
    service.exportProposal(context, saved.item.id)
  ).rejects.toMatchObject({ code: 'review_required' });
});

test('capture retries are atomic and org-qualified, conflicting retries fail', async () => {
  const service = createOpportunityReviewService(database());
  const retries = await Promise.all([
    service.createProposal(context, capture),
    service.createProposal(context, capture),
  ]);
  expect(retries[0].item.id).toBe(retries[1].item.id);
  expect(retries.map(value => value.created).sort()).toEqual([false, true]);
  expect(await service.listProposals(context)).toHaveLength(1);
  await expect(
    service.createProposal(context, {
      ...capture,
      proposal: { ...proposalFixture, title: 'Conflicting capture' },
    })
  ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  const other = await service.createProposal(
    { organizationId: 'other-org', userId: 'other-user' },
    capture
  );
  expect(other.item.id).not.toBe(retries[0].item.id);
  await expect(
    service.exportProposal(
      { organizationId: 'other-org', userId: 'other-user' },
      retries[0].item.id
    )
  ).rejects.toMatchObject({ code: 'not_found' });
  await expect(
    service.reviewProposal(
      { organizationId: 'other-org', userId: 'other-user' },
      {
        id: retries[0].item.id,
        expectedRevision: 1,
        action: 'accept',
        note: 'Forbidden cross-org review',
      }
    )
  ).rejects.toMatchObject({ code: 'not_found' });
});

test('concurrent reviews at the same revision apply exactly one decision', async () => {
  const service = createOpportunityReviewService(database());
  const saved = await service.createProposal(context, capture);
  const results = await Promise.allSettled(
    ['accept', 'request-evidence'].map(action =>
      service.reviewProposal(context, {
        id: saved.item.id,
        expectedRevision: 1,
        action,
        note: 'Concurrent review',
      })
    )
  );
  expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
  const failure = results.find(
    value => value.status === 'rejected'
  ) as PromiseRejectedResult;
  expect(failure.reason).toMatchObject({ code: 'revision_conflict' });
  expect((await service.listProposals(context))[0].revision).toBe(2);
});

test('capture review and export have no network, provider or non-packet store capability', async () => {
  const network = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => {
      throw new Error('Network/provider tripwire');
    });
  const packetStore = database();
  const store = new Proxy(packetStore, {
    get(target, key, receiver) {
      if (!['commandPacket', '$transaction'].includes(String(key)))
        throw new Error(`Forbidden store capability: ${String(key)}`);
      return Reflect.get(target, key, receiver);
    },
  });
  const service = createOpportunityReviewService(store);
  const saved = await service.createProposal(context, capture);
  await service.reviewProposal(context, {
    id: saved.item.id,
    expectedRevision: 1,
    action: 'accept',
    note: 'Review only',
  });
  expect(
    (await service.exportProposal(context, saved.item.id)).executionBlocked
  ).toBe(true);
  expect(network).not.toHaveBeenCalled();
});
