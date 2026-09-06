#!/usr/bin/env node
/**
 * Fail the build if `.vercelignore` excludes a file that defines a real route.
 *
 * Why this exists
 * ---------------
 * `.vercelignore` uses gitignore pattern semantics. A pattern with no leading
 * slash matches a directory of that name AT ANY DEPTH, not just at the repo root.
 * So the bare pattern `docs`, intended to drop the top-level `docs/` folder from
 * the upload, also dropped `app/docs/` -- and the bare pattern `tests` dropped
 * `app/api/ab-testing/tests/`, taking three live API routes with it.
 *
 * Nothing detected this. The files are present in the repo, so type-check, lint,
 * tests and the local build all pass. The routes are simply absent from the
 * deployment bundle, and production answers 404. This check is the missing
 * detector: it asks, of every route file, "would the deployment throw this away?"
 *
 * How the matching is done
 * ------------------------
 * Git is the only thing that implements gitignore semantics correctly, so rather
 * than reimplementing the pattern language we hand the patterns to git. We build
 * a THROWAWAY repository in a temp directory, install `.vercelignore` as its
 * `.gitignore`, and ask `git check-ignore` about each route path.
 *
 * The throwaway repo matters. Running `git check-ignore` inside this repository
 * would consult this repository's own `.gitignore` AND `.git/info/exclude`, and a
 * local exclude can shadow the committed rule -- producing an answer about the
 * developer's machine rather than about `.vercelignore`. The temp repo has an
 * empty `info/exclude` and no other ignore source, so the only thing it can be
 * answering about is `.vercelignore` itself.
 *
 * WHERE THIS MUST RUN
 * -------------------
 * In CI, against a full checkout -- NOT inside the Vercel build. Vercel applies
 * `.vercelignore` when it uploads the repo, so by the time a Vercel build starts,
 * an excluded route directory has already been removed. Run there, this check
 * would inspect a tree the files were deleted from and cheerfully report all
 * clear. The defect is only visible from a complete checkout, which is why it is
 * wired into .github/workflows/route-safety.yml.
 *
 * Note also that `scripts/*` is itself excluded by `.vercelignore`, so this file
 * is deliberately absent from the deployment bundle. That is correct: it is a
 * repository-hygiene check with no runtime role.
 *
 * A NOTE ON LINE ENDINGS
 * ----------------------
 * `.vercelignore` in this repo uses CRLF. A pattern line is therefore `tests\r`,
 * not `tests`, which silently defeats a `sed 's|^tests$|/tests|'` style edit --
 * the `$` anchor never matches. Git and this check both handle it correctly; a
 * human hand-editing the file should be aware of it.
 *
 * Usage: node scripts/check-route-not-deploy-ignored.mjs [repoRoot]
 */

import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.argv[2]
  ? resolve(process.argv[2])
  : join(dirname(fileURLToPath(import.meta.url)), '..');
const vercelignore = join(repoRoot, '.vercelignore');

/** Filenames that make a directory a routable surface in the Next.js App Router. */
const ROUTE_FILES = new Set([
  'page.tsx',
  'page.ts',
  'page.jsx',
  'page.js',
  'route.tsx',
  'route.ts',
  'route.jsx',
  'route.js',
]);

/** Collect every route-defining file under app/. */
function collectRoutes(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      collectRoutes(full, out);
    } else if (ROUTE_FILES.has(e.name)) {
      out.push(relative(repoRoot, full));
    }
  }
  return out;
}

const appDir = join(repoRoot, 'app');
try {
  statSync(appDir);
} catch {
  // A guard that cannot find its subject has NOT passed - it failed to run. Exiting 0 here
  // made the whole check a vacuous pass: pointed at any tree without app/, it reported green
  // without validating a single route. Found by independent review of a9f76cfd8 and
  // reproduced with `node scripts/check-route-not-deploy-ignored.mjs <repo-without-app>`,
  // which exited 0. The routes.length === 0 branch below already refused a vacuous pass;
  // this branch is now consistent with it.
  console.error(
    'check-route-not-deploy-ignored: no app/ directory found at ' + appDir + '.'
  );
  console.error('The check could not run, which is a FAILURE, not a pass.');
  process.exit(1);
}

const routes = collectRoutes(appDir);
if (routes.length === 0) {
  console.error(
    'check-route-not-deploy-ignored: found 0 route files under app/. That is itself suspicious — failing rather than reporting a vacuous pass.'
  );
  process.exit(1);
}

// Build the throwaway repo whose ONLY ignore source is .vercelignore.
const sandbox = mkdtempSync(join(tmpdir(), 'vercelignore-check-'));
execFileSync('git', ['init', '--quiet', sandbox]);
writeFileSync(join(sandbox, '.git', 'info', 'exclude'), '');
copyFileSync(vercelignore, join(sandbox, '.gitignore'));

// Recreate the route paths as empty files so check-ignore has something to resolve.
for (const r of routes) {
  const target = join(sandbox, r);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, '');
}

// `git check-ignore` exits 0 when at least one path IS ignored, 1 when none are.
let ignored = [];
try {
  const out = execFileSync('git', ['-C', sandbox, 'check-ignore', ...routes], {
    encoding: 'utf8',
  });
  ignored = out
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
} catch (err) {
  if (err.status === 1) {
    ignored = String(err.stdout || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
  } else {
    console.error(
      'check-route-not-deploy-ignored: git check-ignore failed to run.'
    );
    console.error(err.message);
    process.exit(1);
  }
}

if (ignored.length > 0) {
  console.error('');
  console.error(
    'DEPLOY-IGNORED ROUTES — these files define routes but .vercelignore'
  );
  console.error(
    'excludes them from the deployment bundle. They will 404 in production'
  );
  console.error('while every local check passes.');
  console.error('');
  for (const p of ignored) console.error(`  ${p}`);
  console.error('');
  console.error(`${ignored.length} of ${routes.length} route files affected.`);
  console.error('');
  console.error(
    'Almost always the cause is an UNANCHORED pattern in .vercelignore.'
  );
  console.error(
    'A bare `docs` matches app/docs/ as well as the top-level docs/.'
  );
  console.error(
    'Anchor it to the repo root — write `/docs` instead of `docs`.'
  );
  console.error('');
  process.exit(1);
}

console.log(
  `check-route-not-deploy-ignored: OK — ${routes.length} route files, none excluded by .vercelignore.`
);
