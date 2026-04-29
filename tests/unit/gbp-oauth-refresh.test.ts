/**
 * Unit tests for lib/gbp/oauth-refresh.ts (SYN-844).
 *
 * Covers:
 *  - Happy path: token exchange + Vercel PATCH (env exists)
 *  - Happy path: token exchange + Vercel POST (env doesn't exist yet)
 *  - Google token exchange failure → ok=false with reason
 *  - Vercel env list failure → ok=false with reason
 *  - Vercel PATCH failure → ok=false with reason
 *  - bearerSummary truncates to first 8 chars + length (no plaintext leak)
 *  - vercelTeamId is appended as ?teamId= when supplied
 *
 * @see SYN-844 (parent: SYN-834 epic)
 */

import { describe, it, expect, jest } from '@jest/globals';
import { refreshGbpBearer } from '@/lib/gbp/oauth-refresh';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function makeFetchSequence(
  responses: Array<{
    ok: boolean;
    status?: number;
    json?: unknown;
    text?: string;
  }>
): jest.Mock & typeof fetch {
  let call = 0;
  return jest.fn(async () => {
    const r = responses[call++];
    if (!r) throw new Error('makeFetchSequence: out of responses');
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      async json() {
        return r.json ?? {};
      },
      async text() {
        return r.text ?? '';
      },
    } as Response;
  }) as jest.Mock & typeof fetch;
}

const baseInput = {
  sourceOfTruthJobId: 'job_test',
  clientId: 'client_id_x',
  clientSecret: 'secret_x',
  refreshToken: 'refresh_x',
  vercelToken: 'vercel_x',
  vercelProjectId: 'proj_x',
};

