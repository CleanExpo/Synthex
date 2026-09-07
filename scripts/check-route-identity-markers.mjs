// Asserts the route identity markers in a REAL production build.
//
// This is the control that proves the signal the post-deploy gate will depend on
// is actually emitted. It has a negative case on purpose: if every page carried
// a marker the check would pass while proving nothing, so the 404 document -
// which is what a catch-all or a missing route actually serves - must carry NONE.
//
// WHY THIS PARSES HTML INSTEAD OF MATCHING IT.
//
// Three versions of this file matched markers with a regex, and each one shipped
// a false green that the next review found:
//
//  1. v1 matched the marker in RAW HTML, so a marker inside a comment, a <script>
//     string, or a <template> satisfied it - the control passed after the
//     browser-visible marker had disappeared.
//  2. v1 never looked at `data-synthex-build`, so the build id could vanish
//     silently and the follow-up gate would depend on a signal nothing asserted.
//  3. v2 stripped comments and four inert tags with a regex, and an independent
//     review of 746a02e6e still broke it three ways: a marker written as TEXT
//     inside <textarea> or <title> was counted (neither is stripped, and both
//     hold text a browser never parses as elements), and a marker in a NESTED
//     <template> survived because a non-greedy `[\s\S]*?</template>` closes at
//     the first `</template>`, not the matching one.
//
// Each fix enumerated one more shape, and the shape list was never the mechanism -
// the mechanism is that HTML has parsing rules a regex does not implement. So the
// document is now parsed and the inert SUBTREES are deleted from the tree; what
// remains is what a browser would render. <textarea> and <title> need no rule at
// all, because a parser puts their contents in a text node where an element query
// cannot reach. Nesting is likewise not a special case. A new inert *shape* cannot
// reopen this; only a new inert *container* could, and there is a fixed list of
// those in the HTML spec.
//
// Worth recording why v1 happened: the throwaway probe used while designing it DID
// strip comments and the shipped file did not. Verifying with one artefact and
// shipping another is the actual mistake.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';

const WANT = {
  'index.html': '/',
  'login.html': '/login',
  'pricing.html': '/pricing',
};
const DIR = '.next/server/app/';

// Containers whose children ARE parsed as elements but are never rendered.
//
// <noscript> is here deliberately. jsdom counts a marker inside it, because jsdom
// parses with scripting DISABLED, where noscript content is live markup. Production
// serves a JS-enabled browser, which does not render it - so jsdom is not the oracle
// for this one case, and a future change to "just use jsdom" would reintroduce it.
const INERT_SUBTREE = 'template, noscript, script, style';

/** Every rendered route-identity marker in a document. */
export function markersIn(html) {
  const $ = cheerio.load(html);
  $(INERT_SUBTREE).remove();
  return $('[data-synthex-route]')
    .toArray()
    .map(el => ({
      route: $(el).attr('data-synthex-route') ?? null,
      // Read from the SAME element as the route: a build id on some other tag
      // proves nothing about this one.
      build: $(el).attr('data-synthex-build') || null,
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
// committed version of this file or a shape a review demonstrated against it.
function selfTest() {
  const OK =
    '<body><span hidden data-synthex-route="/login" data-synthex-build="abc1234"></span></body>';
  const M = 'data-synthex-route="/login" data-synthex-build="a"';
  const cases = [
    ['healthy marker passes', OK, '/login', true],
    [
      'marker inside an HTML comment is not rendered',
      `<body><!-- <span ${M}></span> --><h1>Down</h1></body>`,
      '/login',
      false,
    ],
    [
      'marker inside <script> is not rendered',
      `<body><script>var t='<span ${M}></span>';</script></body>`,
      '/login',
      false,
    ],
    [
      'marker inside <template> is not rendered',
      `<body><template><span ${M}></span></template></body>`,
      '/login',
      false,
    ],
    // ---- the three shapes the 746a02e6e review broke v2 with ----
    [
      'marker as TEXT inside <textarea> is not rendered',
      `<body><textarea><span ${M}></span></textarea><h1>Service unavailable</h1></body>`,
      '/login',
      false,
    ],
    [
      'marker as TEXT inside <title> is not rendered',
      `<html><head><title><span ${M}></span></title></head><body><h1>Down</h1></body></html>`,
      '/login',
      false,
    ],
    [
      'marker inside a NESTED <template> is not rendered',
      `<body><template><template></template><span ${M}></span></template></body>`,
      '/login',
      false,
    ],
    [
      'marker inside <noscript> is not rendered by a JS-enabled browser',
      `<body><noscript><span ${M}></span></noscript></body>`,
      '/login',
      false,
    ],
    [
      'marker nested deep inside a <template> is not rendered',
      `<body><div><section><template><span ${M}></span></template></section></div></body>`,
      '/login',
      false,
    ],
    [
      'a real marker still passes when an inert copy sits beside it',
      `<body><template><span ${M}></span></template><span hidden data-synthex-route="/login" data-synthex-build="abc1234"></span></body>`,
      '/login',
      true,
    ],
    // ---- attribute-level cases ----
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
  return failed === 0 ? 0 : 1;
}

// --------------------------------------------------------------- build check
//
// A missing artefact is reported, not thrown. `readFileSync` on an absent file used to
// exit with a raw ENOENT stack trace naming one path, which in CI is indistinguishable
// from the checker itself being broken and says nothing about which page is unaccounted
// for. Absent output still FAILS - a check that cannot see its subject must never pass -
// but it now says so in the same shape as every other failure.
function readDocument(file) {
  try {
    return readFileSync(DIR + file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function checkBuild() {
  let bad = 0;
  for (const [file, route] of Object.entries(WANT)) {
    const html = readDocument(file);
    if (html === null) {
      console.error(
        `FAIL ${file}: no prerendered document at ${DIR}${file} - run \`npm run build\` first`
      );
      bad++;
      continue;
    }
    const why = checkDocument(html, route);
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
  const notFound = readDocument('_not-found.html');
  if (notFound === null) {
    console.error(
      `FAIL _not-found.html: no prerendered document at ${DIR}_not-found.html - the negative case cannot be checked`
    );
    bad++;
  } else if (markersIn(notFound).length > 0) {
    console.error(
      'FAIL _not-found.html carries a rendered route identity marker.'
    );
    bad++;
  } else {
    console.log('ok   _not-found  no marker, as required');
  }
  return bad === 0 ? 0 : 1;
}

// Run only when invoked as a command. Without this guard the module body ran on
// import, so `markersIn`/`checkDocument` were exported but unusable - importing
// them executed the build check and called process.exit before the caller's first
// line. Found while probing this file's own behaviour, 02/09/2026.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(
    process.argv.includes('--self-test') ? selfTest() : checkBuild()
  );
}
