/**
 * nexus-viral-run — thin, human-triggered orchestration driver for the 1→8
 * short-form pipeline (SYN-1075, spec §9 WS1). Stacks on WS3 gates.
 *
 * Stage sequence (each gate is enforced BEFORE the next spend):
 *   Stage 1  brief        — load org/topic brief data
 *   Gate A   runBriefGrill + assertGatePassed('brief')   → abort before generate
 *   Stage 2  copy         — senior-copywriter-style hook + captions
 *   Stage 3  generate     — generate_video (draft tier, 9:16, 6s, 1 variant)
 *   Stage 4  poll         — get_job until rendered / failed / timeout
 *   Gate B   runBroadcastGrill + assertGatePassed('broadcast') → abort before cuts
 *   Stage 5  derive_cuts  — 1→N platform-native cuts (queued_human_gated, inert)
 *   Report                — structured verdict + job/cut refs
 *
 * PHASE-1 BOUNDARY (never crossed here): this driver composes generate + gates +
 * derive only. It contains NO publish/schedule primitive — releasing a cut to a
 * platform is a separate human-gated route (WS4), deliberately not imported.
 *
 * SPEND SAFETY (overnight guardrail, spec §13 / runbook hard-stops):
 *   - `generate_video` is REAL provider spend (~$1.69 draft + renders).
 *   - The live branch is gated behind BOTH `--live` AND explicit spend
 *     confirmation (`--confirm-spend` / NEXUS_VIRAL_CONFIRM_SPEND=1).
 *   - Default (no `--live`): a full DRY-RUN — no generate call, no spend. Every
 *     stage is threaded with placeholder refs so the composition is exercised.
 *   - `--live` WITHOUT confirmation: prints a documented STOP and no-ops the
 *     generate step (never spends). This is the deliberate morning path: a human
 *     (founder) passes `--confirm-spend`, watching, to run the single live proof.
 *
 * nexus-copywriter RESOLUTION (spec named a `nexus-copywriter` AGENT that does
 * NOT exist; only the `senior-copywriter` skill does — verified). The copy stage
 * therefore delegates to a senior-copywriter-style producer over getAIProvider
 * (the headless-callable equivalent of the skill). No phantom agent is imported.
 *
 * All external effects (gates, MCP tools, provider, brief load) are injected via
 * `NexusViralRunDeps` so a unit run is fully mocked — no network, no fal, no DB.
 */

import { getAIProvider } from '@/lib/ai/providers';
import { runBriefGrill, runBroadcastGrill } from '@/lib/video/gates';
import { assertGatePassed } from '@/lib/video/gates/assert-gate-passed';
import type {
  GateName,
  RunGateInput,
  RunGateResult,
} from '@/lib/video/gates/types';
import { executeStudioTool } from '@/lib/services/ai/studio-tools';
import type { ToolContext } from '@/lib/services/ai/studio-tools/types';

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

export interface NexusViralBrief {
  organizationId: string;
  topic: string;
  /** Brand voice / angle notes pulled from org data. */
  angle: string;
  /** Any grounding facts the copy stage must cite. */
  facts: string[];
}

export interface NexusViralCopy {
  /** The scroll-stopping opening line (first 0–1.5s). */
  hook: string;
  /** The generative-video prompt seeded from hook + brief. */
  videoPrompt: string;
  /** Per-cut caption plan (platform → caption). */
  captions: Array<{ platform: string; caption: string }>;
}

export interface NexusViralRunOptions {
  organizationId: string;
  userId: string;
  topic: string;
  /** Real MethodCard id (see list_cards). Defaults to the hero viral card. */
  methodCardId?: string;
  /** Cuts to derive once Gate B passes. Defaults to a YT + IG pair. */
  cuts?: Array<{
    platform: string;
    target: '9:16' | '1:1' | '16:9';
    maxSec: number;
    captionPlacement: 'upper' | 'centre' | 'cover';
    caption: string;
  }>;
  /** Arm the live generate path. Defaults OFF. */
  live?: boolean;
  /** Explicit spend confirmation — required alongside `live` to actually spend. */
  confirmSpend?: boolean;
  /** Max ms to poll get_job before treating the render as timed out. */
  pollTimeoutMs?: number;
  /** Poll interval ms. */
  pollIntervalMs?: number;
}

export type StageStatus = 'ok' | 'skipped' | 'aborted' | 'stopped';

