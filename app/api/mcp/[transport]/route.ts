/**
 * MCP server — exposes the studio tool layer to external agents (Claude Code,
 * Unite-Hub, scheduled runs) over streamable HTTP. Identical quota/validation
 * paths as the UI; jobs tagged initiatedBy: 'mcp'. NO publish tools (phase 1).
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
  STUDIO_TOOLS,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';
import { resolveOrgFromBearer, McpCaller } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildHandler(caller: McpCaller) {
  return createMcpHandler(
    server => {
      for (const tool of STUDIO_TOOLS) {
        // The SDK's registerTool accepts a ZodRawShapeCompat (raw shape object)
        // for inputSchema, not a full z.object(). All STUDIO_TOOLS schemas are
        // z.object(...) instances so .shape gives us the raw shape.
        const rawShape = (tool.schema as z.ZodObject<z.ZodRawShape>).shape;

        server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: rawShape,
          },
          async (args: Record<string, unknown>) => {
            const result = await executeStudioTool(tool.name, args, {
              userId: caller.userId,
              organizationId: caller.organizationId,
              initiatedBy: 'mcp',
            });
            return {
              content: [
                { type: 'text' as const, text: JSON.stringify(result) },
              ],
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
  const caller = resolveOrgFromBearer(request.headers.get('authorization'));
  if (!caller) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
    });
  }
  return buildHandler(caller)(request);
}

export { handle as GET, handle as POST, handle as DELETE };
