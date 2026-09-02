// Asserts the route identity markers in a REAL production build.
//
// This is the control that proves the signal the post-deploy gate will depend on
// is actually emitted. It has a negative case on purpose: if every page carried
// a marker the check would pass while proving nothing, so the 404 document -
// which is what a catch-all or a missing route actually serves - must carry NONE.
import { readFileSync } from 'node:fs';

const WANT = {
  'index.html': '/',
  'login.html': '/login',
  'pricing.html': '/pricing',
};
const MARKER = /<[a-z][^>]*\sdata-synthex-route\s*=\s*"([^"]*)"/gi;
const DIR = '.next/server/app/';

let bad = 0;

for (const [file, route] of Object.entries(WANT)) {
  const html = readFileSync(DIR + file, 'utf8');
  const found = [...html.matchAll(MARKER)].map(m => m[1]);
  if (found.length !== 1 || found[0] !== route) {
    console.error(
      `FAIL ${file}: expected exactly one marker for ${route}, got ${JSON.stringify(found)}`
    );
    bad++;
  } else {
    console.log(`ok   ${file.padEnd(13)} one marker, route ${found[0]}`);
  }
}

// Negative case. A 404 that carried a marker would mean the gate could be
// satisfied by the very document it exists to reject.
const notFound = readFileSync(DIR + '_not-found.html', 'utf8');
if (/\sdata-synthex-route\s*=/i.test(notFound)) {
  console.error('FAIL _not-found.html carries a route identity marker.');
  bad++;
} else {
  console.log('ok   _not-found  no marker, as required');
}

process.exit(bad === 0 ? 0 : 1);
