#!/usr/bin/env node
/**
 * scripts/mcp/check-tools.mjs [--control]
 * P5 / M11: every tool the MCP route can register (app/api/mcp/[transport]/route.ts registers
 * toolsForScopes(caller.scopes)) declares an outputSchema that converts to a JSON Schema with an
 * object root, as tools/list does (SDK: toJSONSchema io 'output'); the SDK validates
 * structuredContent against it at call time.
 *   exit 0  every registrable tool has one (prints the count)
 *   exit 1  names each tool without one
 *   exit 2  INCONCLUSIVE: the registry could not be loaded (never reported as 0)
 * --control plants a tool without outputSchema next to the real registry and exits 0 only when
 * the same check names it (K5, scripts/fleet/README.md).
 */
import { tsImport } from 'tsx/esm/api';
import { z } from 'zod';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// fileURLToPath decodes %20, so the registry loads from a repo path containing spaces.
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const REGISTRY = path.join(ROOT, 'lib/services/ai/studio-tools/index.ts');

/** Names of tools whose outputSchema is absent or does not convert to an object JSON Schema. */
export function missingOutputSchema(tools) {
  return tools
    .filter(t => {
      if (!t.outputSchema) return true;
      try {
        return (
          z.toJSONSchema(t.outputSchema, { io: 'output' }).type !== 'object'
        );
      } catch {
        return true;
      }
    })
    .map(t => t.name);
}

/** Every tool the route can register: all scopes the registry knows, plus the wildcard. */
async function registrableTools() {
  const mod = await tsImport(pathToFileURL(REGISTRY).href, import.meta.url);
  const reg = mod.toolsForScopes ? mod : mod.default;
  if (
    typeof reg?.toolsForScopes !== 'function' ||
    !Array.isArray(reg.ALL_MCP_TOOLS)
  )
    throw new Error(
      'registry does not export toolsForScopes and ALL_MCP_TOOLS'
    );
  const scopes = ['*', ...new Set(reg.ALL_MCP_TOOLS.map(t => t.scope))];
  const tools = reg.toolsForScopes(scopes);
  if (tools.length === 0)
    throw new Error('registry yielded zero tools for every scope');
  return tools;
}

let tools;
try {
  tools = await registrableTools();
} catch (err) {
  console.log(
    `INCONCLUSIVE check-tools: registry not loaded: ${err?.message ?? err}`
  );
  process.exit(2);
}

if (process.argv.includes('--control')) {
  const planted = {
    name: 'planted_tool_without_output_schema',
    scope: 'creative',
  };
  const caught = missingOutputSchema([...tools, planted]).includes(
    planted.name
  );
  console.log(
    `${caught ? 'PASS' : 'FAIL'} check-tools control: planted tool without outputSchema ${caught ? 'caught' : 'NOT caught'}`
  );
  process.exit(caught ? 0 : 1);
}

const missing = missingOutputSchema(tools);
if (missing.length) {
  console.log(
    `FAIL check-tools: ${missing.length} of ${tools.length} tools lack an outputSchema with an object JSON Schema:`
  );
  for (const n of missing) console.log(`  - ${n}`);
  process.exit(1);
}
console.log(
  `PASS check-tools: all ${tools.length} registrable MCP tools declare an outputSchema`
);
process.exit(0);
