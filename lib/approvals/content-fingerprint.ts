/**
 * Binds a post approval to the wording the reviewer was asked to approve.
 *
 * POST /api/approvals stores a fingerprint of the post's platform and text in
 * the approval request's metadata. PATCH approve recomputes it from the post as
 * it stands now; a mismatch means the post was edited after it was submitted,
 * and the approval is refused until the submitter resubmits. A bound request
 * whose post no longer exists is refused the same way: there is no longer any
 * wording that matches what the reviewer was asked to approve.
 *
 * Requests created before this binding existed carry no fingerprint. They are
 * reported as 'unbound' (still approvable, recorded in the audit log) so posts
 * already waiting for review are not stranded.
 */
import { createHash } from 'crypto';

export const CONTENT_FINGERPRINT_KEY = 'contentFingerprint';

export interface FingerprintablePost {
  content: string;
  platform: string;
}

export type ContentBinding =
  | { kind: 'match' }
  | { kind: 'changed' }
  | { kind: 'unbound' };

export function postContentFingerprint(post: FingerprintablePost): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([post.platform, post.content]))
    .digest('hex');
  return `sha256:${digest}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns approval metadata carrying the server-computed fingerprint. Any
 * caller-supplied fingerprint is dropped: only the server may bind a version.
 */
export function bindPostFingerprint(
  metadata: unknown,
  post: FingerprintablePost | null
): Record<string, unknown> {
  const base = isRecord(metadata) ? { ...metadata } : {};
  delete base[CONTENT_FINGERPRINT_KEY];
  if (post) base[CONTENT_FINGERPRINT_KEY] = postContentFingerprint(post);
  return base;
}

export function checkPostBinding(
  approvalMetadata: unknown,
  post: FingerprintablePost | null
): ContentBinding {
  const stored = isRecord(approvalMetadata)
    ? approvalMetadata[CONTENT_FINGERPRINT_KEY]
    : undefined;
  if (typeof stored !== 'string' || stored.length === 0) {
    return { kind: 'unbound' };
  }
  if (!post) return { kind: 'changed' };
  return stored === postContentFingerprint(post)
    ? { kind: 'match' }
    : { kind: 'changed' };
}
