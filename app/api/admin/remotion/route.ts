/**
 * Remotion Compositions API (God Mode) — AT-010
 *
 * GET  /api/admin/remotion — List compositions, or poll a pending brief (?draftId=)
 * POST /api/admin/remotion — Create org-scoped Remotion visual brief via creative-director
 *
 * Never auto-publishes. Never triggers server-side / Lambda render (not configured).
 * Auth: verifyAdmin() — owner-only via isOwnerEmail or admin role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { invokeSkill } from '@/lib/ai/skills';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import prisma from '@/lib/prisma';
import { aiGeneration } from '@/lib/rate-limit';
import { COMPOSITION_REGISTRY } from '@/lib/remotion/registry';

export const runtime = 'nodejs';

const COMPOSITION_IDS = COMPOSITION_REGISTRY.map(c => c.id) as [
  string,
  ...string[],
];

const brandEnum = z.enum(['DR', 'NRPG', 'RestoreAssist', 'CARSI', 'CCW']);

const remotionBriefSchema = z.object({
  compositionId: z.enum(COMPOSITION_IDS),
  brandScope: brandEnum,
  objective: z.string().min(1).max(2_000),
  companionPageUrl: z.string().url().max(500),
  seniorCopywriterInput: z.string().max(4_000).optional(),
  title: z.string().min(1).max(200).optional(),
  /** Studio preview props only — never used to invent ungrounded imagery. */
  previewProps: z.record(z.string(), z.unknown()).optional(),
});

function buildCreativeDirectorPrompt(
  organizationId: string,
  request: z.infer<typeof remotionBriefSchema>
): string {
  const composition = COMPOSITION_REGISTRY.find(
    c => c.id === request.compositionId
  )!;

  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Create a pending-review CreativeDirectorOutput for a Remotion visual brief. Do not publish, render MP4, or invent ungrounded imagery.',
    `- Channel: remotion-video`,
    `- Brand scope: ${request.brandScope}`,
    `- Composition: ${composition.id} (${composition.name}) — ${composition.description}`,
    `- Dimensions: ${composition.width}×${composition.height} @ ${composition.fps}fps`,
    `- Companion page URL: ${request.companionPageUrl}`,
    `- Objective: ${request.objective}`,
    request.seniorCopywriterInput
      ? `- Senior-copywriter input: ${request.seniorCopywriterInput}`
      : '- Senior-copywriter input: (none supplied — note as needed)',
    request.title ? `- Working title: ${request.title}` : '',
    '',
    'Enforce REM-1 / REM-2 / REM-3, Real Images Only (owned reference library or BLOCKED), EXIF strip, companion-page VideoObject schema, and human review before any production render.',
    'Return the complete CreativeDirectorOutput contract. autoPublish must remain false.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── GET — List compositions or poll brief status ─────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: auth.error || 'Admin access required' },
      { status: 403 }
    );
  }

  const draftId = new URL(request.url).searchParams.get('draftId');
  if (draftId) {
    if (!auth.userId) {
      return NextResponse.json(
        { error: 'User context required to poll Remotion briefs' },
        { status: 400 }
      );
    }

    const organizationId = await getEffectiveOrganizationId(auth.userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organisation context required' },
        { status: 400 }
      );
    }

    const draft = await prisma.contentDraft.findFirst({
      where: {
        id: draftId,
        organizationId,
        platform: 'remotion',
      },
      select: {
        id: true,
        title: true,
        status: true,
        content: true,
        metadata: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { error: 'Remotion brief not found' },
        { status: 404 }
      );
    }

    const metadata = (draft.metadata ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      data: {
        reviewState:
          draft.status === 'review'
            ? ('pending_review' as const)
            : draft.status,
        draft: {
          id: draft.id,
          title: draft.title,
          status: draft.status,
          content: draft.content,
          metadata,
          organizationId: draft.organizationId,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        },
        renderCapabilities: {
          clientSidePreview: true,
          serverSideRender: false,
          lambdaRender: false,
          autoPublish: false,
          note: 'Brief is pending human review. Server-side and Lambda rendering are not configured.',
        },
      },
    });
  }

  return NextResponse.json({
    compositions: COMPOSITION_REGISTRY.map(comp => ({
      id: comp.id,
      name: comp.name,
      description: comp.description,
      dimensions: { width: comp.width, height: comp.height },
      fps: comp.fps,
      durationInFrames: comp.durationInFrames,
      durationSeconds: comp.durationInFrames / comp.fps,
      defaultProps: comp.defaultProps,
    })),
    renderCapabilities: {
      clientSidePreview: true,
      serverSideRender: false,
      lambdaRender: false,
      autoPublish: false,
      note: 'POST creates an org-scoped pending Remotion brief (creative-director). Use the Studio page for client-side preview. Server-side and Lambda rendering are not configured.',
    },
  });
}

// ── POST — Pending Remotion brief (never renders / never publishes) ──────────

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: auth.error || 'Admin access required' },
      { status: 403 }
    );
  }

  if (!auth.userId) {
    return NextResponse.json(
      { error: 'User context required to create Remotion briefs' },
      { status: 400 }
    );
  }

  return aiGeneration(request, async () => {
    const rawBody = await request.json().catch(() => undefined);
    const parsed = remotionBriefSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const userId = auth.userId!;

    try {
      const organizationId = await getEffectiveOrganizationId(userId);
      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organisation context required' },
          { status: 400 }
        );
      }

      const result = await invokeSkill({
        skill: 'creative-director',
        prompt: buildCreativeDirectorPrompt(organizationId, input),
      });

      const composition = COMPOSITION_REGISTRY.find(
        c => c.id === input.compositionId
      )!;
      const title =
        input.title ??
        `Remotion brief — ${composition.name} (${input.brandScope})`;

      const draft = await prisma.contentDraft.create({
        data: {
          userId,
          organizationId,
          platform: 'remotion',
          title,
          content: result.content,
          topic: input.objective,
          status: 'review',
          metadata: {
            skill: result.skill,
            model: result.model,
            agencyTaskId: 'AT-010',
            compositionId: input.compositionId,
            brandScope: input.brandScope,
            companionPageUrl: input.companionPageUrl,
            seniorCopywriterInput: input.seniorCopywriterInput ?? null,
            previewProps: input.previewProps ?? null,
            foundationIncluded: result.foundationIncluded,
            foundationMissing: result.foundationMissing,
            usage: result.usage ?? null,
            autoPublish: false,
            renderStatus: 'pending_review',
            serverSideRender: false,
            lambdaRender: false,
          } as Prisma.InputJsonValue,
        },
      });

      logger.info('admin/remotion: pending brief created', {
        draftId: draft.id,
        organizationId,
        compositionId: input.compositionId,
        skill: result.skill,
      });

      return NextResponse.json(
        {
          data: {
            reviewState: 'pending_review' as const,
            draft: {
              id: draft.id,
              title: draft.title,
              status: draft.status,
              content: draft.content,
              metadata: draft.metadata,
              createdAt: draft.createdAt,
            },
            renderCapabilities: {
              clientSidePreview: true,
              serverSideRender: false,
              lambdaRender: false,
              autoPublish: false,
              note: 'Brief queued for human review only. No MP4 render was started.',
            },
          },
        },
        { status: 201 }
      );
    } catch (error) {
      logger.error('POST /api/admin/remotion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to create Remotion brief',
        },
        { status: 500 }
      );
    }
  });
}
