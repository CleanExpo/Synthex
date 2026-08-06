/**
 * Daily Autopilot Cron
 *
 * GET /api/cron/autopilot
 * Runs daily at 2 AM UTC via Vercel Cron.
 *
 * For each org with autopilot enabled and nextRunAt <= now:
 *   1. Plan daily content (detect gaps in the horizon)
 *   2. Generate content for each gap slot
 *   3. Score → quality gate → schedule or draft
 *   4. Update config.lastRunAt, config.nextRunAt
 *   5. Record AutopilotRun
 *
 * @module app/api/cron/autopilot/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AIContentGenerator } from '@/lib/ai/content-generator';
import type { ContentRequest } from '@/lib/ai/content-generator';
import type { Platform } from '@/lib/ml/posting-time-predictor';
import { planDailyContent } from '@/lib/autopilot/daily-planner';
import { evaluateContent, scoreDimensions } from '@/lib/autopilot/quality-gate';
import type { ContentMix, ContentTheme } from '@/lib/autopilot/types';
import type { GroundedPostImageMeta } from '@/lib/autopilot/grounded-post-image';
import { PLATFORM_SPECS, THEME_PROMPTS } from '@/lib/autopilot/types';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { serializeError } from '@/lib/observability/serialize-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const MAX_REGENERATION_ATTEMPTS = 2;

// ── Time budget ─────────────────────────────────────────────────────────────
// Vercel terminates the function at `maxDuration` with no opportunity to write
// anything, so a run killed inside the slot loop never reaches the finalising
// `autopilotRun.update` below and is left at status='running' indefinitely.
// Nineteen consecutive production runs (2026-07-17 → 2026-08-05) died exactly
// that way at 300,000 ms, and only ops.watchdog()'s reaper ever marked them
// failed — an hour later, from outside the application.
//
// So the loop stops itself instead of being stopped. Before starting each slot
// it checks whether the remaining budget can fit another; if not it breaks and
// finalises, keeping the work already done.
//
// SLOT_RESERVE_MS must cover the slowest single slot PLUS the finalising
// writes. Measured per-slot cost across 12 production runs: 19.5–25.9 s
// (p95 ≈ 26 s). 45 s leaves the p95 slot room to finish and the run row room to
// be written, and is deliberately generous — under-reserving reintroduces the
// exact failure, while over-reserving only defers a slot to tomorrow's run.
const RUN_BUDGET_MS = maxDuration * 1000;
const SLOT_RESERVE_MS = 45_000;

// Cost of one content-generation round trip, used to decide whether a slot can
// afford a second attempt. Measured from model_metrics: gpt-4o-mini averaged
// 7,256-15,685 ms per request across the last five weeks. 12 s sits inside that
// band and errs high, so the estimate under-promises retries rather than
// over-committing the budget.
const SINGLE_CALL_MS = 12_000;
const VALID_PLATFORMS: Platform[] = [
  'twitter',
  'instagram',
  'linkedin',
  'facebook',
  'tiktok',
  'youtube',
];

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'AUTOPILOT');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:autopilot:start', { timestamp: new Date().toISOString() });

  try {
    const now = new Date();

    // Find all orgs with enabled autopilot that are due for a run
    const configs = await prisma.autopilotConfig.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            industry: true,
            brandDna: {
              select: {
                businessName: true,
                industry: true,
                brandVoice: true,
                offerings: true,
              },
            },
            users: {
              select: { id: true },
              take: 1,
            },
            // Org membership runs through team_members, not the users FK —
            // most orgs (incl. all portfolio businesses) have 0 rows on
            // `users.organizationId` but real accepted owners in team_members.
            // Resolve the attributable user from here first.
            teamMembers: {
              where: { acceptedAt: { not: null } },
              select: { userId: true, role: true },
              take: 10,
            },
          },
        },
      },
    });

    logger.info('cron:autopilot:orgs-found', { count: configs.length });

    let totalGenerated = 0;
    let totalOrgsProcessed = 0;
    let runBudgetExhausted = false;

    for (const config of configs) {
      // Do not open an organisation there is no time to serve. Starting one
      // sets status='generating' and creates a run row that the ceiling would
      // then strand — manufacturing precisely the orphaned 'running' rows this
      // budget exists to prevent.
      // Read the clock ONCE here and reuse it for the planner's deadline below.
      // Same discipline as the slot loop: a second read would report a
      // different elapsed than the one the guard acted on, and — because the
      // terminal-status suite models the clock as advancing on every read — a
      // redundant read is 25 simulated seconds charged to the budget under test.
      const orgStartedAt = Date.now();
      if (orgStartedAt - startTime > RUN_BUDGET_MS - SLOT_RESERVE_MS) {
        runBudgetExhausted = true;
        logger.warn('cron:autopilot:budget-exhausted-before-org', {
          orgId: config.organizationId,
          orgsProcessed: totalOrgsProcessed,
          orgsRemaining: configs.length - totalOrgsProcessed,
        });
        break;
      }

      // Hoisted OUT of the try so the catch can finalise a run it did not
      // create. Previously every one of these lived inside the try, so an
      // exception anywhere after autopilotRun.create() left the row at
      // status='running' forever and threw the counters away with the stack —
      // and the catch below, which only ever touched autopilotConfig, had no
      // way to see either. That is why a stranded run reported
      // posts_generated = 0 while 10-13 real posts sat in the posts table:
      // the same defect produced both the orphan and the false zero.
      let run: { id: string } | null = null;
      let runFinalised = false;
      // Seeded from startTime rather than a fresh Date.now(): until the run row
      // exists there is no run to have started, and the real value is assigned
      // immediately after creation. Avoiding the read is not micro-optimisation
      // — the terminal-status suite models the clock as advancing on every
      // read, so a redundant read there is 25 simulated seconds charged to the
      // budget under test.
      let runStartedAt = startTime;
      let slotsPlanned = 0;
      const postIds: string[] = [];
      let postsScheduled = 0;
      let postsDrafted = 0;
      let postsRejected = 0;
      let totalScore = 0;
      let budgetExhausted = false;

      try {
        // Mark as generating
        await prisma.autopilotConfig.update({
          where: { id: config.id },
          data: { status: 'generating' },
        });

        const org = config.organization;
        // Prefer an accepted team member (owner → admin → any), since org
        // membership lives in team_members; fall back to the legacy users FK.
        const userId =
          org.teamMembers.find(m => m.role === 'owner')?.userId ??
          org.teamMembers.find(m => m.role === 'admin')?.userId ??
          org.teamMembers[0]?.userId ??
          org.users[0]?.id;
        if (!userId) {
          // An org with autopilot enabled but no user to attribute content to
          // cannot be processed. The bare `continue` here (after status was set
          // to 'generating' above) left the config pinned at 'generating' with
          // lastRunAt/nextRunAt never advanced — so it stayed perpetually "due"
          // and every run re-entered and re-skipped it (observed: one org stuck
          // 26 days). Reset to a visible error state and advance nextRunAt so
          // the gap surfaces (add a user or disable autopilot) instead of
          // silently looping.
          logger.warn('cron:autopilot:skip-no-user', { orgId: org.id });
          await prisma.autopilotConfig.update({
            where: { id: config.id },
            data: {
              status: 'error',
              lastErrorMessage:
                'Autopilot is enabled but the organisation has no user to attribute content to. Add a user to this organisation or disable autopilot.',
              nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
          });
          continue;
        }

        // Plan what content is needed.
        //
        // Bounded like everything else on the path. The planner runs BEFORE the
        // run row exists, so a hang here strands no row — but it does consume
        // the whole invocation and starve every remaining organisation, which
        // is its own silent failure. Throwing routes into the organisation
        // catch, which marks the config and moves on.
        const plan = await withDeadline(
          planDailyContent(
            org.id,
            config.enabledPlatforms,
            config.planningHorizonDays,
            config.postsPerDayPerPlatform,
            config.contentMix as ContentMix
          ),
          // Measured from NOW, not from orgStartedAt. orgStartedAt is read
          // before the status='generating' write and the org lookup, so reusing
          // it hands the planner a slice that has already been partly spent —
          // a 30 s config write let the planner run to t=285 s against a
          // reserve that promised t=255 s, leaving 15 s for the terminal write.
          // Reusing a clock read is only correct while nothing has happened
          // since it was taken.
          startTime + RUN_BUDGET_MS - SLOT_RESERVE_MS - Date.now(),
          `planDailyContent (${org.id})`
        );

        if (plan.slots.length === 0) {
          await prisma.autopilotConfig.update({
            where: { id: config.id },
            data: {
              status: 'idle',
              lastRunAt: now,
              nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
              lastErrorMessage: null,
            },
          });
          continue;
        }

        // Find or create autopilot campaign
        let campaign = await prisma.campaign.findFirst({
          where: {
            organizationId: org.id,
            settings: { path: ['source'], equals: 'autopilot' },
            status: 'active',
          },
          select: { id: true },
        });

        if (!campaign) {
          campaign = await prisma.campaign.create({
            data: {
              name: `Autopilot Content — ${org.brandDna?.businessName ?? org.name}`,
              platform: config.enabledPlatforms[0] ?? 'instagram',
              status: 'active',
              userId,
              organizationId: org.id,
              settings: { source: 'autopilot', generatedAt: now.toISOString() },
            },
            select: { id: true },
          });
        }

        // Generate content for each slot
        const generator = new AIContentGenerator();
        const brandVoice = org.brandDna?.brandVoice as Record<
          string,
          unknown
        > | null;
        const tone = (brandVoice?.tone as string) ?? 'professional';
        const offerings = (org.brandDna?.offerings as string[]) ?? [];
        const businessName = org.brandDna?.businessName ?? org.name;
        const industry = org.brandDna?.industry ?? org.industry ?? '';

        // `created` is the non-null local the body uses; `run` is the hoisted
        // handle the catch needs. Assigning both keeps the type honest without
        // sprinkling non-null assertions through the slot loop.
        const created = await prisma.autopilotRun.create({
          data: {
            organizationId: org.id,
            runType: 'daily',
            status: 'running',
            campaignId: campaign.id,
            inputSummary: {
              slotsPlanned: plan.slots.length,
              platforms: config.enabledPlatforms,
            },
          },
        });
        run = created;

        slotsPlanned = plan.slots.length;
        runStartedAt = Date.now();
        let slotIndex = 0;

        for (const slot of plan.slots) {
          // Stop before the ceiling stops us. Checked BEFORE the slot rather
          // than after, because a slot started with 20 s left is a slot whose
          // work is thrown away along with the run row that would have recorded
          // it.
          // Read the clock ONCE and use that value for both the decision and
          // the log. Re-reading for the log reports a different elapsed than the
          // one the guard actually acted on — microseconds apart in production,
          // but it makes the log a description of a decision that was never
          // taken, which is exactly the sort of near-miss that makes an incident
          // unreconstructable afterwards.
          const elapsedMs = Date.now() - startTime;
          if (elapsedMs > RUN_BUDGET_MS - SLOT_RESERVE_MS) {
            budgetExhausted = true;
            logger.warn('cron:autopilot:budget-exhausted', {
              orgId: org.id,
              runId: created.id,
              slotsPlanned: plan.slots.length,
              slotsCompleted: postIds.length,
              elapsedMs,
            });
            break;
          }

          // Can this slot afford a second attempt?
          //
          // Attempts beyond the first are a best-of-N quality mechanism — the
          // loop keeps the higher-scoring draw — not a correctness requirement.
          // Affordable means: after paying for this retry, every REMAINING slot
          // can still get its one mandatory call, and the finalising write still
          // fits. Judged per slot rather than once per run, so the budget
          // tightens naturally as the run proceeds.
          const slotsRemaining = plan.slots.length - slotIndex;
          const retryAffordable =
            RUN_BUDGET_MS - elapsedMs >
            slotsRemaining * SINGLE_CALL_MS + SINGLE_CALL_MS + SLOT_RESERVE_MS;
          slotIndex++;

          try {
            const result = await generateSlotContent({
              generator,
              retryAffordable,
              deadlineAt: startTime + RUN_BUDGET_MS - SLOT_RESERVE_MS,
              slot,
              businessName,
              industry,
              tone,
              offerings,
              campaignId: campaign.id,
              orgId: org.id,
              userId,
              runId: created.id,
              autoApproveThreshold: config.autoApproveThreshold,
              minScoreThreshold: config.minScoreThreshold,
            });

            if (result) {
              postIds.push(result.postId);
              totalScore += result.score;
              if (result.status === 'scheduled') postsScheduled++;
              else if (result.status === 'draft') postsDrafted++;
              else postsRejected++;
            } else {
              postsRejected++;
            }
          } catch {
            postsRejected++;
          }
        }

        const avgScore =
          postIds.length > 0 ? Math.round(totalScore / postIds.length) : 0;
        totalGenerated += postIds.length;

        // Finalise run.
        //
        // 'partial' is a first-class outcome, not a dressed-up failure: the run
        // did real work and stopped deliberately. Reporting it as 'completed'
        // would hide that slots were skipped; reporting it as 'failed' would
        // repeat the production defect where 10-13 genuinely generated posts
        // were recorded as posts_generated = 0 and left unattributed.
        const runStatus = budgetExhausted
          ? postIds.length > 0
            ? 'partial'
            : 'failed'
          : postIds.length > 0
            ? 'completed'
            : 'failed';

        await prisma.autopilotRun.update({
          where: { id: created.id },
          data: {
            status: runStatus,
            postsGenerated: postIds.length,
            postsScheduled,
            postsDrafted,
            postsRejected,
            avgScore,
            postIds,
            completedAt: new Date(),
            // Per-RUN elapsed, not per-invocation. This previously measured from
            // the request's startTime, so with more than one org every run after
            // the first reported the cumulative time of all its predecessors.
            durationMs: Date.now() - runStartedAt,
            ...(budgetExhausted
              ? {
                  errorMessage: `Stopped at the time budget after ${postIds.length}/${plan.slots.length} slots. Remaining slots roll to the next run.`,
                }
              : {}),
          },
        });
        // Set only AFTER the write returns. Setting it before would make a
        // failed finalising write look finalised to the catch below, which is
        // the one path that most needs to know it was not.
        runFinalised = true;

        // Schedule next run
        await prisma.autopilotConfig.update({
          where: { id: config.id },
          data: {
            status: 'idle',
            lastRunAt: now,
            nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            lastErrorMessage: null,
          },
        });

        totalOrgsProcessed++;
        // Surface this org's budget outcome to the invocation, so the response
        // and the log say a partial pass happened rather than reporting a clean
        // sweep that skipped slots.
        if (budgetExhausted) runBudgetExhausted = true;
      } catch (err) {
        logger.error('cron:autopilot:org-error', {
          orgId: config.organizationId,
          error: err instanceof Error ? err.message : String(err),
        });

        // Close the run this organisation opened. Without this the row stays
        // at status='running' forever: the reaper eventually marks it failed
        // from outside the application, but it cannot know what the run
        // produced, so the posts that DID land are recorded as zero. Writing
        // the counters here is the difference between "failed, generated 11"
        // and the false zero that hid twelve nights of real work.
        if (run && !runFinalised) {
          try {
            const avgScoreOnError =
              postIds.length > 0 ? Math.round(totalScore / postIds.length) : 0;
            // updateMany with a status guard, NOT update. `runFinalised` is a
            // local belief about a remote write, and the two disagree in a real
            // case: if the finalising update COMMITS but its response is lost —
            // connection reset after commit, which is the ordinary way a
            // database call fails — the flag stays false and this block would
            // rewrite a finished run, turning 'completed' into 'partial' and
            // corrupting the counters it exists to protect.
            //
            // The row is the only honest arbiter of whether the row was
            // written. Guarding on status='running' makes the recovery
            // idempotent: it fires exactly when the run is genuinely unfinished
            // and silently no-ops when it is not.
            await prisma.autopilotRun.updateMany({
              where: { id: run.id, status: 'running' },
              data: {
                // Real work that stopped for a bad reason is 'partial', the
                // same as work that stopped for the budget. Only a run that
                // produced nothing is 'failed'.
                status: postIds.length > 0 ? 'partial' : 'failed',
                postsGenerated: postIds.length,
                postsScheduled,
                postsDrafted,
                postsRejected,
                avgScore: avgScoreOnError,
                postIds,
                completedAt: new Date(),
                durationMs: Date.now() - runStartedAt,
                errorMessage: `Run stopped by an error after ${postIds.length}/${slotsPlanned} slots: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              },
            });
            runFinalised = true;
          } catch (finaliseErr) {
            // Never let the recovery write mask the original failure. If this
            // also fails the row stays 'running' and the watchdog reaper is the
            // backstop — which is exactly the state this block exists to make
            // rare rather than routine.
            logger.error('cron:autopilot:run-finalise-failed', {
              orgId: config.organizationId,
              runId: run.id,
              originalError: err instanceof Error ? err.message : String(err),
              finaliseError:
                finaliseErr instanceof Error
                  ? finaliseErr.message
                  : String(finaliseErr),
            });
          }
        }

        await prisma.autopilotConfig.update({
          where: { id: config.id },
          data: {
            status: 'error',
            lastErrorMessage: err instanceof Error ? err.message : String(err),
            nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:autopilot:end', {
      orgsProcessed: totalOrgsProcessed,
      totalGenerated,
      durationMs: duration,
      budgetExhausted: runBudgetExhausted,
    });

    return NextResponse.json({
      success: true,
      orgsProcessed: totalOrgsProcessed,
      totalGenerated,
      durationMs: duration,
      budgetExhausted: runBudgetExhausted,
    });
  } catch (error) {
    // SYN-999: serialize the Error so its message + stack actually survive
    // logger.error's JSON.stringify (Error props are non-enumerable → were logged as {}).
    // Surface the message in the response too so the cron invocation output shows the cause.
    const detail = serializeError(error);
    logger.error('cron:autopilot:fatal', detail);
    return NextResponse.json(
      { error: 'Autopilot cron failed', message: detail.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER — Generate a single slot's content
// ============================================================================

interface SlotInput {
  generator: AIContentGenerator;
  /**
   * Whether the run can still afford a second generation attempt on content
   * that is already acceptable. False does not suppress the retry on REJECTED
   * content — see the loop below.
   */
  retryAffordable: boolean;
  /**
   * Absolute epoch-ms after which this slot must not begin further work.
   *
   * The hard bound. `retryAffordable` is an estimate and can be wrong; this
   * cannot, so every attempt and every awaited call inside the slot is measured
   * against it.
   */
  deadlineAt: number;
  slot: { platform: string; date: Date; theme: ContentTheme };
  businessName: string;
  industry: string;
  tone: string;
  offerings: string[];
  campaignId: string;
  orgId: string;
  userId: string;
  runId: string;
  autoApproveThreshold: number;
  minScoreThreshold: number;
}

