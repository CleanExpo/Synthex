/** @jest-environment node */
import { ProposalInputSchema } from '@/lib/opportunity-review/schema';
import { proposalFixture } from './fixtures';

test('capture rejects forged execution or economics metadata', () => {
  expect(
    ProposalInputSchema.safeParse({
      ...proposalFixture,
      executionBlocked: false,
    }).success
  ).toBe(false);
});

test('source URLs containing credentials are rejected before capture', () => {
  expect(
    ProposalInputSchema.safeParse({
      ...proposalFixture,
      sources: [
        {
          ...proposalFixture.sources[0],
          url: 'https://operator:secret@example.com/source',
        },
      ],
    }).success
  ).toBe(false);
});

test('oversized proposal content is rejected before persisting an unimportable export', () => {
  const oversized = {
    ...proposalFixture,
    sources: Array.from({ length: 20 }, () => ({
      ...proposalFixture.sources[0],
      claims: Array.from({ length: 20 }, () => 'a'.repeat(2000)),
    })),
  };
  expect(ProposalInputSchema.safeParse(oversized).success).toBe(false);
});

test('malformed and executable source URLs fail validation without throwing', () => {
  for (const url of [
    'not-a-url',
    'javascript:alert(1)',
    'data:text/html,test',
  ]) {
    expect(
      ProposalInputSchema.safeParse({
        ...proposalFixture,
        sources: [{ ...proposalFixture.sources[0], url }],
      }).success
    ).toBe(false);
  }
});
