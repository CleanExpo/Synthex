const mockComplete = jest.fn();
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    models: { fast: 'fast-model', balanced: 'balanced-model' },
    complete: (...a: unknown[]) => mockComplete(...a),
  }),
}));

import { enhancePrompt } from '@/lib/services/ai/video/prompt-enhancer';

beforeEach(() => {
  jest.clearAllMocks();
  mockComplete.mockResolvedValue({
    choices: [
      {
        message: {
          content: 'a cinematic dolly-in shot of a meter, golden light',
        },
      },
    ],
  });
});

describe('prompt enhancer', () => {
  it('returns the LLM expansion', async () => {
    const out = await enhancePrompt('a moisture meter');
    expect(out).toContain('cinematic');
    const call = mockComplete.mock.calls[0][0] as { max_tokens: number };
    expect(call.max_tokens).toBeLessThanOrEqual(300); // cheap, bounded
  });

  it('falls back to the raw subject when the LLM fails', async () => {
    mockComplete.mockRejectedValue(new Error('llm down'));
    await expect(enhancePrompt('a moisture meter')).resolves.toBe(
      'a moisture meter'
    );
  });

  it('falls back to the raw subject when the LLM returns empty', async () => {
    mockComplete.mockResolvedValue({ choices: [{ message: { content: '' } }] });
    await expect(enhancePrompt('a moisture meter')).resolves.toBe(
      'a moisture meter'
    );
  });
});
