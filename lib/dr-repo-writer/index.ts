/**
 * lib/dr-repo-writer — public entry point.
 *
 * Cross-repo committer for the disasterrecovery.com.au repo.
 * Used by the SYN-834 NRPG pipeline as `saveLandingPage` and
 * `saveSitemapXml` callbacks.
 *
 * @see SYN-834 (epic — Track 2 ship-now)
 */

export type {
  GitHubClient,
  GitHubRepoCoords,
  GitHubFileGetResult,
  GitHubWriteResult,
} from './github-client';
export { githubClient } from './github-client';
export { renderLandingPageSource, pathForLandingPage } from './page-renderer';
export {
  DEFAULT_DR_REPO_COORDS,
  saveLandingPageToDrRepo,
  saveSitemapXmlToDrRepo,
  loadCurrentSitemapXmlFromDrRepo,
} from './writer';
export type { DrRepoWriterOptions } from './writer';
