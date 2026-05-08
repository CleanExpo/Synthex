/**
 * Server-side reader for Vision Board artefacts.
 *
 * **Source-of-truth ordering** (per Brain-2 connection map):
 *   1. Synthex-Brain-2 vault          — `02-Projects/RA-2026-05-AppStore-Launch/`
 *   2. Pi-CEO marketing-studio        — `marketing-studio/.research/` (legacy fallback)
 *
 * The Brain-2 vault is the new portfolio operations brain (created 2026-05-08).
 * Pi-CEO writes into the vault via the `_brain-2` symlink. The Vision Board
 * reads from the vault via the `brain-2` symlink. The legacy Pi-CEO direct read
 * stays as a fallback in case Pi-CEO writes directly to its old paths.
 */

import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import type { WaveState } from './types';

const PROJECT_ROOT = path.resolve(process.cwd());

const VAULT_PROJECT_ROOT = path.join(
  PROJECT_ROOT,
  '.claude',
  'external-research',
  'brain-2',
  '02-Projects',
  'RA-2026-05-AppStore-Launch'
);

const PI_CEO_RESEARCH_ROOT = path.join(
  PROJECT_ROOT,
  '.claude',
  'external-research',
  'pi-ceo',
  'marketing-studio',
  '.research'
);

async function safeRead(roots: string[], relPath: string): Promise<{ content: string; rootUsed: string } | null> {
  for (const root of roots) {
    try {
      const abs = path.join(root, relPath);
      const content = await fs.readFile(abs, 'utf-8');
      return { content, rootUsed: root };
    } catch {
      // try next
    }
  }
  return null;
}

async function safeStat(absPath: string): Promise<Date | null> {
  try {
    const stat = await fs.stat(absPath);
    return stat.mtime;
  } catch {
    return null;
  }
}

interface ReadResult {
  markdown: string;
  updatedAt: Date;
  source: 'vault' | 'pi-ceo' | 'unknown';
}

function classifySource(rootUsed: string): ReadResult['source'] {
  if (rootUsed === VAULT_PROJECT_ROOT) return 'vault';
  if (rootUsed === PI_CEO_RESEARCH_ROOT) return 'pi-ceo';
  return 'unknown';
}

export async function readPositioning(): Promise<ReadResult | null> {
  const result = await safeRead(
    [path.join(VAULT_PROJECT_ROOT, 'research'), PI_CEO_RESEARCH_ROOT],
    'positioning.md'
  );
  if (!result) {
    // Try the legacy Pi-CEO file naming
    const legacy = await safeRead([PI_CEO_RESEARCH_ROOT], 'positioning/ra-2026-05.md');
    if (!legacy) return null;
    const updatedAt = await safeStat(path.join(legacy.rootUsed, 'positioning/ra-2026-05.md'));
    return { markdown: legacy.content, updatedAt: updatedAt ?? new Date(0), source: 'pi-ceo' };
  }
  const filePath = path.join(result.rootUsed, 'positioning.md');
  const updatedAt = await safeStat(filePath);
  return { markdown: result.content, updatedAt: updatedAt ?? new Date(0), source: classifySource(result.rootUsed) };
}

export async function readICP(): Promise<ReadResult | null> {
  const result = await safeRead(
    [path.join(VAULT_PROJECT_ROOT, 'research'), PI_CEO_RESEARCH_ROOT],
    'icp.md'
  );
  if (!result) {
    const legacy = await safeRead([PI_CEO_RESEARCH_ROOT], 'icp/ra-2026-05.md');
    if (!legacy) return null;
    const updatedAt = await safeStat(path.join(legacy.rootUsed, 'icp/ra-2026-05.md'));
    return { markdown: legacy.content, updatedAt: updatedAt ?? new Date(0), source: 'pi-ceo' };
  }
  const filePath = path.join(result.rootUsed, 'icp.md');
  const updatedAt = await safeStat(filePath);
  return { markdown: result.content, updatedAt: updatedAt ?? new Date(0), source: classifySource(result.rootUsed) };
}

export async function readChannelPlan(): Promise<unknown | null> {
  const result = await safeRead(
    [path.join(VAULT_PROJECT_ROOT, 'research'), PI_CEO_RESEARCH_ROOT],
    'channel-plan.json'
  );
  if (!result) return null;
  try {
    return JSON.parse(result.content);
  } catch {
    return null;
  }
}

export async function readRunbook(): Promise<unknown | null> {
  // Runbook lives at the project root in the vault, not under research/
  const result = await safeRead(
    [VAULT_PROJECT_ROOT, PI_CEO_RESEARCH_ROOT],
    'runbook.json'
  );
  if (!result) return null;
  try {
    return JSON.parse(result.content);
  } catch {
    return null;
  }
}

export async function getWaveStates(): Promise<WaveState[]> {
  const positioning = await readPositioning();
  const icp = await readICP();
  const channelPlan = await readChannelPlan();
  const runbook = await readRunbook();

  return [
    { wave: 0, status: 'ready', note: 'Vision Board shell + Brain-2 vault' },
    {
      wave: 1,
      status: positioning && icp ? 'ready' : 'pending',
      artefactPath: 'research/positioning.md + research/icp.md (in Brain-2 vault)',
      lastUpdated: positioning?.updatedAt.toISOString(),
      note:
        positioning && icp
          ? `Source: ${positioning.source}`
          : 'Pi-CEO writes here. Awaiting Wave 1 spawn-task approval.',
    },
    {
      wave: 2,
      status: channelPlan ? 'ready' : 'pending',
      artefactPath: 'research/channel-plan.json',
      note: 'Channel plan + UTM scheme + KPI dashboard.',
    },
    {
      wave: 3,
      status: 'pending',
      note: 'Insurer landing copy + 5 emails + 12 LinkedIn pieces.',
    },
    {
      wave: 4,
      status: runbook ? 'ready' : 'pending',
      note: 'NIR explainer MP4 + T+0→T+30 runbook + UTM dashboard.',
    },
  ];
}

export interface BridgeStatus {
  vault: boolean;
  piCeo: boolean;
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  const [vault, piCeo] = await Promise.all([
    fs.stat(VAULT_PROJECT_ROOT).then(() => true).catch(() => false),
    fs.stat(PI_CEO_RESEARCH_ROOT).then(() => true).catch(() => false),
  ]);
  return { vault, piCeo };
}

// Backward-compat shim — old name still used by page.tsx; routes through getBridgeStatus.
export async function isPiCeoBridgeAvailable(): Promise<boolean> {
  const s = await getBridgeStatus();
  return s.vault || s.piCeo;
}
