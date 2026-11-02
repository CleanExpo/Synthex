import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, summarise, buildReport } from './audit-markdown.mjs';

test('active May 2026 Cursor model hint flags review, never auto-marks obsolete', () => {
  const c = classify(
    '.cursor/rules/agent-stack.mdc',
    '# May 2026\nComposer 2.5'
  );
  assert.equal(c.active, true);
  assert.equal(c.legacyModel, true);
  assert.ok(
    c.reason.includes('legacy-model-reference-needs-manual-verification')
  );
});
test('historical plan remains history, not candidate for blanket rewrite', () => {
  const c = classify(
    'docs/archive/plans/2025-08-13.md',
    'A historical note about GPT-4.'
  );
  assert.deepEqual(c.reason, []);
});
test('review report does not falsely assert content was refreshed', () => {
  const i = [
    {
      path: 'CLAUDE.md',
      active: true,
      reason: ['dated-active-reference-review'],
      sha256_12: 'aaa',
    },
  ];
  const r = buildReport(i, 'abcdef');
  assert.equal(r.counts.trackedReadable, 1);
  assert.equal(r.counts.reviewCandidates, 1);
  assert.match(r.warning, /No files modified/);
  assert.deepEqual(summarise(i), { 'CLAUDE.md': 1 });
});
