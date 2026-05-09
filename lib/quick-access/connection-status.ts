/**
 * Server-side connection status checker.
 *
 * Returns a snapshot of which integrations between Synthex ↔ Brain-2 ↔ Pi-CEO ↔
 * Linear ↔ Supabase are alive at request time. Surfaces in the Vision Board
 * Connection Status panel and the Quick Access Storyboard.
 */

import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';

export type ConnectionLevel = 'live' | 'degraded' | 'missing';

export interface ConnectionCheck {
  id: string;
  label: string;
  description: string;
  level: ConnectionLevel;
  detail: string;
  fixHint?: string;
}

interface SymlinkCheck {
  id: string;
  label: string;
  description: string;
  expectedAt: string;
  fixHint: string;
}

const PROJECT_ROOT = process.cwd();

async function symlinkExists(absPath: string): Promise<{ exists: boolean; target?: string }> {
  try {
    const link = await fs.readlink(absPath);
    return { exists: true, target: link };
  } catch {
    try {
      const stat = await fs.stat(absPath);
      // Path exists but is not a symlink — count as live but flag in detail
      return { exists: stat.isDirectory(), target: '(real directory, not symlink)' };
    } catch {
      return { exists: false };
    }
  }
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fs.stat(absPath);
    return true;
  } catch {
    return false;
  }
}

async function gitRepoStatus(absPath: string): Promise<'present' | 'missing'> {
  return (await fileExists(path.join(absPath, '.git')))
    ? 'present'
    : 'missing';
}

const SYMLINKS: SymlinkCheck[] = [
  {
    id: 'vault-bridge',
    label: 'Vision Board ↔ Brain-2 vault',
    description: 'The Vision Board reads vault content via this symlink',
    expectedAt: path.join(PROJECT_ROOT, '.claude', 'external-research', 'brain-2'),
    fixHint:
      'ln -sf ~/Synthex-Brain-2 ~/Synthex/.claude/worktrees/interesting-wilbur/.claude/external-research/brain-2',
  },
  {
    id: 'pi-ceo-bridge',
    label: 'Vision Board ↔ Pi-CEO',
    description: 'Legacy fallback path — Vision Board reads Pi-CEO directly',
    expectedAt: path.join(PROJECT_ROOT, '.claude', 'external-research', 'pi-ceo'),
    fixHint:
      'ln -sf ~/Pi-CEO/Pi-Dev-Ops ~/Synthex/.claude/worktrees/interesting-wilbur/.claude/external-research/pi-ceo',
  },
  {
    id: 'pi-ceo-to-vault',
    label: 'Pi-CEO ↔ Brain-2 (write)',
    description: 'Pi-CEO sessions write into the vault through this symlink',
    expectedAt: path.join(process.env.HOME ?? '', 'Pi-CEO', 'Pi-Dev-Ops', '_brain-2'),
    fixHint:
      'ln -sf ~/Synthex-Brain-2 ~/Pi-CEO/Pi-Dev-Ops/_brain-2',
  },
  {
    id: 'vault-to-pi-ceo',
    label: 'Brain-2 ↔ Pi-CEO (read)',
    description: 'Vault sees Pi-CEO content for Obsidian graph view',
    expectedAt: path.join(process.env.HOME ?? '', 'Synthex-Brain-2', '_pi-ceo'),
    fixHint:
      'ln -sf ~/Pi-CEO/Pi-Dev-Ops ~/Synthex-Brain-2/_pi-ceo',
  },
];

