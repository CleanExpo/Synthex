/**
 * Board Memo Harvester — lib/video/harvesters/board-memo-harvester.ts
 *
 * Extracts BTS ("Behind the Scenes") video topics from three source layers:
 *
 *  1. `.planning/phases/` SUMMARY.md files  — phase decisions + rationale
 *  2. Linear board issues                    — active + completed sprint items
 *  3. Git commit history                     — product evolution narrative
 *
 * Each source maps to a `HarvestedTopic` which the topic-seeder writes
 * to the VideoTopicQueue.
 *
 * @task SYN-577
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HarvestedTopic {
  title: string;
  description: string;
  sourceType: 'board-memo' | 'linear-issue' | 'git-milestone';
  sourceRef: string; // file path, Linear issue ID, or commit SHA
  priority: number; // 1 = highest, 100 = lowest
  tags: string[];
  rawContent?: string; // excerpt for script generation context
}

// ── YAML frontmatter parser ──────────────────────────────────────────────────

interface PhaseFrontmatter {
  phase?: string;
  plan?: string | number;
  tags?: string[];
  'key-decisions'?: string[];
  'patterns-established'?: string[];
  completed?: string;
  subsystem?: string;
}

function parseFrontmatter(content: string): {
  meta: PhaseFrontmatter;
  body: string;
} {
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { meta: {}, body: content };

  const fmRaw = fmMatch[1];
  const body = fmMatch[2];
  const meta: PhaseFrontmatter = {};

  // Simple line-by-line YAML parser for the flat keys we care about
  const lines = fmRaw.split('\n');
  let currentKey: string | null = null;
  let listBuffer: string[] = [];

  const flushList = () => {
    if (currentKey && listBuffer.length > 0) {
      (meta as Record<string, unknown>)[currentKey] = listBuffer;
      listBuffer = [];
    }
    currentKey = null;
  };

  for (const line of lines) {
    const listItemMatch = line.match(/^\s{2}-\s+(.+)$/);
    const keyValueMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);

    if (listItemMatch) {
      listBuffer.push(listItemMatch[1].replace(/^["']|["']$/g, ''));
      continue;
    }

    if (keyValueMatch) {
      flushList();
      const [, key, value] = keyValueMatch;
      currentKey = key;
      if (value.trim() === '' || value.trim() === '[]') {
        // Empty value — list will be populated by subsequent indent lines
      } else {
        (meta as Record<string, unknown>)[key] = value.replace(
          /^["']|["']$/g,
          ''
        );
        currentKey = null;
      }
    }
  }

  flushList();
  return { meta, body };
}

// ── Source 1: Phase SUMMARY files ────────────────────────────────────────────

function harvestPhaseDocs(repoRoot: string): HarvestedTopic[] {
  const phasesDir = path.join(repoRoot, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) {
    logger.warn('BoardMemoHarvester: .planning/phases not found', {
      phasesDir,
    });
    return [];
  }

  const topics: HarvestedTopic[] = [];
  const summaryFiles = walkForPattern(phasesDir, /SUMMARY\.md$/);

  for (const filePath of summaryFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { meta, body } = parseFrontmatter(content);

      // Extract the h1 title from body
      const h1Match = body.match(/^#\s+(.+)$/m);
      const title = h1Match
        ? h1Match[1].trim()
        : `Phase ${meta.phase ?? 'Unknown'} — ${path.basename(path.dirname(filePath))}`;

      // Extract first paragraph after h1 as description
      const descMatch =
        body.match(/^#[^\n]+\n+\*\*([^*]+)\*\*/) ||
        body.match(/^#[^\n]+\n+([A-Z][^#\n]{20,})/m);
      const description = descMatch
        ? descMatch[1].trim().substring(0, 200)
        : title;

      // Extract key decisions as additional context
      const keyDecisions = meta['key-decisions'] ?? [];
      const rawExcerpt =
        keyDecisions.length > 0
          ? `Key decisions: ${keyDecisions.slice(0, 3).join('; ')}`
          : body.substring(0, 500).replace(/\n+/g, ' ').trim();

      // Priority: earlier phases get slightly higher priority for narrative arc
      const phaseNum = parseInt(String(meta.phase ?? '50'), 10) || 50;
      const priority = Math.min(99, Math.max(1, phaseNum));

      const tags = [
        'bts',
        'product-evolution',
        ...(meta.tags ?? []),
        ...(meta.subsystem ? [meta.subsystem] : []),
      ];

      const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');

      topics.push({
        title,
        description,
        sourceType: 'board-memo',
        sourceRef: relPath,
        priority,
        tags,
        rawContent: rawExcerpt,
      });
    } catch (err) {
      logger.warn('BoardMemoHarvester: failed to parse SUMMARY', {
        filePath,
        error: String(err),
      });
    }
  }

  logger.info('BoardMemoHarvester: phase docs harvested', {
    count: topics.length,
  });

  return topics;
}

// ── Source 2: Linear board issues ────────────────────────────────────────────

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  state: { name: string };
  labels?: { nodes: { name: string }[] };
  priority: number;
}

