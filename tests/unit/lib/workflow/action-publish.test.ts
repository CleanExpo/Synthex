/**
 * Unit tests for the action-publish step (SYN-972).
 *
 * This step records publish INTENT after the human gate — it does not publish.
 * It must not fabricate a platformPostId or a publishedAt (that would falsely
 * assert a publication and pollute the audit trail). Pin the honest output.
 */
import { execute } from '@/lib/workflow/step-types/action-publish';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

function ctx(content: unknown) {
  return {
    stepDefinition: {} as never,
    priorOutputs: [{ stepType: 'ai', output: content }],
    stepIndex: 6,
    totalSteps: 7,
  } as unknown as Parameters<typeof execute>[1];
}

const stepDef = {
  name: 'Publish to platform',
  type: 'action',
  config: { platform: 'linkedin' },
} as unknown as Parameters<typeof execute>[0];

describe('action-publish step', () => {
  it('records honest publish intent — no fabricated post id, no false publishedAt', async () => {
    const result = await execute(stepDef, ctx({ content: 'final copy' }));
    expect(result.success).toBe(true);
    const out = (result as { output: Record<string, unknown> }).output;

    expect(out.status).toBe('awaiting_publish');
    expect(out.platform).toBe('linkedin');
    expect(out.content).toEqual({ content: 'final copy' });
    // The lies are gone:
    expect(out).not.toHaveProperty('platformPostId');
    expect(out).not.toHaveProperty('publishedAt');
    // Honest provenance instead:
    expect(typeof out.intentRecordedAt).toBe('string');
    expect(out.note).toMatch(/no post created yet/i);
  });

  it('defaults the platform to unknown when none is configured', async () => {
    const result = await execute(
      { name: 'Publish', type: 'action', config: {} } as unknown as Parameters<typeof execute>[0],
      ctx('x'),
    );
    const out = (result as { output: Record<string, unknown> }).output;
    expect(out.platform).toBe('unknown');
  });
});
