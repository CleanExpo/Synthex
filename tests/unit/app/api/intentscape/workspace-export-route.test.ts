import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

function mockResponse(body: unknown, status = 200): NextResponse {
  return {
    status,
    headers: new Headers(),
    json: async () => body,
  } as unknown as NextResponse;
}

const mockAuthenticate = jest.fn();
const mockErrorResponse = jest.fn();
const mockExportWorkspace = jest.fn();
const mockCreateRuntime = jest.fn();

jest.mock('@/lib/intentscape/api', () => ({
  authenticateIntentScapeRequest: (...args: unknown[]) =>
    mockAuthenticate(...args),
  intentScapeErrorResponse: (...args: unknown[]) => mockErrorResponse(...args),
}));

jest.mock('@/lib/intentscape/runtime', () => ({
  createIntentScapeRuntime: (...args: unknown[]) => mockCreateRuntime(...args),
  IntentScapeWorkspaceIdSchema: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/),
}));

import { GET } from '@/app/api/intentscape/workspaces/[id]/export/route';

function request() {
  return {
    url: 'http://localhost/api/intentscape/workspaces/workspace-1/export',
    method: 'GET',
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('/api/intentscape/workspaces/[id]/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRuntime.mockReturnValue({
      exportWorkspace: mockExportWorkspace,
    });
    mockErrorResponse.mockImplementation(() =>
      mockResponse({ error: 'mapped' }, 500)
    );
  });

  it('stops before export when authentication fails', async () => {
    const denied = mockResponse({ error: 'Authentication required' }, 401);
    mockAuthenticate.mockResolvedValue({ allowed: false, response: denied });

    const response = await GET(request(), {
      params: Promise.resolve({ id: 'workspace-1' }),
    });

    expect(response.status).toBe(401);
    expect(mockCreateRuntime).not.toHaveBeenCalled();
    expect(mockExportWorkspace).not.toHaveBeenCalled();
  });

  it('returns the private Markdown bundle with download hardening', async () => {
    const auth = {
      allowed: true,
      userId: 'user-1',
      organizationId: 'org-1',
    };
    mockAuthenticate.mockResolvedValue(auth);
    mockExportWorkspace.mockResolvedValue({
      filename: 'intentscape-workspace-1.md',
      markdown: '# Private IntentScape wiki\n',
    });

    const response = await GET(request(), {
      params: Promise.resolve({ id: 'workspace-1' }),
    });

    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET' }),
      'read'
    );
    expect(mockCreateRuntime).toHaveBeenCalledWith(auth);
    expect(mockExportWorkspace).toHaveBeenCalledWith('workspace-1');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/markdown');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="intentscape-workspace-1.md"'
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(response.text()).resolves.toBe('# Private IntentScape wiki\n');
  });
});
