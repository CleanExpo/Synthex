/**
 * SYN-1219 — pin SPM dead-path redirects so they cannot silently 404 again.
 *
 * The shared list in config/legacy-path-redirects.mjs is the source of truth.
 * next.config.mjs must import and spread it inside redirects().
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..');

const PINNED: ReadonlyArray<{ source: string; destination: string }> = [
  { source: '/register', destination: '/signup' },
  { source: '/auth/signup', destination: '/signup' },
  { source: '/kickstart', destination: '/opportunity-map' },
  { source: '/scan', destination: '/opportunity-map' },
  { source: '/brief', destination: '/onboarding/season-brief' },
];

describe('SYN-1219 legacy path redirects', () => {
  const redirectsModule = readFileSync(
    join(REPO_ROOT, 'config/legacy-path-redirects.mjs'),
    'utf8'
  );
  const nextConfig = readFileSync(join(REPO_ROOT, 'next.config.mjs'), 'utf8');

  it('wires the shared list into next.config redirects()', () => {
    expect(nextConfig).toContain(
      "import { LEGACY_PATH_REDIRECTS } from './config/legacy-path-redirects.mjs'"
    );
    expect(nextConfig).toContain('...LEGACY_PATH_REDIRECTS');
  });

  it.each(PINNED)(
    'pins $source → $destination as a permanent redirect',
    ({ source, destination }) => {
      expect(redirectsModule).toContain(
        `{ source: '${source}', destination: '${destination}', permanent: true }`
      );
    }
  );
});
