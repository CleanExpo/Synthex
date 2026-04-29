/**
 * GBP OAuth bearer refresh — SYN-844.
 *
 * Exchanges DR_GBP_OAUTH_REFRESH_TOKEN (long-lived) for a new
 * DR_GBP_OAUTH_BEARER (60-min expiry) by calling Google's OAuth token
 * endpoint with grant_type=refresh_token. Pushes the new bearer to
 * Vercel via the Vercel REST API so the next invocation of the GBP
 * worker picks it up from `process.env`.
 *
 * Pure function — DI for fetch + Vercel writer so tests don't hit the
 * network or modify env. The caller (cron route) wires defaults.
 *
 * Bearer is NEVER logged in plaintext — only first 8 chars + length.
 *
 * @see SYN-844 (parent: SYN-834 epic)
 */

import { logger } from '@/lib/logger';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const VERCEL_API_BASE = 'https://api.vercel.com';

export interface RefreshGbpBearerInput {
  /** Source-of-truth job ID for audit (Q3.2.4 H8). */
  sourceOfTruthJobId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  vercelToken: string;
  vercelProjectId: string;
  /** Vercel team ID — optional; if absent the personal-account scope is used. */
  vercelTeamId?: string;
  /** Vercel env name to write to. Defaults to 'DR_GBP_OAUTH_BEARER'. */
  vercelEnvName?: string;
  /** Targets the new env value applies to. Defaults to all three. */
  vercelTargets?: ReadonlyArray<'production' | 'preview' | 'development'>;
}

export interface RefreshGbpBearerResult {
  ok: boolean;
  /** First 8 chars of the new bearer + total length, for audit logs. */
  bearerSummary?: string;
  /** Seconds until the new bearer expires (per Google's response). */
  expiresInSec?: number;
  /** Vercel env id of the row we wrote (or updated). */
  vercelEnvId?: string;
  /** Reason for failure — present iff ok=false. */
  reason?: string;
}

export interface RefreshOptions {
  fetchImpl?: typeof fetch;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

interface VercelEnvListResponse {
  envs: Array<{ id: string; key: string; target: string[] }>;
}

interface VercelEnvWriteResponse {
  id?: string;
  created?: { id?: string };
}

export async function refreshGbpBearer(
  input: RefreshGbpBearerInput,
  opts: RefreshOptions = {}
): Promise<RefreshGbpBearerResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const envName = input.vercelEnvName ?? 'DR_GBP_OAUTH_BEARER';
  const targets = input.vercelTargets ?? [
    'production',
    'preview',
    'development',
  ];

  // 1) Exchange refresh token → access token
  const tokenRes = await fetchImpl(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    return {
      ok: false,
      reason: `google token exchange ${tokenRes.status}: ${body.slice(0, 200)}`,
    };
  }
  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenJson.access_token) {
    return {
      ok: false,
      reason: 'google token response missing access_token',
    };
  }
  const newBearer = tokenJson.access_token;
  const summary = `${newBearer.slice(0, 8)}…(len=${newBearer.length})`;

  // 2) Look up the existing Vercel env row for DR_GBP_OAUTH_BEARER (so we can PATCH it).
  const teamSuffix = input.vercelTeamId ? `?teamId=${input.vercelTeamId}` : '';
  const listUrl = `${VERCEL_API_BASE}/v9/projects/${encodeURIComponent(input.vercelProjectId)}/env${teamSuffix}`;
  const listRes = await fetchImpl(listUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${input.vercelToken}` },
  });
  if (!listRes.ok) {
    return {
      ok: false,
      reason: `vercel env list ${listRes.status}`,
    };
  }
  const list = (await listRes.json()) as VercelEnvListResponse;
  const existing = (list.envs ?? []).find(e => e.key === envName);

  // 3) Write — PATCH if exists, POST if not.
  let vercelEnvId: string | undefined;
  if (existing) {
    const patchUrl = `${VERCEL_API_BASE}/v9/projects/${encodeURIComponent(input.vercelProjectId)}/env/${existing.id}${teamSuffix}`;
    const patchRes = await fetchImpl(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${input.vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: newBearer,
        target: targets,
        type: 'encrypted',
      }),
    });
    if (!patchRes.ok) {
      const body = await patchRes.text().catch(() => '');
      return {
        ok: false,
        reason: `vercel env PATCH ${patchRes.status}: ${body.slice(0, 200)}`,
      };
    }
    vercelEnvId = existing.id;
  } else {
    const postUrl = `${VERCEL_API_BASE}/v10/projects/${encodeURIComponent(input.vercelProjectId)}/env${teamSuffix}`;
    const postRes = await fetchImpl(postUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: envName,
        value: newBearer,
        target: targets,
        type: 'encrypted',
      }),
    });
    if (!postRes.ok) {
      const body = await postRes.text().catch(() => '');
      return {
        ok: false,
        reason: `vercel env POST ${postRes.status}: ${body.slice(0, 200)}`,
      };
    }
    const postJson = (await postRes.json()) as VercelEnvWriteResponse;
    vercelEnvId = postJson.id ?? postJson.created?.id;
  }

  logger.info('[gbp.oauth-refresh] rotated bearer', {
    sourceOfTruthJobId: input.sourceOfTruthJobId,
    bearerSummary: summary,
    expiresInSec: tokenJson.expires_in,
    vercelEnvId,
  });

  return {
    ok: true,
    bearerSummary: summary,
    expiresInSec: tokenJson.expires_in,
    vercelEnvId,
  };
}
