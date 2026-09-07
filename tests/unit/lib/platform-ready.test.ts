import {
  platformReadyCopy,
  platformReadyKind,
} from '@/lib/dashboard/platform-ready';

describe('platformReadyKind', () => {
  it('treats a connected Instagram as ready', () => {
    expect(platformReadyKind({ connected: true })).toBe('ready');
  });

  it('treats an expired token as not ready', () => {
    expect(platformReadyKind({ connected: true, isExpired: true })).toBe(
      'expired'
    );
  });
});

describe('platformReadyCopy', () => {
  it('explains a half-connected Instagram', () => {
    const copy = platformReadyCopy('Instagram', 'not_ready');
    expect(copy.badge).toBe('Not ready');
    expect(copy.missing).toMatch(/not connected/);
    expect(copy.why).toMatch(/cannot send/);
    expect(copy.next).toMatch(/green check/);
  });

  it('keeps drafts available when expired', () => {
    const copy = platformReadyCopy('Instagram', 'expired');
    expect(copy.badge).toBe('Not ready');
    expect(copy.next).toMatch(/draft/);
  });
});
