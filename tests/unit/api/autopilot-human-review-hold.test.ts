import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The autopilot must never publish without a human.
 *
 * `holdAutopilotForReview` already proves a 'schedule' decision downgrades to
 * 'draft'. The second half of the hold lives in the cron route itself, where
 * `postStatus` is pinned by a constant, and nothing tested that half: an
 * independent review of b88bb3883 flipped that constant to `false` and every
 * focused suite still passed. That is the gap this closes.
 *
 * This is a source-level assertion, deliberately. The constant is a compile-time
 * switch with no runtime input, so the source text IS the value — there is no
 * behaviour to exercise until someone changes the literal. It will not catch a
 * scheduling path added elsewhere in the route; it catches the specific flip that
 * turns every generated post into an auto-publish.
 */
const ROUTE = join(process.cwd(), 'app/api/cron/autopilot/route.ts');

describe('autopilot human-review hold', () => {
  const source = readFileSync(ROUTE, 'utf8');

  it('reads the route source it is asserting about', () => {
    // Non-vacuity: a renamed file or an empty read would otherwise pass silently.
    expect(source.length).toBeGreaterThan(1000);
    expect(source).toContain('HOLD_EVERY_POST_FOR_HUMAN_REVIEW');
  });

  it('keeps every autopilot post held for a human', () => {
    expect(source).toMatch(/const HOLD_EVERY_POST_FOR_HUMAN_REVIEW\s*(?::\s*boolean\s*)?=\s*true\s*;/);
  });

  it('derives postStatus from the hold rather than pinning it independently', () => {
    expect(source).toMatch(
      /let postStatus:\s*'scheduled'\s*\|\s*'draft'\s*=\s*HOLD_EVERY_POST_FOR_HUMAN_REVIEW/
    );
  });
});
