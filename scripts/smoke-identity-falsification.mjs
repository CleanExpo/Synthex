#!/usr/bin/env node
// scripts/smoke-identity-falsification.mjs
//
// PROVES THE PRODUCTION SMOKE GATE CAN FAIL.
//
// `scripts/smoke-test.mjs` runs in the REQUIRED `verify-production` job. A gate
// that cannot fail is worse than no gate, because its green gets quoted as
// proof. Six separate review rounds found six ways that script returned "7/7
// passed, exit 0" while production was serving the wrong document. Each one was
// found by a human reading the code, after the code had already shipped.
//
// This file turns that reading into an executable control. It runs the REAL
// smoke script, byte-identically, against mocked responses, and asserts:
//
//   every WRONG-DOCUMENT shape  -> non-zero exit   (the gate fires)
//   every HEALTHY shape         -> zero exit       (no false alarm)
//
// Both halves matter. A gate that fails on everything is not a gate either, so
// the healthy shapes are the positive controls: they prove a failure means
// something. Run with --list to see the shapes.
//
// HOW IT RUNS THE REAL SCRIPT. There is no import-time seam in smoke-test.mjs
// and deliberately so (see below), so this file re-executes ITSELF as a child
// with SMOKE_FALSIFY_SHAPE set. In child mode it installs a fetch stub and then
// dynamically imports the real script, whose own `process.exit(...)` becomes the
// child's exit code. Nothing in smoke-test.mjs is modified, stubbed or copied -
// if it is edited, this control tests the edit.
//
// ZERO DEPENDENCIES, ON PURPOSE. The `verify-production` job runs
// `actions/checkout` + `actions/setup-node` and NO `npm ci`, so `node_modules`
// does not exist when the smoke script executes. An import there would crash the
// required gate on every deploy. cheerio IS a dependency of this repo and would
// otherwise be the better HTML parser; it cannot be used. `--check-zero-deps`
// asserts that constraint so a future refactor cannot quietly break the gate.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = join(HERE, 'smoke-test.mjs');
const VERIFY = join(HERE, 'verify-deployment.js');
const ORIGIN = 'https://synthex.social';

// Titles measured against live production 2026-09-02. If a page is legitimately
// retitled, update smoke-test.mjs's expectTitle AND these in the same commit.
const HOME_OK = 'Free Marketing Opportunity Map | Synthex';
const LOGIN_OK = 'Login | Synthex | SYNTHEX';
const PRICING_OK = 'Pilot Access | Synthex | SYNTHEX';
const NOT_FOUND = 'Not Found | Synthex';

const doc = (title, body = '<h1>ok</h1>') =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;

/**
 * Each shape maps path -> response body. Health endpoints always answer 200, so
 * the PAGE checks are what decides the verdict - otherwise a shape could "fail"
 * for an unrelated reason and look like the identity check working.
 *
 * `expect` is the exit code this shape MUST produce.
 */
const SHAPES = {
  healthy: {
    expect: 0,
    why: 'positive control: the real production titles must pass',
    pages: {
      '/': doc(HOME_OK),
      '/login': doc(LOGIN_OK),
      '/pricing': doc(PRICING_OK),
    },
  },

  'svg-title-in-body': {
    expect: 0,
    why: 'positive control: inline SVG icons carry their own <title> in <body>; scanning the whole document instead of <head> would fail healthy pages',
    pages: {
      '/': doc(HOME_OK, '<svg><title>Menu</title></svg><h1>ok</h1>'),
      '/login': doc(LOGIN_OK, '<svg><title>Menu</title></svg>'),
      '/pricing': doc(PRICING_OK, '<svg><title>Close</title></svg>'),
    },
  },

  'soft-404-homepage': {
    expect: 1,
    why: 'the homepage was accepted for having ANY title, so a soft-404 home passed AND became the baseline every other page was compared against',
    pages: {
      '/': doc(NOT_FOUND, '<h1>Missing</h1>'),
      '/login': doc(LOGIN_OK),
      '/pricing': doc(PRICING_OK),
    },
  },

  'commented-decoy-title': {
    expect: 1,
    why: 'a bare regex took the first title-shaped token anywhere in the byte stream, so a decoy inside an HTML comment beat the real document title',
    pages: {
      '/': doc(HOME_OK),
      '/login': `<!DOCTYPE html><html><head><!-- <title>${LOGIN_OK}</title> --><title>${NOT_FOUND}</title></head><body><h1>Missing</h1></body></html>`,
      '/pricing': `<!DOCTYPE html><html><head><!-- <title>${PRICING_OK}</title> --><title>${NOT_FOUND}</title></head><body><h1>Missing</h1></body></html>`,
    },
  },

  'title-hidden-in-script': {
    expect: 1,
    why: 'markup inside <script> is inert to a browser and must be inert here too',
    pages: {
      '/': doc(HOME_OK),
      '/login': `<!DOCTYPE html><html><head><script>var x="<title>${LOGIN_OK}</title>";</script><title>${NOT_FOUND}</title></head><body></body></html>`,
      '/pricing': doc(PRICING_OK),
    },
  },

  'two-titles-in-head': {
    expect: 1,
    why: 'which title a parser picks is not something a release gate should guess at; conflicting titles are ambiguous and must fail',
    pages: {
      '/': doc(HOME_OK),
      '/login': `<!DOCTYPE html><html><head><title>${LOGIN_OK}</title><title>${NOT_FOUND}</title></head><body></body></html>`,
      '/pricing': doc(PRICING_OK),
    },
  },

  'soft-error-route-titles': {
    expect: 1,
    why: 'a loose /login/i matched "Login unavailable | Synthex", certifying a live incident page as healthy. A subject word proves a page is ABOUT the route, not that it rendered',
    pages: {
      '/': doc(HOME_OK),
      '/login': doc(
        'Login unavailable | Synthex',
        '<h1>Service unavailable</h1>'
      ),
      '/pricing': doc(
        'Pricing unavailable | Synthex',
        '<h1>Service unavailable</h1>'
      ),
    },
  },

  'homepage-served-at-login': {
    expect: 1,
    why: 'a catch-all route can serve homepage HTML at /login with status 200 and the URL preserved',
    pages: {
      '/': doc(HOME_OK),
      '/login': doc(HOME_OK),
      '/pricing': doc(PRICING_OK),
    },
  },

  'plain-404-documents': {
    expect: 1,
    why: "production's real 404 title DIFFERS from the homepage, so a differs-from-home check alone would have passed it",
    pages: {
      '/': doc(HOME_OK),
      '/login': doc(NOT_FOUND, '<h1>Missing</h1>'),
      '/pricing': doc(NOT_FOUND, '<h1>Missing</h1>'),
    },
  },
};

