/** Offline build contract: verify actual licensed font bytes, not just filenames. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const fonts = require('../public/fonts/app/sources.json');
const kit = require('next/dist/compiled/@next/font/dist/fontkit').default;
const parseFont = kit.default || kit;
const layout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');
assert(
  !layout.includes('next/font/google'),
  'Builds must not fetch font assets'
);
assert(layout.includes('next/font/local'), 'Use the local font loader');
assert.equal(fonts.length, 8);
for (const font of fonts) {
  const bytes = fs.readFileSync(path.join(root, font.path));
  assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    font.sha256
  );
  const metadata = parseFont(bytes);
  assert.equal(metadata['OS/2'].usWeightClass, font.weight, font.path);
  assert(
    metadata.familyName.toLowerCase().includes(font.family.replace('-', ' ')),
    font.path
  );
  assert(
    fs
      .readFileSync(path.join(root, font.licensePath), 'utf8')
      .includes('SIL OPEN FONT LICENSE')
  );
  const escapedPath = font.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(
    new RegExp(
      `path: ['"]\\.\\./${escapedPath}['"],\\s*weight: ['"]${font.weight}['"]`
    ).test(layout),
    `Incorrect layout weight: ${font.path}`
  );
}
console.log(
  'Verified 8 local font faces, actual weights, layout bindings, hashes and OFL licences.'
);
