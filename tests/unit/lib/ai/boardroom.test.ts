/**
 * Unit tests — SYN-807 Phase 2: boardroom multi-model synthesis.
 *
 * Mocks the provider factory so each panellist returns a deterministic
 * response without hitting any real LLM endpoint.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  boardroomQuery,
  computeMinPairwiseJaccard,
  __testing,
  type BoardroomPanellist,
} from '@/lib/ai/boardroom';
import * as providers from '@/lib/ai/providers';
import { OllamaUnavailableError } from '@/lib/ai/providers';

const { tokenise, jaccard } = __testing;

// ── Provider factory mock ───────────────────────────────────────────

type CompleteFn = jest.Mock;
const mockProviders = new Map<string, CompleteFn>();

function setPanellistResponse(
  modelId: string,
  text: string,
  opts: { promptTokens?: number; completionTokens?: number } = {}
) {
  const fn: CompleteFn = jest.fn().mockResolvedValue({
    id: `test-${modelId}`,
    model: modelId,
    choices: [
      { message: { role: 'assistant', content: text }, finish_reason: 'stop' },
    ],
    usage: {
      prompt_tokens: opts.promptTokens ?? 10,
      completion_tokens: opts.completionTokens ?? 50,
      total_tokens: (opts.promptTokens ?? 10) + (opts.completionTokens ?? 50),
    },
  });
  mockProviders.set(modelId, fn);
}

function setPanellistFailure(modelId: string, error: Error) {
  const fn: CompleteFn = jest.fn().mockRejectedValue(error);
  mockProviders.set(modelId, fn);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProviders.clear();
  jest
    .spyOn(providers, 'getAIProvider')
    .mockImplementation(({ provider, apiKey: _apiKey } = { apiKey: '' }) => {
      return {
        name: `mock-${provider}`,
        models: {
          fast: 'mock',
          balanced: 'mock',
          creative: 'mock',
          premium: 'mock',
          code: 'mock',
          free: 'mock',
        },
        complete: ((req: { model: string }) => {
          const fn = mockProviders.get(req.model);
          if (!fn) {
            throw new Error(`Test setup error: no mock for model ${req.model}`);
          }
          return fn(req);
        }) as never,
        stream: async function* () {
          // Not used by boardroom tests.
        } as never,
      };
    });
});

// ── Tokenise / Jaccard sanity ───────────────────────────────────────

describe('boardroom — tokenise + jaccard helpers', () => {
  it('tokenise lowercases, strips punctuation, drops stopwords', () => {
    const tokens = tokenise('The Quick brown fox, jumped over the lazy dog!');
    expect(tokens.has('quick')).toBe(true);
    expect(tokens.has('brown')).toBe(true);
    expect(tokens.has('fox')).toBe(true);
    expect(tokens.has('jumped')).toBe(true);
    expect(tokens.has('lazy')).toBe(true);
    expect(tokens.has('dog')).toBe(true);
    expect(tokens.has('the')).toBe(false); // stopword
    expect(tokens.has('over')).toBe(true);
  });

  it('jaccard of identical texts is 1.0', () => {
    const a = tokenise('Ship the campaign on Monday');
    const b = tokenise('Ship the campaign on Monday');
    expect(jaccard(a, b)).toBe(1);
  });

  it('jaccard of fully disjoint texts is 0', () => {
    const a = tokenise('apple banana cherry');
    const b = tokenise('zebra yacht xylophone');
    expect(jaccard(a, b)).toBe(0);
  });

  it('jaccard of partial overlap is between 0 and 1', () => {
    const a = tokenise('apple banana cherry');
    const b = tokenise('banana cherry durian');
    const sim = jaccard(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe('boardroom — computeMinPairwiseJaccard', () => {
  it('returns 1.0 for fewer than 2 responses', () => {
    expect(computeMinPairwiseJaccard([])).toBe(1);
    expect(computeMinPairwiseJaccard(['only one'])).toBe(1);
  });

  it('returns the lowest similarity across all pairs', () => {
    const sim = computeMinPairwiseJaccard([
      'Ship the campaign on Monday',
      'Ship the campaign on Monday', // identical → pair sim = 1
      'Cancel everything and pivot to TikTok now', // disjoint → pair sim = 0
    ]);
    expect(sim).toBe(0);
  });
});

// ── Boardroom query end-to-end ──────────────────────────────────────

const PANEL: BoardroomPanellist[] = [
  { provider: 'ollama', modelId: 'gemma4:e4b' },
  { provider: 'openrouter', modelId: 'deepseek/deepseek-v4-flash' },
  { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-4-6' },
];

const SYNTH: BoardroomPanellist = {
  provider: 'openrouter',
  modelId: 'anthropic/claude-sonnet-4-6',
};

const ESC: BoardroomPanellist = {
  provider: 'openrouter',
  modelId: 'anthropic/claude-opus-4-6',
};

describe('boardroomQuery — agreement path', () => {
  it('returns synthesiser answer when panel agrees', async () => {
    setPanellistResponse('gemma4:e4b', 'Ship the campaign on Monday morning');
    setPanellistResponse(
      'deepseek/deepseek-v4-flash',
      'Ship the campaign on Monday morning'
    );
    setPanellistResponse(
      'anthropic/claude-sonnet-4-6',
      'Ship the campaign on Monday morning. Synthesised final answer.'
    );

    const result = await boardroomQuery({
      prompt: 'When should we ship?',
      panel: PANEL,
      synthesiser: SYNTH,
      escalationSynthesiser: ESC,
    });

    expect(result.escalated).toBe(false);
    expect(result.synthesiserUsed.modelId).toBe('anthropic/claude-sonnet-4-6');
    expect(result.successfulPanellists).toBe(3);
    expect(result.panel).toHaveLength(3);
    expect(result.minPairwiseSimilarity).toBeGreaterThan(0.5);
    expect(result.answer).toContain('Synthesised final answer');
  });
});

describe('boardroomQuery — divergence path', () => {
  it('escalates to higher-tier synthesiser when panel disagrees', async () => {
    setPanellistResponse('gemma4:e4b', 'Ship Monday morning at nine sharp');
    setPanellistResponse(
      'deepseek/deepseek-v4-flash',
      'Cancel everything pivot to TikTok now'
    );
    setPanellistResponse(
      'anthropic/claude-sonnet-4-6',
      'Hold the launch postpone six weeks'
    );
    setPanellistResponse(
      'anthropic/claude-opus-4-6',
      'OPUS escalated synthesis'
    );

    const result = await boardroomQuery({
      prompt: 'When should we ship?',
      panel: PANEL,
      synthesiser: SYNTH,
      escalationSynthesiser: ESC,
      divergenceThreshold: 0.5,
    });

    expect(result.escalated).toBe(true);
    expect(result.synthesiserUsed.modelId).toBe('anthropic/claude-opus-4-6');
    expect(result.answer).toBe('OPUS escalated synthesis');
  });
});

describe('boardroomQuery — partial failure path', () => {
  it('continues when one panellist throws OllamaUnavailableError', async () => {
    setPanellistFailure(
      'gemma4:e4b',
      new OllamaUnavailableError('daemon offline')
    );
    setPanellistResponse('deepseek/deepseek-v4-flash', 'Yes proceed');
    setPanellistResponse('anthropic/claude-sonnet-4-6', 'Yes proceed cleanly');
    setPanellistResponse('anthropic/claude-opus-4-6', 'should not be invoked');

    const result = await boardroomQuery({
      prompt: 'Should we proceed?',
      panel: PANEL,
      synthesiser: SYNTH,
      escalationSynthesiser: ESC,
    });

    expect(result.successfulPanellists).toBe(2);
    expect(result.panel[0]?.response).toBeNull();
    expect(result.panel[0]?.error?.name).toBe('OllamaUnavailableError');
    expect(result.escalated).toBe(false); // 2 surviving + agreement
  });

  it('throws when ALL panellists fail', async () => {
    setPanellistFailure('gemma4:e4b', new Error('a'));
    setPanellistFailure('deepseek/deepseek-v4-flash', new Error('b'));
    setPanellistFailure('anthropic/claude-sonnet-4-6', new Error('c'));

    await expect(
      boardroomQuery({
        prompt: 'q',
        panel: PANEL,
        synthesiser: SYNTH,
      })
    ).rejects.toThrow(/no panellists returned/);
  });
});

describe('boardroomQuery — input validation', () => {
  it('rejects panels with fewer than two panellists', async () => {
    await expect(
      boardroomQuery({
        prompt: 'q',
        panel: [{ provider: 'ollama', modelId: 'gemma4:e2b' }],
      })
    ).rejects.toThrow(/at least two panellists/);
  });

  it('passes systemPrompt through to every panellist', async () => {
    setPanellistResponse('gemma4:e4b', 'A');
    setPanellistResponse('deepseek/deepseek-v4-flash', 'A');
    setPanellistResponse('anthropic/claude-sonnet-4-6', 'A');

    await boardroomQuery({
      prompt: 'q',
      systemPrompt: 'You are a senior strategist.',
      panel: PANEL,
      synthesiser: SYNTH,
    });

    const gemmaCall = mockProviders.get('gemma4:e4b')?.mock.calls[0]?.[0];
    expect(gemmaCall.messages[0].role).toBe('system');
    expect(gemmaCall.messages[0].content).toContain('senior strategist');
    expect(gemmaCall.messages[1].role).toBe('user');
  });
});
