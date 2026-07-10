/**
 * §15.9 ALWAYS-HUMAN-GATED INVARIANT — SYN-1075.
 *
 * The core safety guarantee of the nexus-viral publish path:
 *
 *   No path may create OR transition a youtube/tiktok publish_queue row into
 *   pending/publishing EXCEPT the human release route.
 *
 * This is enforced by two source-level guards that fail if a future change
 * quietly re-arms an automated publish:
 *
 *   (1) `AUTO_PUBLISH_PLATFORMS` (which feeds `seedPublishQueue`, the only
 *       automated producer of `pending` rows from approved calendar slots)
 *       MUST NOT contain 'youtube' or 'tiktok'. If it did, gated video cuts
 *       would be seeded straight to `pending` and bypass the human gate.
 *       (The behavioural companion — `seedPublishQueue` skips youtube/tiktok
 *       slots — lives in __tests__/publish/publishQueue.test.ts.)
 *
 *   (2) The ONLY production file that transitions a `queued_human_gated` row
 *       into `pending` is the human release route. Any other file that both
 *       references `queued_human_gated` and writes `status: 'pending'` is an
 *       ungated auto-publish and fails this test.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SCAN_DIRS = ['lib', 'app', 'components', 'hooks'];
const RELEASE_ROUTE = path
  .join('app', 'api', 'publish-queue', 'release', 'route.ts')
  .replace(/\\/g, '/');

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (
      entry === 'node_modules' ||
      entry === '__tests__' ||
      entry === 'tests'
    ) {
      continue;
    }
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.|\.spec\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = SCAN_DIRS.flatMap(d => walk(path.join(ROOT, d)));

describe('§15.9 invariant — AUTO_PUBLISH_PLATFORMS excludes video platforms', () => {
  it('never contains youtube or tiktok', () => {
    const src = readFileSync(
      path.join(ROOT, 'lib', 'publish', 'publishQueue.ts'),
      'utf8'
    );

    // Isolate the AUTO_PUBLISH_PLATFORMS Set literal.
    const match = src.match(
      /AUTO_PUBLISH_PLATFORMS\s*=\s*new Set\(\[([\s\S]*?)\]\)/
    );
    expect(match).not.toBeNull();
    const setBody = match![1];

    expect(setBody).not.toMatch(/['"]youtube['"]/);
    expect(setBody).not.toMatch(/['"]tiktok['"]/);
    // Sanity: the caption-only platforms are still present.
    expect(setBody).toMatch(/['"]instagram['"]/);
  });
});

describe('§15.9 invariant — only the release route transitions gated→pending', () => {
  it('scanned a non-trivial number of source files', () => {
    // Guards against a broken walk silently passing the test below.
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it('no automated path transitions queued_human_gated into pending', () => {
    const offenders = sourceFiles.filter(file => {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('queued_human_gated')) return false;
      // A TRANSITION is an update/updateMany on the publish_queue that writes a
      // pending/publishing status. `deriveSocialCut` (social-derivation.ts) is
      // NOT flagged: it only *creates* a gated row (`publishQueueItem.create`)
      // and its `status: 'pending'` write is on a `videoAsset`, not the queue.
      const updatesQueue = /publishQueueItem\.(update|updateMany)\b/.test(src);
      const writesPending = /status:\s*['"](pending|publishing)['"]/.test(src);
      return updatesQueue && writesPending;
    });

    const normalised = offenders.map(f =>
      path.relative(ROOT, f).replace(/\\/g, '/')
    );

    // The human release route is the sole permitted transition site.
    expect(normalised).toEqual([RELEASE_ROUTE]);
  });
});
