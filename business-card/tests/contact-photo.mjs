// Phill 24/10/2026: the contact picture is the owner's logo or a photo of the owner, never Margot or anything else.
// The build must refuse every other picture, and the saved contact must carry exactly the owner's file.
// Run from business-card/: node tests/contact-photo.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const dir = '.test-tmp/contact-photo';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const kit = JSON.parse(fs.readFileSync('brand-kits/phill-mcgurk.json', 'utf8'));
const build = (name, contactPhoto) => {
  const planted = structuredClone(kit);
  if (contactPhoto === undefined) delete planted.person.contactPhoto;
  else planted.person.contactPhoto = contactPhoto;
  const file = `${dir}/${name}.json`;
  fs.writeFileSync(file, JSON.stringify(planted));
  return spawnSync(
    'python3',
    ['-I', 'site/build.py', 'card.html', file, `${dir}/${name}-out`],
    { encoding: 'utf8' }
  );
};
const refused = (name, contactPhoto, why) => {
  const r = build(name, contactPhoto);
  assert.notEqual(r.status, 0, `${name}: the build accepted it`);
  assert.match(r.stderr, /contact photo:/, `${name}: ${r.stderr}`);
  assert.match(r.stderr, why, `${name}: ${r.stderr}`);
};
const media = f => 'business-card/brand-kits/media/' + f;

refused('none', undefined, /needs person\.contactPhoto/);
refused('not-an-object', 'app-icon-192.png', /needs person\.contactPhoto/);
refused(
  'kind-margot',
  { kind: 'margot', file: media('app-icon-192.png') },
  /kind must be logo or owner/
);
refused(
  'kind-brand',
  { kind: 'brand', file: media('app-icon-192.png') },
  /kind must be logo or owner/
);
refused('no-file', { kind: 'logo' }, /no file/);
refused(
  'missing-file',
  { kind: 'owner', file: media('owner-photo-does-not-exist.jpg') },
  /existing PNG or JPEG/
);
refused(
  'margot-poster',
  { kind: 'owner', file: media('margot-explainer-poster.jpg') },
  /not the owner's logo or photo/
);
refused(
  'films-path',
  { kind: 'logo', file: 'business-card/site/films/logo.png' },
  /not the owner's logo or photo/
);
refused(
  'edition-poster',
  { kind: 'logo', file: media('edition-origami-poster.jpg') },
  /not the owner's logo or photo/
);
refused(
  'opener-poster',
  { kind: 'logo', file: media('unite-nexus-u-reveal-poster.jpg') },
  /not the owner's logo or photo/
);
refused(
  'video',
  { kind: 'owner', file: media('margot-features.mp4') },
  /not the owner's logo or photo/
);
refused(
  'too-large',
  { kind: 'logo', file: media('app-icon-512.png') },
  /use a copy of about 256 px/
);
// a JPEG name on PNG bytes is not a JPEG
fs.copyFileSync(
  'brand-kits/media/app-icon-192.png',
  'brand-kits/media/zz-test-renamed.jpg'
);
try {
  refused(
    'wrong-bytes',
    { kind: 'logo', file: media('zz-test-renamed.jpg') },
    /is not really a JPEG/
  );
} finally {
  fs.rmSync('brand-kits/media/zz-test-renamed.jpg');
}

// the good case: the owner's logo, the same bytes in the served contact and in the page's own Save
const ok = build('logo', kit.person.contactPhoto);
assert.equal(ok.status, 0, ok.stderr);
const vcf = fs
  .readFileSync(`${dir}/logo-out/phill-mcgurk.vcf`, 'utf8')
  .replace(/\r\n /g, '');
const photo = /^PHOTO;ENCODING=b;TYPE=PNG:([A-Za-z0-9+/=]+)\r$/m.exec(vcf);
assert.ok(photo, 'served contact has a PNG photo');
assert.deepEqual(
  Buffer.from(photo[1], 'base64'),
  fs.readFileSync('brand-kits/media/app-icon-192.png')
);
const page = fs.readFileSync(`${dir}/logo-out/index.html`, 'utf8');
assert.ok(
  page.includes(
    '"contactPhoto":{"kind":"logo","dataUri":"data:image/png;base64,' +
      photo[1] +
      '"}'
  )
);
assert.equal(
  page.includes('app-icon-192.png"},'),
  false,
  'the page carries the picture, not its file path'
);
fs.rmSync(dir, { recursive: true, force: true });
console.info(
  "PASS the build refuses every contact picture that is not the owner's logo or photo; the logo lands in the contact"
);