describe('refreshGbpBearer — happy path (env row exists → PATCH)', () => {
  it('exchanges + PATCHes the existing row + returns truncated summary', async () => {
    const fetchImpl = makeFetchSequence([
      // Google token exchange
      {
        ok: true,
        json: {
          access_token: 'ya29.AVERY_LONG_ACCESS_TOKEN_VALUE',
          expires_in: 3599,
          token_type: 'Bearer',
        },
      },
      // Vercel env list — the row exists
      {
        ok: true,
        json: {
          envs: [
            {
              id: 'env_existing',
              key: 'DR_GBP_OAUTH_BEARER',
              target: ['production'],
            },
          ],
        },
      },
      // Vercel PATCH succeeds
      { ok: true, json: {} },
    ]);

    const result = await refreshGbpBearer(baseInput, { fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.bearerSummary).toBe(
      'ya29.AVE…(len=34)' // first 8 chars + total length
    );
    expect(result.expiresInSec).toBe(3599);
    expect(result.vercelEnvId).toBe('env_existing');

    // Verify the calls in order
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const [tokenCall, listCall, patchCall] = fetchImpl.mock.calls;
    expect((tokenCall as unknown as [string])[0]).toContain(
      'oauth2.googleapis.com/token'
    );
    expect((listCall as unknown as [string])[0]).toContain(
      '/v9/projects/proj_x/env'
    );
    expect((patchCall as unknown as [string, RequestInit])[0]).toContain(
      '/v9/projects/proj_x/env/env_existing'
    );
    expect((patchCall as unknown as [string, RequestInit])[1].method).toBe(
      'PATCH'
    );
  });
});

describe('refreshGbpBearer — happy path (env row missing → POST)', () => {
  it('POSTs a new env row when none exists', async () => {
    const fetchImpl = makeFetchSequence([
      {
        ok: true,
        json: {
          access_token: 'ya29.NEW_TOKEN',
          expires_in: 3599,
          token_type: 'Bearer',
        },
      },
      // env list returns no matching key
      {
        ok: true,
        json: { envs: [{ id: 'env_unrelated', key: 'OTHER', target: [] }] },
      },
      // POST succeeds
      { ok: true, json: { id: 'env_new' } },
    ]);

    const result = await refreshGbpBearer(baseInput, { fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.vercelEnvId).toBe('env_new');
    const [, , postCall] = fetchImpl.mock.calls;
    expect((postCall as unknown as [string, RequestInit])[0]).toContain(
      '/v10/projects/proj_x/env'
    );
    expect((postCall as unknown as [string, RequestInit])[1].method).toBe(
      'POST'
    );
  });
});

describe('refreshGbpBearer — failure modes', () => {
  it('returns ok=false when Google token exchange fails', async () => {
    const fetchImpl = makeFetchSequence([
      { ok: false, status: 400, text: 'invalid_grant' },
    ]);
    const result = await refreshGbpBearer(baseInput, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/google token exchange 400/);
  });

  it('returns ok=false when Google response is missing access_token', async () => {
    const fetchImpl = makeFetchSequence([
      { ok: true, json: { expires_in: 3599 } },
    ]);
    const result = await refreshGbpBearer(baseInput, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/missing access_token/);
  });

  it('returns ok=false when Vercel env list fails', async () => {
    const fetchImpl = makeFetchSequence([
      {
        ok: true,
        json: { access_token: 'tok', expires_in: 3599, token_type: 'Bearer' },
      },
      { ok: false, status: 401 },
    ]);
    const result = await refreshGbpBearer(baseInput, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/vercel env list 401/);
  });

  it('returns ok=false when Vercel PATCH fails', async () => {
    const fetchImpl = makeFetchSequence([
      {
        ok: true,
        json: { access_token: 'tok', expires_in: 3599, token_type: 'Bearer' },
      },
      {
        ok: true,
        json: {
          envs: [
            { id: 'env_x', key: 'DR_GBP_OAUTH_BEARER', target: ['production'] },
          ],
        },
      },
      { ok: false, status: 403, text: 'forbidden' },
    ]);
    const result = await refreshGbpBearer(baseInput, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/vercel env PATCH 403/);
  });

  it('returns ok=false when Vercel POST fails (no existing row)', async () => {
    const fetchImpl = makeFetchSequence([
      {
        ok: true,
        json: { access_token: 'tok', expires_in: 3599, token_type: 'Bearer' },
      },
      { ok: true, json: { envs: [] } },
      { ok: false, status: 422, text: 'invalid' },
    ]);
    const result = await refreshGbpBearer(baseInput, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/vercel env POST 422/);
  });
});

describe('refreshGbpBearer — bearer-summary safety', () => {
  it('truncates the bearer to first 8 chars + length (no plaintext leak)', async () => {
    const fetchImpl = makeFetchSequence([
      {
        ok: true,
        json: {
          access_token: 'aaaaaaaaSECRET_REST_OF_TOKEN_DO_NOT_LEAK',
          expires_in: 3599,
          token_type: 'Bearer',
        },
      },
      {
        ok: true,
        json: {
          envs: [{ id: 'env_x', key: 'DR_GBP_OAUTH_BEARER', target: [] }],
        },
      },
      { ok: true, json: {} },
    ]);
    const result = await refreshGbpBearer(baseInput, { fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.bearerSummary).toBe('aaaaaaaa…(len=40)');
    // The full bearer must NOT appear in the summary
    expect(result.bearerSummary).not.toContain('SECRET_REST_OF_TOKEN');
  });
});

describe('refreshGbpBearer — vercelTeamId scoping', () => {
  it('appends ?teamId= when vercelTeamId is supplied', async () => {
    const fetchImpl = makeFetchSequence([
      {
        ok: true,
        json: { access_token: 'tok', expires_in: 3599, token_type: 'Bearer' },
      },
      {
        ok: true,
        json: {
          envs: [{ id: 'env_x', key: 'DR_GBP_OAUTH_BEARER', target: [] }],
        },
      },
      { ok: true, json: {} },
    ]);
    await refreshGbpBearer(
      { ...baseInput, vercelTeamId: 'team_xyz' },
      { fetchImpl }
    );
    const [, listCall, patchCall] = fetchImpl.mock.calls;
    expect((listCall as unknown as [string])[0]).toContain('?teamId=team_xyz');
    expect((patchCall as unknown as [string])[0]).toContain('?teamId=team_xyz');
  });
});