export interface StageRecord {
  stage: string;
  status: StageStatus;
  detail?: Record<string, unknown>;
}

export interface GateSummary {
  pass: boolean;
  score: number;
  failures: string[];
  /** True when the verdict row was not written (a DB write failure). */
  persistenceSkipped: boolean;
}

export interface NexusViralRunReport {
  ok: boolean;
  live: boolean;
  spendConfirmed: boolean;
  /** Stage the run stopped at, or null when it completed. */
  terminatedAt: string | null;
  reason?: string;
  stages: StageRecord[];
  gateA?: GateSummary;
  gateB?: GateSummary;
  jobIds: string[];
  heroAssetId: string | null;
  cuts: Array<{ platform: string; assetId: string; publishState: string }>;
}

// ---------------------------------------------------------------------------
// Injected dependencies (all real IO lives behind this seam)
// ---------------------------------------------------------------------------

export interface NexusViralRunDeps {
  loadBrief: (
    organizationId: string,
    topic: string
  ) => Promise<NexusViralBrief>;
  generateCopy: (brief: NexusViralBrief) => Promise<NexusViralCopy>;
  runBriefGrill: (input: RunGateInput) => Promise<RunGateResult>;
  runBroadcastGrill: (input: RunGateInput) => Promise<RunGateResult>;
  assertGatePassed: (assetRef: string, gate: GateName) => Promise<void>;
  executeStudioTool: (
    name: string,
    args: unknown,
    ctx: ToolContext
  ) => Promise<Record<string, unknown>>;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

const DEFAULT_METHOD_CARD = 'viral-hero-short';

/**
 * Default brief loader. Kept intentionally thin — a production caller supplies a
 * richer org-grounded brief. Reads no external service so the default is safe to
 * type-check; real org data threading is the caller's job.
 */
async function defaultLoadBrief(
  organizationId: string,
  topic: string
): Promise<NexusViralBrief> {
  return {
    organizationId,
    topic,
    angle: `Hook-first, 9:16 short-form on: ${topic}`,
    facts: [],
  };
}

/**
 * Default copy producer — the headless equivalent of the senior-copywriter
 * skill. Emits a structured hook + video prompt + caption plan via
 * getAIProvider(). (The spec's `nexus-copywriter` agent does not exist; this is
 * the resolved substitute.)
 */
async function defaultGenerateCopy(
  brief: NexusViralBrief
): Promise<NexusViralCopy> {
  const ai = getAIProvider();
  const res = await ai.complete({
    model: ai.models.balanced,
    temperature: 0.7,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior short-form copywriter. Return a scroll-stopping ' +
          'hook (max 12 words, a concrete claim — never generic scene-setting) ' +
          'and a matching 9:16 generative-video prompt. Australian English. ' +
          'Respond as: HOOK: <line>\\nPROMPT: <line>',
      },
      {
        role: 'user',
        content: `Topic: ${brief.topic}\nAngle: ${brief.angle}\nFacts: ${brief.facts.join('; ')}`,
      },
    ],
  });
  const text = res.choices[0]?.message?.content ?? '';
  const hook = /HOOK:\s*(.+)/i.exec(text)?.[1]?.trim() ?? brief.topic;
  const videoPrompt =
    /PROMPT:\s*(.+)/i.exec(text)?.[1]?.trim() ?? `${brief.angle}. ${hook}`;
  return {
    hook,
    videoPrompt,
    captions: [
      { platform: 'youtube', caption: hook },
      { platform: 'instagram', caption: hook },
    ],
  };
}

