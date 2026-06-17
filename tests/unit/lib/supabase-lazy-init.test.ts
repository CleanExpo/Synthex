/**
 * SYN-962 — the two remaining module-level Supabase callers must lazy-init via
 * Proxy: importing the module must NOT construct a client, and the client is
 * built (once, memoized) only on first property access. This removes the
 * SYN-953 build-fail mode where module load constructs a client.
 */
const createClientMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...a: unknown[]) => createClientMock(...a),
}));

beforeEach(() => {
  jest.resetModules();
  createClientMock.mockReset();
  createClientMock.mockReturnValue({
    auth: { __marker: 'auth' },
    from: () => ({ select: () => ({}) }),
  });
});

describe('lib/supabase-client lazy init (SYN-962)', () => {
  it('does not construct a client at module import', async () => {
    await import('@/lib/supabase-client');
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('constructs exactly once on first property access, then memoizes', async () => {
    const mod = await import('@/lib/supabase-client');
    // First access triggers construction.
    void mod.supabase.auth;
    expect(createClientMock).toHaveBeenCalledTimes(1);
    // Subsequent accesses reuse the cached client.
    void mod.supabase.auth;
    void mod.supabase.from;
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});

describe('lib/auth/signInFlow lazy init (SYN-962)', () => {
  it('does not construct the module-level client at import', async () => {
    await import('@/lib/auth/signInFlow');
    // signInFlow's only remaining createClient calls are inside functions
    // (createServiceClient / the lazy proxy), so import must not construct one.
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
