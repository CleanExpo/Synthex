/**
 * Twilio request signature verification — SYN-802
 *
 * Implements the Twilio webhook security spec:
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Algorithm (HMAC-SHA1):
 *   1. Concatenate the full request URL.
 *   2. If POST, sort all POST parameters alphabetically and append
 *      each key+value pair to the URL string (no separator between pairs).
 *   3. Sign with HMAC-SHA1 using the Twilio Auth Token as the key.
 *   4. Base64-encode the result.
 *   5. Compare (timing-safe) against the X-Twilio-Signature header.
 *
 * Uses Node's built-in `crypto` module — same as the rest of the codebase,
 * no new dependencies.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify a Twilio request signature.
 *
 * @param authToken  TWILIO_AUTH_TOKEN env value
 * @param url        Full canonical URL the webhook was sent to
 *                   (scheme + host + path + query string exactly as Twilio sees it)
 * @param params     POST body key→value pairs (from application/x-www-form-urlencoded)
 * @param signature  Value of the X-Twilio-Signature request header (base64)
 */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  if (!signature) return false;

  // Steps 1+2: build the string to sign
  const sortedKeys = Object.keys(params).sort();
  const stringToSign = url + sortedKeys.map((k) => k + params[k]).join('');

  // Steps 3+4: HMAC-SHA1 → base64
  const computed = createHmac('sha1', authToken)
    .update(stringToSign, 'utf8')
    .digest('base64');

  // Step 5: timing-safe comparison
  const computedBuf = Buffer.from(computed);
  const providedBuf = Buffer.from(signature);

  if (computedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(computedBuf, providedBuf);
}

/**
 * Parse an application/x-www-form-urlencoded body string into a key→value map.
 */
export function parseTwilioFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of body.split('&')) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    const k = eqIdx === -1 ? part : part.slice(0, eqIdx);
    const v = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
    if (k) {
      params[decodeURIComponent(k.replace(/\+/g, ' '))] = decodeURIComponent(
        v.replace(/\+/g, ' ')
      );
    }
  }
  return params;
}
