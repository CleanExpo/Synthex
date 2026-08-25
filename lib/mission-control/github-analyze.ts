/**
 * GitHub repository analysis for Mission Control ticket drafting.
 * Uses server token (GITHUB_TOKEN | GH_TOKEN | DR_REPO_GITHUB_TOKEN).
 */

import type { RepoAnalysisSummary } from './types';

function githubToken(): string | null {
  return (
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.DR_REPO_GITHUB_TOKEN?.trim() ||
    null
  );
}

async function ghFetch<T>(path: string): Promise<T> {
  const token = githubToken();
  if (!token) {
    throw new Error('GITHUB_TOKEN_REQUIRED');
  }
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Synthex-Mission-Control',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('GITHUB_AUTH_FAILED');
    }
    if (res.status === 404) {
      throw new Error('GITHUB_REPO_NOT_FOUND');
    }
    throw new Error(`GITHUB_API_${res.status}:${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export function isGitHubConfigured(): boolean {
  return Boolean(githubToken());
}

export async function listAccessibleRepos(
  limit = 30
): Promise<
  Array<{ fullName: string; description: string | null; private: boolean }>
> {
  const data = await ghFetch<
    Array<{
      full_name: string;
      description: string | null;
      private: boolean;
    }>
  >(
    `/user/repos?per_page=${limit}&sort=updated&affiliation=owner,collaborator,organization_member`
  );
  return data.map(r => ({
    fullName: r.full_name,
    description: r.description,
    private: r.private,
  }));
}

export async function analyzeRepository(
  fullName: string
): Promise<RepoAnalysisSummary> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) {
    throw new Error('INVALID_REPO_NAME');
  }

  type RepoPayload = {
    full_name: string;
    description: string | null;
    default_branch: string;
    language: string | null;
    topics?: string[];
    open_issues_count: number;
  };

  type TreePayload = {
    tree?: Array<{ path: string; type: string }>;
  };

  type PrPayload = Array<{
    number: number;
    title: string;
    state: string;
    merged_at: string | null;
  }>;

  const repoData = await ghFetch<RepoPayload>(`/repos/${owner}/${repo}`);

  let topPaths: string[] = [];
  try {
    const tree = await ghFetch<TreePayload>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(repoData.default_branch)}?recursive=1`
    );
    const dirs = new Set<string>();
    for (const node of tree.tree ?? []) {
      if (node.type !== 'blob' || !node.path) continue;
      const parts = node.path.split('/');
      if (parts.length >= 2) {
        dirs.add(parts.slice(0, 2).join('/'));
      } else {
        dirs.add(parts[0]);
      }
      if (dirs.size >= 40) break;
    }
    topPaths = Array.from(dirs).slice(0, 24);
  } catch {
    topPaths = [];
  }

  let recentPullRequests: RepoAnalysisSummary['recentPullRequests'] = [];
  try {
    const prs = await ghFetch<PrPayload>(
      `/repos/${owner}/${repo}/pulls?state=all&per_page=8&sort=updated&direction=desc`
    );
    recentPullRequests = prs.map(pr => ({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.merged_at,
      state: pr.state,
    }));
  } catch {
    recentPullRequests = [];
  }

  return {
    owner,
    repo,
    fullName: repoData.full_name,
    description: repoData.description,
    defaultBranch: repoData.default_branch,
    language: repoData.language,
    topics: repoData.topics ?? [],
    topPaths,
    recentPullRequests,
    openIssueCount: repoData.open_issues_count,
    analyzedAt: new Date().toISOString(),
  };
}
