import type { NextRequest, NextResponse } from 'next/server';

function mockResponse(body: unknown, status = 200): NextResponse {
  return {
    status,
    headers: new Headers(),
    json: async () => body,
  } as unknown as NextResponse;
}

const mockAuthenticate = jest.fn();
const mockParseJsonBody = jest.fn();
const mockErrorResponse = jest.fn();
const mockListWorkspaces = jest.fn();
const mockCreateWorkspace = jest.fn();
const mockCreateRuntime = jest.fn();

jest.mock('@/lib/intentscape/api', () => ({
  authenticateIntentScapeRequest: (...args: unknown[]) =>
    mockAuthenticate(...args),
  parseJsonBody: (...args: unknown[]) => mockParseJsonBody(...args),
  intentScapeErrorResponse: (...args: unknown[]) => mockErrorResponse(...args),
}));

jest.mock('@/lib/intentscape/runtime', () => ({
  createIntentScapeRuntime: (...args: unknown[]) => mockCreateRuntime(...args),
}));

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    createSecureResponse: (body: unknown, status = 200) =>
      mockResponse(body, status),
  },
}));

import { GET, POST } from '@/app/api/intentscape/workspaces/route';

function request(method: 'GET' | 'POST') {
  return {
    url: 'http://localhost/api/intentscape/workspaces',
    method,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as NextRequest;
}

describe('/api/intentscape/workspaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRuntime.mockReturnValue({
      listWorkspaces: mockListWorkspaces,
      createWorkspace: mockCreateWorkspace,
    });
    mockErrorResponse.mockImplementation(() =>
      mockResponse({ error: 'mapped' }, 500)
    );
  });

  it('stops before runtime creation when authentication fails', async () => {
    const denied = mockResponse({ error: 'Authentication required' }, 401);
    mockAuthenticate.mockResolvedValue({ allowed: false, response: denied });

    const response = await GET(request('GET'));

    expect(response.status).toBe(401);
    expect(mockCreateRuntime).not.toHaveBeenCalled();
  });

  it('lists only through the server-derived organisation runtime', async () => {
    const auth = {
      allowed: true,
      userId: 'user-1',
      organizationId: 'org-1',
    };
    mockAuthenticate.mockResolvedValue(auth);
    mockListWorkspaces.mockResolvedValue([{ id: 'workspace-1' }]);

    const response = await GET(request('GET'));

    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET' }),
      'read'
    );
    expect(mockCreateRuntime).toHaveBeenCalledWith(auth);
    await expect(response.json()).resolves.toEqual({
      workspaces: [{ id: 'workspace-1' }],
    });
  });

  it('creates through the server-derived user and organisation runtime', async () => {
    const auth = {
      allowed: true,
      userId: 'user-1',
      organizationId: 'org-1',
    };
    const body = {
      title: 'Explore the constraint',
      originSignal: 'Build an image tool.',
      organizationId: 'attacker-org',
    };
    mockAuthenticate.mockResolvedValue(auth);
    mockParseJsonBody.mockResolvedValue(body);
    mockCreateWorkspace.mockResolvedValue({ id: 'workspace-1' });

    const response = await POST(request('POST'));

    expect(mockCreateRuntime).toHaveBeenCalledWith(auth);
    expect(mockCreateWorkspace).toHaveBeenCalledWith(body);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      workspace: { id: 'workspace-1' },
    });
  });

  it('maps runtime failures without leaking them through the route', async () => {
    mockAuthenticate.mockResolvedValue({
      allowed: true,
      userId: 'user-1',
      organizationId: 'org-1',
    });
    mockListWorkspaces.mockRejectedValue(new Error('database details'));

    const response = await GET(request('GET'));

    expect(mockErrorResponse).toHaveBeenCalledWith(expect.any(Error));
    expect(response.status).toBe(500);
  });
});
