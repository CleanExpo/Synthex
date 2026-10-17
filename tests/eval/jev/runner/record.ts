/**
 * JEV result recording — the contract every family test file writes through.
 *
 * A family test collects one JevResult per case and per planted-failure
 * control, then calls recordResults(family, results) once. The aggregator
 * (aggregate.mjs) reads tests/eval/jev/out/<FAMILY>.jsonl and decides the
 * verdict; the Jest exit code is not the verdict.
 */
import fs from 'fs';
import path from 'path';

export type JevState = 'PASS' | 'FAIL' | 'KNOWN_GAP' | 'INCONCLUSIVE';

export interface JevResult {
  id: string;
  family: string;
  kind: 'case' | 'control';
  /** For a control: the detector's verdict on the planted defect (FAIL = caught). */
  state: JevState;
  gap_id?: string;
  route?: string;
  detail?: string;
}

const JEV_DIR = path.join(__dirname, '..');
export const OUT_DIR = path.join(JEV_DIR, 'out');
const KNOWN_GAPS_DIR = path.join(JEV_DIR, 'known-gaps');

/** tests/eval/jev/known-gaps/<FAMILY>.json — one file per family. */
interface KnownGaps {
  schema: 'jev-known-gaps/1';
  family: string;
  /** cases: exact case ids, or id prefixes ending in `*`. */
  gaps: Record<string, { description: string; cases: string[] }>;
}

let gapIndex:
  | { exact: Map<string, string>; prefixes: [string, string][] }
  | undefined;

function loadGaps(): NonNullable<typeof gapIndex> {
  const exact = new Map<string, string>();
  const prefixes: [string, string][] = [];
  const files = fs.existsSync(KNOWN_GAPS_DIR)
    ? fs
        .readdirSync(KNOWN_GAPS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
    : [];
  for (const file of files) {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(KNOWN_GAPS_DIR, file), 'utf8')
    ) as KnownGaps;
    if (
      parsed.schema !== 'jev-known-gaps/1' ||
      `${parsed.family}.json` !== file
    ) {
      throw new Error(
        `known-gaps/${file}: needs schema jev-known-gaps/1 and family ${file.replace(/\.json$/, '')}`
      );
    }
    for (const [gapId, gap] of Object.entries(parsed.gaps)) {
      for (const id of gap.cases ?? []) {
        if (id.endsWith('*')) prefixes.push([id.slice(0, -1), gapId]);
        else exact.set(id, gapId);
      }
    }
  }
  // Longest prefix wins.
  prefixes.sort((a, b) => b[0].length - a[0].length);
  return { exact, prefixes };
}

/** The known-gap id covering this case, if any (every file in tests/eval/jev/known-gaps/). */
export function knownGap(caseId: string): string | undefined {
  gapIndex ??= loadGaps();
  return (
    gapIndex.exact.get(caseId) ??
    gapIndex.prefixes.find(([prefix]) => caseId.startsWith(prefix))?.[1]
  );
}

/**
 * Turn a script check into a case state. A failing check covered by a known
 * gap is KNOWN_GAP; a known-gap case that now passes is PASS and says so.
 */
export function classify(
  caseId: string,
  passed: boolean,
  detail?: string
): Pick<JevResult, 'state' | 'gap_id' | 'detail'> {
  const gapId = knownGap(caseId);
  if (passed) {
    return gapId
      ? { state: 'PASS', gap_id: gapId, detail: `known gap flipped: ${gapId}` }
      : { state: 'PASS', detail };
  }
  return gapId
    ? { state: 'KNOWN_GAP', gap_id: gapId, detail }
    : { state: 'FAIL', detail };
}

/** Overwrite tests/eval/jev/out/<FAMILY>.jsonl with one JSON line per result. */
export function recordResults(family: string, results: JevResult[]): void {
  for (const r of results) {
    if (r.family !== family) {
      throw new Error(
        `recordResults(${family}): result ${r.id} belongs to ${r.family}`
      );
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const body = results.map(r => JSON.stringify(r)).join('\n');
  fs.writeFileSync(
    path.join(OUT_DIR, `${family}.jsonl`),
    body ? `${body}\n` : ''
  );
}
