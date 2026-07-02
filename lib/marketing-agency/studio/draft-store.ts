/**
 * Studio draft store (SYN-1005 / VS-6) — org-scoped persistence for the studio dashboard.
 *
 * Every operation is scoped by organizationId at the query layer (the table has no DB FK
 * to organizations — see the migration). The Prisma delegate is injectable so this is
 * unit-testable without a database.
 */

import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** Minimal slice of the Prisma StudioContentDraft delegate we use (injectable for tests). */
export type StudioDraftDelegate = Pick<
  typeof prisma.studioContentDraft,
  'create' | 'findMany' | 'updateMany' | 'upsert'
>;

const defaultDelegate = (): StudioDraftDelegate => prisma.studioContentDraft;

export interface SaveStudioDraftInput {
  organizationId: string;
  clientSlug: string;
  topic: string;
  script: string;
  platforms: string[];
  videoProvider?: string;
  videoId?: string;
  videoUrl?: string;
  dedupeKey?: string;
  metadata?: Prisma.InputJsonObject;
}

export async function saveStudioDraft(
  input: SaveStudioDraftInput,
  delegate: StudioDraftDelegate = defaultDelegate()
) {
  const data = {
    organizationId: input.organizationId,
    clientSlug: input.clientSlug,
    topic: input.topic,
    script: input.script,
    platforms: input.platforms,
    videoProvider: input.videoProvider ?? 'heygen',
    videoId: input.videoId ?? null,
    videoUrl: input.videoUrl ?? null,
    dedupeKey: input.dedupeKey ?? null,
    metadata: input.metadata,
  };

  if (!input.dedupeKey) {
    return delegate.create({
      data: {
        ...data,
        status: 'awaiting_approval',
      },
    });
  }

  return delegate.upsert({
    where: {
      organizationId_clientSlug_dedupeKey: {
        organizationId: input.organizationId,
        clientSlug: input.clientSlug,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      ...data,
      status: 'awaiting_approval',
    },
    update: data,
  });
}

export interface ListStudioDraftsInput {
  organizationId: string;
  clientSlug?: string;
  limit?: number;
}

export async function listStudioDrafts(
  input: ListStudioDraftsInput,
  delegate: StudioDraftDelegate = defaultDelegate()
) {
  return delegate.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.clientSlug ? { clientSlug: input.clientSlug } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(input.limit ?? 50, 100),
  });
}

export interface ApproveStudioDraftInput {
  organizationId: string;
  id: string;
  approvedBy: string;
}

/**
 * Approve a draft — the human-approval gate. Org-scoped update: returns the number of
 * rows changed (0 = not found, wrong org, or already actioned). A caller in a different
 * org can NEVER approve another org's draft (org is in the WHERE clause).
 */
export async function approveStudioDraft(
  input: ApproveStudioDraftInput,
  delegate: StudioDraftDelegate = defaultDelegate()
): Promise<number> {
  const result = await delegate.updateMany({
    where: {
      id: input.id,
      organizationId: input.organizationId,
      status: 'awaiting_approval',
    },
    data: {
      status: 'approved',
      approvedBy: input.approvedBy,
      approvedAt: new Date(),
    },
  });
  return result.count;
}
