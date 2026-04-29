/**
 * GitHub Contents-API client for the cross-repo writer.
 *
 * Plain `fetch` — no @octokit dependency, consistent with the GBP /
 * Bing clients in lib/gbp and lib/bing-places. Same L7-style scope:
 * one repo, one default branch.
 *
 * Auth: DR_REPO_GITHUB_TOKEN — fine-grained PAT with Contents:Write
 * on `disasterrecovery.com.au` only. NOT a personal token.
 *
 * @see SYN-834 (epic — Track 2 ship-now)
 */

import { logger } from '@/lib/logger';

const GITHUB_API = 'https://api.github.com';

export interface GitHubRepoCoords {
  owner: string;
  repo: string;
  branch: string;
}

export interface GitHubFileGetResult {
  /** Base64-decoded contents. */
  content: string;
  /** Blob SHA — required for an update. */
  sha: string;
}

export interface GitHubWriteResult {
  ok: boolean;
  /** Commit SHA — present iff ok. */
  commitSha?: string;
  /** Failure reason — present iff !ok. */
  reason?: string;
}

export interface GitHubClient {
  getFile(
    coords: GitHubRepoCoords,
    path: string
  ): Promise<GitHubFileGetResult | null>;
  putFile(
    coords: GitHubRepoCoords,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<GitHubWriteResult>;
}

interface GhFileResponse {
  content: string;
  sha: string;
  encoding: string;
}

interface GhPutResponse {
  commit: { sha: string };
}

function requireToken(): string {
  const token = process.env.DR_REPO_GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      '[dr-repo-writer] DR_REPO_GITHUB_TOKEN missing — inject a fake client in tests, or feature-flag the writer behind DR_NRPG_PIPELINE_ENABLED'
    );
  }
  return token;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export const githubClient: GitHubClient = {
  async getFile(coords: GitHubRepoCoords, path: string) {
    const token = requireToken();
    const url = `${GITHUB_API}/repos/${coords.owner}/${coords.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(coords.branch)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: authHeaders(token),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `[dr-repo-writer.getFile] ${res.status} ${res.statusText}`
      );
    }
    const body = (await res.json()) as GhFileResponse;
    if (body.encoding !== 'base64') {
      throw new Error(
        `[dr-repo-writer.getFile] unexpected encoding '${body.encoding}'`
      );
    }
    // GitHub base64 contents include line breaks — strip them.
    const decoded = Buffer.from(
      body.content.replace(/\n/g, ''),
      'base64'
    ).toString('utf8');
    return { content: decoded, sha: body.sha };
  },

  async putFile(
    coords: GitHubRepoCoords,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) {
    const token = requireToken();
    const url = `${GITHUB_API}/repos/${coords.owner}/${coords.repo}/contents/${encodeURIComponent(path)}`;
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: coords.branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const reason = `${res.status} ${res.statusText} ${text.slice(0, 200)}`;
      logger.warn('[dr-repo-writer.putFile] failed', { path, reason });
      return { ok: false, reason };
    }
    const json = (await res.json()) as GhPutResponse;
    logger.info('[dr-repo-writer.putFile] ok', {
      path,
      commitSha: json.commit.sha,
    });
    return { ok: true, commitSha: json.commit.sha };
  },
};
