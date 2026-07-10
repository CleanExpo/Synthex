/**
 * tasks_* namespace — SYN-MCP-007b (SYN-1084 tail).
 *
 * Autonomous-task records are NOT Prisma rows: they live as BullMQ jobs on
 * QUEUE_NAMES.AUTONOMOUS_TASKS (+ Linear state). Reads therefore go through
 * getQueue() and filter IN APP CODE — a job is visible to an MCP caller ONLY
 * when job.data.organizationId === ctx.organizationId (SYN-MCP-007b
 * org-pinning). Jobs without an organizationId (webhook/shell producers) are
 * invisible to EVERY MCP caller; a wrong-org jobId returns { task: null } —
 * never an error oracle (docs/agent-contract-v2.md §7).
 *
 * tasks_enqueue is LINEAR-GATED (bench must_fix `linear-gated-enqueue`): it
 * accepts ONLY a Linear issue id/identifier. Title, description and
 * acceptance criteria are fetched server-side from Linear — an MCP caller can
 * never inject worker-prompt text. The same gates as the webhook producer
 * apply (autonomous label present + eligible state), the job id is the
 * SYN-MCP-005 deterministic content-addressed id (dedupe intact), and the
 * verified-completion lifecycle is untouched: enqueue NEVER moves an issue,
 * the completion-verifier remains the single Done-writer.
 *
 * Degrade honestly (bench must_fix `redis-degrade`): Redis/Linear
 * unreachable → an explicit error payload, never an unhandled throw. List
 * scans are bounded (≤100 jobs per state, ≤50 returned).
 *
 * SECURITY: the `tasks` scope is INTERNAL-UNITE-GROUP-ONLY — tasks_enqueue
 * ultimately drives a Bash+Edit agent against the company Linear. Never grant
 * the scope to an external/client key (deny-by-default scopes [] already
 * holds for fresh keys).
 */
import { z } from 'zod';
import type { Job } from 'bullmq';
import {
  addJob,
  getQueue,
  QUEUE_NAMES,
  type AutonomousTaskJobData,
} from '@/lib/queue/bull-queue';
import { getLinearClient } from '@/lib/linear/client';
import {
  buildJobId,
  buildTaskEnvelope,
  contentHash,
  extractAcceptance,
  parseTaskEnvelope,
} from '@/lib/tasks/task-envelope';
import type { StudioTool } from './types';

// ─── Gates (must match app/api/webhooks/linear/route.ts — the webhook
//     producer applies the same label + state eligibility) ───────────────────

const AUTONOMOUS_LABELS = new Set([
  'pi-dev:autonomous',
  'mesh:auto',
  'autonomous',
]);
const ELIGIBLE_STATE_TYPES = new Set(['backlog', 'unstarted', 'started']);

// ─── Bounded scans (bench must_fix `redis-degrade`) ──────────────────────────

const MAX_SCAN_PER_STATE = 100;
const MAX_LIST_RETURN = 50;
const DEFAULT_LIST_LIMIT = 20;

// ─── Logical task states over BullMQ job states ──────────────────────────────

type LogicalState = 'queued' | 'running' | 'completed' | 'failed';

const STATE_BUCKETS: Record<
  LogicalState,
  Array<
    'waiting' | 'delayed' | 'prioritized' | 'active' | 'completed' | 'failed'
  >
> = {
  queued: ['waiting', 'delayed', 'prioritized'],
  running: ['active'],
  completed: ['completed'],
  failed: ['failed'],
};

function mapBullState(state: string): LogicalState {
  if (state === 'active') return 'running';
  if (state === 'completed') return 'completed';
  if (state === 'failed') return 'failed';
  return 'queued'; // waiting / delayed / prioritized / waiting-children / unknown
}

// ─── Args + output schemas (structuredContent contract — ISO strings only) ───

const ListTasksArgs = z.object({
  state: z.enum(['queued', 'running', 'completed', 'failed']).optional(),
  limit: z.number().int().min(1).max(MAX_LIST_RETURN).optional(),
});

const GetTaskArgs = z.object({ jobId: z.string().min(1) });

const EnqueueTaskArgs = z.object({
  /** Linear issue UUID or human identifier (e.g. "SYN-1234"). The ONLY input:
   * title/description/acceptance are fetched server-side from Linear. */
  issueId: z.string().min(1),
});

const TaskEnvelopeOut = z.object({
  source: z.string(),
  issueId: z.string(),
  identifier: z.string(),
  acceptance: z.array(z.string()),
  budget: z.object({ maxTurns: z.number(), maxCostUsd: z.number() }),
  traceId: z.string(),
  organizationId: z.string().optional(),
});

const TaskRecordOut = z.object({
  jobId: z.string(),
  state: z.enum(['queued', 'running', 'completed', 'failed']),
  issueId: z.string(),
  identifier: z.string(),
  title: z.string().nullable(),
  /** Parsed TaskEnvelope, or null for pre-envelope legacy jobs. */
  envelope: TaskEnvelopeOut.nullable(),
  enqueuedAt: z.string(),
  processedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  attemptsMade: z.number(),
  failedReason: z.string().nullable(),
});

