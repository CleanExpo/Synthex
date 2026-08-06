/**
 * lib/email/queue.ts — the email queue's retry backoff must be resolvable.
 *
 * MEASURED CAUSE (production Vercel runtime logs, 2026-06-22 -> 2026-08-03)
 * `/api/cron/weekly-digest` failed repeatedly with `Unknown backoff strategy
 * custom`, and no weekly digest has ever been delivered.
 *
 * The queue and every job request `backoff: { type: 'custom' }` (queue.ts:146,
 * :204) but the Worker is constructed with no `settings.backoffStrategy`.
 * BullMQ's contract is explicit — dist/cjs/classes/backoffs.js:
 *
 *   if (backoff.type in Backoffs.builtinStrategies) { ... }
 *   else if (customStrategy) { return customStrategy; }
 *   else { throw new Error(`Unknown backoff strategy ${backoff.type}.`) }
 *
 * So the throw happens when a failed job computes its retry delay. Any email
 * that fails once dies there, and the throw masks whatever the original send
 * error was.
 *
 * `RETRY_DELAYS = [1000, 5000, 30000, 120000, 600000]` was declared at
 * queue.ts:86 and referenced NOWHERE. The custom schedule was written and never
 * wired up. The fix registers it rather than replacing it with `exponential`,
 * because a deliberate 1s/5s/30s/2m/10m ladder is what the author specified and
 * exponential would silently change delivery timing.
 */

import {
  EMAIL_RETRY_DELAYS,
  MAX_ATTEMPTS,
  emailBackoffStrategy,
} from '@/lib/email/queue';

// The REAL bullmq, deliberately. The unit jest config maps `^bullmq$` to
// tests/__mocks__/bullmq.js, and a mock's backoff behaviour is whatever the mock
// says — asserting against it would prove nothing about the production error.
// requireActual bypasses moduleNameMapper so these tests bind to the library's
// genuine contract. Adding `Backoffs` to the shared mock was the alternative and
// would have made the positive control below vacuous.
// Required by concrete path rather than package root: `jest.requireActual('bullmq')`
// still resolved without `Backoffs` under this config, and this is the exact
// module quoted above — so the test binds to the file whose `throw` is the
// production error, not to a re-export that may or may not carry it.
const { Backoffs } = jest.requireActual('bullmq/dist/cjs/classes/backoffs') as {
  Backoffs: {
    calculate: (
      backoff: unknown,
      attemptsMade: number,
      err: Error,
      job: unknown,
      customStrategy?: unknown
    ) => number | undefined;
  };
};

describe('the failure mode is real', () => {
  it("BullMQ throws on 'custom' when no strategy is supplied", () => {
    // POSITIVE CONTROL. Without this, the assertions below could pass against a
    // BullMQ that tolerates an unknown type, and the test would prove nothing
    // about the production error.
    expect(() =>
      Backoffs.calculate(
        { type: 'custom' } as never,
        1,
        new Error('send failed'),
        {} as never,
        undefined // <- no custom strategy: production's exact shape
      )
    ).toThrow(/Unknown backoff strategy custom/);
  });

  it('resolves once the strategy IS supplied', () => {
    // The same call, differing only in the strategy argument, must now succeed —
    // proving the strategy is what closes the gap and not some other change.
    expect(() =>
      Backoffs.calculate(
        { type: 'custom' } as never,
        1,
        new Error('send failed'),
        {} as never,
        emailBackoffStrategy as never
      )
    ).not.toThrow();
  });
});

describe('the ladder and the attempts config must agree', () => {
  it('configures enough attempts to reach the last rung', () => {
    // BullMQ's `attempts` counts TOTAL executions, not retries. The queue passed
    // MAX_RETRIES (5) directly, buying 1 initial try + 4 retries — so the
    // ten-minute rung, the only delay long enough to outlast a provider
    // incident, was unreachable. Off by exactly one, silently, in the direction
    // that discards the retry that matters most.
    //
    // Asserted as a RELATIONSHIP rather than against the literal 6: a future
    // rung added to the ladder must move this number too, and a test pinned to
    // a constant would not notice.
    expect(MAX_ATTEMPTS).toBe(EMAIL_RETRY_DELAYS.length + 1);

    // And the last rung is genuinely reachable at that attempt count.
    const lastRetry = MAX_ATTEMPTS - 1;
    expect(emailBackoffStrategy(lastRetry)).toBe(
      EMAIL_RETRY_DELAYS[EMAIL_RETRY_DELAYS.length - 1]
    );
    expect(emailBackoffStrategy(lastRetry)).toBe(600_000);
  });
});

describe('the retry ladder', () => {
  it('walks RETRY_DELAYS in order: 1s, 5s, 30s, 2m, 10m', () => {
    expect(EMAIL_RETRY_DELAYS).toEqual([1000, 5000, 30000, 120000, 600000]);
    // attemptsMade is 1 on the first failure, so it indexes from 0.
    expect(emailBackoffStrategy(1)).toBe(1000);
    expect(emailBackoffStrategy(2)).toBe(5000);
    expect(emailBackoffStrategy(3)).toBe(30000);
    expect(emailBackoffStrategy(4)).toBe(120000);
    expect(emailBackoffStrategy(5)).toBe(600000);
  });

  it('clamps rather than returning undefined past the end of the ladder', () => {
    // MAX_RETRIES is 5, so attempt 6 should be unreachable — but a strategy that
    // returns undefined out of range makes BullMQ retry immediately in a tight
    // loop, which is a worse failure than the one being fixed. Clamped, so an
    // off-by-one in attempts config degrades to "wait 10 minutes".
    expect(emailBackoffStrategy(6)).toBe(600000);
    expect(emailBackoffStrategy(99)).toBe(600000);
  });

  it('never returns a non-positive delay', () => {
    // A zero or negative delay is a busy-retry loop against SendGrid/Resend.
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect(emailBackoffStrategy(attempt)).toBeGreaterThan(0);
    }
  });
});
