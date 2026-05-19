/**
 * scripts/cfr-baseline.ts — Synthex Phase 1 Deliverable 3.
 *
 * 30-day Change Failure Rate baseline for synthex.social production.
 *
 * A deployment counts as a FAILURE if:
 *   (a) Its Vercel state is ERROR, OR
 *   (b) A revert / hotfix commit landed in `main` within 24h of its
 *       `createdAt` (where revert = commit message starts with "Revert "
 *       or contains "fix(revert)", "hotfix(", or matches the commit
 *       message of an earlier-failed deploy).
 *
 * Run:
 *   VERCEL_TOKEN=... npx tsx scripts/cfr-baseline.ts
 */

interface Deployment {
  uid: string;
  state: 'READY' | 'ERROR' | 'CANCELED' | 'BUILDING' | 'QUEUED' | 'INITIALIZING';
  createdAt: number;
  readyAt?: number;
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
  };
}

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
if (!VERCEL_TOKEN) {
  console.error('VERCEL_TOKEN required');
  process.exit(1);
}

const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_gbQmHn6quoHgG3AswRrDoUlYaF40';
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? 'team_KMZACI5rIltoCRhAtGCXlxUf';
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS ?? 30);

async function listDeployments(windowDays: number): Promise<Deployment[]> {
  const since = Date.now() - windowDays * 86400 * 1000;
  const out: Deployment[] = [];
  let until: number | undefined;
  // Paginate from newest backward until we cross the window boundary.
  // Vercel's pagination uses `until` (a Unix-ms timestamp) for older pages.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let url = `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&target=production&limit=100`;
    if (until) url += `&until=${until}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
    if (!r.ok) throw new Error(`vercel ${r.status}`);
    const j = (await r.json()) as { deployments: Deployment[] };
    if (j.deployments.length === 0) break;
    out.push(...j.deployments);
    const oldest = j.deployments[j.deployments.length - 1].createdAt;
    if (oldest <= since) break;
    until = oldest;
  }
  // Filter strictly to the window (we may have one page that crossed the boundary)
  return out.filter((d) => d.createdAt >= since);
}

function isRevertOrHotfix(msg: string | undefined): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.startsWith('revert ') ||
    lower.startsWith('revert:') ||
    lower.includes('fix(revert)') ||
    lower.includes('hotfix(') ||
    lower.startsWith('hotfix ') ||
    lower.startsWith('hotfix:')
  );
}

function classifyFailureMode(msg: string | undefined): string | null {
  if (!msg) return null;
  const m = msg.toLowerCase();
  if (m.includes('pool') || m.includes('connection')) return 'supabase-pool';
  if (m.includes('webhook') || m.includes('stripe')) return 'stripe-webhook';
  if (m.includes('lockfile') || m.includes('package-lock')) return 'lockfile';
  if (m.includes('cold start') || m.includes('timeout')) return 'cold-start';
  if (m.includes('build') || m.includes('next ')) return 'build';
  if (m.includes('csp') || m.includes('headers')) return 'security-headers';
  return null;
}

interface FailureRow {
  uid: string;
  reason: 'ERROR_STATE' | 'REVERT_WITHIN_24H' | 'HOTFIX_WITHIN_24H';
  createdAt: string;
  sha: string;
  message: string;
  failureMode: string | null;
}

async function main(): Promise<void> {
  const inWindow = await listDeployments(WINDOW_DAYS);

  // Sort ascending so we can scan forward for revert-within-24h
  inWindow.sort((a, b) => a.createdAt - b.createdAt);

  const failures: FailureRow[] = [];
  for (let i = 0; i < inWindow.length; i++) {
    const d = inWindow[i];
    if (d.state === 'ERROR') {
      failures.push({
        uid: d.uid,
        reason: 'ERROR_STATE',
        createdAt: new Date(d.createdAt).toISOString(),
        sha: (d.meta?.githubCommitSha ?? '').slice(0, 8),
        message: d.meta?.githubCommitMessage?.slice(0, 80) ?? '',
        failureMode: classifyFailureMode(d.meta?.githubCommitMessage),
      });
      continue;
    }
    // Scan forward 24h for revert / hotfix
    const horizon = d.createdAt + 24 * 3600 * 1000;
    for (let j = i + 1; j < inWindow.length && inWindow[j].createdAt <= horizon; j++) {
      if (isRevertOrHotfix(inWindow[j].meta?.githubCommitMessage)) {
        failures.push({
          uid: d.uid,
          reason: inWindow[j].meta!.githubCommitMessage!.toLowerCase().startsWith('revert')
            ? 'REVERT_WITHIN_24H'
            : 'HOTFIX_WITHIN_24H',
          createdAt: new Date(d.createdAt).toISOString(),
          sha: (d.meta?.githubCommitSha ?? '').slice(0, 8),
          message: d.meta?.githubCommitMessage?.slice(0, 80) ?? '',
          failureMode: classifyFailureMode(d.meta?.githubCommitMessage),
        });
        break;
      }
    }
  }

  const total = inWindow.length;
  const failed = failures.length;
  const cfr = total === 0 ? 0 : (failed / total) * 100;
  const dora =
    cfr < 5 ? 'Elite' : cfr < 10 ? 'High' : cfr < 15 ? 'Medium' : 'Low';

  const modeCount: Record<string, number> = {};
  for (const f of failures) {
    const k = f.failureMode ?? 'unclassified';
    modeCount[k] = (modeCount[k] ?? 0) + 1;
  }

  console.error('');
  console.error(`[cfr] window      = ${WINDOW_DAYS}d`);
  console.error(`[cfr] deploys     = ${total}`);
  console.error(`[cfr] failures    = ${failed}`);
  console.error(`[cfr] CFR         = ${cfr.toFixed(2)}%`);
  console.error(`[cfr] DORA class  = ${dora}`);
  console.error(`[cfr] failure modes = ${JSON.stringify(modeCount)}`);
  console.error('');

  console.log(JSON.stringify({
    window_days: WINDOW_DAYS,
    total_deploys: total,
    failed_deploys: failed,
    cfr_percent: cfr,
    dora_class: dora,
    failure_modes: modeCount,
    failures,
  }, null, 2));
}

main().catch((e) => {
  console.error('[cfr] FAIL', e);
  process.exit(1);
});
