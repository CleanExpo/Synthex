/**
 * J4 Gap probes, script part (spec: "JEV test harness", family table row J4).
 *
 * 50 confirmed gaps from "Ranked gaps, M1 to M14" (tests/eval/jev/cases/J4/probes.json,
 * each with its spec line) x 4 deterministic probes = 200 cases:
 *   exists, rest (route present and authenticated), mcp (tool in the registry
 *   source), typed (route response schema or tool outputSchema).
 * Receipt and idempotent probes and the 100 model-pair cases are reserved by
 * the spec for later and are not built here.
 *
 * Controls: three planted capabilities written to a temp fixture tree.
 * ALPHA is complete and must pass all four probes (else every control is
 * recorded not-caught, so the family is BROKEN_CHECK); BETA has no route and
 * GAMMA has no output schema, and the same detectors must catch both.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { classify, recordResults, type JevResult } from '../runner/record';
import {
  runProbe,
  type Gap,
  type ProbeConfig,
  type ProbeKind,
} from './j4/probes';

const FAMILY = 'J4';
const ROOT = path.join(__dirname, '../../../..');
const doc = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../cases/J4/probes.json'), 'utf8')
) as ProbeConfig & { probe_kinds: ProbeKind[]; gaps: Gap[] };

const results: JevResult[] = [];
afterAll(() => recordResults(FAMILY, results));

it('J4 gap probes against the repo', () => {
  for (const gap of doc.gaps) {
    for (const kind of doc.probe_kinds) {
      const id = `J4-${gap.slug}-${kind}`;
      try {
        const v = runProbe(ROOT, doc, gap, kind);
        results.push({
          id,
          family: FAMILY,
          kind: 'case',
          ...classify(id, v.passed, `${gap.m} ${kind}: ${v.detail}`),
        });
      } catch (err) {
        results.push({
          id,
          family: FAMILY,
          kind: 'case',
          state: 'INCONCLUSIVE',
          detail: `probe threw: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }
  expect(results.filter(r => r.kind === 'case')).toHaveLength(200);
});

// ── Positive controls ────────────────────────────────────────────────────────
const AUTHED_ROUTE = (
  schema: boolean
) => `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
${schema ? 'const FixtureResponseSchema = z.object({ ok: z.boolean() });\n' : ''}
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(${schema ? 'FixtureResponseSchema.parse({ ok: true })' : '{ ok: true }'});
}
`;
const tool = (name: string, schema: boolean) => `  {
    name: '${name}',
    description: 'planted fixture tool',
    scope: 'context',
    riskClass: 'read',
    costClass: 'free',
    schema: z.object({}),
${schema ? '    outputSchema: z.object({ ok: z.boolean() }),\n' : ''}    execute: async () => ({ ok: true }),
  },`;
const FIXTURE: Record<string, string> = {
  'lib/fixture/alpha.ts':
    'export function alphaCapability() {\n  return 1;\n}\n',
  'lib/fixture/beta.ts': 'export function betaCapability() {\n  return 1;\n}\n',
  'lib/fixture/gamma.ts':
    'export function gammaCapability() {\n  return 1;\n}\n',
  'app/api/fixture-alpha/route.ts': AUTHED_ROUTE(true),
  // BETA: deliberately no route.
  'app/api/fixture-gamma/route.ts': AUTHED_ROUTE(false),
  [`${doc.mcp_registry_dir}/fixture-tools.ts`]: `import { z } from 'zod';\nexport const FIXTURE_TOOLS = [\n${tool('fixture_alpha_read', true)}\n${tool('fixture_beta_read', true)}\n${tool('fixture_gamma_read', false)}\n];\n`,
};
const plant = (name: string): Gap => ({
  slug: `ctrl-${name}`,
  m: 'CTRL',
  spec_line: 'planted fixture',
  capability: `planted ${name}`,
  exists: { files: [`lib/fixture/${name}.ts`], symbol: `^${name}Capability$` },
  rest: { route: `^/api/fixture-${name}$` },
  mcp: { tool: `^fixture_${name}_read$` },
});

it('J4 positive controls on planted capabilities', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-j4-'));
  try {
    for (const [file, body] of Object.entries(FIXTURE)) {
      fs.mkdirSync(path.dirname(path.join(fixtureRoot, file)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(fixtureRoot, file), body);
    }
    const alpha = plant('alpha');
    const alphaMisses = doc.probe_kinds
      .map(k => [k, runProbe(fixtureRoot, doc, alpha, k)] as const)
      .filter(([, v]) => !v.passed)
      .map(([k, v]) => `${k}: ${v.detail}`);

    const beta = plant('beta');
    const gamma = plant('gamma');
    const controls: [string, Gap, ProbeKind, Gap['typed']?][] = [
      ['J4-CTRL-beta-missing-route-rest', beta, 'rest'],
      [
        'J4-CTRL-beta-missing-route-typed',
        beta,
        'typed',
        { route: beta.rest.route },
      ],
      [
        'J4-CTRL-gamma-missing-schema-typed-tool',
        gamma,
        'typed',
        { tool: gamma.mcp.tool },
      ],
      [
        'J4-CTRL-gamma-missing-schema-typed-route',
        gamma,
        'typed',
        { route: gamma.rest.route },
      ],
    ];
    for (const [id, gap, kind, typed] of controls) {
      const v = runProbe(
        fixtureRoot,
        doc,
        typed ? { ...gap, typed } : gap,
        kind
      );
      // A detector that false-fails the complete plant proves nothing by failing here.
      const caught = !v.passed && alphaMisses.length === 0;
      results.push({
        id,
        family: FAMILY,
        kind: 'control',
        state: caught ? 'FAIL' : 'PASS',
        detail: alphaMisses.length
          ? `detector false-fails complete plant ALPHA (${alphaMisses.join('; ')})`
          : `${caught ? 'caught' : 'NOT caught'}: ${v.detail}`,
      });
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
