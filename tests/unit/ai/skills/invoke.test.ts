/**
 * `invokeSkill` — the boundary the product calls through.
 *
 * The provider is mocked so these assert wiring and refusal, not model output:
 * that the allowlist is enforced before any filesystem access, that the
 * compiled skill arrives as the system message with the caller's prompt kept
 * separate, and that an unreadable foundation document is surfaced to the
 * caller rather than swallowed.
 */

import { invokeSkill, SkillNotInvocableError } from '@/lib/ai/skills';

const complete = jest.fn();

jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    name: 'Mock',
    models: {
      fast: 'mock-fast',
      balanced: 'mock-balanced',
      creative: 'mock-creative',
      premium: 'mock-premium',
      code: 'mock-code',
      free: 'mock-free',
    },
    complete,
    stream: jest.fn(),
  }),
}));

function respondWith(content: string) {
  complete.mockResolvedValue({
    id: 'mock-1',
    model: 'mock-balanced',
    choices: [
      { message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

beforeEach(() => {
  complete.mockReset();
  respondWith('SKILL OUTPUT');
});

describe('invokeSkill — allowlist', () => {
  it('refuses a skill that exists but is not product-invocable', async () => {
    // build-orchestrator is a real skill whose instructions assume shell access.
    await expect(
      invokeSkill({ skill: 'build-orchestrator', prompt: 'go' })
    ).rejects.toThrow(SkillNotInvocableError);

    expect(complete).not.toHaveBeenCalled();
  });

  it('refuses a traversal attempt without touching the filesystem', async () => {
    await expect(
      invokeSkill({ skill: '../../etc/passwd', prompt: 'go' })
    ).rejects.toThrow(SkillNotInvocableError);

    expect(complete).not.toHaveBeenCalled();
  });
});

describe('invokeSkill — request shape', () => {
  it('sends the compiled skill as system and the caller prompt as user', async () => {
    await invokeSkill({
      skill: 'senior-strategist',
      prompt: 'Plan the Q3 launch.',
    });

    expect(complete).toHaveBeenCalledTimes(1);
    const request = complete.mock.calls[0][0];

    expect(request.messages).toHaveLength(2);
    expect(request.messages[0].role).toBe('system');
    expect(request.messages[0].content).toContain('senior-strategist');
    expect(request.messages[1]).toEqual({
      role: 'user',
      content: 'Plan the Q3 launch.',
    });
  });

  it('defaults to the balanced preset and honours an override', async () => {
    await invokeSkill({ skill: 'senior-strategist', prompt: 'x' });
    expect(complete.mock.calls[0][0].model).toBe('mock-balanced');

    await invokeSkill({
      skill: 'senior-strategist',
      prompt: 'x',
      model: 'mock-premium',
    });
    expect(complete.mock.calls[1][0].model).toBe('mock-premium');
  });

  it('enables prompt caching, since the system prompt repeats across calls', async () => {
    await invokeSkill({ skill: 'senior-strategist', prompt: 'x' });

    expect(complete.mock.calls[0][0].cache).toBe(true);
  });
});

describe('invokeSkill — result', () => {
  it('returns the model content with the skill it ran', async () => {
    const result = await invokeSkill({
      skill: 'senior-copywriter',
      prompt: 'Draft a headline.',
    });

    expect(result.content).toBe('SKILL OUTPUT');
    expect(result.skill.slug).toBe('senior-copywriter');
    expect(result.usage?.total_tokens).toBe(15);
  });

  it('reports an unreadable foundation document instead of hiding it', async () => {
    // marketing-operations-director cites tier-b-engineering-specs.md, which
    // has never been written. The caller must be able to see that.
    const result = await invokeSkill({
      skill: 'marketing-operations-director',
      prompt: 'x',
    });

    expect(result.foundationMissing).toContain('tier-b-engineering-specs.md');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('reports which foundation documents were trimmed to fit', async () => {
    const result = await invokeSkill({
      skill: 'senior-strategist',
      prompt: 'x',
    });

    expect(
      result.foundationIncluded.find(f => f.filename === 'ceo-foundation.md')
    ).toEqual({ filename: 'ceo-foundation.md', truncated: true });
  });
});
