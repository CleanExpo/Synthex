/**
 * MCP server — exposes the studio tool layer to external agents (Claude Code,
 * Unite-Group Nexus, scheduled runs) over streamable HTTP. Identical quota/validation
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
 * Installed: mcp-handler@2.2.0 with the MCP v2 server peer.
 * The handler is mounted directly at this route; transport/basePath options
 * from 1.x are removed. Registration uses full Zod input/output schemas.
 */
import { createMcpHandler } from 'mcp-handler';
import { NextRequest } from 'next/server';
import {
  toolsForScopes,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';
import { resolveOrgFromBearer, McpAuthResult } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildHandler(caller: McpAuthResult) {
  return createMcpHandler(server => {
    // SYN-MCP-007: register ONLY tools covered by the caller key's scopes
    // ('*' = all; empty/absent scopes = zero tools — deny by default).
    // buildHandler runs per-request, so tools/list is always per-caller.
    for (const tool of toolsForScopes(caller.scopes)) {
      // MCP v2 consumes full Standard Schemas rather than raw Zod shapes.

      // SYN-MCP-007 spike (SYN-1084): once outputSchema is declared the SDK
      // VALIDATES structuredContent at call time and throws on mismatch —
      // only tools with contract-tested output shapes declare one.
      const outputSchema = tool.outputSchema;

      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.schema,
          ...(outputSchema ? { outputSchema } : {}),
        },
        async args => {
          if (
            typeof args !== 'object' ||
            args === null ||
            Array.isArray(args)
          ) {
            throw new Error('Tool arguments must be an object');
          }
          const result = await executeStudioTool(
            tool.name,
            args as Record<string, unknown>,
            {
              userId: caller.userId,
              organizationId: caller.organizationId,
              initiatedBy: 'mcp',
              scopes: caller.scopes,
            }
          );
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            // Emit structuredContent alongside text only when the tool
            // declares an outputSchema (SDK validates it against the shape).
            ...(tool.outputSchema ? { structuredContent: result } : {}),
          };
        }
      );
    }
  });
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
