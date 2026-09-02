// Asserts the route identity markers in a REAL production build.
//
// This is the control that proves the signal the post-deploy gate will depend on
// is actually emitted. It has a negative case on purpose: if every page carried
// a marker the check would pass while proving nothing, so the 404 document -
// which is what a catch-all or a missing route actually serves - must carry NONE.
//
// TWO DEFECTS FOUND IN REVIEW, both reproduced before fixing, both now covered by
// the self-test below (`--self-test`):
//
//  1. The first version matched the marker in RAW HTML. A marker inside an HTML
//     comment, a <script> string, or a <template> therefore satisfied it - so the
//     control would pass after the browser-visible marker had disappeared. That is
//     precisely the false-green class this whole gate exists to close, reproduced
//     inside the control meant to close it. Comments and inert containers are
//     stripped before anything is counted, exactly as scripts/smoke-test.mjs does
//     for <title>.
//
//     Worth recording why it happened: the throwaway probe used while designing
//     this DID strip comments, and the shipped file did not. Verifying with one
//     artefact and shipping another is the actual mistake.
//
//  2. The first version never looked at `data-synthex-build`. Its route check
//     passed with the build attribute deleted, so the build id could vanish
//     silently and the follow-up gate would depend on a signal nothing asserted.
//     The build attribute must now be present and non-empty ON THE SAME ELEMENT
//     as the route - a build id on some other tag proves nothing about this one.
import { readFileSync } from 'node:fs';

const WANT = {
  'index.html': '/',
  'login.html': '/login',
  'pricing.html': '/pricing',
};
const DIR = '.next/server/app/';

// Only markup a browser would actually render can identify a page.
const INERT = /<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;
const live = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(INERT, '');

// The whole element, so the build attribute can be checked on the SAME tag.
const MARKER_EL = /<[a-z][^>]*\sdata-synthex-route\s*=\s*"[^"]*"[^>]*>/gi;
const ROUTE_OF = /\sdata-synthex-route\s*=\s*"([^"]*)"/i;
const BUILD_OF = /\sdata-synthex-build\s*=\s*"([^"]*)"/i;

/** Every rendered route-identity marker in a document. */
export function markersIn(html) {
  return [...live(html).matchAll(MARKER_EL)].map(m => ({
    route: ROUTE_OF.exec(m[0])?.[1] ?? null,
    build: BUILD_OF.exec(m[0])?.[1] ?? null,
  }));
}

/** null when the document is correct for `route`, else why it is not. */
export function checkDocument(html, route) {
  const found = markersIn(html);
  if (found.length !== 1) {
    return `expected exactly one rendered marker for ${route}, got ${found.length} (${JSON.stringify(found.map(f => f.route))})`;
  }
  const [m] = found;
  if (m.route !== route)
    return `marker declares route ${JSON.stringify(m.route)}, expected ${route}`;
  if (!m.build)
    return `marker for ${route} carries no non-empty data-synthex-build`;
  return null;
}

// ----------------------------------------------------------------- self-test
//
// Runs without a build, so the control can be proven able to fail on a machine
// that has not compiled the app. Every case below is a defect that reached a
// committed version of this file or a shape the review demonstrated.
if (process.argv.includes('--self-test')) {
  const OK =
    '<body><span hidden data-synthex-route="/login" data-synthex-build="abc1234"></span></body>';
  const cases = [
    ['healthy marker passes', OK, '/login', true],
    [
      'marker inside an HTML comment is not rendered',
      '<body><!-- <span data-synthex-route="/login" data-synthex-build="a"></span> --><h1>Down</h1></body>',
      '/login',
      false,
    ],
    [
      'marker inside <script> is not rendered',
      '<body><script>var t=\'<span data-synthex-route="/login" data-synthex-build="a"></span>\';</script></body>',
      '/login',
      false,
    ],
    [
      'marker inside <template> is not rendered',
      '<body><template><span data-synthex-route="/login" data-synthex-build="a"></span></template></body>',
      '/login',
      false,
    ],
    [
      'missing build attribute fails',
      '<body><span hidden data-synthex-route="/login"></span></body>',
      '/login',
      false,
    ],
    [
      'empty build attribute fails',
      '<body><span hidden data-synthex-route="/login" data-synthex-build=""></span></body>',
      '/login',
      false,
    ],
    [
      'build id on a DIFFERENT element does not count',
      '<body><meta data-synthex-build="abc1234"><span data-synthex-route="/login"></span></body>',
      '/login',
      false,
    ],
    [
      'wrong route fails (homepage served at /login)',
      '<body><span data-synthex-route="/" data-synthex-build="abc1234"></span></body>',
      '/login',
      false,
    ],
    [
      'no marker at all fails (error boundary / 404)',
      '<body><h1>Authentication Error</h1></body>',
      '/login',
      false,
    ],
    [
      'two markers are ambiguous and fail',
      OK +
        '<span data-synthex-route="/login" data-synthex-build="abc1234"></span>',
      '/login',
      false,
    ],
  ];
  let failed = 0;
  for (const [name, html, route, shouldPass] of cases) {
    const why = checkDocument(html, route);
    const passed = why === null;
    const ok = passed === shouldPass;
    if (!ok) failed++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${shouldPass ? 'accepts' : 'rejects'}: ${name}${!ok && why ? ` [${why}]` : ''}`
    );
  }
  console.log(
    failed === 0
      ? `\nAll ${cases.length} self-test shapes behaved as required.`
      : `\n${failed} self-test shape(s) misbehaved.`
  );
  process.exit(failed === 0 ? 0 : 1);
}

// --------------------------------------------------------------- build check
let bad = 0;

for (const [file, route] of Object.entries(WANT)) {
  const why = checkDocument(readFileSync(DIR + file, 'utf8'), route);
  if (why) {
    console.error(`FAIL ${file}: ${why}`);
    bad++;
  } else {
    console.log(
      `ok   ${file.padEnd(13)} one rendered marker, route ${route}, build present`
    );
  }
}

// Negative case. A 404 that carried a marker would mean the gate could be
// satisfied by the very document it exists to reject.
if (markersIn(readFileSync(DIR + '_not-found.html', 'utf8')).length > 0) {
  console.error(
    'FAIL _not-found.html carries a rendered route identity marker.'
  );
  bad++;
} else {
  console.log('ok   _not-found  no marker, as required');
}

process.exit(bad === 0 ? 0 : 1);