export function defaultDeps(): NexusViralRunDeps {
  return {
    loadBrief: defaultLoadBrief,
    generateCopy: defaultGenerateCopy,
    runBriefGrill,
    runBroadcastGrill,
    assertGatePassed,
    executeStudioTool,
    sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    log: (line: string) => console.log(line),
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function summariseGate(result: RunGateResult): GateSummary {
  return {
    pass: result.pass,
    score: result.verdict.score,
    failures: result.verdict.failures,
    persistenceSkipped: result.persistenceSkipped,
  };
}

const DEFAULT_CUTS: NonNullable<NexusViralRunOptions['cuts']> = [
  {
    platform: 'youtube',
    target: '9:16',
    maxSec: 60,
    captionPlacement: 'upper',
    caption: 'placeholder — replaced by copy stage',
  },
  {
    platform: 'instagram',
    target: '9:16',
    maxSec: 60,
    captionPlacement: 'upper',
    caption: 'placeholder — replaced by copy stage',
  },
];

/**
 * Compose the 1→8 pipeline. Pure orchestration: every effect goes through
 * `deps`. Returns a structured report; a gate FAIL (or a fail-closed
 * assertGatePassed) terminates the run BEFORE any downstream spend and is
 * surfaced on the report — it is never thrown past this function.
 */
export async function runNexusViral(
  options: NexusViralRunOptions,
  deps: NexusViralRunDeps = defaultDeps()
): Promise<NexusViralRunReport> {
  const {
    organizationId,
    userId,
    topic,
    methodCardId = DEFAULT_METHOD_CARD,
    live = false,
    confirmSpend = false,
    pollTimeoutMs = 10 * 60 * 1000,
    pollIntervalMs = 15_000,
  } = options;

  const ctx: ToolContext = { userId, organizationId, initiatedBy: 'studio' };
  const spendConfirmed = live && confirmSpend;

  const report: NexusViralRunReport = {
    ok: false,
    live,
    spendConfirmed,
    terminatedAt: null,
    stages: [],
    jobIds: [],
    heroAssetId: null,
    cuts: [],
  };

  const abort = (
    stage: string,
    reason: string,
    detail?: Record<string, unknown>
  ) => {
    report.stages.push({ stage, status: 'aborted', detail });
    report.terminatedAt = stage;
    report.reason = reason;
    report.ok = false;
    deps.log(`ABORT @ ${stage}: ${reason}`);
    return report;
  };

  // --- Stage 1: brief -----------------------------------------------------
  const brief = await deps.loadBrief(organizationId, topic);
  report.stages.push({ stage: 'brief', status: 'ok', detail: { topic } });
  deps.log(`brief: ${topic}`);

  // --- Gate A: brief grill (pre-generation) -------------------------------
  // Stable run-scoped ref for the brief gate (the run has no earlier id yet).
  const briefRef = `brief:${organizationId}:${topic}`;
  const gateA = await deps.runBriefGrill({
    organizationId,
    createdById: userId,
    assetRef: briefRef,
    candidate: brief,
  });
  report.gateA = summariseGate(gateA);
  if (!gateA.pass) {
    return abort('gateA', 'brief_grill_failed', {
      failures: gateA.verdict.failures,
    });
  }
  // WS3b deterministic enforcement — inert verdict must be a persisted QA row.
  // A fail-closed throw here also stops the run before any spend.
  try {
    await deps.assertGatePassed(briefRef, 'brief');
  } catch (err) {
    return abort('gateA', 'brief_gate_not_enforceable', {
      error: err instanceof Error ? err.message : String(err),
      persistenceSkipped: gateA.persistenceSkipped,
    });
  }
  report.stages.push({
    stage: 'gateA',
    status: 'ok',
    detail: { score: gateA.verdict.score },
  });

  // --- Stage 2: copy ------------------------------------------------------
  const copy = await deps.generateCopy(brief);
  report.stages.push({
    stage: 'copy',
    status: 'ok',
    detail: { hook: copy.hook },
  });
  deps.log(`copy hook: ${copy.hook}`);

  // --- Stage 3: generate_video (REAL SPEND — gated) -----------------------
  if (!spendConfirmed) {
    const why = !live
      ? 'dry-run (no --live): generate_video NOT called, no spend'
      : 'live armed but spend NOT confirmed: pass --confirm-spend to run the paid proof';
    report.stages.push({
      stage: 'generate',
      status: live ? 'stopped' : 'skipped',
      detail: { why },
    });
    report.terminatedAt = 'generate';
    report.reason = why;
    report.ok = true; // a clean dry-run/stop is a successful composition, not a failure
    deps.log(`STOP @ generate: ${why}`);
    return report;
  }

  // Live path (human-triggered, watched). Real provider spend starts here.
  const genResult = await deps.executeStudioTool(
    'generate_video',
    {
      prompt: copy.videoPrompt,
      methodCardId,
      modelTier: 'draft',
      aspectRatio: '9:16',
      durationSeconds: 6,
      variants: 1,
    },
    ctx
  );
  const jobs = Array.isArray(genResult.jobs)
    ? (genResult.jobs as Array<{ id: string }>)
    : [];
  report.jobIds = jobs.map(j => j.id);
  if (report.jobIds.length === 0) {
    return abort('generate', 'no_job_ids_returned', { genResult });
  }
  report.stages.push({
    stage: 'generate',
    status: 'ok',
    detail: { jobIds: report.jobIds },
  });
  deps.log(`generate: jobs=${report.jobIds.join(',')}`);

  // --- Stage 4: poll get_job ---------------------------------------------
  const heroJobId = report.jobIds[0];
  const deadline = Date.now() + pollTimeoutMs;
  let heroJob: {
    id: string;
    status?: string;
    videoUrl?: string | null;
  } | null = null;
  while (Date.now() < deadline) {
    const res = await deps.executeStudioTool('get_job', { id: heroJobId }, ctx);
    const job = res.job as {
      id: string;
      status?: string;
      videoUrl?: string | null;
    } | null;
    if (job?.status === 'rendered') {
      heroJob = job;
      break;
    }
    if (job?.status === 'failed') {
      return abort('poll', 'render_failed', { job });
    }
    await deps.sleep(pollIntervalMs);
  }
  if (!heroJob) {
    return abort('poll', 'render_timed_out', { heroJobId });
  }
  report.heroAssetId = heroJob.id;
  report.stages.push({
    stage: 'poll',
    status: 'ok',
    detail: { heroAssetId: heroJob.id },
  });

  // --- Gate B: broadcast grill (post-generation) --------------------------
  // Ref is the rendered hero id — the SAME id passed to derive_cuts below, so
  // the broadcast verdict this writes is exactly what deriveSocialCut asserts on.
  const gateB = await deps.runBroadcastGrill({
    organizationId,
    createdById: userId,
    assetRef: heroJob.id,
    candidate: { job: heroJob, copy },
  });
  report.gateB = summariseGate(gateB);
  if (!gateB.pass) {
    return abort('gateB', 'broadcast_grill_failed', {
      failures: gateB.verdict.failures,
    });
  }
  try {
    await deps.assertGatePassed(heroJob.id, 'broadcast');
  } catch (err) {
    return abort('gateB', 'broadcast_gate_not_enforceable', {
      error: err instanceof Error ? err.message : String(err),
      persistenceSkipped: gateB.persistenceSkipped,
    });
  }
  report.stages.push({
    stage: 'gateB',
    status: 'ok',
    detail: { score: gateB.verdict.score },
  });

  // --- Stage 5: derive_cuts (inert, queued_human_gated) -------------------
  const captionByPlatform = new Map(
    copy.captions.map(c => [c.platform, c.caption])
  );
  const cutSpec = (options.cuts ?? DEFAULT_CUTS).map(cut => ({
    ...cut,
    caption: captionByPlatform.get(cut.platform) ?? cut.caption,
  }));
  const deriveResult = await deps.executeStudioTool(
    'derive_cuts',
    { heroAssetId: heroJob.id, cuts: cutSpec },
    ctx
  );
  const derivedCuts = Array.isArray(deriveResult.cuts)
    ? (deriveResult.cuts as Array<{
        platform: string;
        assetId: string;
        publishState: string;
      }>)
    : [];
  report.cuts = derivedCuts;
  report.stages.push({
    stage: 'derive_cuts',
    status: 'ok',
    detail: { count: derivedCuts.length },
  });
  deps.log(
    `derive_cuts: ${derivedCuts.length} cuts (queued_human_gated, inert)`
  );

  // NO publish step — releasing cuts is a separate human-gated route (WS4).
  report.ok = true;
  report.terminatedAt = null;
  return report;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): NexusViralRunOptions {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const organizationId = get('--org') ?? process.env.NEXUS_VIRAL_ORG_ID ?? '';
  const userId = get('--user') ?? process.env.NEXUS_VIRAL_USER_ID ?? '';
  const topic = get('--topic') ?? '';
  if (!organizationId || !userId || !topic) {
    throw new Error('Required: --org <id> --user <id> --topic "<topic>"');
  }
  return {
    organizationId,
    userId,
    topic,
    methodCardId: get('--card'),
    live: argv.includes('--live'),
    confirmSpend:
      argv.includes('--confirm-spend') ||
      process.env.NEXUS_VIRAL_CONFIRM_SPEND === '1',
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await runNexusViral(options);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

// Only run when invoked directly (never on import — the unit test imports this).
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
