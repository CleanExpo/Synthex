/**
 * Sweep result sink and run settings.
 *
 * A sweep row is a JevResult (runner/record.ts) plus the goal it measures and
 * the criterion it checks. Rows go to <SWEEP_OUT_DIR>/<goal>.jsonl; run.mjs
 * aggregates them. recordResults() is hardwired to out/<FAMILY>.jsonl (the
 * hard-gate families), so the sweep keeps its own sink with the same shape.
 */
import fs from 'fs';
import path from 'path';
import type { JevResult, JevState } from '../../runner/record';

export type Goal = 'G1' | 'G2' | 'G3' | 'G4' | 'G5';

export interface SweepRow extends JevResult {
  goal: Goal;
  /** Criterion id, e.g. G1.C1a. Controls name the criterion they plant against. */
  criterion: string;
}

export const SWEEP = {
  outDir: process.env.SWEEP_OUT_DIR ?? path.join(__dirname, '../../out/sweep'),
  seed: Number(process.env.SWEEP_SEED ?? 20261022),
  /** Run date (YYYY-MM-DD). Defaults to the run's UTC date. */
  asOf: process.env.SWEEP_AS_OF ?? new Date().toLocaleDateString('en-CA'),
  /** Control ids whose planted defect is NOT planted (self-test of the run). */
  disarmed: new Set(
    (process.env.SWEEP_DISARM ?? '').split(',').filter(Boolean)
  ),
};

/** Collects rows for one goal and writes them once. Duplicate ids throw. */
export class Sink {
  readonly rows: SweepRow[] = [];
  private ids = new Set<string>();
  private n: number;
  /**
   * `part` names a second file for the same goal (<goal>.<part>.jsonl) when a
   * goal needs a different boundary mock; `idOffset` keeps its ids distinct.
   */
  constructor(
    readonly goal: Goal,
    readonly part?: string,
    idOffset = 0
  ) {
    this.n = idOffset;
  }

  /** Next case id, e.g. G1-000123. */
  nextId(): string {
    this.n += 1;
    return `${this.goal}-${String(this.n).padStart(6, '0')}`;
  }

  add(row: Omit<SweepRow, 'family' | 'goal'>): void {
    const key = `${row.kind}:${row.id}`;
    if (this.ids.has(key)) throw new Error(`duplicate sweep row ${key}`);
    this.ids.add(key);
    this.rows.push({ ...row, family: this.goal, goal: this.goal });
  }

  /** A case whose verdict is `passed`; a harness failure is INCONCLUSIVE. */
  verdict(
    criterion: string,
    passed: boolean | null,
    detail: string,
    route?: string
  ): void {
    const state: JevState =
      passed === null ? 'INCONCLUSIVE' : passed ? 'PASS' : 'FAIL';
    this.add({
      id: this.nextId(),
      kind: 'case',
      criterion,
      state,
      detail,
      route,
    });
  }

  /**
   * A planted control. `caught` is the detector's verdict on the mutant:
   * true = the detector saw the defect (state FAIL, good). A disarmed control
   * ran without its mutant, so a sound detector reports PASS and the run is
   * BROKEN_CHECK.
   */
  control(
    id: string,
    criterion: string,
    caught: boolean | null,
    detail: string
  ): void {
    const state: JevState =
      caught === null ? 'INCONCLUSIVE' : caught ? 'FAIL' : 'PASS';
    this.add({
      id,
      kind: 'control',
      criterion,
      state,
      detail: `${SWEEP.disarmed.has(id) ? '[disarmed] ' : ''}planted defect ${
        caught ? 'caught' : 'NOT caught'
      }: ${detail}`,
    });
  }

  write(): void {
    fs.mkdirSync(SWEEP.outDir, { recursive: true });
    const body = this.rows.map(r => JSON.stringify(r)).join('\n');
    fs.writeFileSync(
      path.join(
        SWEEP.outDir,
        `${this.goal}${this.part ? `.${this.part}` : ''}.jsonl`
      ),
      body ? `${body}\n` : ''
    );
  }
}

/** True when this control must run WITHOUT its planted defect. */
export const disarmed = (id: string) => SWEEP.disarmed.has(id);

/** Seeded PRNG (mulberry32): same seed, same sequence, no Math.random. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

/** Silence console for the run: 100k log lines dominate the runtime. */
export function quietConsole(): void {
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
}

/** Cut the network: any fetch rejects. A case that needs it is INCONCLUSIVE. */
export function cutNetwork(): void {
  global.fetch = (() =>
    Promise.reject(
      new Error('sweep: network disabled')
    )) as unknown as typeof fetch;
}
