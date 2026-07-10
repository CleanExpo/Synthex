/**
 * Sandbox canary (SYN-MCP-000).
 *
 * Proves the Docker verification sandbox end-to-end:
 *   1. Prisma connects to the sandbox Postgres (:5499) and reads the seeded
 *      fixtures (schema materialised by global-setup's `prisma db push`).
 *   2. REAL ioredis + bullmq (no jest mock in this profile) connect to the
 *      sandbox Redis (:6399): enqueue a job by jobId, read it back, clean up.
 *
 * Run: npm run sandbox:up && npm run test:integration
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  assertSandboxDatabaseUrl,
  assertSandboxRedisUrl,
} from './setup/sandbox-guard';
import { createSandboxPrismaClient } from './setup/seed';

describe('verification sandbox canary', () => {
  // Belt-and-braces: global-setup already enforced this, but assert again in
  // the worker process so a mis-wired config can never silently pass.
  const databaseUrl = assertSandboxDatabaseUrl(process.env.DATABASE_URL);
  const redisUrl = assertSandboxRedisUrl(process.env.REDIS_URL);

  describe('postgres (prisma -> :5499)', () => {
    const { prisma } = createSandboxPrismaClient();

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it('connects and reads the seeded organization', async () => {
      const org = await prisma.organization.findUnique({
        where: { id: 'itest-org' },
      });
      expect(org).not.toBeNull();
      expect(org?.slug).toBe('itest-org');
      expect(org?.name).toBe('Integration Test Org');
    });

    it('reads the seeded marketing-agency graph (claim blocked by default)', async () => {
      const claim = await prisma.marketingAgencyClaim.findUnique({
        where: { id: 'itest-claim' },
        include: { sourceRef: true, campaign: true },
      });
      expect(claim).not.toBeNull();
      expect(claim?.evidenceStatus).toBe('blocked');
      expect(claim?.sourceRef?.id).toBe('itest-source-ref');
      expect(claim?.campaign?.slug).toBe('itest-campaign');
      expect(claim?.organizationId).toBe('itest-org');
    });
  });

  describe('redis (real ioredis + bullmq -> :6399)', () => {
    const QUEUE_NAME = 'itest-canary';
    const JOB_ID = 'itest-canary-job';

    let connection: IORedis;
    let queue: Queue;

    beforeAll(() => {
      // maxRetriesPerRequest: null is required by bullmq's blocking commands.
      connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      queue = new Queue(QUEUE_NAME, { connection });
    });

    afterAll(async () => {
      // Throwaway queue — wipe it entirely, then release both connections.
      await queue.obliterate({ force: true });
      await queue.close();
      await connection.quit();
    });

    it('answers PING', async () => {
      await expect(connection.ping()).resolves.toBe('PONG');
    });

    it('enqueues a bullmq job by jobId and reads it back', async () => {
      // Idempotent under re-runs: clear any leftover from a previous run.
      const leftover = await queue.getJob(JOB_ID);
      if (leftover) {
        await leftover.remove();
      }

      const added = await queue.add(
        'canary',
        { hello: 'sandbox' },
        { jobId: JOB_ID }
      );
      expect(added.id).toBe(JOB_ID);

      const fetched = await queue.getJob(JOB_ID);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(JOB_ID);
      expect(fetched?.data).toEqual({ hello: 'sandbox' });

      await fetched?.remove();
      await expect(queue.getJob(JOB_ID)).resolves.toBeUndefined();
    });
  });

  it('is guarded against non-sandbox targets', () => {
    expect(databaseUrl).toContain(':5499/');
    expect(redisUrl).toContain(':6399');
  });
});
