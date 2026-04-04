/**
 * Shared SWR fetcher utility.
 *
 * Usage with SWR:
 *   const { data } = useSWR('/api/endpoint', fetchJson);
 *
 * Always sends credentials (cookies) so session-authenticated routes work.
 */
export const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());
