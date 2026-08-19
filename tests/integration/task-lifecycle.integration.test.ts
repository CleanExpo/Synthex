/**
 * SYN-MCP-005 (SYN-1081) — deterministic jobId dedupe against REAL bullmq
 * on the Docker verification sandbox Redis (:6399). Runs ONLY under
 * jest.integration.cjs (npm run test:integration).
 *
 * Proves the SYN-1081 acceptance line "double-enqueue → single job (bullmq
 * UN-mocked vs sandbox redis)" plus the bench must_fix 1 dedupe-window
 * semantics:
 *   - re-add with the same jobId while the record is retained → deduped
 *   - edited content (different hash → different jobId) → second job
 *   - record removed → same jobId enqueues again (window expired)
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { assertSandboxRedisUrl } from './setup/sandbox-guard';
import { buildJobId, contentHash } from '@/lib/tasks/task-envelope';

describe('deterministic jobId dedupe (real bullmq → sandbox redis)', () => {
  const redisUrl = assertSandboxRedisUrl(process.env.REDIS_URL);

  const QUEUE_NAME = 'itest-task-lifecycle';
  let connection: IORedis;
  let queue: Queue;

  beforeAll(() => {
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue(QUEUE_NAME, { connection });
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
  });

  beforeEach(async () => {
    await queue.drain(true);
  });

  it('double-add with the same deterministic jobId → exactly ONE job', async () => {
    const jobId = buildJobId('itest-issue-1', contentHash('title', 'desc'));

    await queue.add(
      'autonomous:execute-task',
      { identifier: 'SYN-1' },
      { jobId }
    );
    await queue.add(
      'autonomous:execute-task',
      { identifier: 'SYN-1' },
      { jobId }
    );

    const waiting = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
    const matching = waiting.filter(j => j.id === jobId);
    expect(matching).toHaveLength(1);
  });

  it('edited content → different jobId → TWO jobs', async () => {
    const jobIdV1 = buildJobId(
      'itest-issue-2',
      contentHash('title v1', 'desc')
    );
    const jobIdV2 = buildJobId(
      'itest-issue-2',
      contentHash('title v2', 'desc')
    );
    expect(jobIdV1).not.toBe(jobIdV2);

    await queue.add(
      'autonomous:execute-task',
      { identifier: 'SYN-2' },
      { jobId: jobIdV1 }
    );
    await queue.add(
      'autonomous:execute-task',
      { identifier: 'SYN-2' },
      { jobId: jobIdV2 }
    );

    const waiting = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
    const matching = waiting.filter(j => j.id === jobIdV1 || j.id === jobIdV2);
    expect(matching).toHaveLength(2);
  });

  it('dedupe window: after the job record is removed, the same jobId enqueues again', async () => {
    const jobId = buildJobId('itest-issue-3', contentHash('title', 'desc'));

    const first = await queue.add(
      'autonomous:execute-task',
      { identifier: 'SYN-3' },
      { jobId }
    );
    await first.remove(); // simulates removeOnComplete/removeOnFail pruning

    const second = await queue.add(
      'autonomous:execute-task',
      { identifier: 'SYN-3' },
      { jobId }
    );
    expect(second.id).toBe(jobId);

    const waiting = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
    expect(waiting.filter(j => j.id === jobId)).toHaveLength(1);
  });
});
