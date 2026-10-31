/**
 * @jest-environment node
 *
 * One guard at the model boundary: inside a portfolio org's prompt scope,
 * every provider refuses a request that names a word the brand never uses,
 * before any network call. Workflow steps and the evidence judge run inside
 * that boundary too.
 */

const mockOrgFind = jest.fn();
jest.mock('@/lib/prisma', () => {
  const client = {
    organization: { findUnique: (...a: unknown[]) => mockOrgFind(...a) },
  };
  return { __esModule: true, default: client, prisma: client };
});

const realProviders = jest.requireActual(
  '@/lib/ai/providers/anthropic-provider'
);
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => new realProviders.AnthropicProvider('test-key'),
}));
jest.mock('@/lib/ai/prompt-layer-builder', () => ({
  buildLayeredPrompt: async () => ({ systemPrompt: null }),
}));
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: async () => undefined,
  calculatePipelineCost: () => 0.001,
}));

import { AnthropicProvider } from '@/lib/ai/providers/anthropic-provider';
import { OpenAIProvider } from '@/lib/ai/providers/openai-provider';
import { OpenRouterProvider } from '@/lib/ai/providers/openrouter-provider';
import { GoogleProvider } from '@/lib/ai/providers/google-provider';
import { OllamaProvider } from '@/lib/ai/providers/ollama-provider';
import type { AIProvider } from '@/lib/ai/providers/base-provider';
import {
  withPromptOrg,
  enterPromptOrg,
  guardScopedRequest,
} from '@/lib/ai/prompt-scope';
import { routedCall } from '@/lib/ai/model-router';
import { ForbiddenPromptError } from '@/lib/marketing-calendar/prompt-guard';
import { executeStep } from '@/lib/workflow/step-executor';
import { createLlmEntailmentScorer } from '@/lib/evidence/entailment';