/**
 * Bound how long we WAIT for a call. It does not, and cannot, cancel one.
 *
 * Be precise about the guarantee, because the imprecise version is a lie that
 * reads like a fix. Promise.race settles the race; the losing promise keeps
 * running. There is no cancellation here and there cannot be without an
 * AbortSignal plumbed through the content generator, Prisma and the image
 * pipeline — none of which currently accept one.
 *
 * What this DOES guarantee is the thing the run actually needs: control returns
 * to the loop at a known time, so the loop reaches its finalising write before
 * Vercel's ceiling instead of being killed mid-flight. The abandoned operation
 * dies with the function a few seconds later, having cost money and produced
 * nothing — wasteful, but bounded, and vastly better than a run stranded at
 * status='running' with its counters lost.
 *
 * `retryAffordable` cannot do this job: it is an ESTIMATE from an average call
 * cost, so it bounds the expected case and nothing else. One hung provider call
 * walks straight past it.
 *
 * Rejects rather than resolving a sentinel: every caller here already treats a
 * throw as "this produced nothing", so a rejection routes into existing
 * handling instead of needing a new branch at each site.
 */
async function withDeadline<T>(
  work: Promise<T>,
  msRemaining: number,
  label: string
): Promise<T> {
  if (msRemaining <= 0) {
    throw new Error(`autopilot: no budget left for ${label}`);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `autopilot: ${label} exceeded its ${msRemaining} ms slice of the run budget`
              )
            ),
          msRemaining
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateSlotContent(input: SlotInput): Promise<{
  postId: string;
  score: number;
  status: 'scheduled' | 'draft' | 'rejected';
} | null> {
  const spec = PLATFORM_SPECS[input.slot.platform];
  if (!spec) return null;

  let bestContent = '';
  let bestScore = 0;
  let bestDecision: 'schedule' | 'draft' | 'reject' = 'reject';
  let bestDimensions: Record<string, number> = {};

  for (let attempt = 1; attempt <= MAX_REGENERATION_ATTEMPTS; attempt++) {
    // Never OPEN an attempt there is no clock left to finish. Checked here as
    // well as at the bottom of the loop because the bottom check reasons about
    // an estimated call cost, while this one reasons about the fact that the
    // budget is already spent.
    // One read, used for both the admission check and the slice handed to
    // withDeadline below. Reading twice back-to-back reports a budget the guard
    // never acted on.
    const attemptStartedAt = Date.now();
    if (attemptStartedAt >= input.deadlineAt) break;
    try {
      const request: ContentRequest = {
        type: 'post',
        platform: input.slot.platform as ContentRequest['platform'],
        topic: THEME_PROMPTS[input.slot.theme],
        tone: input.tone as ContentRequest['tone'],
        targetAudience: `customers of ${input.businessName}`,
        keywords: input.offerings.slice(0, 5),
        includeEmojis: input.slot.platform !== 'linkedin',
        includeHashtags: spec.hashtagCount > 0,
        includeCTA: true,
        orgId: input.orgId,
      };

      // SYN-MCP-003: server-built context — org/user from the cron slot
      // input, traceId = the autopilot run id.
      const generated = await withDeadline(
        input.generator.generateContent(request, {
          organizationId: input.orgId,
          userId: input.userId,
          taskId: input.runId,
          traceId: input.runId,
          autonomyLevel: 'autonomous',
        }),
        input.deadlineAt - attemptStartedAt,
        `generateContent attempt ${attempt} (${input.slot.platform})`
      );
      const gate = evaluateContent(
        generated.content,
        input.slot.platform,
        input.autoApproveThreshold,
        input.minScoreThreshold
      );

      if (gate.score > bestScore) {
        bestContent = generated.content;
        bestScore = gate.score;
        bestDecision = gate.decision;
        bestDimensions = scoreDimensions(
          generated.content,
          input.slot.platform
        );
      }

      if (gate.decision === 'schedule') break;

      // A non-reject draw is already an acceptable outcome held for review, so
      // another attempt only buys a chance at a higher score. Spend it only
      // when the run can afford to.
      //
      // This is what put the job over the ceiling. The break above fires only
      // on 'schedule', and Disaster Recovery — the sole organisation autopilot
      // runs — carries auto_approve_threshold = 100 against an observed score
      // range of 73-85, so 'schedule' never occurred and every slot spent both
      // attempts. Measured at 2.03 and 2.05 calls per post across two separate
      // weeks of model_metrics: 14 slots x 2 calls x ~10 s = ~280 s against a
      // 300 s ceiling, which is why it missed by seconds and why exactly one
      // night in twenty happened to fit.
      //
      // A REJECTED draw earns another attempt where the ESTIMATE says the run
      // cannot afford one: escaping reject is this loop's actual purpose, and
      // denying it to save an estimated 12 s would silently lower the content
      // floor — an invisible quality regression traded for a visible timeout.
      //
      // But it does NOT earn one past the wall clock. That exemption was
      // unbounded, so a slot drawing reject twice could re-enter the generator
      // with no budget left and carry the run through the 300 s ceiling — the
      // exact failure this change removes, reintroduced through the quality
      // door. Past the clock there is no quality argument left to make: the
      // function is killed mid-write and the draw is not recorded at all, so
      // retrying buys a rejected post nobody ever sees.
      const msLeft = input.deadlineAt - Date.now();
      if (msLeft < SINGLE_CALL_MS) break;
      if (gate.decision !== 'reject' && !input.retryAffordable) break;
    } catch {
      // Continue to next attempt
    }
  }

  if (!bestContent || bestDecision === 'reject') {
    return null;
  }

  // Optimal time
  let scheduledAt = input.slot.date;
  if (VALID_PLATFORMS.includes(input.slot.platform as Platform)) {
    try {
      const { postingTimePredictor } =
        await import('@/lib/ml/posting-time-predictor');
      // Bounded. A previous round left this unwrapped on the stated grounds
      // that it was an in-process predictor which could not hang. That was
      // wrong and was never checked: getOptimalTimes awaits Supabase over the
      // network (lib/ml/posting-time-predictor.ts:328), so it is exactly the
      // kind of call that can hang indefinitely, and the surrounding catch
      // cannot help with a request that never settles.
      //
      // The fallback to the slot's own date makes expiry harmless, so bounding
      // it costs nothing and removes a real stall path.
      const timeResult = await withDeadline(
        postingTimePredictor.getOptimalTimes(
          input.userId,
          input.slot.platform as Platform,
          'Australia/Sydney'
        ),
        input.deadlineAt - Date.now(),
        `getOptimalTimes (${input.slot.platform})`
      );
      const optHour = timeResult.topSlot.hour;
      scheduledAt = new Date(input.slot.date);
      scheduledAt.setHours(optHour, 0, 0, 0);
    } catch {
      // Keep default
    }
  }

  // Real Images Only (docs/specs/autopilot-grounded-images.md): a scheduled
  // autonomous post must carry a real GROUNDED image. Generate one image via
  // the sanctioned entry point ONLY for would-be-scheduled posts (bounds cost
  // to one image per auto-published post). If no grounded image is produced —
  // blocked (no owned references), failure, or defensively ungrounded — the
  // helper downgrades the post to 'draft' and attaches NO image (never a
  // placeholder/stock/ungrounded URL). Draft/reject posts are not image-gen'd.
  let postStatus: 'scheduled' | 'draft' =
    bestDecision === 'schedule' ? 'scheduled' : 'draft';
  let images: string[] = [];
  let imageMeta: Partial<GroundedPostImageMeta> = {};

  if (postStatus === 'scheduled') {
    // Bounded by the same clock as generation, and failure DOWNGRADES rather
    // than propagates. Image generation is the slowest call in the slot and the
    // only one that reaches an external renderer, so an unbounded await here
    // could spend the whole remaining budget on a single post. Letting it throw
    // would be worse still: the content is already generated and paid for, so
    // discarding the post to punish a slow image loses real work.
    //
    // This becomes load-bearing the moment auto_approve_threshold drops to 80.
    // At 100 nothing was ever 'scheduled', so this branch never executed in
    // production and its cost and failure modes were untested.
    try {
      const { attachGroundedImage } =
        await import('@/lib/autopilot/grounded-post-image');
      const attached = await withDeadline(
        attachGroundedImage({
          businessName: input.businessName,
          industry: input.industry,
          offerings: input.offerings,
          theme: input.slot.theme,
          platform: input.slot.platform,
          orgId: input.orgId,
          userId: input.userId,
          runId: input.runId,
        }),
        input.deadlineAt - Date.now(),
        `attachGroundedImage (${input.slot.platform})`
      );
      postStatus = attached.status;
      images = attached.images;
      imageMeta = attached.meta;
    } catch {
      // Keep the post, drop the schedule. Matches the helper's own contract for
      // a blocked or failed image: never a placeholder, never an ungrounded URL,
      // and never a scheduled post without a real grounded image.
      postStatus = 'draft';
      images = [];
      imageMeta = {};
    }
  }

  // NOT bounded, deliberately, and this is the one exception on the path.
  //
  // Everything else abandoned by withDeadline loses only effort. This write is
  // the moment generated content becomes a durable post; abandoning the wait
  // does not abandon the INSERT, so a bounded version would return control
  // while the row still lands — producing a post that exists in the database
  // and appears in no run's postIds. That is precisely the orphaned-draft class
  // this whole change set exists to end, recreated by the mechanism meant to
  // prevent it.
  //
  // The exposure is small and the tradeoff is the right way round: the slot
  // loop has already refused to start work past its deadline, so this write
  // begins with SLOT_RESERVE_MS of reserve, and a Prisma insert that outlasts
  // 45 s means the database is unavailable — in which case the finalising write
  // fails too and the watchdog reaper is the correct backstop.
  const post = await prisma.post.create({
    data: {
      content: bestContent,
      platform: input.slot.platform,
      campaignId: input.campaignId,
      status: postStatus,
      scheduledAt: postStatus === 'scheduled' ? scheduledAt : null,
      metadata: {
        source: 'autopilot' as const,
        runId: input.runId,
        theme: input.slot.theme,
        scoreOverall: bestScore,
        scoreDimensions: bestDimensions,
        qualityDecision: postStatus === 'scheduled' ? 'scheduled' : 'draft',
        generationAttempt: 1,
        generatedAt: new Date().toISOString(),
        ...(images.length > 0 ? { images } : {}),
        ...imageMeta,
      },
    },
    select: { id: true },
  });

  return { postId: post.id, score: bestScore, status: postStatus };
}
