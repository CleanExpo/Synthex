/**
 * The one rule for whether a post's approval still covers what would be
 * published (SYN-1256).
 *
 * An approval request binds to a fingerprint of the post as submitted
 * (lib/approvals/content-fingerprint.ts: platform, text, metadata.images,
 * metadata.linkUrl). That binding was only checked when a reviewer approved.
 * Anything that changed the post afterwards (a scheduler PATCH, or any other
 * writer of Post) left the approval in place, and the publish cron sent the
 * new, never-approved wording.
 *
 * The rule reads the post's latest approval request, never a copy kept in
 * Post.metadata: the scheduler PATCH routes let a client replace metadata, so
 * a copy there could be erased or forged.
 *
 *   - No request, or a request created before binding existed (no
 *     fingerprint): 'not_required'. Behaviour is unchanged for those posts.
 *   - A bound request that is not approved yet (pending, in review, rejected,
 *     revision requested): 'held', reason approval_not_final.
 *   - An approved bound request whose fingerprint no longer matches the post:
 *     'held', reason approved_content_changed.
 *   - An approved bound request that matches: 'approved'.
 *
 * Callers: GET /api/cron/publish-scheduled (the enforcement point, checked on
 * the exact row it is about to send) and both scheduler PATCH routes (early
 * hold, so the owner sees the post waiting for approval at once). A failed
 * lookup throws; callers must treat a throw as "do not publish".
 */
import { prisma } from '@/lib/prisma';
import {
  checkPostBinding,
  CONTENT_FINGERPRINT_KEY,
  type FingerprintablePost,
} from './content-fingerprint';

export type PostApprovalHoldReason =
  | 'approved_content_changed'
  | 'approval_not_final';

export type PostPublishApproval =
  | { kind: 'not_required' }
  | { kind: 'approved'; approvalId: string }
  | { kind: 'held'; approvalId: string; reason: PostApprovalHoldReason };

export interface PublishablePost extends FingerprintablePost {
  id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function checkPostPublishApproval(
  post: PublishablePost
): Promise<PostPublishApproval> {
  const latest = await prisma.approvalRequest.findFirst({
    where: { contentType: 'post', contentId: post.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, metadata: true },
  });
  if (!latest) return { kind: 'not_required' };

  const stored = isRecord(latest.metadata)
    ? latest.metadata[CONTENT_FINGERPRINT_KEY]
    : undefined;
  if (typeof stored !== 'string' || stored.length === 0) {
    return { kind: 'not_required' };
  }

  if (latest.status !== 'approved') {
    return {
      kind: 'held',
      approvalId: latest.id,
      reason: 'approval_not_final',
    };
  }

  return checkPostBinding(latest.metadata, post).kind === 'match'
    ? { kind: 'approved', approvalId: latest.id }
    : {
        kind: 'held',
        approvalId: latest.id,
        reason: 'approved_content_changed',
      };
}

export interface PostEdit {
  content?: string;
  platform?: string;
  status?: string;
  metadata?: unknown;
}

/**
 * For the scheduler edit routes: when the post would be left scheduled, check
 * the rule against the post as the edit leaves it. Returns the status and
 * metadata to write instead when the approval no longer covers it, or null
 * when the edit can be written as asked.
 */
export async function approvalHoldForEdit(
  existing: PublishablePost & { status: string },
  edit: PostEdit,
  at: string
): Promise<{
  status: 'pending_approval';
  metadata: Record<string, unknown>;
} | null> {
  if ((edit.status ?? existing.status) !== 'scheduled') return null;
  const metadata =
    edit.metadata !== undefined ? edit.metadata : existing.metadata;
  const verdict = await checkPostPublishApproval({
    id: existing.id,
    content: edit.content ?? existing.content,
    platform: edit.platform ?? existing.platform,
    metadata,
  });
  if (verdict.kind !== 'held') return null;
  return {
    status: 'pending_approval',
    metadata: heldForApprovalMetadata(
      isRecord(metadata) ? metadata : {},
      verdict,
      at
    ),
  };
}

/**
 * The Post.metadata a hold writes. publishGate.allowed === false is what
 * PATCH /api/approvals/[id] looks for to put the post back in the queue once
 * the current wording is approved, so every hold writes it the same way.
 */
export function heldForApprovalMetadata(
  metadata: Record<string, unknown>,
  verdict: Extract<PostPublishApproval, { kind: 'held' }>,
  at: string
): Record<string, unknown> {
  const history = Array.isArray(metadata.history) ? metadata.history : [];
  return {
    ...metadata,
    publishGate: {
      allowed: false,
      blockers: [verdict.reason],
      approvalId: verdict.approvalId,
      checkedAt: at,
    },
    history: [
      ...history,
      {
        event: 'held_for_approval',
        at,
        reason: verdict.reason,
        approvalId: verdict.approvalId,
      },
    ],
  };
}
