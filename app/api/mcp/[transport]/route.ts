/**
 * MCP server — exposes the studio tool layer to external agents (Claude Code,
 * Unite-Hub, scheduled runs) over streamable HTTP. Identical quota/validation
 * paths as the UI; jobs tagged initiatedBy: 'mcp'. NO publish/spend tools —
 * v1 registers read/draft riskClass only (SYN-MCP-007, machine-enforced).
 *
 * SYN-MCP-007 (SYN-1084): registration is scope-filtered per caller key
 * (docs/agent-contract-v2.md), and tools with a contract-tested outputSchema
 * emit structuredContent alongside the text content.
 *
 * Client config (.mcp.json):
 *   { "synthex-studio": { "type": "http", "url": "https://<host>/api/mcp/mcp",
 *     "headers": { "Authorization": "Bearer <key>" } } }
 *
 * Installed: mcp-handler@1.1.0 — uses createMcpHandler (alias for
 * createMcpRouteHandler). Registration API: server.registerTool(name, config, cb)
 * where config.inputSchema is a ZodRawShapeCompat (raw shape, not z.object()).
 */
import { createMcpHandler } from 'mcp-handler';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  toolsForScopes,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';
import { resolveOrgFromBearer, McpAuthResult } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildHandler(caller: McpAuthResult) {
  return createMcpHandler(
    server => {
      // SYN-MCP-007: register ONLY tools covered by the caller key's scopes
      // ('*' = all; empty/absent scopes = zero tools — deny by default).
      // buildHandler runs per-request, so tools/list is always per-caller.
      for (const tool of toolsForScopes(caller.scopes)) {
        // The SDK's registerTool accepts a ZodRawShapeCompat (raw shape object)
        // for input/output schemas, not a full z.object(). All tool schemas are
        // z.object(...) instances so .shape gives us the raw shape.
        const rawShape = (tool.schema as z.ZodObject<z.ZodRawShape>).shape;

        // SYN-MCP-007 spike (SYN-1084): once outputSchema is declared the SDK
        // VALIDATES structuredContent at call time and throws on mismatch —
        // only tools with contract-tested output shapes declare one.
        const outputShape = tool.outputSchema
          ? (tool.outputSchema as z.ZodObject<z.ZodRawShape>).shape
          : undefined;

        server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: rawShape,
            ...(outputShape ? { outputSchema: outputShape } : {}),
          },
          async (args: Record<string, unknown>) => {
            const result = await executeStudioTool(tool.name, args, {
              userId: caller.userId,
              organizationId: caller.organizationId,
              initiatedBy: 'mcp',
              scopes: caller.scopes,
            });
            return {
              content: [
                { type: 'text' as const, text: JSON.stringify(result) },
              ],
              // Emit structuredContent alongside text only when the tool
              // declares an outputSchema (SDK validates it against the shape).
              ...(tool.outputSchema ? { structuredContent: result } : {}),
            };
          }
        );
      }
    },
    {},
    { basePath: '/api/mcp' }
  );
}

async function handle(request: NextRequest) {
  // SYN-MCP-004-1: async — hashed DB lookup with legacy env-map fallback.
  const caller = await resolveOrgFromBearer(
    request.headers.get('authorization')
  );
  if (!caller) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return buildHandler(caller)(request);
}

export { handle as GET, handle as POST, handle as DELETE };
