/**
 * Unit tests for the ai-generate workflow step (AT-002 skill wiring).
 */
import { execute } from '@/lib/workflow/step-types/ai-generate';
import type { StepContext, WorkflowStepDefinition } from '@/lib/workflow/types';

jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(),
}));

jest.mock('@/lib/ai/skills', () => ({
  invokeSkill: jest.fn(),
}));

import { getAIProvider } from '@/lib/ai/providers';
import { invokeSkill } from '@/lib/ai/skills';

const mockGetAIProvider = getAIProvider as jest.Mock;
const mockInvokeSkill = invokeSkill as jest.Mock;

function baseContext(overrides: Partial<StepContext> = {}): StepContext {
  return {
    stepDefinition: {} as WorkflowStepDefinition,
    priorOutputs: [],
    stepIndex: 2,
    totalSteps: 7,
    workflowInput: { goal: 'Announce the new service line' },
    ...overrides,
  };
}

describe('ai-generate workflow step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes through invokeSkill when config.skill is set (AT-002)', async () => {
    mockInvokeSkill.mockResolvedValue({
      skill: { slug: 'senior-copywriter', name: 'Senior Copywriter' },
      content: 'Draft copy for the campaign.',
      model: 'claude-haiku',
      foundationIncluded: [],
      foundationMissing: [],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

    const stepDef: WorkflowStepDefinition = {
      name: 'Generate content',
      type: 'ai',
      promptTemplate: 'Write content based on this brief:\n\n{{workflowInput}}',
      config: { skill: 'senior-copywriter' },
    };

    const result = await execute(stepDef, baseContext());

    expect(mockInvokeSkill).toHaveBeenCalledTimes(1);
    expect(mockInvokeSkill).toHaveBeenCalledWith({
      skill: 'senior-copywriter',
      prompt: expect.stringContaining('Announce the new service line'),
    });
    expect(mockGetAIProvider).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      tokensUsed: 30,
      output: {
        content: 'Draft copy for the campaign.',
        metadata: {
          model: 'claude-haiku',
          tokensUsed: 30,
          skill: 'senior-copywriter',
        },
      },
    });
  });

  test('keeps legacy provider.complete path when no skill is configured', async () => {
    const complete = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Legacy draft' } }],
      model: 'auto',
      usage: { total_tokens: 12 },
    });
    mockGetAIProvider.mockReturnValue({ complete });

    const stepDef: WorkflowStepDefinition = {
      name: 'Generate content',
      type: 'ai',
      promptTemplate: 'Generate content for: {{workflowInput}}',
    };

    const result = await execute(stepDef, baseContext());

    expect(mockInvokeSkill).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      tokensUsed: 12,
      output: {
        content: 'Legacy draft',
        metadata: { model: 'auto', tokensUsed: 12 },
      },
    });
  });

  test('returns non-terminal failure when invokeSkill throws', async () => {
    mockInvokeSkill.mockRejectedValue(new Error('Provider unavailable'));

    const stepDef: WorkflowStepDefinition = {
      name: 'Generate content',
      type: 'ai',
      promptTemplate: '{{workflowInput}}',
      config: { skill: 'senior-copywriter' },
    };

    const result = await execute(stepDef, baseContext());

    expect(result).toEqual({
      success: false,
      error: 'Provider unavailable',
      terminal: false,
    });
  });
});
