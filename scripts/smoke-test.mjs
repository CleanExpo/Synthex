#!/usr/bin/env node
// scripts/smoke-test.mjs — Smoke test suite for live Synthex deployment
// Usage: BASE_URL=https://synthex.social node scripts/smoke-test.mjs
// Exit 0 = all pass, Exit 1 = any fail

const BASE_URL = process.env.BASE_URL || 'https://synthex.social';
const TIMEOUT_MS = 10000;

// `isHome` supplies the baseline document; `distinctFromHome` marks a page that
// must NOT be the homepage. Order matters: '/' is fetched before its dependants.
const tests = [
  { method: 'GET', path: '/api/health', acceptStatus: [200, 503] },
  { method: 'GET', path: '/api/health/live', acceptStatus: [200] },
  { method: 'GET', path: '/api/health/ready', acceptStatus: [200, 503] },
  {
    method: 'GET',
    path: '/',
    acceptStatus: [200],
    isHome: true,
    expectTitle: /^Free Marketing Opportunity Map \| Synthex/i,
  },
  {
    method: 'GET',
    path: '/login',
    acceptStatus: [200],
    distinctFromHome: true,
    expectTitle: /^Login \| Synthex/i,
  },
  {
    method: 'GET',
    path: '/pricing',
    acceptStatus: [200],
    distinctFromHome: true,
    expectTitle: /^Pilot Access \| Synthex/i,
  },
  { method: 'HEAD', path: '/api/health', acceptStatus: [200] },
];

const BASE_ORIGIN = new URL(BASE_URL).origin;

/** Normalise for comparison: strip trailing slashes, keep root as '/'. */
const normalisePath = p => p.replace(/\/+$/, '') || '/';

/**
 * WHERE A REQUEST IS ALLOWED TO END UP.
 *
 * `redirect: 'follow'` plus a status-only check answers "did SOME page respond
 * 200", not "did THIS route respond". A broken router that sends /login and
 * /pricing to the homepage returns 200 on every path, so this script printed
 * 7/7 and exited 0 for a site where both advertised routes were absent - and
 * this script runs in the REQUIRED post-deploy job, so that green was the whole
 * gate.
 *
 * Origin is compared as well as pathname: a redirect to another host serving
 * the same path is not this site.
 *
 * Default is strict. Add an entry only with evidence that production really
 * redirects, and say what that evidence was.
 */
const ALLOWED_FINAL_PATHS = {};

/**
 * IS THIS ACTUALLY THE REQUESTED PAGE, OR THE HOMEPAGE WEARING ITS URL?
 *
 * Status, origin and pathname together still do not identify the RESOURCE. An
 * internal rewrite or a catch-all fallback can serve homepage HTML at /login
 * with status 200 and the URL preserved, and every check above passes - so the
 * required gate certifies a deploy where the advertised pages do not exist.
 * `redirect: 'manual'` does not help: no redirect occurs.
 *
 * The discriminator is the document <title>, compared DIFFERENTIALLY against the
 * homepage rather than against hardcoded copy. Measured on production
 * 2026-09-01:
 *     /        "Free Marketing Opportunity Map | Synthex"
 *     /login   "Login | Synthex | SYNTHEX"
 *     /pricing "Pilot Access | Synthex | SYNTHEX"
 * A marketing rewording keeps this passing; the homepage served at /login does
 * not.
 *
 * Why not a DOM marker such as a password field: /login is client-rendered and
 * ships no password input in its HTML, so that check would fail against healthy
 * production. Why not the canonical link or og:url: /pricing's canonical AND
 * og:url both point at the homepage today, and its og:title is IDENTICAL to the
 * 404 page's. All measured, not assumed.
 *
 * "DIFFERS FROM HOME" WAS NOT ENOUGH, and production proves it: the real 404
 * document is titled "Synthex | Marketing Command Center", which differs from
 * the homepage title, so a catch-all serving that at /login would have passed a
 * home-only comparison. Each page therefore also carries a POSITIVE
 * `expectTitle` pattern.
 *
 * THE PATTERNS ARE ANCHORED THROUGH THE SEPARATOR, and that is the point. They
 * used to match only the route's SUBJECT (/login/i, /pilot access|pricing/i),
 * which certified soft-error documents: "Login unavailable | Synthex" contains
 * "login", so an incident page served at /login passed the required gate. A
 * subject word proves a page is ABOUT the route; it does not prove the healthy
 * document rendered. Measured on production 2026-09-02:
 *     /        "Free Marketing Opportunity Map | Synthex"  ^Free Marketing Opportunity Map \| Synthex
 *     /login   "Login | Synthex | SYNTHEX"                 ^Login \| Synthex
 *     /pricing "Pilot Access | Synthex | SYNTHEX"          ^Pilot Access \| Synthex
 *     404      "Synthex | Marketing Command Center"        matches NONE
 * The shapes that used to pass and now do not:
 *     "Login unavailable | Synthex"    fails ^Login \| Synthex
 *     "Pricing unavailable | Synthex"  fails ^Pilot Access \| Synthex
 *     "Not Found | Synthex" at /       fails ^Free Marketing Opportunity Map \| Synthex
 *
 * The homepage carries its own expectTitle now. It used to be accepted for
 * having ANY non-empty title, so a soft-404 homepage passed AND then became the
 * baseline every other page was compared against.
 *
 * This is coupled to wording, and that maintenance cost is accepted on purpose:
 * a release gate must assert what the page IS, not merely what it is not. If a
 * page is legitimately retitled, update the pattern in the same commit.
 *
 * WHY THE EXTRACTION BELOW IS NOT A BARE REGEX OVER THE WHOLE DOCUMENT.
 *
 * `html.match(/<title[^>]*>([^<]*)<\/title>/i)` takes the FIRST title-shaped
 * token anywhere in the byte stream, which an HTML parser does not agree is the
 * document title. A response body of
 *     <!-- <title>Login</title> --><title>Not Found | Synthex</title>
 * yielded "Login" and passed this gate while the real document was the 404.
 * Commented and scripted markup is inert to a browser, so it must be inert here
 * too.
 *
 * Three narrowings, each closing a measured bypass:
 *   1. Look only inside <head>. A document title cannot live in <body>, and
 *      inline SVG icons legitimately carry their own <title> elements there -
 *      scanning the whole document would both admit spoofs and risk failing
 *      healthy pages.
 *   2. Drop comments and script/style/template/noscript blocks before matching,
 *      because none of them contribute a document title.
 *   3. Treat two DIFFERENT titles in <head> as ambiguous and fail. Which one a
 *      parser picks is not something a release gate should be guessing at.
 *
 * Deliberately zero-dependency: a real HTML parser (cheerio IS in this repo's
 * dependencies) cannot be used here. The `verify-production` job that runs this
 * script does `checkout` + `setup-node` and NO `npm ci`, so `node_modules` does
 * not exist at that point - an import would crash the required gate on every
 * deploy. Verified against production 2026-09-02: /, /login, /pricing and the
 * 404 each return exactly ONE <title>, all inside <head>.
 */