const bad = {
  model: 'm',
  messages: [
    { role: 'system' as const, content: 'You write for Unite Group.' },
    { role: 'user' as const, content: 'Promote CARSI courses this week' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgFind.mockResolvedValue({ slug: 'unite-group' });
});

const providers: Array<[string, () => AIProvider]> = [
  ['Anthropic', () => new AnthropicProvider('test-key')],
  ['OpenAI', () => new OpenAIProvider('test-key')],
  ['OpenRouter', () => new OpenRouterProvider('test-key')],
  ['Google', () => new GoogleProvider('test-key')],
  ['Ollama', () => new OllamaProvider()],
];

describe.each(providers)('%s provider', (_, make) => {
  it('refuses a forbidden prompt inside a portfolio scope (complete)', async () => {
    await expect(
      withPromptOrg('org-ug', () => make().complete(bad))
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
  });

  it('refuses a forbidden prompt inside a portfolio scope (stream)', async () => {
    await expect(
      withPromptOrg('org-ug', async () => {
        for await (const _chunk of make().stream(bad)) void _chunk;
      })
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
  });
});

describe('guardScopedRequest', () => {
  it('passes outside any scope without a lookup', async () => {
    await expect(guardScopedRequest(bad)).resolves.toBeUndefined();
    expect(mockOrgFind).not.toHaveBeenCalled();
  });

  it('passes for an org outside the portfolio', async () => {
    mockOrgFind.mockResolvedValue({ slug: 'some-client' });
    await expect(
      withPromptOrg('org-x', () => guardScopedRequest(bad))
    ).resolves.toBeUndefined();
  });

  it('scans structured message content too', async () => {
    await expect(
      withPromptOrg('org-ug', () =>
        guardScopedRequest({
          model: 'm',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'Feature RestoreAssist' }],
            } as never,
          ],
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
  });

  it('scans tool definitions too', async () => {
    await expect(
      withPromptOrg('org-ug', () =>
        guardScopedRequest({
          messages: [{ content: 'A post about a local cafe' }],
          tools: [{ name: 'cite', description: 'Cite a CARSI course' }],
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
  });

  it('routed calls run in their organisation scope and a refusal is not escalated', async () => {
    const send = jest.fn();
    await expect(
      routedCall({
        task: {
          taskType: 'caption_generation',
          inputTokenEstimate: 10,
          qualityThreshold: 'medium',
          clientId: 'org-ug',
        },
        execute: async () => {
          await guardScopedRequest(bad);
          send();
          return 'ok';
        },
      })
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
    expect(send).not.toHaveBeenCalled();
    expect(mockOrgFind).toHaveBeenCalledTimes(1);
  });

  it('enterPromptOrg scopes the rest of an entry point', async () => {
    const entry = async () => {
      enterPromptOrg('org-ug');
      await guardScopedRequest(bad);
    };
    await expect(entry()).rejects.toBeInstanceOf(ForbiddenPromptError);
  });

  it('passes a clean portfolio prompt', async () => {
    await expect(
      withPromptOrg('org-ug', () =>
        guardScopedRequest({
          model: 'm',
          messages: [{ role: 'user', content: 'A post about a local cafe' }],
        })
      )
    ).resolves.toBeUndefined();
  });
});

describe('workflow steps', () => {
  it("run inside the org's scope, so a forbidden workflow input never reaches a model", async () => {
    const result = await executeStep(
      { name: 'draft', type: 'ai' } as never,
      {
        stepDefinition: { name: 'draft', type: 'ai' },
        priorOutputs: [],
        workflowInput: { brief: 'Promote CARSI courses' },
        stepIndex: 0,
        totalSteps: 1,
        organizationId: 'org-ug',
      } as never,
      2000
    );
    expect(result.success).toBe(false);
    expect(String(result.error)).toMatch(/never uses/);
  });
});

describe('evidence judge', () => {
  it('refuses a portfolio claim naming a forbidden word, calling no model', async () => {
    const complete = jest.fn();
    const scorer = createLlmEntailmentScorer({ complete } as never);
    await expect(
      scorer.scoreSources({
        orgId: 'org-ug',
        claimId: 'c1',
        claimStatement: 'CARSI trains 500 technicians a year',
        sources: [
          {
            url: 'https://example.test/a',
            title: 'A',
            excerpt: 'Some evidence',
          } as never,
        ],
      })
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('no model call bypasses the guard', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const ROOT = path.resolve(__dirname, '../../..');

  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(path.join(ROOT, dir), {
      withFileTypes: true,
    })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', '__tests__'].includes(e.name))
          out.push(...sources(rel));
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        out.push(rel);
      }
    }
    return out;
  }

  // A model SDK import, or a model API host or endpoint in the source.
  const MODEL_CALL =
    /from '(@anthropic-ai\/sdk|openai|@google\/generative-ai|@google\/genai|ai|@ai-sdk\/[a-z-]+)'|api\.anthropic\.com|api\.openai\.com|openrouter\.ai\/api|generativelanguage\.googleapis|\/chat\/completions/;
  const GUARDED = /guardScopedRequest|guardScopedText|modelFetch/;
  // Files that reach a model host without sending any content.
  const NO_CONTENT: Record<string, string> = {
    'lib/encryption/api-key-validator.ts':
      'key checks: model lists and a fixed "hi"',
    'app/api/onboarding/validate-key/route.ts':
      'key checks: model lists and a fixed "test"',
    'app/api/health/ai/route.ts': 'health probe: model list only',
    'lib/resilience/circuit-breaker.ts': 'mentions a host in a comment only',
    'lib/ai/model-registry.ts':
      'price table; mentions a host in a comment only',
  };

  it('every file that calls a model checks the request first', () => {
    const files = [...sources('lib'), ...sources('app'), ...sources('packages')]
      .map(f => f.split(path.sep).join('/'))
      .filter(f =>
        MODEL_CALL.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))
      );
    expect(files.length).toBeGreaterThan(20);
    const unguarded = files.filter(
      f =>
        !(f in NO_CONTENT) &&
        !GUARDED.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    );
    expect(unguarded).toEqual([]);
  });

  it('every provider class is one this file proves refuses a forbidden prompt', () => {
    const classes = sources('lib')
      .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
      .flatMap(t => [...t.matchAll(/class (\w+) implements AIProvider/g)])
      .map(m => m[1])
      .filter(c => c !== 'MockAIProvider'); // eval fixture, never calls a model
    expect(classes.sort()).toEqual(
      [
        'AnthropicProvider',
        'GoogleProvider',
        'OllamaProvider',
        'OpenAIProvider',
        'OpenRouterProvider',
      ].sort()
    );
  });

  it('modelFetch refuses a forbidden body inside a portfolio scope before sending', async () => {
    const sent = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}'));
    const { modelFetch } = jest.requireActual('@/lib/ai/prompt-scope');
    await expect(
      withPromptOrg('org-ug', () =>
        modelFetch('https://api.example.test/v1/messages', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Promote CARSI courses' }),
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
    expect(sent).not.toHaveBeenCalled();
  });
});
