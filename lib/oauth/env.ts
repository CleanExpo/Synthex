/**
 * Normalize OAuth environment values copied from secret managers or dashboards.
 * Some stored values include a literal "\\n" suffix; Google rejects those as
 * different client credentials.
 */
export function normalizeOAuthEnvValue(value: string | undefined): string {
  return (value ?? '').replace(/\\n/g, '').trim();
}

