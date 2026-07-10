/**
 * SYN-MCP-002 — bounded-concurrency contract for
 * AIContentGenerator.batchGenerate (lib/ai/content-generator.ts).
 *
 * Defect under test (vs main @ 2bd24eb5): batchGenerate was an unbounded
 * Promise.all over LLM calls — N requests meant N simultaneous provider
 * calls (cost + provider rate-limit exposure).
 *
 * Contract now: at most 3 generateContent calls in flight at once, and the
 * result array preserves input ordering regardless of completion order.
 */

// --- Mock the module's heavy imports so the REAL class loads cleanly ------
jest.mock('@/lib/prisma', () => ({
  prisma: {},
  default: {},
}));
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/obsidian/client-knowledge-base', () => ({
  buildContextForGeneration: jest.fn(),
}));
jest.mock('@/lib/ai/prompt-layer-builder', () => ({
  buildLayeredPrompt: jest.fn(),
}));
jest.mock('@/lib/content/layout-renderer', () => ({
  injectLayoutSignals: jest.fn(),
}));

import {
  aiContentGenerator,
  mapWithConcurrency,
  type ContentRequest,
  type GeneratedContent,
} from '@/lib/ai/content-generator';

/** Flush pending microtasks + one macrotask tick. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function makeRequests(n: number): ContentRequest[] {
  return Array.from({ length: n }, (_x, i) => ({
    type: 'post' as const,
    platform: 'twitter' as const,
    topic: `topic-${i}`,
  }));
}

describe('batchGenerate — bounded concurrency (SYN-MCP-002)', () => {
  it('never has more than 3 generateContent calls in flight and preserves ordering', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    // One resolver per started call, in start order.
    const resolvers: Array<() => void> = [];

    const spy = jest
      .spyOn(aiContentGenerator, 'generateContent')
      .mockImplementation((request: ContentRequest) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise<GeneratedContent>(resolve => {
          let settled = false;
          resolvers.push(() => {
            if (settled) return; // idempotent — safe to call in drain loops
            settled = true;
            inFlight--;
            resolve({ id: `gen:${request.topic}` } as GeneratedContent);
          });
        });
      });

    const requests = makeRequests(8);
    const resultPromise = aiContentGenerator.batchGenerate(requests);

    // The pool starts exactly `limit` workers immediately — not all 8.
    await flush();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(inFlight).toBe(3);

    // Complete calls OUT OF ORDER; the pool must top back up to 3 without
    // ever exceeding it.
    resolvers[1]();
    await flush();
    expect(spy).toHaveBeenCalledTimes(4);
    expect(inFlight).toBe(3);
    expect(maxInFlight).toBe(3);

    resolvers[3](); // finish the call that started 4th
    resolvers[0](); // then the very first
    await flush();
    expect(spy).toHaveBeenCalledTimes(6);
    expect(inFlight).toBe(3);
    expect(maxInFlight).toBe(3);

    // Drain: resolve all pending calls; newly started calls push new
    // resolvers, so loop until all 8 have started and completed.
    for (let guard = 0; guard < 10; guard++) {
      resolvers.forEach(resolve => resolve()); // idempotent
      await flush();
      if (spy.mock.calls.length === 8 && inFlight === 0) break;
    }

    const results = await resultPromise;

    // The bound held for the whole run.
    expect(maxInFlight).toBe(3);
    expect(spy).toHaveBeenCalledTimes(8);

    // Ordering preserved: result i corresponds to request i even though
    // completions were interleaved.
    expect(results.map(r => r.id)).toEqual(requests.map(r => `gen:${r.topic}`));
  });

  it('handles batches smaller than the concurrency limit', async () => {
    const spy = jest
      .spyOn(aiContentGenerator, 'generateContent')
      .mockImplementation(async (request: ContentRequest) => {
        return { id: `gen:${request.topic}` } as GeneratedContent;
      });

    const results = await aiContentGenerator.batchGenerate(makeRequests(2));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(results.map(r => r.id)).toEqual(['gen:topic-0', 'gen:topic-1']);
  });

  it('returns an empty array for an empty batch', async () => {
    const spy = jest.spyOn(aiContentGenerator, 'generateContent');
    const results = await aiContentGenerator.batchGenerate([]);
    expect(results).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('mapWithConcurrency (pool helper)', () => {
  it('respects the limit and preserves input order', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const out = await mapWithConcurrency([5, 4, 3, 2, 1], 2, async n => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Later items finish faster — completion order != input order.
      await new Promise(resolve => setTimeout(resolve, n * 2));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([50, 40, 30, 20, 10]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
