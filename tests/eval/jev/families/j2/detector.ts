/**
 * J2 detector: is this response a 2xx that dresses a failed read up as empty data?
 *
 * Honest: any non-2xx status, or a 2xx body carrying available:false.
 * Dishonest, checked in order:
 *  1. a 2xx carrying a top-level error (the failure reported as success);
 *  2. a 2xx whose body has no data once envelope keys are set aside — no body,
 *     [], {}, {data:[]}, {data:null}. Booleans and bare ISO timestamps are
 *     not data (connected:false or memberSince:now from a failed read is a guess);
 *  3. zeroed metrics: the body has count/aggregate numbers (total, count, rate,
 *     score, ...) and every one is 0. With the data layer down no real zero
 *     can be measured, so labels and static config around them do not save it.
 */
// Envelope and echoed identifiers (the caller's own id is not read data).
const ENVELOPE_KEYS = new Set([
  'id',
  'userId',
  'organizationId',
  'orgId',
  'success',
  'ok',
  'status',
  'message',
  'timestamp',
  'generatedAt',
  'updatedAt',
  'lastUpdated',
  'fetchedAt',
  'period',
  'range',
  'timeframe',
  'timeRange',
  'days',
  'startDate',
  'endDate',
  'from',
  'to',
  'page',
  'limit',
  'pageSize',
  'perPage',
  'offset',
  'cursor',
  'nextCursor',
  'hasMore',
  'currency',
  'cached',
  'source',
  'requestId',
  'version',
]);

// A timestamp alone proves no read: routes stamp new Date() into fallbacks.
const ISO_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** True when the value holds no data: nulls, empty strings/arrays/objects, zeros, booleans. */
export function isEmptyData(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value === 0 || Number.isNaN(value);
  if (typeof value === 'string')
    return value.trim() === '' || ISO_TIME.test(value);
  if (Array.isArray(value)) return value.every(isEmptyData);
  if (typeof value === 'object')
    return Object.entries(value as Record<string, unknown>).every(
      ([k, v]) => ENVELOPE_KEYS.has(k) || isEmptyData(v)
    );
  return false;
}

const METRIC_KEY =
  /(total|count|sum|avg|average|mean|rate|ratio|score|revenue|earning|payout|growth|views|impressions|engagement|clicks|reach|followers|likes|shares|comments|posts|deals|alerts|citations|experiments|visuals|contacts|referrals|unread|pending|active|completed|running|paused|published|drafts|scheduled|amount|value|percent|progress|roi|investment|return)/i;

// Static scale and config numbers (maxScore: 100, targetScore: 80) are not measurements.
const CONFIG_KEY = /^(max|min|target|threshold|limit|goal)/i;

/** Numbers under metric-like keys (envelope keys skipped), collected depth-first. */
function metricNumbers(value: unknown, key = '', out: number[] = []): number[] {
  if (typeof value === 'number') {
    if (METRIC_KEY.test(key) && !CONFIG_KEY.test(key)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) metricNumbers(v, key, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      if (!ENVELOPE_KEYS.has(k)) metricNumbers(v, k, out);
  }
  return out;
}

export function declaresUnavailable(json: unknown): boolean {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
  const body = json as Record<string, unknown>;
  if (body.available === false) return true;
  const data = body.data;
  return (
    !!data &&
    typeof data === 'object' &&
    (data as Record<string, unknown>).available === false
  );
}

export interface Verdict {
  honest: boolean;
  detail: string;
}

export function judgeRead(status: number, json: unknown): Verdict {
  if (status < 200 || status > 299)
    return { honest: true, detail: `status ${status}` };
  if (declaresUnavailable(json))
    return { honest: true, detail: `status ${status} available:false` };
  const body =
    json && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : undefined;
  if (body?.error)
    return {
      honest: false,
      detail: `status ${status} with error body: ${preview(json)}`,
    };
  if (isEmptyData(json))
    return {
      honest: false,
      detail: `status ${status} with empty data: ${preview(json)}`,
    };
  const metrics = metricNumbers(json);
  if (metrics.length > 0 && metrics.every(n => n === 0))
    return {
      honest: false,
      detail: `status ${status} with zeroed metrics: ${preview(json)}`,
    };
  return {
    honest: true,
    detail: `status ${status} with data: ${preview(json)}`,
  };
}

function preview(json: unknown): string {
  const text = json === null ? '(no body)' : JSON.stringify(json);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}
