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
const KNOWN_GAPS_FILE = path.join(JEV_DIR, 'known-gaps.json');

interface KnownGaps {
  schema: 'jev-known-gaps/1';
  gaps: Record<string, { cases: string[]; note?: string }>;
}

let gapIndex: Map<string, string> | undefined;

/** The known-gap id that covers this case, if any (tests/eval/jev/known-gaps.json). */
export function knownGap(caseId: string): string | undefined {
  if (!gapIndex) {
    const parsed = JSON.parse(
      fs.readFileSync(KNOWN_GAPS_FILE, 'utf8')
    ) as KnownGaps;
    if (parsed.schema !== 'jev-known-gaps/1') {
      throw new Error(
        `known-gaps.json: unexpected schema ${String(parsed.schema)}`
      );
    }
    gapIndex = new Map();
    for (const [gapId, gap] of Object.entries(parsed.gaps)) {
      for (const id of gap.cases ?? []) gapIndex.set(id, gapId);
    }
  }
  return gapIndex.get(caseId);
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
