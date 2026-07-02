/**
 * Regression test for SYN-999 — the Resend SDK must load via ESM `import()`,
 * never a module-load `require()` (which threw ERR_REQUIRE_ESM and 500'd
 * /api/cron/seo-audits). This exercises the exact fixed code path.
 */

import { loadResendCtor } from '@/lib/email/resend-loader';

describe('loadResendCtor (ESM-safe Resend load)', () => {
  it('dynamically imports the Resend SDK without a require()-of-ESM crash', async () => {
    const ResendCtor = await loadResendCtor();
    expect(ResendCtor).not.toBeNull();
    expect(typeof ResendCtor).toBe('function'); // constructable class
    // Construction is offline (just stores the key) — proves the SDK is usable.
    const Ctor = ResendCtor as NonNullable<typeof ResendCtor>;
    expect(() => new Ctor('re_test_key')).not.toThrow();
  });

  it('caches the loader promise across calls', () => {
    expect(loadResendCtor()).toBe(loadResendCtor());
  });
});
