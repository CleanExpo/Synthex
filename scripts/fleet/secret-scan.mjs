#!/usr/bin/env node
/**
 * scripts/fleet/secret-scan.mjs — K3. Scans text (tool output, diffs) for key patterns.
 * On a hit it writes the security halt file STOP into FLEET_HALT_DIR (default policy halt_dir),
 * which only a person clears. selftest sets FLEET_HALT_DIR to a scratch dir so a planted hit
 * never writes the real STOP. Usage: node secret-scan.mjs < text  | --diff <base> <head>
 */
import { policy, ROOT, tryGit, isMain } from './lib.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const PATTERNS = [
  { pattern: 'anthropic', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { pattern: 'openai', re: /sk-(proj-)?[A-Za-z0-9]{20,}/ },
  { pattern: 'aws', re: /AKIA[0-9A-Z]{16}/ },
  { pattern: 'github', re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
  { pattern: 'stripe-live', re: /sk_live_[A-Za-z0-9]{16,}/ },
  {
    pattern: 'private-key',
    re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    pattern: 'database-url-with-password',
    re: /postgres(ql)?:\/\/[^:\s]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1)/,
  },
];
export function scanForSecrets(text) {
  return PATTERNS.filter(p => p.re.test(text)).map(p => ({
    pattern: p.pattern,
  }));
}
export function haltOnHit(hits, reason) {
  if (!hits.length) return false;
  const dir = process.env.FLEET_HALT_DIR || path.join(ROOT, policy().halt_dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'STOP'),
    `security halt ${new Date().toISOString()}\nreason: ${reason}\npatterns: ${hits.map(h => h.pattern).join(',')}\ncleared only by a person\n`
  );
  return true;
}
if (isMain(import.meta.url)) {
  const a = process.argv.slice(2);
  let text;
  if (a[0] === '--diff') text = tryGit(['diff', a[1], a[2]]) || '';
  else text = readFileSync(0, 'utf8');
  const hits = scanForSecrets(text);
  if (haltOnHit(hits, a[0] === '--diff' ? `diff ${a[1]}..${a[2]}` : 'stdin')) {
    console.log(
      `FAIL secret-scan: ${hits.map(h => h.pattern).join(',')} — STOP written`
    );
    process.exit(1);
  }
  console.log('PASS secret-scan: no key pattern');
  process.exit(0);
}
