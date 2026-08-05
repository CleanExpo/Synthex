/**
 * POST /api/marketing/incident — AT-025
 *
 * Classifies a canary AMBER/RED incident with a deterministic default-higher
 * severity classifier and stores an org-scoped pending-review draft.
 * Never notifies external systems and never pages humans — review only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { mutation } from '@/lib/rate-limit';
import {
  CANARY_SIGNALS,
  INCIDENT_BRANDS,
  INCIDENT_TYPES,
  classifyIncident,
  formatIncidentReviewContent,
} from '@/lib/agency/incident-classifier';

export const runtime = 'nodejs';

const incidentRequestSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  canarySignal: z.enum(CANARY_SIGNALS),
  brand: z.enum(INCIDENT_BRANDS),
  summary: z.string().min(1).max(2_000),
  containmentStatus: z
    .enum(['in-progress', 'contained', 'resolved'])
    .default('in-progress'),
  /** Optional hint — never used to downgrade below the computed floor. */
  proposedSeverity: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional(),
});

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    // Mutation — rate-limit before persist (route-safety [C]).
    return mutation(request, async () => {
      const rawBody = await request.json().catch(() => undefined);
      const parsed = incidentRequestSchema.safeParse(rawBody);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const input = parsed.data;

      try {
        const organizationId =
          (await getEffectiveOrganizationId(userId)) ?? clientId;
        const detectedAt = new Date();
        const dateStamp = detectedAt.toISOString().slice(0, 10);
        const incidentId = `INC-${dateStamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const classification = classifyIncident({
          type: input.type,
          canarySignal: input.canarySignal,
          proposedSeverity: input.proposedSeverity,
        });

        const content = formatIncidentReviewContent({
          incidentId,
          detectedAt: detectedAt.toISOString(),
          type: input.type,
          brand: input.brand,
          canarySignal: input.canarySignal,
          summary: input.summary,
          classification,
          containmentStatus: input.containmentStatus,
        });

        const draft = await prisma.contentDraft.create({
          data: {
            userId,
            organizationId,
            platform: 'governance',
            title: `Incident ${input.canarySignal} — ${input.type} (${input.brand})`,
            content,
            topic: input.summary.slice(0, 200),
            status: 'review',
            metadata: {
              agencyTaskId: 'AT-025',
              incidentId,
              classifier: 'deterministic',
              incidentType: input.type,
              canarySignal: input.canarySignal,
              brand: input.brand,
              severity: classification.severity,
              severityFloor: classification.severityFloor,
              severityLabel: classification.severityLabel,
              defaultedHigher: classification.defaultedHigher,
              proposedSeverity: input.proposedSeverity ?? null,
              containmentStatus: input.containmentStatus,
              notifyExternal: false,
              pageHuman: false,
              storeForReviewOnly: true,
              autoPublish: false,
              reviewState: 'pending_review',
            },
          },
        });

        logger.info('marketing: incident classification stored for review', {
          draftId: draft.id,
          incidentId,
          organizationId,
          severity: classification.severity,
          type: input.type,
          canarySignal: input.canarySignal,
        });

        return NextResponse.json(
          {
            data: {
              reviewState: 'pending_review' as const,
              incidentId,
              classification: {
                severity: classification.severity,
                severityFloor: classification.severityFloor,
                severityLabel: classification.severityLabel,
                defaultedHigher: classification.defaultedHigher,
                notifyExternal: false,
                pageHuman: false,
                storeForReviewOnly: true,
              },
              // Explicit product gate — never claim CEO was notified.
              notification: {
                external: false,
                humanPaged: false,
                storeForReviewOnly: true,
              },
              draft: {
                id: draft.id,
                title: draft.title,
                status: draft.status,
                content: draft.content,
                metadata: draft.metadata,
                createdAt: draft.createdAt,
              },
            },
          },
          { status: 201 }
        );
      } catch (error) {
        logger.error('POST /api/marketing/incident failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to classify and store incident for review',
          },
          { status: 500 }
        );
      }
    });
  }
);
