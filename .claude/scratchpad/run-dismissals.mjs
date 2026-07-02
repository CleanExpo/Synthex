#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const queue = JSON.parse(
  readFileSync('.claude/scratchpad/dismiss-queue.json', 'utf8')
);
let ok = 0,
  fail = 0;
const failed = [];

for (const { n, reason, comment, rule } of queue) {
  try {
    execSync(
      `gh api -X PATCH "repos/CleanExpo/Synthex/code-scanning/alerts/${n}" ` +
        `-f state=dismissed -f dismissed_reason=${JSON.stringify(reason)} ` +
        `-f dismissed_comment=${JSON.stringify(comment)} --jq '.state'`,
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    ok++;
    process.stdout.write('.');
  } catch {
    fail++;
    failed.push({ n, rule });
    process.stdout.write('x');
  }
}

process.stdout.write('\n');
console.log(`Dismissed: ${ok} / ${queue.length}`);
if (fail > 0) {
  console.log(`Failed: ${fail}`);
  console.log(failed.map(f => `  #${f.n} (${f.rule})`).join('\n'));
}
