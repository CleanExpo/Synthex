import { customerPostStatus } from '@/lib/dashboard/post-status';

/** Failed or waiting posts that belong on Home / Calendar — not a new nav item. */

export type NeedsYouReason = 'failed' | 'approval';

export type NeedsYouSource = {
  id: string;
  title?: string | null;
  content?: string | null;
  status?: string | null;
  approvalStatus?: string | null;
};

export type NeedsYouItem = {
  id: string;
  label: string;
  reason: NeedsYouReason;
};

const WAITING_APPROVAL = new Set([
  'pending',
  'in_review',
  'revision_requested',
]);

function labelFor(post: NeedsYouSource): string {
  const raw = (post.title || post.content || 'Post').trim();
  return raw.length > 80 ? `${raw.slice(0, 80)}…` : raw;
}

export function needsYouReason(post: NeedsYouSource): NeedsYouReason | null {
  if (!post.id?.trim()) return null;
  if (customerPostStatus(post.status ?? undefined) === 'Failed') {
    return 'failed';
  }
  const approval = (post.approvalStatus ?? '').trim().toLowerCase();
  if (WAITING_APPROVAL.has(approval)) return 'approval';
  const raw = (post.status ?? '').trim().toLowerCase();
  if (raw === 'pending' || raw === 'pending_approval' || raw === 'ready') {
    return 'approval';
  }
  return null;
}

export function pickNeedsYouItems(
  posts: NeedsYouSource[],
  limit = 3
): NeedsYouItem[] {
  const failed: NeedsYouItem[] = [];
  const waiting: NeedsYouItem[] = [];

  for (const post of posts) {
    const reason = needsYouReason(post);
    if (!reason) continue;
    const item = { id: post.id, label: labelFor(post), reason };
    if (reason === 'failed') failed.push(item);
    else waiting.push(item);
  }

  return [...failed, ...waiting].slice(0, limit);
}
