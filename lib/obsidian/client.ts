/**
 * Obsidian Local REST API Client
 *
 * Wraps the Obsidian Local REST API plugin (default port 27124).
 * All calls are no-ops when OBSIDIAN_ENABLED is not 'true' — safe to import in production.
 *
 * ENVIRONMENT VARIABLES:
 * - OBSIDIAN_BASE_URL:  Base URL for Obsidian Local REST API (default: http://localhost:27124)
 * - OBSIDIAN_API_KEY:   API key from the plugin Settings panel
 * - OBSIDIAN_ENABLED:   Set to 'true' to enable (default: disabled in production)
 */

export interface ObsidianNote {
  path: string;
  content: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
}

export interface ObsidianSearchResult {
  filename: string;
  score: number;
  matches: Array<{
    match: { start: number; end: number };
    context: string;
  }>;
}

function getBaseUrl(): string {
  return process.env.OBSIDIAN_BASE_URL ?? 'http://localhost:27124';
}

function getApiKey(): string {
  return process.env.OBSIDIAN_API_KEY ?? '';
}

export function isEnabled(): boolean {
  return (
    process.env.OBSIDIAN_ENABLED === 'true' && !!process.env.OBSIDIAN_API_KEY
  );
}

async function obsidianFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  return fetch(url, { ...options, headers });
}

/**
 * Read note content by vault-relative path.
 * Returns empty string if note not found or Obsidian is disabled.
 */
export async function readNote(notePath: string): Promise<string> {
  if (!isEnabled()) return '';
  try {
    const res = await obsidianFetch(`/vault/${encodeURIComponent(notePath)}`);
    if (!res.ok) return '';
    const data = (await res.json()) as { content?: string };
    return data.content ?? '';
  } catch {
    return '';
  }
}

/**
 * Write (create or overwrite) a note at the given vault-relative path.
 */
export async function writeNote(
  notePath: string,
  content: string
): Promise<void> {
  if (!isEnabled()) return;
  try {
    await obsidianFetch(`/vault/${encodeURIComponent(notePath)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  } catch {
    // Best-effort — non-fatal
  }
}

/**
 * Append content to an existing note (or create it if absent).
 */
export async function appendToNote(
  notePath: string,
  content: string
): Promise<void> {
  if (!isEnabled()) return;
  try {
    await obsidianFetch(`/vault/${encodeURIComponent(notePath)}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  } catch {
    // Best-effort — non-fatal
  }
}

/**
 * Full-text search across the vault.
 * Returns matching note metadata (content not populated — use readNote to fetch).
 */
export async function searchNotes(query: string): Promise<ObsidianNote[]> {
  if (!isEnabled()) return [];
  try {
    const res = await obsidianFetch(
      `/search/simple/?query=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const results = (await res.json()) as ObsidianSearchResult[];
    return results.map(r => ({
      path: r.filename,
      content: '',
      stat: { ctime: 0, mtime: 0, size: 0 },
    }));
  } catch {
    return [];
  }
}

export const obsidianClient = {
  readNote,
  writeNote,
  appendToNote,
  searchNotes,
  isEnabled,
};
