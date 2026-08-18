/**
 * SYN-962 — lazy-init guard (updated SYN-1070).
 *
 * @supabase/supabase-js was removed in SYN-1070. lib/supabase-client.ts is
 * now a no-op shim backed by Prisma. The original contract — "never construct
 * a Supabase client at module load" — still holds: our shim must NOT call
 * createClient at any point, because the package is gone.
 */
const createClientMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...a: unknown[]) => createClientMock(...a),
}));

beforeEach(() => {
  jest.resetModules();
  createClientMock.mockReset();
});

describe('lib/supabase-client (SYN-1070 shim)', () => {
  it('does not construct a Supabase client at module import', async () => {
    await import('@/lib/supabase-client');
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('never calls createClient on property access — shim is @supabase/supabase-js-free', async () => {
    const mod = await import('@/lib/supabase-client');
    // Access known exports — none should trigger createClient
    void mod.supabase.auth;
    void mod.db.from;
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('exports testConnection as a function', async () => {
    const mod = await import('@/lib/supabase-client');
    expect(typeof mod.testConnection).toBe('function');
  });
});

describe('lib/auth/signInFlow lazy init (SYN-962)', () => {
  it('does not construct the module-level client at import', async () => {
    await import('@/lib/auth/signInFlow');
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
