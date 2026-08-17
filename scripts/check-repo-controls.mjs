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
 *
 * In CI this needs a PAT, and that is now observed rather than predicted. Run
 * 31969036972 on this branch returned `GET /repos/CleanExpo/Synthex/actions/secrets
 * -> 403 Resource not accessible by integration` under the stock Actions
 * GITHUB_TOKEN. The workflow `permissions:` key has no `administration`, `secrets`
 * or `variables` entry to grant, so no amount of permission-widening on
 * GITHUB_TOKEN reaches these endpoints. The fine-grained permissions required are:
 *
 *   Administration: Read  branch protection, required_pull_request_reviews, rulesets
 *   Secrets:        Read  actions/secrets
 *   Variables:      Read  actions/variables
 *   Actions:        Read  environments
 *   Metadata:       Read  the repo itself, branches?protected=true (always granted)
 *
 * Until that token exists the run goes red naming the endpoint and the status
 * code. That is the designed outcome, not a defect to be worked around: dropping
 * an endpoint from the probe would make the control stop watching a control.
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
    // No `shell: true`: the argument vector is static, and running it through a
    // shell only re-parses those arguments under shell quoting rules.
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    fail('no token. Set GH_TOKEN or GITHUB_TOKEN, or authenticate the gh CLI.');
  }
}

const TOKEN = token();

const CANNOT_READ = 'This check cannot read its subject, so it cannot pass.';

/**
 * One GET. Returns the parsed body and the raw Link header, because the callers
 * that page need the header and the callers that do not still need the body.
 *
 * The timeout matters on the scheduled run: without it a stalled api.github.com
 * connection hangs until the job-level timeout and the failure arrives as a
 * cancelled job rather than as a named endpoint.
 */
async function request(url) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'synthex-check-repo-controls',
      },
    });
  } catch (e) {
    const why =
      e?.name === 'TimeoutError'
        ? 'timed out after 20s'
        : String(e?.message ?? e);
    fail(`GET ${url} -> ${why}. ${CANNOT_READ}`);
  }
  if (!res.ok) {
    const body = await res.text();
    fail(`GET ${url} -> ${res.status}. ${CANNOT_READ} ${body.slice(0, 300)}`);
  }
  return { body: await res.json(), link: res.headers.get('link') };
}

async function get(path) {
  return (await request(`${API}/${path}`)).body;
}

/** The `rel="next"` URL from a Link header, or null at the last page. */
function nextLink(link) {
  const m = link && /<([^>]+)>;\s*rel="next"/.exec(link);
  return m ? m[1] : null;
}

/**
 * GET a list endpoint in full, following pagination to the last page.
 *
 * `key` names the array on wrapper-shaped payloads (`{total_count, secrets: []}`);
 * pass nothing for endpoints that return a bare array.
 *
 * Reading one default page would be a control that fails in the green direction.
 * The page default is 30, so on a repository with 31 secrets
 * `actions.secret.VERCEL_DEPLOY_HOOK.exists` would report false while the secret
 * existed. Phase 0.0's target for that control IS false, so the truncated read
 * and the achieved target are the same observation - the check would report the
 * door closed by never having looked at it. Same shape for rulesets, protected
 * branches and DEPLOY_INHIBIT.
 *
 * `totalCount` is carried from the first page so callers that want the server's
 * own count do not have to re-derive it from a list they may have paged.
 */
