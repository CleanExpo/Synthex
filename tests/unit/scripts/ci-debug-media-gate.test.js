// tests/unit/scripts/ci-debug-media-gate.test.js
//
// Lane Synthex, bounded work item: tests for the extractLines / tail
// helpers in ci-debug-media-gate.mjs. The pattern is the same as
// tests/unit/scripts/reconcile-migration-history.test.js — inline copies
// of the helpers, kept in sync with the script. Jest with ts-jest preset,
// so we use the Jest globals (describe / it / expect) not vitest.

/* global describe, it, expect */

// ── Helpers inlined from ci-debug-media-gate.mjs (kept in sync) ─────────

function tail(s, max = 4000) {
  if (s.length <= max) return s;
  return `... [${s.length - max} chars omitted] ...\n` + s.slice(-max);
}

function extractLines(s, predicate) {
  return s
    .split('\n')
    .filter(predicate)
    .map(l => l.trim())
    .filter(Boolean);
}

function buildFailMatcher() {
  return l => {
    const low = l.toLowerCase();
    return (
      low.startsWith('fail:') ||
      low.startsWith('fails:') ||
      low.startsWith('error:') ||
      low.startsWith('errors:') ||
      low.startsWith('fail ') ||
      low.startsWith('fatal') ||
      (low.startsWith('warnings:') && l.trim().endsWith(':'))
    );
  };
}

function buildWarnMatcher() {
  return l => {
    const low = l.toLowerCase();
    return (
      low.startsWith('warn:') ||
      low.startsWith('warning:') ||
      (l.trim().startsWith('- ') && l.length > 4)
    );
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('tail', () => {
  it('returns the string unchanged if shorter than max', () => {
    expect(tail('hello', 100)).toBe('hello');
  });

  it('truncates the middle if longer than max and adds an omission marker', () => {
    // Build a string with a clear marker that the tail retains the END.
    const long =
      'X'.repeat(500) +
      'TAIL_MARKER_BEGIN' +
      'Y'.repeat(500) +
      'TAIL_MARKER_END';
    const out = tail(long, 100);
    expect(out).toContain('TAIL_MARKER_END');
    expect(out).toContain('chars omitted');
    // The "begin" marker should have been dropped (we kept only the last 100 chars).
    expect(out).not.toContain('TAIL_MARKER_BEGIN');
  });
});

describe('extractLines + matchers', () => {
  const stdout =
    'Media check: 14 source images, 28 generated images\n' +
    'Warnings:\n' +
    '- public/images/hero-robot.png source is 624KB; prefer using generated WebP/AVIF in UI\n' +
    '\n';

  it('captures the Warnings: header as a fail signal (when no other fail line)', () => {
    const failLines = extractLines(stdout, buildFailMatcher());
    expect(failLines).toContain('Warnings:');
  });

  it('captures the bullet-style warn lines', () => {
    const warnLines = extractLines(stdout, buildWarnMatcher());
    expect(warnLines).toContain(
      '- public/images/hero-robot.png source is 624KB; prefer using generated WebP/AVIF in UI'
    );
  });

  it('captures the actual fail lines from a failing script', () => {
    const failing =
      'Media check: 14 source images, 28 generated images\n' +
      'fail: docs/foo.png has .png extension but contains jpeg\n' +
      'errors:\n' +
      '  - file not found\n';
    const failLines = extractLines(failing, buildFailMatcher());
    expect(failLines).toContain(
      'fail: docs/foo.png has .png extension but contains jpeg'
    );
    expect(failLines).toContain('errors:');
  });
});
