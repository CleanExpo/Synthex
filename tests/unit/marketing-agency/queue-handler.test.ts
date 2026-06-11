/**
 * Unit test for the Marketing Agency queue handler.
 *
 * Verifies that the handler delegates to runAgent with the correct args
 * from the job payload, and that registering the handler is idempotent.
 */

const enqueue = jest.fn();
const registerHandler = jest.fn();
const runAgent = jest.fn();

jest.mock('@/lib/queue', () => ({
  enqueue: (...args: unknown[]) => enqueue(...args),
  registerHandler: (...args: unknown[]) => registerHandler(...args),
  JobTypes: { MARKETING_AGENT_RUN: 'marketing-agent:run' },
}));

jest.mock('@/lib/marketing-agency/agent/runner', () => ({
  runAgent: (...args: unknown[]) => runAgent(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('queueMarketingAgentRun', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    enqueue.mockResolvedValue({ id: 'job-1', type: 'marketing-agent:run' });
  });

  test('enqueues with the right job type, data and maxAttempts=1', async () => {
    const { queueMarketingAgentRun } =
      await import('@/lib/marketing-agency/agent/queue-handler');
    const job = await queueMarketingAgentRun({
      agentId: 'agent-1',
      triggeredById: 'user-1',
      trigger: 'manual',
    });
    expect(enqueue).toHaveBeenCalledWith(
      'marketing-agent:run',
      { agentId: 'agent-1', triggeredById: 'user-1', trigger: 'manual' },
      expect.objectContaining({ maxAttempts: 1 })
    );
    expect(job.id).toBe('job-1');
  });
});

describe('registerMarketingAgentHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('handler invokes runAgent with the job payload', async () => {
    const { registerMarketingAgentHandler } =
      await import('@/lib/marketing-agency/agent/queue-handler');
    runAgent.mockResolvedValue({
      runId: 'run-1',
      status: 'completed',
      summary: 'ok',
    });

    registerMarketingAgentHandler();
    expect(registerHandler).toHaveBeenCalled();
    const [, handler] = registerHandler.mock.calls[0];

    const result = await handler({
      id: 'job-1',
      data: {
        agentId: 'agent-1',
        triggeredById: 'user-1',
        trigger: 'cadence-daily',
      },
    });

    expect(runAgent).toHaveBeenCalledWith({
      agentId: 'agent-1',
      triggeredById: 'user-1',
    });
    expect(result).toMatchObject({ runId: 'run-1', status: 'completed' });
  });

  test('registering twice does not double-register the handler', async () => {
    const { registerMarketingAgentHandler } =
      await import('@/lib/marketing-agency/agent/queue-handler');
    registerMarketingAgentHandler();
    registerMarketingAgentHandler();
    registerMarketingAgentHandler();
    expect(registerHandler).toHaveBeenCalledTimes(1);
  });
});
