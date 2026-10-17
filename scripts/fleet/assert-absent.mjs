#!/usr/bin/env node
/** node scripts/fleet/assert-absent.mjs --pattern <regex> --paths <p...> — exit 0 when git grep finds nothing; positive control: --pattern must find something with --expect-present. */
import { run, ROOT } from './lib.mjs';
const a = process.argv.slice(2);
const pi = a.indexOf('--pattern');
const si = a.indexOf('--paths');
if (pi < 0 || si < 0) {
  console.error('usage: --pattern <regex> --paths <p...> [--expect-present]');
  process.exit(2);
}
const paths = a.slice(si + 1).filter(x => !x.startsWith('--'));
const r = run('git', ['grep', '-l', '-E', a[pi + 1], '--', ...paths], {
  cwd: ROOT,
});
if (r.code > 1) {
  console.log(
    `INCONCLUSIVE assert-absent: git grep failed: ${r.stderr.trim()}`
  );
  process.exit(2);
}
const found = r.stdout.trim().split('\n').filter(Boolean);
if (a.includes('--expect-present')) {
  console.log(
    `${found.length ? 'PASS' : 'FAIL'} assert-absent positive control: ${found.length} file(s) match`
  );
  process.exit(found.length ? 0 : 1);
}
console.log(
  `${found.length ? 'FAIL' : 'PASS'} assert-absent ${a[pi + 1]}: ${found.length} file(s)${found.length ? ' — ' + found.slice(0, 5).join(', ') : ''}`
);
process.exit(found.length ? 1 : 0);
