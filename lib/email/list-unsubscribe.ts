/**
 * Unsubscribe link and RFC 8058 one-click headers for marketing email.
 *
 * Every commercial email (Spam Act 2003: a functional unsubscribe on every
 * message) links to the one real route, /api/newsletter/unsubscribe, and
 * carries List-Unsubscribe + List-Unsubscribe-Post so mailbox providers can
 * unsubscribe in one click (RFC 8058; Gmail bulk-sender rules).
 *
 * RFC 8058 requires an https URI. When NEXT_PUBLIC_APP_URL is not https
 * (local dev), the production origin is used so the header stays valid.
 *
 * The address travels as a plain `email` query parameter, as the route has
 * always accepted. A signed opaque token (RFC 8058 recommends one) needs a
 * new signing secret and is not built here.
 */

const PRODUCTION_ORIGIN = 'https://synthex.social';

function httpsOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.startsWith('https://')) {
    return configured.replace(/\/+$/, '');
  }
  return PRODUCTION_ORIGIN;
}

/** Absolute https URL of the unsubscribe route for this recipient. */
export function unsubscribeUrl(email: string): string {
  return `${httpsOrigin()}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
}

/** Headers to pass to Resend `emails.send({ headers })` on marketing email. */
export function listUnsubscribeHeaders(email: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl(email)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
