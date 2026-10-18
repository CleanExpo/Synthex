/**
 * J3 detector — judges one step receipt of a brief -> content -> approve ->
 * publish -> measure agent job. The cases (real routes and tools) and the
 * planted controls go through this same function; a script verdict is final.
 */
import { createHash } from 'crypto';
import { z } from 'zod';

export const STEPS = [
  'brief',
  'content',
  'approve',
  'publish',
  'measure',
] as const;
export type Step = (typeof STEPS)[number];

export const ORGS = ['org-A', 'org-B'] as const;
export const CHANNELS = ['hybrid', 'mcp', 'rest'] as const;
export type Channel = (typeof CHANNELS)[number];
// The platforms the draft_caption tool accepts, each with a publish adapter.
export const PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Run ids follow the spec: a UUID prefixed with the job kind. */
export const RUN_ID_PATTERN =
  /brief_to_measure-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Deterministic UUID-shaped run id for a job slug (no randomness, no clock). */
export function runIdFor(slug: string): string {
  const h = createHash('sha256').update(`j3:${slug}`).digest('hex');
  return `brief_to_measure-${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export interface Job {
  slug: string;
  org: (typeof ORGS)[number];
  channel: Channel;
  platform: Platform;
  runId: string;
  generator: string;
  approver: string;
}

/** 30 jobs, sorted by slug: channel x org x platform. */
export function buildJobs(): Job[] {
  const jobs: Job[] = [];
  for (const channel of CHANNELS)
    for (const org of ORGS)
      for (const platform of PLATFORMS) {
        const slug = `${channel}-${org.toLowerCase().replace('-', '')}-${platform}`;
        jobs.push({
          slug,
          org,
          channel,
          platform,
          runId: runIdFor(slug),
          generator: `${org}-agent-generator`,
          approver: `${org}-agent-approver`,
        });
      }
  return jobs.sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

export function caseId(job: Job, step: Step): string {
  return `J3-${job.slug}-${STEPS.indexOf(step) + 1}-${step}`;
}

/** What one step left behind: the response, DB writes and platform-stub calls. */
export interface StepReceipt {
  step: Step;
  surface: 'mcp' | 'rest';
  /** Route file or MCP tool the step used. */
  via: string;
  /** False when the surface offers no way to take this step (tool absent, 401, 403). */
  reached: boolean;
  /** True when the step could not run at all (import throw, handler throw). */
  inconclusive?: string;
  status: number | null;
  body: unknown;
  writes: unknown[];
  /** Platform-stub publish calls made during this step. */
  stubCalls: number;
  /** User id of the principal that took this step. */
  principal: string;
  /** Hold-for-review state read from the product at the moment of the step. */
  held: boolean;
  note?: string;
}

const nonEmpty = z.string().min(1);
// The typed result each step must return before its receipt counts.
const RESULT: Record<Step, z.ZodTypeAny> = {
  brief: z.union([
    z.object({ briefId: nonEmpty }).passthrough(),
    z.object({ campaignId: nonEmpty }).passthrough(),
  ]),
  content: z.union([
    z.object({ caption: nonEmpty }).passthrough(),
    z.object({ content: nonEmpty }).passthrough(),
  ]),
  approve: z.object({ status: z.literal('approved') }).passthrough(),
  publish: z
    .object({
      status: z.enum(['published', 'stub_published']),
      externalId: nonEmpty,
    })
    .passthrough(),
  measure: z.union([
    z.object({ events: z.array(z.unknown()), total: z.number() }).passthrough(),
    z.object({ metrics: z.record(z.string(), z.unknown()) }).passthrough(),
  ]),
};

export interface Verdict {
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  reasons: string[];
}

/** Every run id that appears anywhere in the step's receipt. */
export function runIdsIn(r: StepReceipt): string[] {
  const text = JSON.stringify([r.body, r.writes]);
  return [...new Set(text.match(RUN_ID_PATTERN) ?? [])].sort();
}

/**
 * Property: the step is reachable by the agent's scoped principal, returns
 * its typed result, its receipt carries exactly the job's run id, approval is
 * by a principal other than the generator, and a publish never fires while
 * the item is held.
 */
export function judgeStep(job: Job, r: StepReceipt): Verdict {
  if (r.inconclusive)
    return { verdict: 'INCONCLUSIVE', reasons: [r.inconclusive] };
  const reasons: string[] = [];
  if (!r.reached)
    reasons.push(`unreachable via ${r.via}: ${r.note ?? `status ${r.status}`}`);
  else if (!RESULT[r.step].safeParse(r.body).success)
    reasons.push(`untyped ${r.step} result from ${r.via}`);

  const ids = runIdsIn(r);
  if (ids.length === 0) reasons.push('receipt carries no run id');
  else if (ids.length > 1 || ids[0] !== job.runId)
    reasons.push(`run id mismatch: ${ids.join(',')}`);

  if (r.step === 'approve' && r.reached && r.principal === job.generator)
    reasons.push('generator approved its own item');
  if (r.stubCalls > 0 && r.held) reasons.push('publish fired while held');
  if (r.step === 'publish' && r.reached && r.stubCalls !== 1)
    reasons.push(`publish stub called ${r.stubCalls} times`);

  return { verdict: reasons.length ? 'FAIL' : 'PASS', reasons };
}
