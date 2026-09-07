/**
 * Customer copy for social accounts: Ready or Not ready.
 */

export type PlatformReadyKind = 'ready' | 'expired' | 'refresh' | 'not_ready';

export function platformReadyKind(status: {
  connected: boolean;
  isExpired?: boolean;
  needsRefresh?: boolean;
}): PlatformReadyKind {
  if (status.connected && status.isExpired) return 'expired';
  if (status.connected && status.needsRefresh) return 'refresh';
  if (status.connected) return 'ready';
  return 'not_ready';
}

export function platformReadyCopy(
  name: string,
  kind: PlatformReadyKind
): {
  badge: 'Ready' | 'Not ready';
  missing: string;
  why: string;
  next: string;
} {
  if (kind === 'ready') {
    return {
      badge: 'Ready',
      missing: '',
      why: `${name} can receive posts when you schedule them.`,
      next: 'Write a post in Content when you are ready.',
    };
  }
  if (kind === 'expired') {
    return {
      badge: 'Not ready',
      missing: `${name} login has expired.`,
      why: 'Posts to this account will stay in Synthex until you reconnect.',
      next: 'Tap Reconnect, then you can still draft anytime.',
    };
  }
  if (kind === 'refresh') {
    return {
      badge: 'Not ready',
      missing: `${name} needs a refresh.`,
      why: 'If you skip this, the next live send may fail.',
      next: 'Tap Refresh. You can still write drafts.',
    };
  }
  return {
    badge: 'Not ready',
    missing: `${name} is not connected.`,
    why: 'You cannot send to this channel yet. Drafts are fine.',
    next: 'Tap Connect. Ready looks like a green check.',
  };
}
