// SYN-1395: the living-card allowlist may ignore only a Supabase publishable key,
// and only on the two generated card pages. Any other secret on those lines is
// still reported, and the same key anywhere else is still reported.
// Run from anywhere: node business-card/tests/gitleaks-allowlist.mjs
// Uses gitleaks on PATH, or GITLEAKS_BIN. CI's gitleaks-action pins 8.24.3.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const ignore = fs.readFileSync(path.join(root, '.gitleaksignore'), 'utf8');
for (const line of ignore.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  assert.doesNotMatch(
    trimmed,
    /^business-card\/site\/(?:index|preview)\.html:/,
    'path-only gitleaks ignore hides every secret on the line: ' + trimmed
  );
}

const config = fs.readFileSync(path.join(root, '.gitleaks.toml'), 'utf8');
assert.match(config, /useDefault\s*=\s*true/);
assert.match(config, /condition\s*=\s*"AND"/);
assert.match(config, /regexTarget\s*=\s*"secret"/);
assert.match(config, /\^sb_publishable_\[A-Za-z0-9_-\]\+\$/);
assert.match(config, /business-card\/site\/index\\?\.html/);
assert.match(config, /business-card\/site\/preview\\?\.html/);
assert.doesNotMatch(config, /^\[\[allowlists\]\]/m);
assert.doesNotMatch(config, /^\[allowlist\]/m);

const publishable = 'sb_publishable_k7Qm9Vx2Lp8Rn4Tw6Ys1Za3Bc5';
const other = 'a91f3c0e7b24d65890ab12cd34ef56';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-gitleaks-'));
const reportDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'card-gitleaks-report-')
);
const report = path.join(reportDir, 'report.json');
try {
  fs.mkdirSync(path.join(dir, 'business-card/site'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'other'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'fixtures/business-card/site'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(dir, 'business-card/site/index.html'),
    `<script>window.BRAND_KIT={"key":"${publishable}"}</script>\n`
  );
  fs.writeFileSync(
    path.join(dir, 'business-card/site/preview.html'),
    `<script>window.BRAND_KIT={"key":"${publishable}","token":"${other}"}</script>\n`
  );
  fs.writeFileSync(
    path.join(dir, 'fixtures/business-card/site/index.html'),
    `<script>window.BRAND_KIT={"key":"${publishable}"}</script>\n`
  );
  fs.writeFileSync(
    path.join(dir, 'other/app.js'),
    `const key = "${publishable}";\n`
  );
  const bin = process.env.GITLEAKS_BIN || 'gitleaks';
  const scan = spawnSync(
    bin,
    [
      'dir',
      '.',
      '--config',
      path.join(root, '.gitleaks.toml'),
      '--gitleaks-ignore-path',
      '.',
      '--no-banner',
      '--report-format',
      'json',
      '--report-path',
      report,
      '--exit-code',
      '0',
    ],
    { encoding: 'utf8', cwd: dir }
  );
  assert.equal(
    scan.status,
    0,
    `gitleaks failed to scan (${bin}): ${scan.stderr || scan.error || ''}`
  );
  const findings = JSON.parse(fs.readFileSync(report, 'utf8'));
  // Paths are relative to the scanned root, like the repo-relative paths CI sees,
  // so the root-anchored allowlist is exercised exactly.
  const hit = (file, secret) =>
    findings.some(f => f.File === file && f.Secret === secret);
  assert.equal(
    hit('business-card/site/index.html', publishable),
    false,
    'publishable key on index.html must be allowed'
  );
  assert.equal(
    hit('business-card/site/preview.html', publishable),
    false,
    'publishable key on preview.html must be allowed'
  );
  assert.equal(
    hit('business-card/site/preview.html', other),
    true,
    'another secret on the preview line must still be reported'
  );
  assert.equal(
    hit('fixtures/business-card/site/index.html', publishable),
    true,
    'a nested copy of the card page is not the root page and must still be reported'
  );
  assert.equal(
    hit('other/app.js', publishable),
    true,
    'the publishable key outside the card pages must still be reported'
  );
  console.info(
    'PASS publishable key allowed only on the two card pages; other secrets still reported'
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(reportDir, { recursive: true, force: true });
}
