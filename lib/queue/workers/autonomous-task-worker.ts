/**
 * Autonomous Task Worker
 *
 * @description BullMQ worker that picks up `autonomous:execute-task` jobs and drives
 * the `@anthropic-ai/claude-agent-sdk` `query()` function to execute them autonomously.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection URL
 * - ANTHROPIC_API_KEY: Required for the Claude agent SDK
 * - LINEAR_API_KEY: Required for posting comments and updating issue state
 *
 * DEPLOYMENT NOTE:
 * The `@anthropic-ai/claude-agent-sdk` spawns a `claude` subprocess via child_process.
 * This requires the `claude` CLI to be in PATH. The worker degrades gracefully when
 * the CLI is unavailable (posts an explanatory comment to Linear, does not retry).
 * For production use, run this worker in a persistent process environment
 * (Railway, Fly.io) rather than a Vercel Lambda.
 */

import { Worker, Job } from 'bullmq';
import { getLinearClient } from '@/lib/linear/client';
import { QUEUE_NAMES } from '@/lib/queue/bull-queue';
import type { AutonomousTaskJobData } from '@/lib/queue/bull-queue';
import { logger } from '@/lib/logger';

// Lazy import — @anthropic-ai/claude-agent-sdk may not be importable everywhere
let queryFn: ((opts: { prompt: string; options: QueryOptions }) => AsyncIterable<SDKMessage>) | null = null;

interface QueryOptions {
  cwd?: string;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  maxTurns?: number;
}

interface SDKMessage {
  type: string;
  subtype?: string;
  result?: string;
  total_cost_usd?: number;
}

async function getQueryFn() {
  if (!queryFn) {
    try {
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      queryFn = sdk.query;
    } catch (err) {
      logger.error('[autonomous-worker] Failed to import claude-agent-sdk:', err);
      return null;
    }
  }
  return queryFn;
}

// Cache completed state IDs per team to avoid repeated API calls
const completedStateCache = new Map<string, string>();

async function getCompletedStateId(teamId: string): Promise<string | null> {
  if (completedStateCache.has(teamId)) {
    return completedStateCache.get(teamId)!;
  }
  try {
    const linear = getLinearClient();
    const states = await linear.workflowStates({
      filter: { team: { id: { eq: teamId } } },
    });
    const completed = states.nodes.find((s: { type: string }) => s.type === 'completed');
    if (completed) {
      completedStateCache.set(teamId, completed.id);
      return completed.id;
    }
  } catch (err) {
    logger.warn('[autonomous-worker] Could not fetch workflow states:', { error: err });
  }
  return null;
}

