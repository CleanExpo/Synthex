/**
 * Approval Comments API — threaded collaboration (backlog #12).
 *
 *   GET  /api/approvals/[id]/comments  → the comment thread for an approval
 *   POST /api/approvals/[id]/comments  → add a comment; @-mentions fire notifications
 *
 * First-class replacement for the JSON-embedded comments on approval_requests.steps.
 * Org-scoped via the parent approval (caller's org must match approval.organizationId,
 * or the caller must be the submitter — mirrors canAccessApproval in the detail route).
 *
 * Validation ladder (defineRoute + withAuth): 401 (no session) → 403 (no org) →
 * 400 (bad body) → 200. A 403 is also returned when the caller cannot see the approval.
 *
 * SLA / due-date reminders are out of scope for #12 — tracked as a follow-up.
 *
 * @module app/api/approvals/[id]/comments/route
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const createCommentSchema = z.object({
  body: z.string().min(1, 'Comment body required').max(5000),
  // Optional explicit mention list (user ids / handles). When omitted, mentions are
  // parsed from the body. When provided, it is merged with parsed @-handles.
  mentions: z.array(z.string().min(1).max(120)).max(50).optional(),
});

/**
 * Pull the approval id out of /api/approvals/[id]/comments. `defineRoute` /
 * `withAuth` hand us the request but not the dynamic params, so read it from the URL
 * (same convention as the marketing-agency agents [id] route).
 */
function extractApprovalId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('approvals');
  if (idx === -1) return null;
  const id = segments[idx + 1];
  return id && id !== 'comments' ? id : null;
}

/**
 * Parse @-mention handles from a comment body. Matches @handle tokens
 * (letters, digits, '_', '-', '.'). Returns a de-duplicated list (no leading @).
 */
function parseMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9_.-]+)/g) ?? [];
  const handles = matches.map((m) => m.slice(1));
  return Array.from(new Set(handles));
}

/**
 * Load an approval the caller is allowed to see. Org-scoped: same organisation OR
 * the caller is the submitter. Returns null when not found or not visible.
 */
async function loadVisibleApproval(approvalId: string, clientId: string, userId: string) {
  return prisma.approvalRequest.findFirst({
    where: {
      id: approvalId,
      OR: [{ organizationId: clientId }, { submittedBy: userId }],
    },
    select: { id: true, title: true, organizationId: true },
  });
}

/**
 * Fire a notification to each mentioned user via the existing notifications
 * mechanism (prisma.notification — the same table the NotificationBell reads).
 * Best-effort: a mention that does not resolve to a real user id is skipped, and a
 * notification failure never fails the comment write.
 */
async function notifyMentions(
  mentions: string[],
  ctx: { approvalId: string; approvalTitle: string; authorId: string; commentId: string },
): Promise<void> {
  // Only notify mentions that resolve to a real user, and never self-notify.
  const targetIds = Array.from(new Set(mentions)).filter((id) => id !== ctx.authorId);
  if (targetIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: targetIds } },
    select: { id: true },
  });
  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: 'info',
      title: `You were mentioned on "${ctx.approvalTitle}"`,
      message: 'A new comment mentions you on an approval request.',
      data: {
        source: 'approval_comment_mention',
        approvalId: ctx.approvalId,
        commentId: ctx.commentId,
      },
    })),
  });
}

export const GET = withAuth(async (request, { clientId, userId }) => {
  const approvalId = extractApprovalId(request);
  if (!approvalId) {
    return NextResponse.json({ error: 'Invalid approval id' }, { status: 400 });
  }

  const approval = await loadVisibleApproval(approvalId, clientId, userId);
  if (!approval) {
    return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
  }

  const comments = await prisma.approvalComment.findMany({
    where: { approvalRequestId: approvalId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      approvalRequestId: true,
      authorId: true,
      body: true,
      mentions: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      approvalRequestId: c.approvalRequestId,
      authorId: c.authorId,
      authorName: c.author?.name ?? null,
      authorEmail: c.author?.email ?? null,
      body: c.body,
      mentions: c.mentions,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

export const POST = defineRoute(
  {
    body: createCommentSchema,
    serverErrorMessage: 'Failed to add comment',
    onError: (error) =>
      logger.error('approvals: add comment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { clientId, userId, request }) => {
    const approvalId = extractApprovalId(request);
    if (!approvalId) {
      return NextResponse.json({ error: 'Invalid approval id' }, { status: 400 });
    }

    const approval = await loadVisibleApproval(approvalId, clientId, userId);
    if (!approval) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    // Merge explicit mentions with @-handles parsed from the body.
    const mentions = Array.from(
      new Set([...(body.mentions ?? []), ...parseMentions(body.body)]),
    );

    const comment = await prisma.approvalComment.create({
      data: {
        approvalRequestId: approvalId,
        authorId: userId,
        body: body.body,
        mentions,
      },
      select: {
        id: true,
        approvalRequestId: true,
        authorId: true,
        body: true,
        mentions: true,
        createdAt: true,
      },
    });

    // @-mention → notify via the existing notifications mechanism. Best-effort:
    // never fail the comment write because a notification could not be sent.
    try {
      await notifyMentions(mentions, {
        approvalId,
        approvalTitle: approval.title,
        authorId: userId,
        commentId: comment.id,
      });
    } catch (error) {
      logger.error('approvals: mention notification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          approvalRequestId: comment.approvalRequestId,
          authorId: comment.authorId,
          body: comment.body,
          mentions: comment.mentions,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  },
);
