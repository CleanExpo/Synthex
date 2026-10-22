/**
 * lib/bing-webmaster — Bing Webmaster Tools API client (kit K1).
 *
 * Not to be confused with lib/bing-places (Bing Places for Business).
 *
 * @see lib/bing-webmaster/README.md
 */
export {
  BING_SUBMIT_URL_BATCH_MAX,
  BING_WEBMASTER_JSON_BASE,
  createBingWebmasterClient,
  type BingFailureKind,
  type BingResult,
  type BingSite,
  type BingUrlSubmissionQuota,
  type BingWebmasterClient,
  type BingWebmasterClientOptions,
} from './client';

export { submitUrlsWithinQuota, type BingQuotaSubmission } from './quota';
