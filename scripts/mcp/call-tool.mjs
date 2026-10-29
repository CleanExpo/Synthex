#!/usr/bin/env node
/**
 * scripts/mcp/call-tool.mjs --tool <name> --org <orgId> [--args '<json>'] [--expect-count N] [--control]
 * P6 definition of done: calls one registered MCP tool the way the route does and checks its output.
 *   exit 0  PASS
 *   exit 1  FAIL, naming the mismatch
 *   exit 2  INCONCLUSIVE: registry, writer or in-memory hook could not load (never reported as 0)
 * Mode: with DATABASE_URL unset, no database is touched. A node:module hook swaps lib/prisma for
 * scripts/mcp/prisma-memory.mjs and `--org synthetic` seeds through the real recordLocalOutcome
 * writer (three calls + one booking at loc-synthetic-1, each call replayed, plus a bystander org).
 * With DATABASE_URL set the tool runs read-only against that database, no seeding.
 * --control writes one replayed call twice through recordMarketingAgencyOutcome (bypassing the
 * writer's dedupe) and exits 0 only when the count check reports 5 != 4 (K5, scripts/fleet/README.md).
 */
import { tsImport } from 'tsx/esm/api';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const lib = p => pathToFileURL(path.join(ROOT, p)).href;
const LOCATION = 'loc-synthetic-1';
const BYSTANDER = 'synthetic-bystander';

const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const opt = n => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const inconclusive = msg => {
  console.log(`INCONCLUSIVE call-tool: ${msg}`);
  process.exit(2);
};

const toolName = opt('tool');
const org = opt('org');
if (!toolName || !org)
  inconclusive(
    'usage: --tool <name> --org <orgId> [--args json] [--expect-count N] [--control]'
  );
let args = {};
try {
  args = opt('args') ? JSON.parse(opt('args')) : {};
} catch (err) {
  inconclusive(`--args is not valid JSON: ${err.message}`);
}
const expectRaw = opt('expect-count');
const expectCount = expectRaw === undefined ? undefined : Number(expectRaw);
if (expectRaw !== undefined && !Number.isInteger(expectCount))
  inconclusive('--expect-count must be an integer');

const memory = !process.env.DATABASE_URL;
const seed = memory && org === 'synthetic';
console.log(
  memory
    ? `mode: in-memory (DATABASE_URL unset, no database touched)${seed ? ', seeded through recordLocalOutcome' : ', unseeded'}`
    : 'mode: database (DATABASE_URL set, read-only, no seeding)'
);
if (flag('control') && !seed)
  inconclusive(
    '--control needs the in-memory synthetic mode (DATABASE_URL unset, --org synthetic)'
  );

let tool, writer, persistence;
try {
  if (memory)
    (
      await import(lib('scripts/mcp/prisma-memory-hook.mjs'))
    ).installPrismaMemoryHook();
  const reg = await tsImport(
    lib('lib/services/ai/studio-tools/index.ts'),
    import.meta.url
  );
  const r = reg.toolsForScopes ? reg : reg.default;
  tool = r.toolsForScopes(['*']).find(t => t.name === toolName);
  if (!tool) throw new Error(`tool ${toolName} not in toolsForScopes(['*'])`);
  if (seed) {
    writer = await tsImport(
      lib('lib/marketing-agency/outcomes/local-outcome-writer.ts'),
      import.meta.url
    );
    persistence = await tsImport(
      lib('lib/marketing-agency/intelligence/signal-persistence.ts'),
      import.meta.url
    );
    const w = writer.recordLocalOutcome ? writer : writer.default;
    writer = w;
    persistence = persistence.recordMarketingAgencyOutcome
      ? persistence
      : persistence.default;
    if (
      typeof writer?.recordLocalOutcome !== 'function' ||
      typeof persistence?.recordMarketingAgencyOutcome !== 'function'
    )
      throw new Error('writer or persistence module lacks its export');
  }
} catch (err) {
  inconclusive(`${err?.message ?? err}`);
}

async function seedSynthetic() {
  const base = {
    organizationId: org,
    locationId: LOCATION,
    source: 'call-tool-seed',
  };
  for (const key of ['call-1', 'call-2', 'call-3']) {
    for (let replay = 0; replay < 2; replay++)
      await writer.recordLocalOutcome({
        ...base,
        kind: 'call',
        dedupeKey: key,
      });
  }
  await writer.recordLocalOutcome({
    ...base,
    kind: 'booking',
    dedupeKey: 'booking-1',
  });
  await writer.recordLocalOutcome({
    ...base,
    organizationId: BYSTANDER,
    kind: 'call',
    dedupeKey: 'bystander-1',
  });
  if (flag('control')) {
    // Bypass the writer's dedupe: same signal, same eventType, recorded a second time.
    await persistence.recordMarketingAgencyOutcome({
      organizationId: org,
      signalExternalId: 'local-outcome:call:call-1',
      eventType: 'local_call',
      metadata: { locationId: LOCATION },
    });
  }
}

/** Mismatch descriptions; empty means the output is as expected. */
function check(events) {
  const bad = [];
  if (expectCount !== undefined && events.length !== expectCount)
    bad.push(`count ${events.length} != ${expectCount}`);
  if (seed) {
    const wrong = events.filter(e => e.locationId !== LOCATION).length;
    if (wrong) bad.push(`${wrong} event(s) without locationId ${LOCATION}`);
    const n = t => events.filter(e => e.eventType === t).length;
    if (n('local_call') !== 3 || n('local_booking') !== 1)
      bad.push(
        `eventTypes local_call=${n('local_call')} local_booking=${n('local_booking')} (want 3 and 1)`
      );
    const leaked = events.filter(e =>
      JSON.stringify(e.metadata ?? {}).includes('bystander')
    ).length;
    if (leaked) bad.push(`${leaked} event(s) from the bystander org`);
  }
  return bad;
}

let events;
try {
  if (seed) await seedSynthetic();
  const out = await tool.execute(args, {
    userId: 'call-tool',
    organizationId: org,
    initiatedBy: 'mcp',
  });
  events = out?.events;
  if (!Array.isArray(events)) {
    if (expectCount === undefined) {
      console.log(`PASS call-tool: ${toolName} ran for org ${org}`);
      console.log(JSON.stringify(out));
      process.exit(0);
    }
    inconclusive(`${toolName} returned no events array to count`);
  }
} catch (err) {
  if (!memory) {
    console.log(`FAIL call-tool: ${toolName} threw: ${err?.message ?? err}`);
    process.exit(1);
  }
  inconclusive(`seed or execute threw: ${err?.message ?? err}`);
}

const bad = check(events);
if (flag('control')) {
  const caught = bad.some(b => b.startsWith('count 5 != 4'));
  console.log(
    `${caught ? 'PASS' : 'FAIL'} call-tool control: replayed call without dedupe ${caught ? `caught (${bad[0]})` : `NOT caught (${bad.join('; ') || 'no mismatch'})`}`
  );
  process.exit(caught ? 0 : 1);
}
if (bad.length) {
  console.log(`FAIL call-tool: ${bad.join('; ')}`);
  process.exit(1);
}
console.log(`PASS call-tool: ${toolName} org ${org}: ${events.length} events`);
process.exit(0);