const HEAD_OF = /<head[^>]*>([\s\S]*?)<\/head>/i;
const INERT = /<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Every distinct document title declared in <head>, ignoring inert markup. */
const titlesOf = html => {
  const head = html.match(HEAD_OF)?.[1] ?? '';
  const live = head.replace(/<!--[\s\S]*?-->/g, '').replace(INERT, '');
  const found = [...live.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map(m =>
    m[1].trim()
  );
  return [...new Set(found)];
};

let homeTitle = null;

async function runTest(test) {
  const url = `${BASE_URL}${test.path}`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: test.method,
      signal: controller.signal,
      redirect: 'follow',
    });
    // NOTE: the timeout is NOT cleared here. It used to be, which meant the
    // abort fired only on the headers - and the HTML body read added below then
    // ran unbounded. A server that returns headers promptly and stalls the body
    // hung this script past its own 10s limit and consumed the workflow timeout
    // instead of producing a bounded failure. The controller must still be armed
    // while the body is read.
    const statusOk = test.acceptStatus.includes(res.status);

    // res.url is the FINAL url after any redirects.
    const finalUrl = new URL(res.url || url);
    const permitted = [
      test.path,
      ...(ALLOWED_FINAL_PATHS[test.path] ?? []),
    ].map(normalisePath);
    const landedRight =
      finalUrl.origin === BASE_ORIGIN &&
      permitted.includes(normalisePath(finalUrl.pathname));

    // Identity check for HTML pages only.
    let identityOk = true;
    let identityNote = null;
    if (test.isHome || test.distinctFromHome) {
      const html = await res.text();
      const titles = titlesOf(html);

      if (titles.length === 0) {
        identityOk = false;
        identityNote = test.isHome
          ? 'homepage served no <title> in <head>; cannot identify pages'
          : 'no <title> in <head>';
      } else if (titles.length > 1) {
        identityOk = false;
        identityNote = `ambiguous document: <head> declares ${titles.length} different titles (${titles
          .map(t => JSON.stringify(t))
          .join(', ')})`;
      } else {
        const title = titles[0];

        // Positive identity, applied to EVERY page including the homepage.
        // This check used to live only in the non-home branch, so the homepage
        // was accepted for having any title at all - and a soft-404 homepage
        // both passed and poisoned the baseline below.
        if (test.expectTitle && !test.expectTitle.test(title)) {
          identityOk = false;
          identityNote = `wrong document: title ${JSON.stringify(title)} does not match ${test.expectTitle}`;
        } else if (test.isHome) {
          // Only a homepage that proved its own identity may serve as the
          // baseline. A wrong homepage must not become the thing every other
          // page is measured against.
          homeTitle = title;
        } else if (homeTitle === null) {
          // Fail closed: without the baseline this check cannot run, and a
          // check that silently skips is the defect this file keeps finding.
          identityOk = false;
          identityNote =
            'homepage baseline unavailable; cannot verify identity';
        } else if (title === homeTitle) {
          identityOk = false;
          identityNote = `served the homepage document (title "${title}")`;
        }
      }
    }

    // Only now is every network read complete, so the abort timer can be
    // released. Clearing it earlier is what let the body read run unbounded.
    clearTimeout(timeout);
    const latency = Date.now() - start;

    return {
      pass: statusOk && landedRight && identityOk,
      status: res.status,
      latency,
      error: null,
      landedAt: landedRight ? null : `${finalUrl.origin}${finalUrl.pathname}`,
      identityNote,
    };
  } catch (err) {
    return {
      pass: false,
      status: 0,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

const label = (method, path) => `${method} ${path}`.padEnd(36);

console.log(`\nSynthex Smoke Test \u2014 ${BASE_URL}`);
console.log('\u2500'.repeat(50));

let passed = 0;
for (const test of tests) {
  const result = await runTest(test);
  if (result.pass) passed++;
  const icon = result.pass ? '\u2713' : '\u2717';
  const status = result.error ? `ERR: ${result.error}` : String(result.status);
  const landed = result.landedAt
    ? `  -> landed at ${result.landedAt}`
    : result.identityNote
      ? `  -> ${result.identityNote}`
      : '';
  console.log(
    `${icon}  ${label(test.method, test.path)} ${status.padEnd(5)} (${result.latency}ms)${landed}`
  );
}

console.log('\u2500'.repeat(50));
console.log(`${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
