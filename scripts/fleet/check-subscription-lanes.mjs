#!/usr/bin/env node
// Fails (exit 1) when the fleet can reach a review lane or model route that is not on a
// subscription plan. Prints one FAIL line per problem; never prints a key value.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reviewLanes,
  policyViolations,
  meteredKeysPresent,
  usableReviewLanes,
} from './lanes.mjs';
import { meteredKeyItem, reviewLaneItem } from './check-bootstrap.mjs';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const read = p => readFileSync(path.join(ROOT, p), 'utf8');
const fails = [];

// 1. The policy file itself.
const pol = JSON.parse(read('scripts/fleet/policy.json'));
for (const v of policyViolations(pol)) fails.push(`policy: ${v}`);

// 2. The lane filter refuses non-subscription and unknown lanes even when the paid-ok switch is
//    set in the ambient environment (lib.mjs run() merges process.env into every child).
process.env.PR_GATE_OPENROUTER_PAID_OK = '1';
const probe = reviewLanes({
  review: {
    lanes_in_order: [
      'openrouter',
      'minimax',
      'gemini',
      'codex',
      'brand-new-paid-lane',
    ],
    never: [],
  },
});
if (JSON.stringify(probe) !== JSON.stringify(['codex']))
  fails.push(
    `lane filter returned ${JSON.stringify(probe)} with PR_GATE_OPENROUTER_PAID_OK=1, expected ["codex"]`
  );
delete process.env.PR_GATE_OPENROUTER_PAID_OK;

// 3. run-phase.mjs iterates only the filtered lanes, never sets the paid-ok switch, and its
//    review ledger rows record the model and whether a paid-ok switch was set.
const rp = read('scripts/fleet/run-phase.mjs');
if (!/for \(const lane of reviewLanes\(pol\)\)/.test(rp))
  fails.push('run-phase.mjs does not iterate reviewLanes(pol)');
if (/for \(const lane of pol\.review\.lanes_in_order\)/.test(rp))
  fails.push('run-phase.mjs still iterates pol.review.lanes_in_order directly');
if (/PR_GATE_OPENROUTER_PAID_OK:\s*'1'/.test(rp))
  fails.push('run-phase.mjs can still set PR_GATE_OPENROUTER_PAID_OK');
const ledgerRow = rp.match(
  /ledgerAppend\(\{\s*kind: 'review',[^}]*verdict[^}]*\}\)/s
);
if (
  !ledgerRow ||
  !/model/.test(ledgerRow[0]) ||
  !/paid_ok_env/.test(ledgerRow[0])
)
  fails.push('run-phase.mjs review ledger row lacks model and paid_ok_env');

// 4. Bootstrap item 3 FAILs when a metered key is present and names it without its value, and
//    PASSes when none is present (behaviour, not source text: Codex review of 2c58bb520, P0).
const sentinel = 'dummy-not-a-real-key';
const keyed = meteredKeyItem({ OPENROUTER_API_KEY: sentinel });
if (keyed.id !== 3 || keyed.state !== 'FAIL')
  fails.push(
    `check-bootstrap item 3 is ${keyed.state} with OPENROUTER_API_KEY set, expected FAIL`
  );
if (!String(keyed.detail).includes('OPENROUTER_API_KEY'))
  fails.push('check-bootstrap item 3 does not name the metered key present');
if (JSON.stringify(keyed).includes(sentinel))
  fails.push('check-bootstrap item 3 prints a metered key value');
const unkeyed = meteredKeyItem({});
if (unkeyed.state !== 'PASS')
  fails.push(
    `check-bootstrap item 3 is ${unkeyed.state} with no metered key, expected PASS`
  );
if (
  meteredKeysPresent({ ANTHROPIC_API_KEY: 'x' }).join() !== 'ANTHROPIC_API_KEY'
)
  fails.push('meteredKeysPresent does not detect ANTHROPIC_API_KEY');

// 5. Bootstrap item 5 counts only lanes the policy allows: resolved paid lanes beside an
//    unavailable codex must not read as review readiness (Codex review of 0b8fc6231, P1).
const listing = codexState =>
  [
    'order  lane        credential',
    `    1  codex       ${codexState}`,
    '    2  minimax     resolved',
    '    3  gemini      NOT FOUND',
    '    4  openrouter  resolved',
    '    -  cursor      PATH ok  [registered, not routed]',
  ].join('\n');
const noCodex = usableReviewLanes(pol, listing('NOT FOUND'));
if (noCodex.length)
  fails.push(
    `usableReviewLanes counted ${JSON.stringify(noCodex)} with codex unavailable, expected []`
  );
const withCodex = usableReviewLanes(pol, listing('PATH ok'));
if (JSON.stringify(withCodex) !== JSON.stringify(['codex']))
  fails.push(
    `usableReviewLanes returned ${JSON.stringify(withCodex)} with codex available, expected ["codex"]`
  );
// Bootstrap item 5 itself, given the same listings as an independent_review.py run result.
const item5 = (code, codexState) =>
  reviewLaneItem(pol, { code, stdout: listing(codexState), stderr: '' });
const i5none = item5(0, 'NOT FOUND');
if (i5none.id !== 5 || i5none.state !== 'FAIL')
  fails.push(
    `check-bootstrap item 5 is ${i5none.state} with codex unavailable and paid lanes resolved, expected FAIL`
  );
const i5codex = item5(0, 'PATH ok');
if (i5codex.state !== 'PASS' || i5codex.detail !== 'codex')
  fails.push(
    `check-bootstrap item 5 is ${i5codex.state} [${i5codex.detail}] with codex available, expected PASS [codex]`
  );
const i5err = item5(1, 'PATH ok');
if (i5err.state !== 'INCONCLUSIVE')
  fails.push(
    `check-bootstrap item 5 is ${i5err.state} when --list-lanes fails, expected INCONCLUSIVE`
  );

for (const f of fails) console.log(`FAIL ${f}`);
if (fails.length) process.exit(1);
console.log('ok subscription-only review lanes');
