#!/usr/bin/env node
/**
 * check-repo-controls.mjs
 *
 * Asserts that the live GitHub merge/deploy control plane for this repository
 * matches the state declared in .github/repo-controls.json.
 *
 * Written for Gruen Standard v1.1 Phase 0.0 (docs/specs/gruen-standard/spec.md, section 7):
 * "close the door" before deleting anything or rotating anything. A declared file
 * nobody compares to reality is documentation, not a control; this script is the
 * comparison.
 *
 * Modes
 *   (default)           DRIFT check. Fails if any live value differs from `expected`.
 *   --require-targets   Additionally fails if any `expected` still differs from
 *                       `phase_0_0_target`, i.e. if a Phase 0.0 item is still open.
 *   --json              Emit the probe/compare result as JSON on stdout.
 *
 * Every read is a GET. This script issues no mutating request and must never be
 * given one: it is the thing that notices when somebody else does.
 *
 * It fails CLOSED. An API error, a missing permission, an absent declaration and an
 * undeclared new control are all failures, not skips. A check that cannot read its
 * subject has not passed.
 *
 * Token resolution: GH_TOKEN, then GITHUB_TOKEN, then `gh auth token`.
 * Reading branch protection requires admin rights on the repository. The stock
 * Actions GITHUB_TOKEN has no `administration: read` permission key, so in CI this
 * is expected to need a PAT; if the read fails the run goes red rather than green.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DECL_PATH = join(ROOT, '.github', 'repo-controls.json');
const API = 'https://api.github.com';

const args = new Set(process.argv.slice(2));
const REQUIRE_TARGETS = args.has('--require-targets');
const AS_JSON = args.has('--json');

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(2);
}

function token() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      shell: true,
    }).trim();
  } catch {
    fail('no token. Set GH_TOKEN or GITHUB_TOKEN, or authenticate the gh CLI.');
  }
}

const TOKEN = token();

async function get(path) {
  const res = await fetch(`${API}/${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'synthex-check-repo-controls',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    fail(
      `GET /${path} -> ${res.status}. This check cannot read its subject, so it cannot pass. ${body.slice(0, 300)}`
    );
  }
  return res.json();
}

/** Recursively list files under a directory. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

async function probe(repo, defaultBranch) {
  const [
    r,
    prot,
    reviews,
    rulesets,
    envs,
    prodEnv,
    vars,
    secrets,
    protectedBranches,
  ] = await Promise.all([
    get(`repos/${repo}`),
    get(`repos/${repo}/branches/${defaultBranch}/protection`),
    // The top-level protection payload omits required_pull_request_reviews on this
    // repository. The sub-resource is authoritative; reading only the top level
    // would wrongly report that reviews are unconfigured.
    get(
      `repos/${repo}/branches/${defaultBranch}/protection/required_pull_request_reviews`
    ),
    get(`repos/${repo}/rulesets`),
    get(`repos/${repo}/environments`),
    get(`repos/${repo}/environments/Production`),
    get(`repos/${repo}/actions/variables`),
    get(`repos/${repo}/actions/secrets`),
    get(`repos/${repo}/branches?protected=true`),
  ]);

  const reviewerRule =
    (prodEnv.protection_rules || []).find(
      x => x.type === 'required_reviewers'
    ) || null;

  const deployYml = join(ROOT, '.github', 'workflows', 'deploy.yml');
  const deployText = existsSync(deployYml)
    ? readFileSync(deployYml, 'utf8')
    : '';
  // Scoped to .github/workflows/ deliberately: the claim under test is spec section 4 E4,
  // "a dormant VERCEL_DEPLOY_HOOK secret with zero workflow references". Widening this to
  // all of .github/ makes the control count its own declaration file and self-trip.
  const hookRefs = walk(join(ROOT, '.github', 'workflows')).filter(p =>
    readFileSync(p, 'utf8').includes('VERCEL_DEPLOY_HOOK')
  ).length;

  // A second, older protection-as-code file exists at .github/branch-protection.json
  // (tracked; added 2025-08-12 in commit 95679169b). Every branch-protection claim in it
  // is false against the live repository and nothing reads it. Two declarations of the
  // merge control plane that disagree is worse than one, so its presence and its reader
  // count are probed rather than left to be rediscovered. Readers are looked for only
  // where one could plausibly live: workflows, scripts, and package.json.
  const legacyPresent = existsSync(
    join(ROOT, '.github', 'branch-protection.json')
  );
  // SELF is excluded: this script names the file in order to probe it, so without the
  // exclusion the instrument counts itself as a reader and the control trips on its own
  // existence. Second instance of that mistake in this file - see the VERCEL_DEPLOY_HOOK
  // scoping note above. A probe that matches on a literal string must always be asked
  // whether it can see itself.
  const SELF = fileURLToPath(import.meta.url);
  const legacyReaders =
    [join(ROOT, '.github', 'workflows'), join(ROOT, 'scripts')]
      .flatMap(d => walk(d))
      .filter(p => p !== SELF)
      .filter(p => readFileSync(p, 'utf8').includes('branch-protection.json'))
      .length +
    (readFileSync(join(ROOT, 'package.json'), 'utf8').includes(
      'branch-protection.json'
    )
      ? 1
      : 0);

  return {
    'repo.owner_type': r.owner?.type ?? null,
    'repo.allow_auto_merge': r.allow_auto_merge ?? null,
    'repo.delete_branch_on_merge': r.delete_branch_on_merge ?? null,
    'repo.web_commit_signoff_required': r.web_commit_signoff_required ?? null,

    'protection.required_status_checks.strict':
      prot.required_status_checks?.strict ?? null,
    'protection.required_status_checks.contexts': [
      ...(prot.required_status_checks?.contexts ?? []),
    ].sort(),
    'protection.enforce_admins': prot.enforce_admins?.enabled ?? null,
    'protection.required_signatures': prot.required_signatures?.enabled ?? null,
    'protection.required_linear_history':
      prot.required_linear_history?.enabled ?? null,
    'protection.allow_force_pushes': prot.allow_force_pushes?.enabled ?? null,
    'protection.allow_deletions': prot.allow_deletions?.enabled ?? null,
    'protection.block_creations': prot.block_creations?.enabled ?? null,
    'protection.required_conversation_resolution':
      prot.required_conversation_resolution?.enabled ?? null,
    'protection.lock_branch': prot.lock_branch?.enabled ?? null,

    'protection.reviews.required_approving_review_count':
      reviews.required_approving_review_count ?? null,
    'protection.reviews.dismiss_stale_reviews':
      reviews.dismiss_stale_reviews ?? null,
    'protection.reviews.require_code_owner_reviews':
      reviews.require_code_owner_reviews ?? null,
    'protection.reviews.require_last_push_approval':
      reviews.require_last_push_approval ?? null,

    'rulesets.count': Array.isArray(rulesets) ? rulesets.length : null,

    'environment.Production.can_admins_bypass':
      prodEnv.can_admins_bypass ?? null,
    'environment.Production.prevent_self_review': reviewerRule
      ? reviewerRule.prevent_self_review
      : null,
    'environment.Production.required_reviewers': reviewerRule
      ? reviewerRule.reviewers
          .map(x => x.reviewer?.login ?? x.reviewer?.slug ?? '?')
          .sort()
      : null,
    'environment.count': envs.total_count ?? null,

    'actions.variable.DEPLOY_INHIBIT.exists': (vars.variables ?? []).some(
      v => v.name === 'DEPLOY_INHIBIT'
    ),
    'actions.variable.count': vars.total_count ?? null,

    'actions.secret.VERCEL_DEPLOY_HOOK.exists': (secrets.secrets ?? []).some(
      s => s.name === 'VERCEL_DEPLOY_HOOK'
    ),

    'branches.protected': Array.isArray(protectedBranches)
      ? protectedBranches.map(b => b.name).sort()
      : null,

    'legacy.branch_protection_json.present': legacyPresent,
    'legacy.branch_protection_json.reader_count': legacyReaders,

    'workflow.deploy.deploy_inhibit_guard_present':
      /vars\.DEPLOY_INHIBIT\s*!=\s*'true'/.test(deployText),
    'workflow.deploy.vercel_deploy_hook_references': hookRefs,
  };
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = v => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

async function main() {
  if (!existsSync(DECL_PATH)) fail(`declaration not found at ${DECL_PATH}`);
  // replace(/^﻿/, ''): a BOM is a Windows editor artefact, not a malformed
  // declaration. Without this the check dies with a parse error on an otherwise
  // valid file, and the fix somebody reaches for is to loosen the check.
  const decl = JSON.parse(readFileSync(DECL_PATH, 'utf8').replace(/^﻿/, ''));
  const observed = await probe(decl.repo, decl.default_branch);

  const declaredIds = Object.keys(decl.controls);
  const observedIds = Object.keys(observed);

  const undeclared = observedIds.filter(id => !declaredIds.includes(id));
  const unprobed = declaredIds.filter(id => !observedIds.includes(id));

  const drift = [];
  const openGaps = [];

  for (const id of declaredIds) {
    if (!observedIds.includes(id)) continue;
    const c = decl.controls[id];
    // Arrays are compared order-insensitively; the probe already sorts them.
    const expected = Array.isArray(c.expected)
      ? [...c.expected].sort()
      : c.expected;
    if (!eq(observed[id], expected)) {
      drift.push({
        id,
        expected,
        live: observed[id],
        gate: c.gate,
        note: c.note,
      });
    }
    if (c.phase_0_0_target !== null && c.phase_0_0_target !== undefined) {
      const target = Array.isArray(c.phase_0_0_target)
        ? [...c.phase_0_0_target].sort()
        : c.phase_0_0_target;
      if (!eq(expected, target)) {
        openGaps.push({ id, expected, target, gate: c.gate, note: c.note });
      }
    }
  }

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        { observed, drift, openGaps, undeclared, unprobed },
        null,
        2
      )
    );
  } else {
    console.log(
      `repo-controls: ${decl.repo}@${decl.default_branch}  declared=${declaredIds.length}  probed=${observedIds.length}`
    );
    console.log('');

    if (undeclared.length) {
      console.log(
        'UNDECLARED CONTROLS (the probe knows about these, the declaration does not):'
      );
      for (const id of undeclared)
        console.log(`  ! ${id}  live=${show(observed[id])}`);
      console.log('');
    }
    if (unprobed.length) {
      console.log(
        'UNPROBED DECLARATIONS (declared but nothing reads them - a control that cannot be checked):'
      );
      for (const id of unprobed) console.log(`  ! ${id}`);
      console.log('');
    }

    if (drift.length === 0) {
      console.log(
        'DRIFT: none. Every declared control matches the live repository.'
      );
    } else {
      console.log(
        `DRIFT: ${drift.length} control(s) no longer match the declaration.`
      );
      for (const d of drift) {
        console.log(`  x ${d.id}`);
        console.log(`      declared: ${show(d.expected)}`);
        console.log(`      live:     ${show(d.live)}`);
        console.log(`      gate:     ${d.gate}`);
      }
    }
    console.log('');

    if (openGaps.length === 0) {
      console.log(
        'PHASE 0.0: no open gaps. Every declared control already sits at its target.'
      );
    } else {
      console.log(
        `PHASE 0.0 OPEN GAPS: ${openGaps.length} (informational unless --require-targets)`
      );
      for (const g of openGaps) {
        console.log(
          `  o ${g.id}: ${show(g.expected)} -> target ${show(g.target)}  [${g.gate}]`
        );
      }
      console.log(
        '  Founder-executable steps: docs/specs/gruen-standard/phase-0-0-founder-runbook.md'
      );
    }
  }

  const hard = drift.length + undeclared.length + unprobed.length;
  if (hard > 0) process.exit(1);
  if (REQUIRE_TARGETS && openGaps.length > 0) process.exit(1);
  process.exit(0);
}

main().catch(e => fail(e?.stack || String(e)));