async function processAutonomousTask(job: Job<AutonomousTaskJobData>): Promise<void> {
  const { issueId, identifier, title, description } = job.data;
  const linear = getLinearClient();

  logger.info(`[autonomous-worker] Starting task ${identifier}: ${title}`);

  // Verify agent SDK is available
  const query = await getQueryFn();
  if (!query) {
    try {
      await linear.createComment({
        issueId,
        body: `## ❌ Agent SDK Unavailable\n\nThe \`@anthropic-ai/claude-agent-sdk\` could not be loaded in this environment. The \`claude\` CLI must be installed and available in PATH.\n\nThis task needs to be run in a persistent worker environment (not Vercel Lambda).`,
      });
    } catch (commentErr) {
      logger.warn('[autonomous-worker] Failed to post SDK unavailable comment:', { error: commentErr });
    }
    // Don't retry — this is an environment config issue
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    try {
      await linear.createComment({
        issueId,
        body: `## ❌ Missing Configuration\n\n\`ANTHROPIC_API_KEY\` is not set. Configure it in the worker environment.`,
      });
    } catch (commentErr) {
      logger.warn('[autonomous-worker] Failed to post missing API key comment:', { error: commentErr });
    }
    return;
  }

  const prompt = [
    `You are working on Linear issue ${identifier}: ${title}`,
    description ? `\n\nDescription:\n${description}` : '',
    `\n\nComplete the task described above.`,
    `Create a feature branch named \`fix/${identifier.toLowerCase()}\` before making any changes.`,
    `Run \`npm run type-check\` after making changes to verify no TypeScript errors.`,
    `When done, summarise exactly what files were changed and what was done.`,
  ].join('');

  // Post start comment
  try {
    await linear.createComment({
      issueId,
      body: `## 🤖 Autonomous Agent Started\n\nWorking on: **${title}**\n\nI'll post updates as I progress.`,
    });
  } catch (commentErr) {
    logger.warn('[autonomous-worker] Failed to post start comment:', { error: commentErr });
  }

  let turnCount = 0;
  let maxTurnsExceeded = false;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: process.cwd(),
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        appendSystemPrompt:
          'Never commit directly to main. Always work on a feature branch.',
        maxTurns: 50,
      },
    })) {
      if (message.type === 'assistant') {
        turnCount++;
        // Post progress every 10 turns
        if (turnCount % 10 === 0) {
          try {
            await linear.createComment({
              issueId,
              body: `⏳ Agent working... (${turnCount} turns completed)`,
            });
          } catch (commentErr) {
            logger.warn('[autonomous-worker] Failed to post progress comment:', { error: commentErr });
          }
        }
      }

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          const costStr = message.total_cost_usd != null
            ? `$${message.total_cost_usd.toFixed(4)} USD`
            : 'unknown';

          try {
            await linear.createComment({
              issueId,
              body: `## ✅ Task Complete\n\n${message.result ?? 'No summary provided.'}\n\n---\n*Turns: ${turnCount} | Cost: ${costStr}*`,
            });
          } catch (commentErr) {
            logger.warn('[autonomous-worker] Failed to post completion comment:', { error: commentErr });
          }

          // Mark issue as Done
          try {
            const issue = await linear.issue(issueId);
            const team = await issue.team;
            if (team) {
              const stateId = await getCompletedStateId(team.id);
              if (stateId) {
                await linear.updateIssue(issueId, { stateId });
                logger.info(`[autonomous-worker] Marked ${identifier} as Done`);
              }
            }
          } catch (stateErr) {
            logger.warn(`[autonomous-worker] Could not update state for ${identifier}:`, { error: stateErr });
          }
        } else if (message.subtype === 'error_max_turns') {
          maxTurnsExceeded = true;
          try {
            await linear.createComment({
              issueId,
              body: `## ⚠️ Task Too Complex\n\nThe agent reached the turn limit (50 turns) without completing the task.\n\nPlease break this issue into smaller sub-tasks and re-assign them with the \`autonomous\` label.`,
            });
          } catch (commentErr) {
            logger.warn('[autonomous-worker] Failed to post max-turns comment:', { error: commentErr });
          }
        } else {
          try {
            await linear.createComment({
              issueId,
              body: `## ⚠️ Task Ended\n\nResult type: \`${message.subtype ?? 'unknown'}\`. Human review needed.`,
            });
          } catch (commentErr) {
            logger.warn('[autonomous-worker] Failed to post ended comment:', { error: commentErr });
          }
        }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Detect "claude not found" specifically
    if (errorMsg.includes('ENOENT') || errorMsg.includes('claude')) {
      try {
        await linear.createComment({
          issueId,
          body: `## ❌ Claude CLI Not Found\n\nThe \`claude\` binary is not available in this environment. Ensure the Claude Code CLI is installed.\n\nError: \`${errorMsg}\``,
        });
      } catch (commentErr) {
        logger.warn('[autonomous-worker] Failed to post CLI not found comment:', { error: commentErr });
      }
      return; // Don't retry for missing CLI
    }

    try {
      await linear.createComment({
        issueId,
        body: `## ❌ Worker Error\n\nAn error occurred during task execution. Check server logs.\n\nError: \`${errorMsg}\``,
      });
    } catch (commentErr) {
      logger.warn('[autonomous-worker] Failed to post error comment:', { error: commentErr });
    }

    logger.error(`[autonomous-worker] Error on ${identifier}:`, err);
    throw err; // Let BullMQ retry (up to 3 attempts)
  }

  if (maxTurnsExceeded) return; // Don't retry max-turns failures

  logger.info(`[autonomous-worker] Completed task ${identifier} in ${turnCount} turns`);
}

export function createAutonomousTaskWorker() {
  const worker = new Worker<AutonomousTaskJobData>(
    QUEUE_NAMES.AUTONOMOUS_TASKS,
    processAutonomousTask,
    {
      // Redis connection intentionally duplicated from bull-queue.ts.
      // This worker may eventually move to a separate persistent process
      // that does not import the full queue module. If this becomes a
      // maintenance burden, extract getRedisConnection() to lib/queue/connection.ts.
      connection: (() => {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) return { host: 'localhost', port: 6379 };
        try {
          const url = new URL(redisUrl);
          return {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
            username: url.username || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          };
        } catch {
          return { host: 'localhost', port: 6379 };
        }
      })(),
      concurrency: 1, // One autonomous task at a time
    }
  );

  worker.on('error', (err) => {
    logger.error('[autonomous-worker] Worker error:', err);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[autonomous-worker] Job ${job?.id} failed:`, err);
  });

  logger.info('[autonomous-worker] Autonomous task worker started (concurrency: 1)');
  return worker;
}