const ListTasksOutput = z.object({
  tasks: z.array(TaskRecordOut),
  total: z.number(),
  /** Explicit degrade signal — non-null when the queue backend is unreachable. */
  error: z.string().nullable(),
});

const GetTaskOutput = z.object({
  task: TaskRecordOut.extend({
    /** Worker return value (run evidence), null until the job completes. */
    result: z.unknown().nullable(),
  }).nullable(),
  error: z.string().nullable(),
});

const EnqueueTaskOutput = z.object({
  enqueued: z.boolean(),
  /** True when a job with the same content-addressed id already exists. */
  deduped: z.boolean(),
  jobId: z.string().nullable(),
  issueId: z.string().nullable(),
  identifier: z.string().nullable(),
  traceId: z.string().nullable(),
  /** Why nothing was enqueued (gate failure / dedupe / backend unreachable). */
  reason: z.string().nullable(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toIso(ms: number | undefined | null): string | null {
  return typeof ms === 'number' && Number.isFinite(ms)
    ? new Date(ms).toISOString()
    : null;
}

function toTaskRecord(
  job: Job,
  state: LogicalState
): z.infer<typeof TaskRecordOut> {
  const data = job.data as AutonomousTaskJobData;
  return {
    jobId: String(job.id ?? ''),
    state,
    issueId: data.issueId,
    identifier: data.identifier,
    title: data.title ?? null,
    envelope: parseTaskEnvelope(data.envelope),
    enqueuedAt: toIso(job.timestamp) ?? new Date(0).toISOString(),
    processedAt: toIso(job.processedOn),
    finishedAt: toIso(job.finishedOn),
    attemptsMade: job.attemptsMade ?? 0,
    failedReason: job.failedReason ?? null,
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const NOT_ENQUEUED = {
  enqueued: false,
  deduped: false,
  jobId: null,
  issueId: null,
  identifier: null,
  traceId: null,
} as const;

// ─── Tools ───────────────────────────────────────────────────────────────────

export const TASKS_TOOLS: StudioTool[] = [
  {
    name: 'tasks_list',
    description:
      'List autonomous task records (queued/running/completed/failed BullMQ jobs on the autonomous-tasks queue) for the caller org, newest first. Org-pinned: only jobs enqueued with your organizationId are visible — org-less internal jobs never appear. Bounded scan (≤100 jobs/state, ≤50 returned). Returns an explicit error field when the queue backend is unreachable.',
    scope: 'tasks',
    riskClass: 'read',
    costClass: 'free',
    schema: ListTasksArgs,
    outputSchema: ListTasksOutput,
    execute: async (args, ctx) => {
      const a = ListTasksArgs.parse(args);
      const states: LogicalState[] = a.state
        ? [a.state]
        : ['queued', 'running', 'completed', 'failed'];
      try {
        const queue = getQueue(QUEUE_NAMES.AUTONOMOUS_TASKS);
        const records: Array<z.infer<typeof TaskRecordOut>> = [];
        for (const logical of states) {
          const jobs = await queue.getJobs(
            STATE_BUCKETS[logical],
            0,
            MAX_SCAN_PER_STATE - 1
          );
          for (const job of jobs) {
            if (!job) continue;
            const data = job.data as AutonomousTaskJobData | undefined;
            // Org-pinning: jobs without an organizationId (webhook/shell
            // producers) are invisible to every MCP caller.
            if (!data || data.organizationId !== ctx.organizationId) continue;
            records.push(toTaskRecord(job, logical));
          }
        }
        records.sort(
          (x, y) => Date.parse(y.enqueuedAt) - Date.parse(x.enqueuedAt)
        );
        const tasks = records.slice(0, a.limit ?? DEFAULT_LIST_LIMIT);
        return { tasks, total: tasks.length, error: null };
      } catch (err) {
        // Redis unreachable → explicit degrade payload, never a throw.
        return {
          tasks: [],
          total: 0,
          error: `task queue unavailable: ${errMessage(err)}`,
        };
      }
    },
  },
  {
    name: 'tasks_get',
    description:
      'Fetch one autonomous task record by BullMQ jobId — envelope, state, timestamps, attempt count, failure reason and the worker result (run evidence) when finished. Org-pinned: a jobId outside your org (or an org-less internal job) returns task: null — never an error oracle. Returns an explicit error field when the queue backend is unreachable.',
    scope: 'tasks',
    riskClass: 'read',
    costClass: 'free',
    schema: GetTaskArgs,
    outputSchema: GetTaskOutput,
    execute: async (args, ctx) => {
      const a = GetTaskArgs.parse(args);
      try {
        const queue = getQueue(QUEUE_NAMES.AUTONOMOUS_TASKS);
        const job = await queue.getJob(a.jobId);
        if (!job) return { task: null, error: null };
        const data = job.data as AutonomousTaskJobData | undefined;
        // Wrong-org (or org-less) job → indistinguishable from absent.
        if (!data || data.organizationId !== ctx.organizationId) {
          return { task: null, error: null };
        }
        const state = mapBullState(await job.getState());
        return {
          task: {
            ...toTaskRecord(job, state),
            result: job.returnvalue ?? null,
          },
          error: null,
        };
      } catch (err) {
        return {
          task: null,
          error: `task queue unavailable: ${errMessage(err)}`,
        };
      }
    },
  },
  {
    name: 'tasks_enqueue',
    description:
      'Enqueue an autonomous task for a Linear issue via the SYN-MCP-005 deterministic-jobId path. Accepts ONLY a Linear issue id/identifier — title, description and acceptance criteria are fetched server-side from Linear (callers can never inject worker-prompt text). Gated exactly like the webhook producer: the issue must carry an autonomous label and be in an eligible state (Backlog/Todo/In Progress). Same content → same jobId → deduped. Drafts work only: the verified-completion lifecycle is untouched — Done still requires the completion-verifier (PR + green CI). Internal-Unite-Group scope: never grant `tasks` to external keys.',
    scope: 'tasks',
    riskClass: 'draft',
    costClass: 'free',
    schema: EnqueueTaskArgs,
    outputSchema: EnqueueTaskOutput,
    execute: async (args, ctx) => {
      const a = EnqueueTaskArgs.parse(args);

      // 1. Fetch the issue server-side (Linear-gated enqueue: the caller's
      //    only input is the issue reference).
      let issueId: string;
      let identifier: string;
      let title: string;
      let description: string | null;
      let hasAutonomousLabel: boolean;
      let stateType: string | undefined;
      try {
        const linear = getLinearClient();
        const issue = await linear.issue(a.issueId);
        if (!issue) {
          return { ...NOT_ENQUEUED, reason: 'issue not found in Linear' };
        }
        const [labels, state] = await Promise.all([
          issue.labels(),
          issue.state,
        ]);
        issueId = issue.id;
        identifier = issue.identifier;
        title = issue.title;
        description = issue.description ?? null;
        hasAutonomousLabel = labels.nodes.some(l =>
          AUTONOMOUS_LABELS.has(l.name.toLowerCase())
        );
        stateType = state?.type;
      } catch (err) {
        return {
          ...NOT_ENQUEUED,
          reason: `linear unavailable: ${errMessage(err)}`,
        };
      }

      // 2. Same gates as the webhook producer (route.ts): label + state.
      if (!hasAutonomousLabel) {
        return {
          ...NOT_ENQUEUED,
          issueId,
          identifier,
          reason:
            'issue does not carry an autonomous label (pi-dev:autonomous / mesh:auto / autonomous)',
        };
      }
      if (stateType === undefined || !ELIGIBLE_STATE_TYPES.has(stateType)) {
        return {
          ...NOT_ENQUEUED,
          issueId,
          identifier,
          reason: `issue state '${stateType ?? 'unknown'}' is not eligible (backlog/unstarted/started only)`,
        };
      }

      // 3. Deterministic content-addressed identity (SYN-MCP-005) — the
      //    dedupe path the webhook uses, unchanged.
      const jobId = buildJobId(issueId, contentHash(title, description));

      try {
        const queue = getQueue(QUEUE_NAMES.AUTONOMOUS_TASKS);
        const existing = await queue.getJob(jobId);
        if (existing) {
          const existingEnvelope = parseTaskEnvelope(
            (existing.data as AutonomousTaskJobData | undefined)?.envelope
          );
          return {
            enqueued: false,
            deduped: true,
            jobId,
            issueId,
            identifier,
            traceId: existingEnvelope?.traceId ?? null,
            reason:
              'duplicate: a job with this content-addressed id already exists (edit the issue content to re-run)',
          };
        }

        const envelope = buildTaskEnvelope({
          source: 'mcp',
          issueId,
          identifier,
          acceptance: extractAcceptance(description),
          organizationId: ctx.organizationId,
        });

        await addJob(
          QUEUE_NAMES.AUTONOMOUS_TASKS,
          {
            type: 'autonomous:execute-task',
            issueId,
            identifier,
            title,
            description,
            envelope,
            // Org-pinning: makes this job visible to tasks_list/tasks_get for
            // this caller org (and only this org).
            organizationId: ctx.organizationId,
          },
          { jobId }
        );

        return {
          enqueued: true,
          deduped: false,
          jobId,
          issueId,
          identifier,
          traceId: envelope.traceId,
          reason: null,
        };
      } catch (err) {
        return {
          ...NOT_ENQUEUED,
          issueId,
          identifier,
          reason: `task queue unavailable: ${errMessage(err)}`,
        };
      }
    },
  },
];
