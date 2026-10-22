/**
 * Quota-aware URL submission to Bing Webmaster.
 *
 * Reads GetUrlSubmissionQuota first, sends at most min(daily, monthly) URLs
 * in batches of at most 500, and stops at the first failed batch. Whatever
 * was not sent is returned in `deferred`; `ok` is true only when every URL
 * was submitted.
 */
import {
  BING_SUBMIT_URL_BATCH_MAX,
  type BingResult,
  type BingUrlSubmissionQuota,
  type BingWebmasterClient,
} from './client';

export interface BingQuotaSubmission {
  ok: boolean;
  submitted: string[];
  deferred: string[];
  quota?: BingUrlSubmissionQuota;
  /** Present whenever ok is false. */
  reason?: string;
  /** The failure that stopped submission, if any. */
  failure?: Extract<BingResult<unknown>, { ok: false }>;
}

export async function submitUrlsWithinQuota(
  client: BingWebmasterClient,
  siteUrl: string,
  urls: readonly string[]
): Promise<BingQuotaSubmission> {
  const all = [...new Set(urls)];
  if (all.length === 0) {
    return {
      ok: false,
      submitted: [],
      deferred: [],
      reason: 'no URLs to submit',
    };
  }

  const q = await client.getUrlSubmissionQuota(siteUrl);
  if (!q.ok) {
    return {
      ok: false,
      submitted: [],
      deferred: all,
      reason: `quota lookup failed (${q.kind}); nothing sent`,
      failure: q,
    };
  }

  const allowance = Math.max(0, Math.min(q.data.daily, q.data.monthly));
  const toSend = all.slice(0, allowance);
  const submitted: string[] = [];

  for (let i = 0; i < toSend.length; i += BING_SUBMIT_URL_BATCH_MAX) {
    const batch = toSend.slice(i, i + BING_SUBMIT_URL_BATCH_MAX);
    const r = await client.submitUrlBatch(siteUrl, batch);
    if (!r.ok) {
      return {
        ok: false,
        submitted,
        deferred: all.slice(submitted.length),
        quota: q.data,
        reason: `batch failed (${r.kind}); remaining URLs deferred`,
        failure: r,
      };
    }
    submitted.push(...batch);
  }

  const deferred = all.slice(submitted.length);
  return {
    ok: deferred.length === 0,
    submitted,
    deferred,
    quota: q.data,
    ...(deferred.length > 0
      ? {
          reason: `quota allows ${allowance} now (daily ${q.data.daily}, monthly ${q.data.monthly}); ${deferred.length} deferred`,
        }
      : {}),
  };
}
