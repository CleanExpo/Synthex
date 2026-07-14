/**
 * Guard test: the Meta Graph API version must live in ONE place.
 *
 * Meta expires each Graph API version ~2 years after release, and scattered
 * hardcoded version strings (v18.0, v19.0, …) silently broke Facebook/Instagram
 * publishing in prod once they expired. The version now lives only in
 * lib/social/meta-graph-version.ts (META_GRAPH_VERSION / META_GRAPH_BASE); every
 * caller must import it. This test fails if any source file hardcodes a
 * graph.facebook.com/vNN.N or www.facebook.com/vNN.N URL, forcing new code to
 * use the constant so the next bump stays a one-line change.
 */
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ALLOWED_FILE = 'lib/social/meta-graph-version.ts';
// Matches a hardcoded Meta Graph API version in a URL, e.g. graph.facebook.com/v23.0
const HARDCODED_META_VERSION = /(?:graph|www)\.facebook\.com\/v\d+\.\d+/;

describe('Meta Graph API version centralization', () => {
  const files = globSync('{app,lib}/**/*.{ts,tsx}', {
    cwd: REPO_ROOT,
    ignore: ['**/*.d.ts', '**/node_modules/**'],
  });

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no hardcoded Meta Graph version outside meta-graph-version.ts', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      if (rel.replace(/\\/g, '/') === ALLOWED_FILE) continue;
      const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      if (HARDCODED_META_VERSION.test(content)) offenders.push(rel);
    }
    expect(
      offenders.length === 0
        ? true
        : // Surface the offending files in the failure message.
          `Hardcoded Meta Graph version found in:\n  ${offenders.join('\n  ')}\n` +
            `Fix: import { META_GRAPH_BASE, META_GRAPH_VERSION } from '@/lib/social/meta-graph-version'.`
    ).toBe(true);
  });

  it('the constant file exports META_GRAPH_VERSION and META_GRAPH_BASE', () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, ALLOWED_FILE), 'utf8');
    expect(content).toMatch(/export const META_GRAPH_VERSION\s*=/);
    expect(content).toMatch(/export const META_GRAPH_BASE\s*=/);
  });
});
