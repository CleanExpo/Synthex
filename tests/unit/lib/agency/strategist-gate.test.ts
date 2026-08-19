/**
 * AT-004 — senior-strategist final-gate before CEO queue.
 */

import {
  decisionClearsCeoQueue,
  isStrategistClearance,
  parseStrategistDecision,
  priorBrandVoicePassed,
  runStrategistGate,
} from '@/lib/agency/strategist-gate';

jest.mock('@/lib/ai/skills', () => ({
  invokeSkill: jest.fn(),
}));

import { invokeSkill } from '@/lib/ai/skills';

const mockInvoke = invokeSkill as jest.MockedFunction<typeof invokeSkill>;

describe('strategist-gate helpers', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  test('priorBrandVoicePassed requires brand-voice-enforce pass', () => {
    expect(priorBrandVoicePassed([])).toBe(false);
    expect(
      priorBrandVoicePassed([
        { output: { gate: 'brand-voice-enforce', pass: false } },
      ])
    ).toBe(false);
    expect(
      priorBrandVoicePassed([
        { output: { gate: 'brand-voice-enforce', pass: true } },
      ])
    ).toBe(true);
  });

  test('parseStrategistDecision extracts routing from fenced JSON', () => {
    const content = [
      'Prose for the CEO.',
      '```json',
      JSON.stringify({
        routing_decision: {
          action: 'proceed',
          next_skill: 'ceo-batch-queue',
        },
        ceo_attention_required: false,
      }),
      '```',
    ].join('\n');

    expect(parseStrategistDecision(content)).toEqual({
      action: 'proceed',
      nextSkill: 'ceo-batch-queue',
      ceoAttentionRequired: false,
      reason: undefined,
    });
  });

  test('decisionClearsCeoQueue only for proceed/escalate paths', () => {
    expect(
      decisionClearsCeoQueue({
        action: 'proceed',
        nextSkill: 'ceo-batch-queue',
      })
    ).toBe(true);
    expect(
      decisionClearsCeoQueue({ action: 'escalate-to-ceo', nextSkill: null })
    ).toBe(true);
    expect(
      decisionClearsCeoQueue({
        action: 'hold',
        nextSkill: 'ceo-batch-queue',
      })
    ).toBe(false);
    expect(
      decisionClearsCeoQueue({ action: 'unparseable', nextSkill: null })
    ).toBe(false);
  });

  test('isStrategistClearance requires AT-004 pass stamp', () => {
    expect(
      isStrategistClearance({
        gate: 'senior-strategist',
        agencyTaskId: 'AT-004',
        pass: true,
      })
    ).toBe(true);
    expect(
      isStrategistClearance({
        gate: 'senior-strategist',
        agencyTaskId: 'AT-004',
        pass: false,
      })
    ).toBe(false);
    expect(
      isStrategistClearance({ gate: 'brand-voice-enforce', pass: true })
    ).toBe(false);
  });

  test('runStrategistGate holds when brand voice has not passed', async () => {
    const stamp = await runStrategistGate({
      draft: 'Hello',
      brandVoicePassed: false,
    });
    expect(stamp.pass).toBe(false);
    expect(stamp.reason).toBe('brand_voice_not_passed');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('runStrategistGate stamps pass when strategist proceeds to CEO queue', async () => {
    mockInvoke.mockResolvedValue({
      skill: { slug: 'senior-strategist', name: 'Senior Strategist' },
      content: JSON.stringify({
        routing_decision: {
          action: 'proceed',
          next_skill: 'ceo-batch-queue',
        },
        ceo_attention_required: false,
      }),
      model: 'test-model',
      foundationIncluded: [],
      foundationMissing: [],
    });

    const stamp = await runStrategistGate({
      draft: 'Ready draft',
      organizationId: 'org-1',
      brandVoicePassed: true,
    });

    expect(stamp.pass).toBe(true);
    expect(stamp.gate).toBe('senior-strategist');
    expect(stamp.agencyTaskId).toBe('AT-004');
    expect(stamp.action).toBe('proceed');
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'senior-strategist' })
    );
  });

  test('runStrategistGate fail-closed on unparseable skill output', async () => {
    mockInvoke.mockResolvedValue({
      skill: { slug: 'senior-strategist', name: 'Senior Strategist' },
      content: 'Just some prose without a decision contract.',
      model: 'test-model',
      foundationIncluded: [],
      foundationMissing: [],
    });

    const stamp = await runStrategistGate({
      draft: 'Ready draft',
      brandVoicePassed: true,
    });

    expect(stamp.pass).toBe(false);
    expect(stamp.action).toBe('unparseable');
  });
});
