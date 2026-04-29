/**
 * Cross-repo writer for disasterrecovery.com.au.
 *
 * Two functions:
 *   - saveLandingPageToDrRepo(page) → commits app/<slug>/page.tsx
 *   - saveSitemapXmlToDrRepo(xml)   → commits public/sitemap.xml
 *
 * Both write directly to the default branch via the GitHub Contents
 * API (PUT /repos/.../contents/{path}). For a single-tenant DR site
 * with the lib/landing-page validators as the gate, direct-to-main is
 * acceptable. If you want PR-per-page review later, swap the two
 * write helpers for a Git-Data-API branch + PR flow without touching
 * lib/nrpg-pipeline.
 *
 * @see SYN-834 (epic — Track 2 ship-now)
 */

import { logger } from '@/lib/logger';
import type { BuildLandingPageResult } from '@/lib/landing-page';
import {
  githubClient as defaultGithubClient,
  type GitHubClient,
  type GitHubRepoCoords,
} from './github-client';
import { pathForLandingPage, renderLandingPageSource } from './page-renderer';

/** Default disasterrecovery.com.au repo coords. */
export const DEFAULT_DR_REPO_COORDS: GitHubRepoCoords = {
  owner: 'CleanExpo',
  repo: 'disasterrecovery.com.au',
  branch: 'main',
};

const SITEMAP_PATH = 'public/sitemap.xml';

export interface DrRepoWriterOptions {
  /** Override the GitHub client (tests). */
  client?: GitHubClient;
  /** Override the repo coords (e.g. staging fork). */
  coords?: GitHubRepoCoords;
}

/**
 * Commit one landing page. Idempotent — if the file already exists at
 * the target path, the SHA is fetched and the PUT becomes an update.
 * Returns false when the page hasn't changed (caller need not retry).
 */
export async function saveLandingPageToDrRepo(
  page: BuildLandingPageResult,
  opts: DrRepoWriterOptions = {}
): Promise<{
  ok: boolean;
  commitSha?: string;
  reason?: string;
  unchanged?: boolean;
}> {
  const client = opts.client ?? defaultGithubClient;
  const coords = opts.coords ?? DEFAULT_DR_REPO_COORDS;
  const path = pathForLandingPage(page);
  const newContent = renderLandingPageSource(page);

  const existing = await client.getFile(coords, path);
  if (existing && existing.content === newContent) {
    logger.info('[dr-repo-writer] page unchanged — skip commit', { path });
    return { ok: true, unchanged: true };
  }

  const result = await client.putFile(
    coords,
    path,
    newContent,
    `feat(pages): SYN-834 ${existing ? 'update' : 'add'} /${page.slug}`,
    existing?.sha
  );
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, commitSha: result.commitSha };
}

/**
 * Commit a sitemap. Idempotent — unchanged content = no commit.
 */
export async function saveSitemapXmlToDrRepo(
  xml: string,
  opts: DrRepoWriterOptions = {}
): Promise<{
  ok: boolean;
  commitSha?: string;
  reason?: string;
  unchanged?: boolean;
}> {
  const client = opts.client ?? defaultGithubClient;
  const coords = opts.coords ?? DEFAULT_DR_REPO_COORDS;

  const existing = await client.getFile(coords, SITEMAP_PATH);
  if (existing && existing.content === xml) {
    logger.info('[dr-repo-writer] sitemap unchanged — skip commit');
    return { ok: true, unchanged: true };
  }

  const result = await client.putFile(
    coords,
    SITEMAP_PATH,
    xml,
    `chore(sitemap): SYN-834 auto-regen`,
    existing?.sha
  );
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, commitSha: result.commitSha };
}

/**
 * Read the current sitemap.xml from the DR repo. Returns '' if the
 * file doesn't exist yet (so the regen starts from an empty urlset).
 */
export async function loadCurrentSitemapXmlFromDrRepo(
  opts: DrRepoWriterOptions = {}
): Promise<string> {
  const client = opts.client ?? defaultGithubClient;
  const coords = opts.coords ?? DEFAULT_DR_REPO_COORDS;
  const file = await client.getFile(coords, SITEMAP_PATH);
  return file?.content ?? '';
}
