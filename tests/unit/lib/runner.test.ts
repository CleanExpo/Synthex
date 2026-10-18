/**
 * Unit tests for createEdgeFunctionRunner -- SYN-626
 */

import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';

const mockCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    edgeFunctionLog: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'log-1' });
  delete process.env.PIPELINE_SLACK_WEBHOOK;
});

// ---------------------------------
// Status determination
// ---------------------------------

describe('status: failed', () => {
  it('marks failed when process() throws on all retries', async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => {
        throw new Error('boom');
      },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: 'c1', input: 'data' }]);
    expect(result.status).toBe('failed');
    expect(result.clientsFailed).toBe(1);
    expect(result.clientsProcessed).toBe(0);
  });

  it('marks failed when all clients fail', async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => {
        throw new Error('always fails');
      },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([
      { clientId: 'c1', input: 'a' },
      { clientId: 'c2', input: 'b' },
    ]);
    expect(result.status).toBe('failed');
    expect(result.clientsFailed).toBe(2);
  });
});

describe('status: partial', () => {
  it('marks partial when validateOutput() returns { valid: false }', async () => {
    const runner = createEdgeFunctionRunner<string, number>(
      'test-pipeline',
      async () => 150,
      output => ({
        valid: output >= 0 && output <= 100,
        metadata: { score: output },
      }),
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: 'c1', input: 'data' }]);
    expect(result.status).toBe('partial');
  });

  it('marks partial when some clients fail', async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async (_input, clientId) => {
        if (clientId === 'c2') throw new Error('c2 failed');
        return 'ok';
      },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([
      { clientId: 'c1', input: 'a' },
      { clientId: 'c2', input: 'b' },
    ]);
    expect(result.status).toBe('partial');
    expect(result.clientsProcessed).toBe(1);
    expect(result.clientsFailed).toBe(1);
  });
});

describe('status: success', () => {
  it('marks success when all clients succeed and validateOutput passes', async () => {
    const runner = createEdgeFunctionRunner<string, number>(
      'test-pipeline',
      async () => 75,
      output => ({
        valid: output >= 0 && output <= 100,
        metadata: { score: output },
      }),
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([
      { clientId: 'c1', input: 'a' },
      { clientId: 'c2', input: 'b' },
    ]);
    expect(result.status).toBe('success');
    expect(result.clientsProcessed).toBe(2);
    expect(result.clientsFailed).toBe(0);
  });

  it('marks success with no validateOutput hook', async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => 'done',
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: 'c1', input: 'x' }]);
    expect(result.status).toBe('success');
  });

  it('returns empty success for zero inputs', async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => 'done',
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([]);
    expect(result.status).toBe('success');
    expect(result.clientsProcessed).toBe(0);
  });
});

// ---------------------------------
// Logging
// ---------------------------------

describe('edge_function_logs write', () => {
  it('writes one EdgeFunctionLog row per run via Prisma', async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => 'ok',
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: 'c1', input: 'x' }]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const { data } = mockCreate.mock.calls[0][0];
    expect(data.functionName).toBe('test-pipeline');
    expect(data.runId).toBe(result.runId);
    expect(data.clientId).toBeNull();
    expect(data.status).toBe('success');
    expect(data.clientsProcessed).toBe(1);
    expect(data.clientsFailed).toBe(0);
    expect(data.errorJson).toBeUndefined();
  });

  it('includes errorJson when clients fail', async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => {
        throw new Error('oops');
      },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    await runner.run([{ clientId: 'c1', input: 'x' }]);
    const { data } = mockCreate.mock.calls[0][0];
    expect(data.status).toBe('failed');
    expect(data.errorJson[0].clientId).toBe('c1');
  });

  it('still returns the run result when the log write fails', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => 'ok',
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: 'c1', input: 'x' }]);
    expect(result.status).toBe('success');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------
// Retry behaviour
// ---------------------------------

describe('retry', () => {
  it('retries up to maxRetries then records failure', async () => {
    let attempts = 0;
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => {
        attempts++;
        throw new Error('transient');
      },
      undefined,
      { maxRetries: 3, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: 'c1', input: 'x' }]);
    expect(attempts).toBe(3);
    expect(result.status).toBe('failed');
  });

  it('succeeds on second attempt after transient failure', async () => {
    let attempts = 0;
    const runner = createEdgeFunctionRunner<string, string>(
      'test-pipeline',
      async () => {
        attempts++;
        if (attempts === 1) throw new Error('transient');
        return 'recovered';
      },
      undefined,
      { maxRetries: 3, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: 'c1', input: 'x' }]);
    expect(attempts).toBe(2);
    expect(result.status).toBe('success');
    expect(result.clientsProcessed).toBe(1);
  });
});
