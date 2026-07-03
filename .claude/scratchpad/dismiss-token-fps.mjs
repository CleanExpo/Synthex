#!/usr/bin/env node
import { execSync } from 'node:child_process';

const queue = [
  {
    n: 9,
    reason: 'false positive',
    comment:
      "Placeholder 'sk_test_xxxxxxxxxx' in env-doc generator example string. Not a real key.",
  },
  {
    n: 6,
    reason: 'false positive',
    comment:
      "Placeholder 'sk_test_xxxxxxxxxx or sk_live_xxxxxxxxxx' in env-validator example string. Not a real key.",
  },
  {
    n: 5,
    reason: 'false positive',
    comment:
      'Placeholder in env-validator example string (duplicate of #6). Not a real key.',
  },
  {
    n: 8,
    reason: 'false positive',
    comment:
      "Placeholder 'pk_test_xxxxxxxxxx' in env-doc generator example string. Not a real key.",
  },
  {
    n: 4,
    reason: 'false positive',
    comment:
      "Placeholder 'pk_test_xxxxxxxxxx or pk_live_xxxxxxxxxx' in env-validator example string. Not a real key.",
  },
  {
    n: 3,
    reason: 'false positive',
    comment:
      'Placeholder in env-validator example string (duplicate of #4). Not a real key.',
  },
  {
    n: 2,
    reason: 'false positive',
    comment:
      "Property name mapping `linkedin: 'linkedinHandle'` in platformHandleMap — value is a TrackedCompetitor field key, not a LinkedIn client ID.",
  },
];

let ok = 0,
  fail = 0;
for (const { n, reason, comment } of queue) {
  try {
    execSync(
      `gh api -X PATCH "repos/CleanExpo/Synthex/code-scanning/alerts/${n}" ` +
        `-f state=dismissed -f dismissed_reason=${JSON.stringify(reason)} ` +
        `-f dismissed_comment=${JSON.stringify(comment)}`,
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    ok++;
    process.stdout.write('.');
  } catch {
    fail++;
    process.stdout.write('x');
  }
}
process.stdout.write('\n');
console.log(`Dismissed: ${ok}/7${fail ? ` · Failed: ${fail}` : ''}`);
