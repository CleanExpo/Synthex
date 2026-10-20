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
// Web faces are WOFF2 bound in app/layout.tsx; the single caption-render face is
// WOFF burned into social cuts by ffmpeg drawtext (its FreeType cannot read WOFF2).
const webFonts = fonts.filter(font => font.use === undefined);
const renderFonts = fonts.filter(font => font.use === 'caption-render');
assert.equal(
  webFonts.length + renderFonts.length,
  fonts.length,
  'Unknown font use'
);
assert.equal(webFonts.length, 8);
assert.equal(renderFonts.length, 1);
for (const font of renderFonts) {
  assert(font.path.endsWith('.woff'), font.path);
  const bytes = fs.readFileSync(path.join(root, font.path));
  assert.equal(bytes.subarray(0, 4).toString(), 'wOFF');
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    font.sha256
  );
  assert(
    fs
      .readFileSync(path.join(root, font.licensePath), 'utf8')
      .includes('SIL OPEN FONT LICENSE')
  );
}
for (const font of webFonts) {
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
// Read the evaluated config, not its source text: a commented-out entry or a
// later duplicate key changes what Next.js traces but not what a text match sees.
const { pathToFileURL } = require('node:url');
import(pathToFileURL(path.join(root, 'next.config.mjs')).href)
  .then(({ default: nextConfig }) => {
    const traced =
      nextConfig?.outputFileTracingIncludes?.['/api/cron/social-cut-render'];
    assert(
      Array.isArray(traced),
      'No trace include for /api/cron/social-cut-render'
    );
    for (const font of renderFonts) {
      assert(
        traced.includes(`./${font.path}`),
        `Not traced for /api/cron/social-cut-render: ${font.path}`
      );
    }
    console.log(
      'Verified 8 local font faces, actual weights, layout bindings, hashes and OFL licences, plus 1 traced caption-render face.'
    );
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
