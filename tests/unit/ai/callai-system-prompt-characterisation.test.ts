/**
 * callAI() system-prompt characterisation (SYN-515 Phase 2.5)
 *
 * Locks the EXACT system prompt (and the article max_tokens branch) that
 * AIContentGenerator.callAI produces today, so the 3-layer refactor (Phase 3)
 * can be proven regression-free. These expectations MUST stay green before and
 * after the refactor.
 *
 * Prisma is mocked so every layer lookup misses — after the refactor,
 * buildLayeredPrompt therefore returns null and callAI must fall back to these
 * exact legacy strings + withAntiSlop, even when an orgId is supplied.
 */

const mockPrisma = {
  brandOperatingSystem: { findUnique: jest.fn() },
  clientProfile: { findUnique: jest.fn() },
  brandDNA: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { AIContentGenerator } from '@/lib/ai/content-generator';
import { withAntiSlop } from '@/lib/ai/prompts/anti-slop-directive';
import type { AIProvider } from '@/lib/ai/providers';

interface CapturedCall {
  system: string;
  maxTokens: number | undefined;
}

/** Fake provider that records the system message + max_tokens of each call. */
function makeCapturingClient(): { client: AIProvider; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const client = {
    async complete(req: {
      messages: Array<{ role: string; content: string }>;
      max_tokens?: number;
    }) {
      const system = req.messages.find(m => m.role === 'system')?.content ?? '';
      calls.push({ system, maxTokens: req.max_tokens });
      return { choices: [{ message: { content: 'ok' } }] };
    },
  } as unknown as AIProvider;
  return { client, calls };
}

beforeEach(() => {
  mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue(null);
  mockPrisma.clientProfile.findUnique.mockResolvedValue(null);
  mockPrisma.brandDNA.findUnique.mockResolvedValue(null);
  mockPrisma.organization.findUnique.mockResolvedValue(null);
});

// Access the private callAI without widening the public surface.
function callAI(gen: AIContentGenerator, ...args: unknown[]): Promise<string> {
  return (gen as unknown as { callAI: (...a: unknown[]) => Promise<string> }).callAI(
    ...args
  );
}

describe('callAI system-prompt characterisation', () => {
  it('(a) with full orgContext produces the content-expert prompt', async () => {
    const gen = new AIContentGenerator();
    const { client, calls } = makeCapturingClient();
    const orgContext = {
      businessName: 'Acme Plumbing',
      industry: 'plumbing',
      location: 'Sydney',
      brandVoice: 'Speak plainly.',
    };

    await callAI(gen, 'write a post', 'model-x', client, undefined, orgContext, 'org-1', 'post');

    expect(calls[0].system).toBe(
      withAntiSlop(
        'You are a content expert for Acme Plumbing, a plumbing business in Sydney. Speak plainly.'
      )
    );
  });

  it('(a2) orgContext with null industry/location/brandVoice keeps the ?? fallback', async () => {
    const gen = new AIContentGenerator();
    const { client, calls } = makeCapturingClient();
    const orgContext = {
      businessName: 'Solo',
      industry: null,
      location: null,
      brandVoice: null,
    };

    await callAI(gen, 'write a post', 'model-x', client, undefined, orgContext, 'org-1', 'post');

    expect(calls[0].system).toBe(
      withAntiSlop(
        'You are a content expert for Solo. Generate unique, creative content optimized for maximum engagement.'
      )
    );
  });

  it('(b) without orgContext produces the viral-expert prompt', async () => {
    const gen = new AIContentGenerator();
    const { client, calls } = makeCapturingClient();

    await callAI(gen, 'write a post', 'model-x', client);

    expect(calls[0].system).toBe(
      withAntiSlop(
        'You are a viral content expert specializing in creating highly engaging social media content. Generate unique, creative content optimized for maximum engagement.'
      )
    );
  });

  it('preserves the article max_tokens branch (3000 for article, 1000 otherwise)', async () => {
    const gen = new AIContentGenerator();
    const { client, calls } = makeCapturingClient();

    await callAI(gen, 'write an article about plumbing', 'model-x', client);
    await callAI(gen, 'write a short caption', 'model-x', client);

    expect(calls[0].maxTokens).toBe(3000);
    expect(calls[1].maxTokens).toBe(1000);
  });
});