// ---------------------------------------------------------------- child mode

const shapeName = process.env.SMOKE_FALSIFY_SHAPE;
if (shapeName) {
  const shape = SHAPES[shapeName];
  if (!shape) {
    console.error(`unknown shape: ${shapeName}`);
    process.exit(2);
  }
  globalThis.fetch = async url => {
    const u = new URL(url);
    if (u.pathname.startsWith('/api/health')) {
      return { status: 200, url: u.href, text: async () => '{"status":"ok"}' };
    }
    const body = shape.pages[u.pathname];
    if (body === undefined) {
      return { status: 404, url: u.href, text: async () => doc(NOT_FOUND) };
    }
    return { status: 200, url: u.href, text: async () => body };
  };
  process.env.BASE_URL = ORIGIN;
  await import(SMOKE); // its own process.exit() is this child's exit code
  process.exit(0);
}

// --------------------------------------------------------------- zero-dep check

const IMPORT_RE = /^\s*(?:import\s|.*\brequire\s*\()/m;

function checkZeroDeps() {
  let bad = 0;
  for (const f of [SMOKE, VERIFY]) {
    const src = readFileSync(f, 'utf8');
    // Strip block and line comments so prose about imports is not a false hit.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter(l => !/^\s*\/\//.test(l))
      .join('\n');
    if (IMPORT_RE.test(code)) {
      console.error(`FAIL ${f} has a module import.`);
      console.error(
        '     verify-production runs checkout + setup-node with NO npm ci,'
      );
      console.error(
        '     so node_modules does not exist and this crashes the required gate.'
      );
      bad++;
    } else {
      console.log(`ok   ${f.replace(HERE, 'scripts')} is import-free`);
    }
  }
  return bad === 0 ? 0 : 1;
}

if (process.argv.includes('--check-zero-deps')) {
  process.exit(checkZeroDeps());
}

if (process.argv.includes('--list')) {
  for (const [name, s] of Object.entries(SHAPES)) {
    console.log(`${s.expect === 0 ? 'PASS' : 'FAIL'}  ${name}\n      ${s.why}`);
  }
  process.exit(0);
}

// -------------------------------------------------------------- parent mode

console.log(
  'Smoke-gate falsification - does the required gate actually fire?\n'
);

let failures = 0;
for (const [name, shape] of Object.entries(SHAPES)) {
  const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, SMOKE_FALSIFY_SHAPE: name },
    encoding: 'utf8',
  });
  const got = run.status;
  const ok = got === shape.expect;
  if (!ok) failures++;
  const verdict = ok ? 'ok  ' : 'FAIL';
  const wanted = shape.expect === 0 ? 'pass' : 'fail';
  console.log(
    `${verdict} ${name.padEnd(26)} expected the gate to ${wanted} (exit ${shape.expect}), got exit ${got}`
  );
  if (!ok) {
    console.log(`     why this shape matters: ${shape.why}`);
    const tail = (run.stdout || '')
      .trim()
      .split('\n')
      .slice(-4)
      .join('\n     ');
    if (tail) console.log(`     last output:\n     ${tail}`);
  }
}

console.log();
failures += checkZeroDeps();

console.log();
if (failures === 0) {
  console.log(
    `All ${Object.keys(SHAPES).length} shapes behaved as required. The gate fires on wrong documents and stays quiet on healthy ones.`
  );
  process.exit(0);
}
console.log(`${failures} check(s) did not behave as required.`);
process.exit(1);