async function fetchLinearIssues(): Promise<LinearIssue[]> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    logger.warn(
      'BoardMemoHarvester: LINEAR_API_KEY not set — skipping Linear harvest'
    );
    return [];
  }

  const query = `
    query {
      issues(
        filter: {
          team: { key: { eq: "UNI" } }
          state: { name: { in: ["Done", "In Progress", "In Review"] } }
        }
        orderBy: { updatedAt: descending }
        first: 100
      ) {
        nodes {
          id
          identifier
          title
          description
          priority
          state { name }
          labels { nodes { name } }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      logger.warn('BoardMemoHarvester: Linear API error', {
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as {
      data?: { issues?: { nodes?: LinearIssue[] } };
    };
    return data?.data?.issues?.nodes ?? [];
  } catch (err) {
    logger.warn('BoardMemoHarvester: Linear fetch failed', {
      error: String(err),
    });
    return [];
  }
}

function linearIssuesToTopics(issues: LinearIssue[]): HarvestedTopic[] {
  return issues.map(issue => {
    const labelNames = issue.labels?.nodes?.map(l => l.name) ?? [];
    // Linear priority: 1=urgent, 2=high, 3=medium, 4=low, 0=no priority
    const priority =
      issue.priority >= 1 && issue.priority <= 4 ? issue.priority * 20 : 60;

    return {
      title: `Decision Story: ${issue.title}`,
      description:
        issue.description?.substring(0, 200) ??
        `Board decision captured in ${issue.identifier}`,
      sourceType: 'linear-issue' as const,
      sourceRef: issue.identifier,
      priority,
      tags: ['bts', 'board-decision', ...labelNames],
      rawContent: issue.description?.substring(0, 500) ?? '',
    };
  });
}

// ── Source 3: Git commit history ─────────────────────────────────────────────

/**
 * Fetch git log using spawnSync (fixed args array — no shell injection risk).
 * All arguments are hardcoded string literals, no user input is interpolated.
 */
function extractGitMilestones(repoRoot: string): HarvestedTopic[] {
  const result = spawnSync(
    'git',
    ['log', '--no-merges', '--pretty=format:%H|%s|%as|%an', '-n', '200'],
    { cwd: repoRoot, encoding: 'utf8', timeout: 10_000 }
  );

  if (result.status !== 0 || !result.stdout) {
    logger.warn('BoardMemoHarvester: git log failed', {
      stderr: result.stderr?.substring(0, 200),
    });
    return [];
  }

  const milestones = result.stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const parts = line.split('|');
      return {
        sha: parts[0]?.trim() ?? '',
        message: parts[1]?.trim() ?? '',
        date: parts[2]?.trim() ?? '',
        author: parts[3]?.trim() ?? '',
      };
    })
    .filter(m => /^(feat|fix|refactor|perf)\s*[\(:]/i.test(m.message));

  const topics: HarvestedTopic[] = milestones.slice(0, 30).map((m, i) => {
    const typeMatch = m.message.match(/^(\w+)[\s(:]/);
    const scopeMatch = m.message.match(/\(([^)]+)\)/);
    const type = typeMatch?.[1] ?? 'change';
    const scope = scopeMatch?.[1] ?? 'system';
    const description = m.message
      .replace(/^\w+\([^)]+\):\s*/, '')
      .replace(/^\w+:\s*/, '');

    return {
      title: `How We Built: ${description.substring(0, 80)}`,
      description: `Git history deep-dive — ${type} to ${scope} on ${m.date}. ${description}`,
      sourceType: 'git-milestone' as const,
      sourceRef: m.sha,
      priority: 30 + i * 2, // spread 30–88 based on recency
      tags: ['bts', 'technical-decision', type, scope],
      rawContent: `Commit: ${m.sha}\nDate: ${m.date}\nAuthor: ${m.author}\nMessage: ${m.message}`,
    };
  });

  logger.info('BoardMemoHarvester: git milestones extracted', {
    count: topics.length,
  });

  return topics;
}

// ── Recursive file walker ─────────────────────────────────────────────────────

function walkForPattern(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkForPattern(full, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(full);
    }
  }
  return results.sort(); // alphabetical = chronological for phases
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface BoardMemoHarvestResult {
  topics: HarvestedTopic[];
  sources: {
    phaseDocs: number;
    linearIssues: number;
    gitMilestones: number;
  };
}

/**
 * Harvest all BTS source material and return a unified topic list.
 *
 * @param repoRoot  Absolute path to the repository root (default: process.cwd())
 */
export async function harvestBoardMemos(
  repoRoot: string = process.cwd()
): Promise<BoardMemoHarvestResult> {
  logger.info('BoardMemoHarvester: starting harvest', { repoRoot });

  const [phaseTopics, linearIssues, gitTopics] = await Promise.all([
    Promise.resolve(harvestPhaseDocs(repoRoot)),
    fetchLinearIssues().then(linearIssuesToTopics),
    Promise.resolve(extractGitMilestones(repoRoot)),
  ]);

  // Merge + deduplicate by sourceRef
  const seen = new Set<string>();
  const all: HarvestedTopic[] = [];

  for (const topic of [...phaseTopics, ...linearIssues, ...gitTopics]) {
    if (!seen.has(topic.sourceRef)) {
      seen.add(topic.sourceRef);
      all.push(topic);
    }
  }

  logger.info('BoardMemoHarvester: harvest complete', {
    total: all.length,
    phaseDocs: phaseTopics.length,
    linearIssues: linearIssues.length,
    gitMilestones: gitTopics.length,
  });

  return {
    topics: all,
    sources: {
      phaseDocs: phaseTopics.length,
      linearIssues: linearIssues.length,
      gitMilestones: gitTopics.length,
    },
  };
}
