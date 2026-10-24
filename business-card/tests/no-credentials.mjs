// Phill 24/10/2026: no certifications on the card. The build must refuse a page that carries one,
// however short the text (the working-record check only looks at text of 12 characters or more).
// Run from business-card/: node tests/no-credentials.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const dir = '.test-tmp/no-credentials';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const source = fs.readFileSync('card.html', 'utf8');
const build = (name, html) => {
  fs.writeFileSync(`${dir}/${name}.html`, html);
  return spawnSync(
    'python3',
    [
      '-I',
      'site/build.py',
      `${dir}/${name}.html`,
      'brand-kits/phill-mcgurk.json',
      `${dir}/${name}-out`,
    ],
    { encoding: 'utf8' }
  );
};

const clean = build('clean', source);
assert.equal(clean.status, 0, clean.stderr);
assert.equal(
  /IICRC/i.test(fs.readFileSync(`${dir}/clean-out/index.html`, 'utf8')),
  false
);

for (const term of ['IICRC', 'iicrc', '47496', 'BFRS', 'GBAC']) {
  const planted = build('planted', source + `\n<!-- ${term} -->\n`);
  assert.notEqual(
    planted.status,
    0,
    `${term} reached the page and the build passed`
  );
  assert.match(planted.stderr, /certification text reached the page/);
}
fs.rmSync(dir, { recursive: true, force: true });
console.info(
  'PASS the build refuses certification text at any length; the clean card builds'
);
