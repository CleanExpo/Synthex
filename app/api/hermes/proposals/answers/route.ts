/**
 * HERMES author-answers intake — HER-7 / B-5
 *
 * POST /api/hermes/proposals/answers
 * Body: { proposalId: string, answers: string[] }  (answers index-aligned to
 * the questions stored on the proposal)
 *
 * The author replies to the questions raised by the draft cron. We weave their
 * answers into the draft (finaliseDraftWithAnswers), run the existing voice
 * gate, and on pass/warn write to the Calendar as pending_approval — the same
 * destination the non-questions path uses. Hard-fail rejects, as in the cron.
 *
 * No inbound Telegram webhook exists, so answers arrive via this authenticated,
 * org-scoped endpoint (dashboard form). Fails closed (401/403) via withOrg.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withOrg } from '@/lib/auth/with-org';
import { resolveImpersonatedAuthor } from '@/lib/hermes/orgs';
import { finaliseDraftWithAnswers } from '@/lib/hermes/generator/author-questions';
import { runVoiceGate } from '@/lib/hermes/voice/gate';
import { writeDraftToCalendar } from '@/lib/hermes/calendar/write';
import {
  matchAnswersToQuestions,
  readAwaitingAuthorInputMetadata,
} from '@/lib/hermes/author-input';
import { brands, type BrandSlug } from '@unite-group/brand-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  proposalId: z.string().min(1),
  answers: z.array(z.string()).min(1),
});

export const POST = withOrg(async (request, { org }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
  const { proposalId, answers } = parsed.data;

  // Org-scoped load — 404 (never leak existence) if missing or cross-org.
  const proposal = await prisma.hermesProposal.findFirst({
    where: { id: proposalId, organizationId: org.id },
    select: { id: true, content: true, status: true, metadata: true },
  });
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }
  if (proposal.status !== 'awaiting_author_input') {
    return NextResponse.json(
      {
        error: `Proposal is not awaiting author input (status: ${proposal.status})`,
      },
      { status: 409 }
    );
  }

  const meta = readAwaitingAuthorInputMetadata(proposal.metadata);
  if (!meta) {
    return NextResponse.json(
      { error: 'Proposal is missing author-question metadata' },
      { status: 422 }
    );
  }

  const qa = matchAnswersToQuestions(meta.authorQuestions, answers);
  if (qa.length === 0) {
    return NextResponse.json(
      { error: 'At least one question must be answered' },
      { status: 400 }
    );
  }

  // Resolve the brand, voice floor, and author needed to finalise + calendar.
  const config = await prisma.hermesConfig.findUnique({
    where: { organizationId: org.id },
    select: { brandSlug: true, voiceFloor: true },
  });
  const brand = config ? brands[config.brandSlug as BrandSlug] : undefined;
  if (!config || !brand) {
    return NextResponse.json(
      { error: 'HERMES is not configured for this organisation' },
      { status: 409 }
    );
  }
  const userId = await resolveImpersonatedAuthor(org.id);
  if (!userId) {
    return NextResponse.json(
      { error: 'No Owner-role author for this organisation' },
      { status: 409 }
    );
  }

  // Weave the author's experience in, then run the existing voice gate.
  const finalDraft = await finaliseDraftWithAnswers(
    { organizationId: org.id, topic: meta.topic, rationale: meta.rationale },
    proposal.content,
    qa
  );
  const gate = await runVoiceGate(finalDraft.content, brand, config.voiceFloor);

  const sharedMetadata = {
    stage: 'answered',
    authorQuestions: meta.authorQuestions,
    topic: meta.topic,
    rationale: meta.rationale,
    answeredCount: qa.length,
    readabilityGrade: gate.readabilityGrade,
    readabilityWarning: gate.readabilityWarning,
    hardFailOverride: gate.hardFailOverride,
    modelUsed: gate.modelUsed,
    reasons: gate.reasons,
  };

  // Hard-fail = blocked even in log-only mode (mirrors the cron).
  if (gate.decision === 'fail' || gate.hardFailOverride) {
    await prisma.hermesProposal.update({
      where: { id: proposal.id },
      data: {
        content: finalDraft.content,
        voiceScore: gate.score,
        voiceGateDecision: gate.decision,
        voiceFailedRules: gate.failedRules,
        status: 'rejected',
        metadata: sharedMetadata,
      },
    });
    logger.info('[hermes:answers] finalised draft hard-failed the voice gate', {
      orgId: org.id,
      proposalId: proposal.id,
      failedRules: gate.failedRules,
    });
    return NextResponse.json(
      {
        status: 'rejected',
        voiceScore: gate.score,
        failedRules: gate.failedRules,
      },
      { status: 200 }
    );
  }

  // Pass / warn (H-1 log-only) → Calendar as pending_approval.
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
  const writeResult = await writeDraftToCalendar({
    organizationId: org.id,
    userId,
    content: finalDraft.content,
    platform: brand.defaultChannel,
    scheduledAt,
    gateResult: gate,
  });
  if (!writeResult) {
    return NextResponse.json(
      { error: 'Failed to write draft to calendar' },
      { status: 500 }
    );
  }

  await prisma.hermesProposal.update({
    where: { id: proposal.id },
    data: {
      content: finalDraft.content,
      voiceScore: gate.score,
      voiceGateDecision: gate.decision,
      voiceFailedRules: gate.failedRules,
      status: 'queued',
      postId: writeResult.postId,
      metadata: sharedMetadata,
    },
  });

  logger.info('[hermes:answers] finalised proposal to calendar', {
    orgId: org.id,
    proposalId: proposal.id,
    postId: writeResult.postId,
    voiceScore: gate.score,
  });
  return NextResponse.json(
    { status: 'queued', postId: writeResult.postId, voiceScore: gate.score },
    { status: 200 }
  );
});
