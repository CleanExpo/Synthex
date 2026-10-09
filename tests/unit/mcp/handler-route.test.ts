/** @jest-environment node */
/** Real MCP v2 transport with auth/tools mocked: no provider or database calls. */
import { z } from 'zod';

jest.mock('@/app/api/mcp/auth', () => ({
  resolveOrgFromBearer: jest.fn(),
}));
jest.mock('@/lib/services/ai/studio-tools', () => ({
  toolsForScopes: jest.fn(),
  executeStudioTool: jest.fn(),
}));

import { resolveOrgFromBearer } from '@/app/api/mcp/auth';
import {
  toolsForScopes,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';
import { POST } from '@/app/api/mcp/[transport]/route';
import { NextRequest } from 'next/server';

const caller = {
  userId: 'user-fixture',
  organizationId: 'org-fixture',
  scopes: ['context'],
};
const tool = {
  name: 'context_fixture',
  description: 'Fixture tool',
  schema: z.object({ key: z.string() }),
  outputSchema: z.object({ value: z.string() }),
};
const request = (method: string, params?: unknown) =>
  new NextRequest('http://localhost/api/mcp/mcp', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer fixture-key',
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      ...(params ? { params } : {}),
    }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  (resolveOrgFromBearer as jest.Mock).mockResolvedValue(caller);
  (toolsForScopes as jest.Mock).mockReturnValue([tool]);
  (executeStudioTool as jest.Mock).mockResolvedValue({ value: 'fixture' });
});

it('rejects unauthenticated callers before registering tools', async () => {
  (resolveOrgFromBearer as jest.Mock).mockResolvedValue(null);
  const response = await POST(request('tools/list'));
  expect(response.status).toBe(401);
  expect(toolsForScopes).not.toHaveBeenCalled();
  expect(executeStudioTool).not.toHaveBeenCalled();
});

it('lists full input and output schemas at the existing client URL', async () => {
  const response = await POST(request('tools/list'));
  expect(response.status).toBe(200);
  const frame = (await response.text())
    .split('\n')
    .find(line => line.startsWith('data: '));
  expect(frame).toBeDefined();
  const body = JSON.parse(frame!.slice('data: '.length));
  expect(body.result.tools).toHaveLength(1);
  expect(body.result.tools[0]).toMatchObject({
    name: 'context_fixture',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { value: { type: 'string' } } },
  });
  expect(toolsForScopes).toHaveBeenCalledWith(['context']);
});

it('retains per-caller scope and structured results for tool calls', async () => {
  const response = await POST(
    request('tools/call', { name: tool.name, arguments: { key: 'fixture' } })
  );
  expect(response.status).toBe(200);
  const frame = (await response.text())
    .split('\n')
    .find(line => line.startsWith('data: '));
  expect(frame).toBeDefined();
  const body = JSON.parse(frame!.slice('data: '.length));
  expect(body.result.structuredContent).toEqual({ value: 'fixture' });
  expect(executeStudioTool).toHaveBeenCalledWith(
    tool.name,
    { key: 'fixture' },
    {
      userId: caller.userId,
      organizationId: caller.organizationId,
      scopes: ['context'],
      initiatedBy: 'mcp',
    }
  );
});
