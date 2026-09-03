/**
 * Studio draft store (SYN-1005 / VS-6) — org-scoped persistence for the studio dashboard.
 *
 * Every operation is scoped by organizationId at the query layer (the table has no DB FK
 * to organizations — see the migration). The Prisma delegate is injectable so this is
 * unit-testable without a database.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

/** Minimal slice of the Prisma StudioContentDraft delegate we use (injectable for tests). */
export type StudioDraftDelegate = Pick<
  typeof prisma.studioContentDraft,
  'create' | 'findMany' | 'findFirst' | 'updateMany' | 'upsert'
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

/**
 * Save (or re-save, by dedupe key) a draft. A draft that has LEFT
 * `awaiting_approval` is never overwritten: its script is what a human
 * approved and its metadata carries the approval record and the scheduled
 * Posts, so a regenerated version is a new draft, not an edit. The existing
 * row is returned untouched and the skip is logged.
 */
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

  // The status predicate lives IN the write, never in a read before it: a
  // guard evaluated in a previous statement can be overtaken by an approval
  // that commits between the two. One conditional update; on zero rows the
  // draft is either new (create) or has left awaiting_approval (the unique
  // index turns that into P2002, and the row is returned untouched).
  const key = {
    organizationId: input.organizationId,
    clientSlug: input.clientSlug,
    dedupeKey: input.dedupeKey,
  };
  const updated = await delegate.updateMany({
    where: { ...key, status: 'awaiting_approval' },
    data,
  });
  if (updated.count > 0) {
    return delegate.findFirst({ where: key });
  }
  try {
    return await delegate.create({
      data: { ...data, status: 'awaiting_approval' },
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const existing = await delegate.findFirst({ where: key });
    logger.warn('studio draft not overwritten: it has left awaiting_approval', {
      organizationId: input.organizationId,
      clientSlug: input.clientSlug,
      dedupeKey: input.dedupeKey,
      status: existing?.status,
    });
    return existing;
  }
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
