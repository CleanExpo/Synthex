import { resolveOrgFromBearer } from '@/app/api/mcp/auth';

describe('MCP bearer auth', () => {
  beforeEach(() => {
    process.env.SYNTHEX_MCP_KEYS = JSON.stringify({
      'key-abc': {
        organizationId: 'org1',
        userId: 'u-mcp',
        label: 'claude-code',
      },
    });
  });

  it('maps a known bearer key to its org context', () => {
    expect(resolveOrgFromBearer('Bearer key-abc')).toEqual({
      organizationId: 'org1',
      userId: 'u-mcp',
      label: 'claude-code',
    });
  });

  it('returns null for unknown or missing keys', () => {
    expect(resolveOrgFromBearer('Bearer nope')).toBeNull();
    expect(resolveOrgFromBearer(null)).toBeNull();
    expect(resolveOrgFromBearer('key-abc')).toBeNull(); // must be Bearer scheme
  });

  it('returns null on malformed SYNTHEX_MCP_KEYS JSON', () => {
    process.env.SYNTHEX_MCP_KEYS = '{not json';
    expect(resolveOrgFromBearer('Bearer key-abc')).toBeNull();
  });
});