export async function getConnectionStatus(): Promise<ConnectionCheck[]> {
  const checks: ConnectionCheck[] = [];

  // 1. Symlink checks
  for (const sl of SYMLINKS) {
    const r = await symlinkExists(sl.expectedAt);
    checks.push({
      id: sl.id,
      label: sl.label,
      description: sl.description,
      level: r.exists ? 'live' : 'missing',
      detail: r.exists
        ? `→ ${r.target ?? sl.expectedAt}`
        : `expected at ${sl.expectedAt} — not found`,
      fixHint: r.exists ? undefined : sl.fixHint,
    });
  }

  // 2. Brain-2 git repo (version safety)
  const brain2GitState = await gitRepoStatus(
    path.join(process.env.HOME ?? '', 'Synthex-Brain-2')
  );
  checks.push({
    id: 'vault-git',
    label: 'Brain-2 git repo',
    description: 'Vault has version history — recoverable from accidental deletion',
    level: brain2GitState === 'present' ? 'live' : 'missing',
    detail:
      brain2GitState === 'present'
        ? 'git initialised — vault content tracked'
        : 'no .git directory — one rm -rf away from total loss',
    fixHint:
      brain2GitState === 'missing'
        ? 'cd ~/Synthex-Brain-2 && git init && git add . && git commit -m "Initial vault baseline"'
        : undefined,
  });

  // 3. Linear API key
  const linearKeyPresent = !!process.env.LINEAR_API_KEY;
  checks.push({
    id: 'linear-api',
    label: 'Linear API key',
    description: 'Required for sync-linear-decisions.ts and any Linear automation',
    level: linearKeyPresent ? 'live' : 'missing',
    detail: linearKeyPresent
      ? 'LINEAR_API_KEY set'
      : 'LINEAR_API_KEY not present in env',
    fixHint: linearKeyPresent
      ? undefined
      : 'Add LINEAR_API_KEY to .env.local (get from linear.app/settings/api)',
  });

  // 4. Linear → vault decision-log writer (script presence)
  const syncScriptExists = await fileExists(
    path.join(PROJECT_ROOT, 'scripts', 'sync-linear-decisions.ts')
  );
  checks.push({
    id: 'linear-vault-writer',
    label: 'Linear → vault decision writer',
    description: 'Mirrors Linear comments tagged [decision] into ~/Synthex-Brain-2/04-Decisions/',
    level: syncScriptExists ? (linearKeyPresent ? 'live' : 'degraded') : 'missing',
    detail: syncScriptExists
      ? linearKeyPresent
        ? 'script present + API key set — run with: npx tsx scripts/sync-linear-decisions.ts'
        : 'script present but LINEAR_API_KEY missing — cannot run'
      : 'script not present',
    fixHint: !syncScriptExists
      ? 'See Wave 9c — should be at scripts/sync-linear-decisions.ts'
      : !linearKeyPresent
        ? 'Add LINEAR_API_KEY to .env.local'
        : undefined,
  });

  // 5. Vercel AI Gateway (AI commentary endpoint)
  // Post-SYN-945: AI commentary routes through the AI Gateway with provider
  // failover (google/gemini-3.1-pro → anthropic/claude-sonnet-4.6 → openai/gpt-5.4).
  // Auth is via VERCEL_OIDC_TOKEN — no per-provider API key required.
  const oidcTokenPresent = !!process.env.VERCEL_OIDC_TOKEN;
  checks.push({
    id: 'ai-gateway',
    label: 'Vercel AI Gateway',
    description: 'AI commentary endpoint — google/gemini-3.1-pro with failover',
    level: oidcTokenPresent ? 'live' : 'degraded',
    detail: oidcTokenPresent
      ? 'VERCEL_OIDC_TOKEN set'
      : 'VERCEL_OIDC_TOKEN missing — AI commentary falls back to deterministic stub',
    fixHint: oidcTokenPresent
      ? undefined
      : 'Run: vercel env pull .env.local --yes',
  });

  // 6. ElevenLabs API key (voice rendering)
  const elevenKeyPresent = !!process.env.ELEVENLABS_API_KEY;
  checks.push({
    id: 'elevenlabs-api',
    label: 'ElevenLabs API key',
    description: 'Required for training video voiceover synthesis',
    level: elevenKeyPresent ? 'live' : 'degraded',
    detail: elevenKeyPresent
      ? 'ELEVENLABS_API_KEY set'
      : 'ELEVENLABS_API_KEY missing — Remotion renders without voiceover',
    fixHint: elevenKeyPresent
      ? undefined
      : 'Add ELEVENLABS_API_KEY to .env.local',
  });

  return checks;
}

export function summarise(checks: ConnectionCheck[]): {
  live: number;
  degraded: number;
  missing: number;
} {
  return {
    live: checks.filter(c => c.level === 'live').length,
    degraded: checks.filter(c => c.level === 'degraded').length,
    missing: checks.filter(c => c.level === 'missing').length,
  };
}
