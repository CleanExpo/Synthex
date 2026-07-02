#!/usr/bin/env node
import { execSync } from 'node:child_process';

const queue = [
  {
    n: 82,
    reason: 'false positive',
    comment:
      "print(f\"  Error: {result['error']}\") — result['error'] is the literal string 'No valid credentials' (not a credential value). CodeQL's taint analysis flags it because the word 'credentials' appears in the error text.",
  },
  {
    n: 81,
    reason: 'false positive',
    comment:
      'Same as #82 — printing error string metadata, not credential values.',
  },
  {
    n: 80,
    reason: 'false positive',
    comment:
      'Same as #82 — printing result dict containing model/path/size/elapsed metadata, not credentials.',
  },
  {
    n: 79,
    reason: 'false positive',
    comment: 'Same as #82 — printing result dict metadata.',
  },
  {
    n: 77,
    reason: 'false positive',
    comment:
      "meta_path.write_text(json.dumps(result, indent=2)) — writes generation metadata (prompt/model/resolution/elapsed), not credentials. The result dict only ever contains 'No valid credentials' as an error string; never a credential value.",
  },
  {
    n: 76,
    reason: "won't fix",
    comment:
      'Internal scanner script (.claude/skills/project-scanner). Tag-strip regex behaviour acceptable; not a production attack surface.',
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
console.log(
  `Dismissed: ${ok}/${queue.length}${fail ? ` · Failed: ${fail}` : ''}`
);
