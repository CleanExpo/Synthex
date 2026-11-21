// Test-only preload for worker-entrypoint.test.ts (SYN-1145).
//
// Replaces globalThis.fetch in the worker process so the real entrypoint runs
// with no network at all. Requests to the fake project are answered from the
// scenario in STUB_SCENARIO; every other host is refused, so a stray real
// address can never be contacted. Every request is appended to STUB_LOG as
// "METHOD /path".
import { appendFileSync } from 'node:fs';

const ref = process.env.STUB_REF;
const logFile = process.env.STUB_LOG;
const scenario = JSON.parse(process.env.STUB_SCENARIO || '{}');

const record = line => appendFileSync(logFile, `${line}\n`);

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input.url ?? String(input));
  const method = (init.method || input?.method || 'GET').toUpperCase();
  const u = new URL(url);
  if (u.hostname !== `${ref}.supabase.co`) {
    record(`REFUSED ${method}`);
    throw new TypeError('stub: request to an unexpected host refused');
  }
  record(`${method} ${u.pathname}`);

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  if (method === 'GET' && u.pathname === '/storage/v1/bucket') {
    return json(scenario.buckets ?? []);
  }
  if (u.pathname === '/rest/v1/brand_video_jobs') {
    if (method === 'GET') return json(scenario.queue ?? []);
    if (method === 'PATCH') {
      const body = JSON.parse(String(init.body ?? '{}'));
      if (body.status === 'rendering') {
        // The claim uses maybeSingle(): the client reads a one-row array as
        // the row and an empty array as a lost race.
        return json(scenario.claimed ? [scenario.claimed] : []);
      }
      // Final status write; select('id') returns the changed rows.
      return json(scenario.statusRows ?? []);
    }
  }
  return json({ message: 'stub: unexpected request' }, 500);
};
