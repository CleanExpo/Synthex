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

// 4. The bootstrap check treats a present metered key as a failure, not a pass.
const cb = read('scripts/fleet/check-bootstrap.mjs');
if (!/meteredKeysPresent\(/.test(cb))
  fails.push(
    'check-bootstrap.mjs does not fail on a present metered provider key'
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
if (!/usableReviewLanes\(pol, lanes\.stdout\)/.test(cb))
  fails.push(
    'check-bootstrap.mjs item 5 does not use usableReviewLanes(pol, ...)'
  );

for (const f of fails) console.log(`FAIL ${f}`);
if (fails.length) process.exit(1);
console.log('ok subscription-only review lanes');