async function getAll(path, key) {
  const items = [];
  let totalCount = null;
  let url = `${API}/${path}${path.includes('?') ? '&' : '?'}per_page=100`;
  while (url) {
    const { body, link } = await request(url);
    const page = key ? body?.[key] : body;
    if (!Array.isArray(page)) {
      fail(
        `GET ${url} did not return a list${key ? ` under "${key}"` : ''}. ${CANNOT_READ}`
      );
    }
    if (totalCount === null && typeof body?.total_count === 'number') {
      totalCount = body.total_count;
    }
    items.push(...page);
    url = nextLink(link);
  }
  return { items, totalCount };
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
    getAll(`repos/${repo}/rulesets`),
    // Not paged: only `total_count` is read off this one, and the server reports
    // the true total on page one regardless of how many environments come back.
    get(`repos/${repo}/environments`),
    get(`repos/${repo}/environments/Production`),
    getAll(`repos/${repo}/actions/variables`, 'variables'),
    getAll(`repos/${repo}/actions/secrets`, 'secrets'),
    getAll(`repos/${repo}/branches?protected=true`),
  ]);

  const reviewerRule =
    (prodEnv.protection_rules || []).find(
      x => x.type === 'required_reviewers'
    ) || null;

  const deployYml = join(ROOT, '.github', 'workflows', 'deploy.yml');
  const deployRaw = existsSync(deployYml)
    ? readFileSync(deployYml, 'utf8')
    : '';
  // Comments are stripped before any guard is matched, because a guard probed by
  // text match must not be satisfiable by prose. deploy.yml already carries two
  // comment lines naming DEPLOY_INHIBIT immediately above the `if:` that uses it
  // (lines 117-118). Delete the condition, leave a comment describing it, and an
  // unstripped probe reports the kill-switch present while nothing guards the job.
  // Whole-line comments and ` #` trailing comments only: a `#` with no space
  // before it belongs to a URL fragment, not a comment.
  const deployText = deployRaw
    .split('\n')
    .map(l => (/^\s*#/.test(l) ? '' : l.replace(/\s+#.*$/, '')))
    .join('\n');
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
    // The declaration's `default_branch` is an INPUT to this probe - it chooses
    // which branch's protection gets read. Left uncompared, moving the default
    // branch to an unprotected one is invisible: every protection control would
    // still be read off `main`, still match, and the run would exit 0 while the
    // branch pull requests actually target has no protection at all. Reading the
    // live value back turns that input into something the check also asserts.
    'repo.default_branch': r.default_branch ?? null,
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

    'rulesets.count': rulesets.items.length,

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

    'actions.variable.DEPLOY_INHIBIT.exists': vars.items.some(
      v => v.name === 'DEPLOY_INHIBIT'
    ),
    'actions.variable.count': vars.totalCount,

    'actions.secret.VERCEL_DEPLOY_HOOK.exists': secrets.items.some(
      s => s.name === 'VERCEL_DEPLOY_HOOK'
    ),

    'branches.protected': protectedBranches.items.map(b => b.name).sort(),

    'legacy.branch_protection_json.present': legacyPresent,
    'legacy.branch_protection_json.reader_count': legacyReaders,

    'workflow.deploy.deploy_inhibit_guard_present':
      /vars\.DEPLOY_INHIBIT\s*!=\s*'true'/.test(deployText),
    // Every environment.Production.* control above audits GitHub's copy of the
    // production environment. None of them asks whether the production deploy job
    // still USES it. Point `deploy-production` at another environment, or drop the
    // binding, and the required-reviewer rule stops applying to production deploys
    // while all four environment controls keep matching and the run exits 0 - a
    // control auditing a surface nothing is bound to. Comments are stripped from
    // deployText first, so this cannot be satisfied by a comment either.
    'workflow.deploy.production_environment_binding':
      /environment:\s*\n\s*name:\s*production\b/.test(deployText),
    'workflow.deploy.vercel_deploy_hook_references': hookRefs,
  };
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = v => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

async function main() {
  if (!existsSync(DECL_PATH)) fail(`declaration not found at ${DECL_PATH}`);
  // replace(/^\uFEFF/, ''): a BOM is a Windows editor artefact, not a malformed
  // declaration. Without this the check dies with a parse error on an otherwise
  // valid file, and the fix somebody reaches for is to loosen the check.
  //
  // Written as the escape \uFEFF, never as a literal character. It was a literal
  // until 2026-08-17, and by then it was no longer a BOM: the file held the three
  // characters U+00EF U+00BB U+00BF - the BOM's UTF-8 bytes re-decoded as Latin-1
  // by some editor along the way. readFileSync(..., 'utf8') turns a real BOM into
  // the single character U+FEFF, which that sequence cannot match, so the guard
  // was decorative. Proven by planting a real BOM on .github/repo-controls.json:
  // FATAL SyntaxError before the fix, exit 0 after. The escape cannot be mangled
  // by an encoding round-trip, so it stays an escape.
  const decl = JSON.parse(
    readFileSync(DECL_PATH, 'utf8').replace(/^\uFEFF/, '')
  );
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
