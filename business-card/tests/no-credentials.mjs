// Phill 24/10/2026: no certifications on the card. The build must refuse a page that carries one,
// however short the text and whatever sits next to it, whether it comes from the template or the kit.
// Run from business-card/: node tests/no-credentials.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const dir = '.test-tmp/no-credentials';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const source = fs.readFileSync('card.html', 'utf8');
const kitPath = 'brand-kits/phill-mcgurk.json';
const kit = JSON.parse(fs.readFileSync(kitPath, 'utf8'));
const build = (name, html, kitFile = kitPath) => {
  fs.writeFileSync(`${dir}/${name}.html`, html);
  return spawnSync(
    'python3',
    [
      '-I',
      'site/build.py',
      `${dir}/${name}.html`,
      kitFile,
      `${dir}/${name}-out`,
    ],
    { encoding: 'utf8' }
  );
};
const refused = (result, label) => {
  assert.notEqual(
    result.status,
    0,
    `${label} reached the page and the build passed`
  );
  assert.match(result.stderr, /certification text reached the page/, label);
};

const clean = build('clean', source);
assert.equal(clean.status, 0, clean.stderr);
assert.equal(
  /IICRC/i.test(fs.readFileSync(`${dir}/clean-out/index.html`, 'utf8')),
  false
);

// in the template, with any neighbours
for (const text of [
  'IICRC',
  'iicrc',
  '47496',
  'BFRS',
  'GBAC',
  'IICRC/GBAC',
  'xIICRCx',
])
  refused(
    build('planted', source + `\n<!-- ${text} -->\n`),
    `template: ${text}`
  );

// in a visitor-facing kit value
for (const text of ['IICRC/GBAC credential holder', 'BFRS-certified']) {
  const planted = structuredClone(kit);
  planted.person.intro = text;
  const file = `${dir}/kit.json`;
  fs.writeFileSync(file, JSON.stringify(planted));
  refused(build('kit', source, file), `kit intro: ${text}`);
}
fs.rmSync(dir, { recursive: true, force: true });
console.info(
  'PASS the build refuses certification text from the template or the kit, at any length; the clean card builds'
);
