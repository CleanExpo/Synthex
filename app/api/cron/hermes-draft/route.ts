/**
 * HERMES draft cron — SYN-912 / HER-1d
 *
 * GET /api/cron/hermes-draft
 * Schedule: 0 17 * * * UTC (daily 03:00 AEST / 04:00 AEDT — one hour after
 * the discovery sweep so candidates are ready).
 *
 * For each org with HermesConfig.enabled=true:
 *   1. Resolve the Owner-role impersonated author (skip + LINEAR escalate if missing)
 *   2. Load the BrandConfig for the org's brandSlug
 *   3. Load top dailyQuota candidates by priority where status='open'
 *   4. For each candidate (and its bench fallback):
 *      a. generateDraft → voice gate → writeDraftToCalendar
 *      b. On hard-fail override: mark proposal 'rejected', escalate LINEAR routine,
 *         and pull the next candidate from the bench so the quota fills.
 *      c. On warn or pass (H-1 log-only): write to Calendar as pending_approval.
 *   5. Update HermesConfig.nextRunAt
 *
 * Per-org errors are caught — never abort the loop.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { resolveImpersonatedAuthor } from '@/lib/hermes/orgs';
import { generateDraft } from '@/lib/hermes/generator/draft';
import { generateDraftWithQuestions } from '@/lib/hermes/generator/author-questions';
import {
  isAuthorQuestionsEnabled,
  formatAuthorQuestionsMessage,
} from '@/lib/hermes/author-input';
import { runVoiceGate } from '@/lib/hermes/voice/gate';
import { writeDraftToCalendar } from '@/lib/hermes/calendar/write';
import {
  sendEscalation,
  NotificationChannel,
} from '@/lib/alerts/notification-channels';
import { brands, type BrandSlug } from '@unite-group/brand-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface OrgResult {
  orgId: string;
  outcome: 'processed' | 'skipped_no_owner' | 'skipped_no_brand' | 'error';
  drafted?: number;
  passed?: number;
  warned?: number;
  hardFailed?: number;
  calendared?: number;
  /** Author-questions mode: number of drafts whose questions were sent to the author. */
  questionsSent?: number;
  benchExhausted?: boolean;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronRequest(request, 'HERMES_DRAFT');
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  logger.info('cron:hermes-draft:start', {
    timestamp: new Date().toISOString(),
  });

  const configs = await prisma.hermesConfig.findMany({
    where: { enabled: true },
    select: {
      id: true,
      organizationId: true,
      brandSlug: true,
      dailyQuota: true,
      voiceFloor: true,
      metadata: true,
    },
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const results: OrgResult[] = [];

  for (const config of configs) {
    const orgId = config.organizationId;

    try {
      const userId = await resolveImpersonatedAuthor(orgId);
      if (!userId) {
        await sendEscalation({
          channel: NotificationChannel.LINEAR,
          message: `HERMES draft skipped — no Owner for org ${orgId}.`,
          priority: 'routine',
          context: { orgId, hermesConfigId: config.id },
        });
        skipped += 1;
        results.push({ orgId, outcome: 'skipped_no_owner' });
        continue;
      }

      const brand = brands[config.brandSlug as BrandSlug];
      if (!brand) {
        logger.error('[cron:hermes-draft] Unknown brandSlug — skipping', {
          orgId,
          brandSlug: config.brandSlug,
        });
        skipped += 1;
        results.push({ orgId, outcome: 'skipped_no_brand' });
        continue;
      }

      // Author-questions mode (HER-7 / B-5): draft + ask the author questions,
      // defer the voice gate + Calendar write to the answer-intake endpoint.
      // Default (flag absent) keeps the original one-shot draft → gate → Calendar.
      const orgResult = isAuthorQuestionsEnabled(config.metadata)
        ? await processOrgWithQuestions({
            orgId,
            userId,
            dailyQuota: config.dailyQuota,
          })
        : await processOrg({
            orgId,
            userId,
            brand,
            dailyQuota: config.dailyQuota,
            voiceFloor: config.voiceFloor,
          });

      processed += 1;
      results.push({ orgId, outcome: 'processed', ...orgResult });

      // Update nextRunAt to now + 24h. HER-3 lifts to 6h — change here when cadence shifts.
      await prisma.hermesConfig.update({
        where: { id: config.id },
        data: { nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
    } catch (err) {
      errors += 1;
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('cron:hermes-draft:org-error', {
        orgId,
        error: errorMessage,
      });
      results.push({ orgId, outcome: 'error', error: errorMessage });

      try {
        await sendEscalation({
          channel: NotificationChannel.LINEAR,
          message: `HERMES draft cron failed for org ${orgId}: ${errorMessage}`,
          priority: 'routine',
          context: { orgId },
        });
      } catch {
        // already logged inside sendEscalation
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info('cron:hermes-draft:end', {
    durationMs,
    orgsProcessed: processed,
    orgsSkipped: skipped,
    orgsErrored: errors,
  });

  return NextResponse.json({
    success: true,
    processed,
    skipped,
    errors,
    durationMs,
    results,
  });
}

// ============================================================================
// Per-org processing — bench-fill semantics
// ============================================================================

interface ProcessOrgArgs {
  orgId: string;
  userId: string;
  brand: import('@unite-group/brand-config').BrandConfig;
  dailyQuota: number;
  voiceFloor: number;
}

async function processOrg(args: ProcessOrgArgs): Promise<{
  drafted: number;
  passed: number;
  warned: number;
  hardFailed: number;
  calendared: number;
  benchExhausted: boolean;
}> {
  // Load up to dailyQuota × CANDIDATE_BENCH_MULTIPLIER (4) candidates ordered
  // by priority desc. We fill the quota greedily, pulling the next bench
  // candidate when one fails the hard-fail gate.
  const BENCH_DEPTH = args.dailyQuota * 4;

  const candidates = await prisma.hermesGapCandidate.findMany({
    where: { organizationId: args.orgId, status: 'open' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: BENCH_DEPTH,
  });

  let drafted = 0;
  let passed = 0;
  let warned = 0;
  let hardFailed = 0;
  let calendared = 0;

  // Posts scheduled to publish 1 hour from now so the human reviewer has
  // time to approve via Calendar before the publish-scheduled cron fires.
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

  for (const candidate of candidates) {
    if (calendared >= args.dailyQuota) break; // quota filled

    drafted += 1;

    // 1. Create the proposal row in 'pending' so we can attach gate results
    //    even if subsequent steps fail.
    const proposal = await prisma.hermesProposal.create({
      data: {
        organizationId: args.orgId,
        gapCandidateId: candidate.id,
        content: '', // populated after draft
        status: 'pending',
      },
      select: { id: true },
    });

    try {
      const draft = await generateDraft({
        organizationId: args.orgId,
        topic: candidate.topic,
        rationale: candidate.rationale,
      });

      const gate = await runVoiceGate(
        draft.content,
        args.brand,
        args.voiceFloor
      );

      // 2. Persist gate result on the proposal regardless of outcome.
      await prisma.hermesProposal.update({
        where: { id: proposal.id },
        data: {
          content: draft.content,
          voiceScore: gate.score,
          voiceGateDecision: gate.decision,
          voiceFailedRules: gate.failedRules,
          metadata: {
            readabilityGrade: gate.readabilityGrade,
            readabilityWarning: gate.readabilityWarning,
            hardFailOverride: gate.hardFailOverride,
            modelUsed: gate.modelUsed,
            reasons: gate.reasons,
          },
        },
      });

      // 3. Hard-fail = blocked even in log-only mode. Skip Calendar write,
      //    escalate routine LINEAR, and let the loop pull the next bench candidate.
      if (gate.decision === 'fail' || gate.hardFailOverride) {
        hardFailed += 1;
        await prisma.hermesProposal.update({
          where: { id: proposal.id },
          data: { status: 'rejected' },
        });
        await prisma.hermesGapCandidate.update({
          where: { id: candidate.id },
          data: { status: 'rejected' },
        });
        await sendEscalation({
          channel: NotificationChannel.LINEAR,
          message: `HERMES gate hard-fail (org ${args.orgId}, topic "${candidate.topic.slice(0, 60)}"): ${gate.failedRules.join(', ') || 'readability'}`,
          priority: 'routine',
          context: { orgId: args.orgId, proposalId: proposal.id },
        });
        continue;
      }

      // 4. H-1 log-only: pass and warn both proceed to Calendar.
      if (gate.decision === 'pass') passed += 1;
      else warned += 1;

      const writeResult = await writeDraftToCalendar({
        organizationId: args.orgId,
        userId: args.userId,
        content: draft.content,
        platform: args.brand.defaultChannel,
        scheduledAt,
        gateResult: gate,
      });

      if (writeResult) {
        await prisma.hermesProposal.update({
          where: { id: proposal.id },
          data: { status: 'queued', postId: writeResult.postId },
        });
        await prisma.hermesGapCandidate.update({
          where: { id: candidate.id },
          data: { status: 'drafted' },
        });
        calendared += 1;
      } else {
        // Calendar write failed but the proposal is preserved for retry.
        // Leave status='pending' so the next cron tick re-attempts.
        logger.warn(
          '[cron:hermes-draft] Calendar write failed; proposal left pending',
          {
            orgId: args.orgId,
            proposalId: proposal.id,
          }
        );
      }
    } catch (err) {
      // One candidate's failure should never abort the whole org's quota fill.
      // Mark proposal failed, escalate routine, continue to next bench candidate.
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[cron:hermes-draft] candidate processing failed', {
        orgId: args.orgId,
        candidateId: candidate.id,
        proposalId: proposal.id,
        error: errorMessage,
      });
      await prisma.hermesProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'rejected',
          metadata: { error: errorMessage },
        },
      });
    }
  }

  return {
    drafted,
    passed,
    warned,
    hardFailed,
    calendared,
    benchExhausted:
      drafted === candidates.length && calendared < args.dailyQuota,
  };
}

// ============================================================================
// Author-questions mode (HER-7 / B-5)
//
// Draft each candidate WITH 2-3 author questions, persist the proposal as
// 'awaiting_author_input' (questions + topic/rationale in metadata), and send
// the questions to the author over Telegram. The voice gate + Calendar write
// happen later, in POST /api/hermes/proposals/answers once the author replies.
// Quota is measured in "questions sent", not "calendared".
// ============================================================================

interface ProcessOrgQuestionsArgs {
  orgId: string;
  userId: string;
  dailyQuota: number;
}

async function processOrgWithQuestions(args: ProcessOrgQuestionsArgs): Promise<{
  drafted: number;
  questionsSent: number;
  benchExhausted: boolean;
}> {
  const BENCH_DEPTH = args.dailyQuota * 4;

  const candidates = await prisma.hermesGapCandidate.findMany({
    where: { organizationId: args.orgId, status: 'open' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: BENCH_DEPTH,
  });

  let drafted = 0;
  let questionsSent = 0;

  for (const candidate of candidates) {
    if (questionsSent >= args.dailyQuota) break; // quota filled
    drafted += 1;

    const proposal = await prisma.hermesProposal.create({
      data: {
        organizationId: args.orgId,
        gapCandidateId: candidate.id,
        content: '',
        status: 'pending',
      },
      select: { id: true },
    });

    try {
      const dq = await generateDraftWithQuestions({
        organizationId: args.orgId,
        topic: candidate.topic,
        rationale: candidate.rationale,
      });

      // Persist the draft + questions; topic/rationale travel in metadata so
      // finalisation never depends on the candidate row still existing.
      await prisma.hermesProposal.update({
        where: { id: proposal.id },
        data: {
          content: dq.draft,
          status: 'awaiting_author_input',
          metadata: {
            stage: 'awaiting_author_input',
            authorQuestions: dq.questions,
            topic: candidate.topic,
            rationale: candidate.rationale,
            modelUsed: dq.modelUsed,
          },
        },
      });

      // Mark the candidate drafted so it isn't re-picked on the next tick.
      await prisma.hermesGapCandidate.update({
        where: { id: candidate.id },
        data: { status: 'drafted' },
      });

      // Surface the questions to the author over the existing Telegram channel.
      // Falls back to Linear, and no-ops gracefully if neither is configured.
      await sendEscalation({
        channel: NotificationChannel.TELEGRAM,
        message: formatAuthorQuestionsMessage(
          candidate.topic,
          dq.questions,
          proposal.id
        ),
        priority: 'routine',
        fallback: NotificationChannel.LINEAR,
        context: { orgId: args.orgId, proposalId: proposal.id },
      });

      questionsSent += 1;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[cron:hermes-draft] author-questions candidate failed', {
        orgId: args.orgId,
        candidateId: candidate.id,
        proposalId: proposal.id,
        error: errorMessage,
      });
      await prisma.hermesProposal.update({
        where: { id: proposal.id },
        data: { status: 'rejected', metadata: { error: errorMessage } },
      });
    }
  }

  return {
    drafted,
    questionsSent,
    benchExhausted:
      drafted === candidates.length && questionsSent < args.dailyQuota,
  };
}
