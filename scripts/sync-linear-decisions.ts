#!/usr/bin/env npx tsx
/**
 * Linear → Brain-2 vault decision-log writer.
 *
 * Mirrors Linear comments containing the marker `[decision]` (case-insensitive)
 * into `~/Synthex-Brain-2/04-Decisions/` as individual markdown notes with
 * proper frontmatter and back-links to the Linear ticket.
 *
 * Why: Linear is the spine, but decisions disappear into comment threads.
 * This script lifts them into the vault's graph view so Obsidian can
 * surface decision lineage across the portfolio.
 *
 * Usage:
 *   npx tsx scripts/sync-linear-decisions.ts                 # incremental sync
 *   npx tsx scripts/sync-linear-decisions.ts --since 7d      # last 7 days only
 *   npx tsx scripts/sync-linear-decisions.ts --dry-run       # preview, don't write
 *   npx tsx scripts/sync-linear-decisions.ts --team Synthex  # filter by team
 *
 * Decision marker syntax in a Linear comment:
 *   [decision] We're picking option B because X.
 *   [decision: launch tier] Standard tier (not headline) — community + email + light PR.
 *
 * Auth: reads LINEAR_API_KEY from .env or .env.local.
 *
 * @ticket SYN-9XX (Wave 9c)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ── Config ────────────────────────────────────────────────────────────────

const VAULT_DECISIONS_DIR = path.resolve(
  process.env.HOME ?? '',
  'Synthex-Brain-2',
  '04-Decisions'
);
const STATE_FILE = path.resolve(
  process.env.HOME ?? '',
  'Synthex-Brain-2',
  '_meta',
  '.linear-sync-state.json'
);
const DECISION_MARKER = /\[decision(?::\s*([^\]]+))?\]/i;
const LINEAR_API = 'https://api.linear.app/graphql';

// ── CLI args ──────────────────────────────────────────────────────────────

interface Args {
  since?: string;
  dryRun: boolean;
  team?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && args[i + 1]) out.since = args[++i];
    else if (args[i] === '--dry-run') out.dryRun = true;
    else if (args[i] === '--team' && args[i + 1]) out.team = args[++i];
  }
  return out;
}

// ── Types ─────────────────────────────────────────────────────────────────

interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  user: { name: string; email?: string } | null;
  issue: {
    id: string;
    identifier: string;
    title: string;
    url: string;
    team: { key: string; name: string };
    project: { name: string } | null;
  };
}

interface SyncState {
  lastSyncIso: string;
  ledger: Record<string, { commentId: string; vaultPath: string; written: string }>;
}

// ── State (resume from last sync) ─────────────────────────────────────────

function loadState(): SyncState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as SyncState;
  } catch {
    return { lastSyncIso: '1970-01-01T00:00:00.000Z', ledger: {} };
  }
}

function saveState(state: SyncState, dryRun: boolean): void {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// ── Linear GraphQL ────────────────────────────────────────────────────────

async function fetchComments(
  apiKey: string,
  sinceIso: string,
  teamKey?: string
): Promise<LinearComment[]> {
  const query = `
    query Comments($filter: CommentFilter) {
      comments(filter: $filter, first: 250, orderBy: updatedAt) {
        nodes {
          id
          body
          createdAt
          updatedAt
          url
          user { name email }
          issue {
            id
            identifier
            title
            url
            team { key name }
            project { name }
          }
        }
      }
    }
  `;
  const filter: Record<string, unknown> = {
    updatedAt: { gte: sinceIso },
  };
  if (teamKey) {
    filter.issue = { team: { key: { eq: teamKey } } };
  }
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables: { filter } }),
  });
  if (!res.ok) {
    throw new Error(`Linear API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: { comments?: { nodes?: LinearComment[] } }; errors?: unknown };
  if (json.errors) {
    throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data?.comments?.nodes ?? [];
}

// ── Decision extraction ───────────────────────────────────────────────────

interface DecisionRecord {
  comment: LinearComment;
  topic: string;        // from [decision: topic] or first line of body
  body: string;         // full comment body
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

function extractDecision(comment: LinearComment): DecisionRecord | null {
  const match = DECISION_MARKER.exec(comment.body);
  if (!match) return null;

  const topicFromMarker = match[1]?.trim();
  let topic = topicFromMarker;

  if (!topic) {
    // Use the first non-marker line as topic
    const cleaned = comment.body.replace(DECISION_MARKER, '').trim();
    const firstLine = cleaned.split('\n')[0]?.trim() ?? '';
    topic = firstLine.slice(0, 80);
  }

  if (!topic) topic = comment.issue.identifier;

  const date = comment.updatedAt.slice(0, 10);
  const slug = `${date}-${slugify(topic)}`;

  return {
    comment,
    topic,
    body: comment.body.replace(DECISION_MARKER, '').trim(),
    slug,
  };
}

// ── Markdown emission ─────────────────────────────────────────────────────

function emitDecisionMarkdown(record: DecisionRecord): string {
  const c = record.comment;
  const date = c.updatedAt.slice(0, 10);
  const teamSlug = c.issue.team.key.toLowerCase();

  return `---
type: decision
status: open
brand: ${teamSlug === 'syn' ? 'portfolio' : teamSlug}
ticket: ${c.issue.identifier}
created: ${date}
updated: ${date}
decision-by: ${c.user?.name ?? 'unknown'}
source: linear-comment
linear-comment-id: ${c.id}
tags:
  - source/linear
  - team/${teamSlug}
---

# Decision · ${record.topic}

> **Linear ticket:** [${c.issue.identifier} — ${c.issue.title}](${c.issue.url})
> **Comment:** [${c.id.slice(0, 8)}…](${c.url})
> **By:** ${c.user?.name ?? 'unknown'}
> **At:** ${c.updatedAt}
${c.issue.project ? `> **Project:** ${c.issue.project.name}\n` : ''}
## Decision

${record.body}

---

*Auto-mirrored from Linear by \`scripts/sync-linear-decisions.ts\`. Edit freely — re-syncs do not overwrite existing files unless the source comment changes.*
`;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error('LINEAR_API_KEY not set in .env / .env.local');
    process.exit(1);
  }

  const state = loadState();
  let sinceIso = state.lastSyncIso;
  if (args.since) {
    const m = /^(\d+)([dhwm])$/.exec(args.since);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2];
      const ms =
        unit === 'd' ? n * 86400_000 :
        unit === 'h' ? n * 3600_000 :
        unit === 'w' ? n * 86400_000 * 7 :
        n * 60_000;
      sinceIso = new Date(Date.now() - ms).toISOString();
    } else {
      sinceIso = new Date(args.since).toISOString();
    }
  }

  console.log(`[sync-linear-decisions] since=${sinceIso} team=${args.team ?? '*'} dryRun=${args.dryRun}`);

  const comments = await fetchComments(apiKey, sinceIso, args.team);
  console.log(`[sync-linear-decisions] fetched ${comments.length} comments updated since ${sinceIso}`);

  const decisions = comments
    .map(extractDecision)
    .filter((r): r is DecisionRecord => r !== null);

  console.log(`[sync-linear-decisions] ${decisions.length} carry the [decision] marker`);

  if (!args.dryRun) {
    fs.mkdirSync(VAULT_DECISIONS_DIR, { recursive: true });
  }

  let written = 0;
  let skipped = 0;
  for (const record of decisions) {
    const filePath = path.join(VAULT_DECISIONS_DIR, `${record.slug}.md`);
    const existing = state.ledger[record.comment.id];

    // Idempotency: re-sync only if the comment text changed (compare against ledger)
    if (existing && existing.commentId === record.comment.id && fs.existsSync(filePath)) {
      const existingBody = fs.readFileSync(filePath, 'utf-8');
      const newBody = emitDecisionMarkdown(record);
      if (existingBody === newBody) {
        skipped++;
        continue;
      }
    }

    if (args.dryRun) {
      console.log(`  [dry-run] would write: ${filePath}`);
    } else {
      fs.writeFileSync(filePath, emitDecisionMarkdown(record));
      state.ledger[record.comment.id] = {
        commentId: record.comment.id,
        vaultPath: filePath,
        written: new Date().toISOString(),
      };
    }
    written++;
  }

  state.lastSyncIso = new Date().toISOString();
  saveState(state, args.dryRun);

  console.log(`[sync-linear-decisions] ${written} written · ${skipped} unchanged (skipped) · state saved`);
}

main().catch(err => {
  console.error('[sync-linear-decisions] failed:', err);
  process.exit(1);
});
