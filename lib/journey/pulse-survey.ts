/**
 * Pulse Survey — HTML builder + tracked URL helpers — SYN-677
 *
 * buildPulseSurveyHtml() — returns an inline HTML block (not a full page)
 *   safe to embed inside an email body between other <tr> rows.
 *
 * buildTrackedUrl() — wraps a destination URL in the click-tracker redirect,
 *   with an optional pulse pixel embedded for dual tracking.
 *
 * Tracking flow:
 *   1. Email client loads <img src="/api/journey/pulse?..."> → records 'delivered'
 *   2. Client clicks a score circle → GET /api/journey/click?url=/api/journey/pulse-confirm&...
 *   3. pulse-confirm writes engagement_outcome = 'surveyed', returns a thank-you page
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export interface PulseSurveyOptions {
  clientId: string;
  momentId: string;   // client_journey_events.id — ties the score to the event
  question?: string;  // defaults to a standard question
}

/** Score-specific colour tokens (bg, border, text) */
const SCORE_COLOURS: Record<number, [string, string, string]> = {
  1: ['#fef2f2', '#fca5a5', '#dc2626'],
  2: ['#fff7ed', '#fdba74', '#ea580c'],
  3: ['#fefce8', '#fde047', '#ca8a04'],
  4: ['#f0fdf4', '#86efac', '#16a34a'],
  5: ['#eff6ff', '#93c5fd', '#2563eb'],
};

const SCORE_LABELS: Record<number, string> = {
  1: 'Not helpful',
  2: 'Somewhat',
  3: 'Neutral',
  4: 'Helpful',
  5: 'Very helpful',
};

/**
 * Builds a URL that routes through the click tracker and lands on
 * the pulse-confirm page (which writes engagement_outcome = 'surveyed').
 */
function buildScoreUrl(clientId: string, momentId: string, score: number): string {
  const confirmUrl = new URL(`${APP_URL}/api/journey/pulse-confirm`);
  confirmUrl.searchParams.set('clientId', clientId);
  confirmUrl.searchParams.set('momentId', momentId);
  confirmUrl.searchParams.set('score', String(score));

  const clickUrl = new URL(`${APP_URL}/api/journey/click`);
  clickUrl.searchParams.set('clientId', clientId);
  clickUrl.searchParams.set('momentId', momentId);
  clickUrl.searchParams.set('url', confirmUrl.toString());

  return clickUrl.toString();
}

/**
 * Builds a click-tracked URL for any destination link in the email.
 * Logs 'clicked' outcome when the client follows the link.
 */
export function buildTrackedUrl(
  clientId: string,
  momentId: string,
  destUrl: string
): string {
  const clickUrl = new URL(`${APP_URL}/api/journey/click`);
  clickUrl.searchParams.set('clientId', clientId);
  clickUrl.searchParams.set('momentId', momentId);
  clickUrl.searchParams.set('url', destUrl);
  return clickUrl.toString();
}

/**
 * Pixel URL that records email open/delivery.
 * Embed as <img src="..."> — email clients load it on open.
 */
function buildPixelUrl(clientId: string, momentId: string): string {
  const url = new URL(`${APP_URL}/api/journey/pulse`);
  url.searchParams.set('clientId', clientId);
  url.searchParams.set('momentId', momentId);
  return url.toString();
}

/**
 * Returns an HTML block (table rows) containing:
 *  - A question label
 *  - 5 score circles (1–5) as anchor tags
 *  - A 1×1 tracking pixel
 *
 * Safe to embed directly inside an email's outer <table> as sibling <tr> rows.
 */
export function buildPulseSurveyHtml(opts: PulseSurveyOptions): string {
  const {
    clientId,
    momentId,
    question = 'How useful was this update for your business?',
  } = opts;

  const pixelUrl = buildPixelUrl(clientId, momentId);

  const circles = [1, 2, 3, 4, 5]
    .map(score => {
      const [bg, border, text] = SCORE_COLOURS[score];
      const label = SCORE_LABELS[score];
      const href = buildScoreUrl(clientId, momentId, score);
      return `
              <td style="text-align:center;padding:0 4px;">
                <a href="${href}" style="display:inline-block;width:40px;height:40px;border-radius:50%;background:${bg};border:2px solid ${border};line-height:36px;text-align:center;font-size:15px;font-weight:700;color:${text};text-decoration:none;" title="${label}">${score}</a>
                <p style="margin:4px 0 0;font-size:9px;color:#9ca3af;white-space:nowrap;">${label}</p>
              </td>`;
    })
    .join('');

  return `
          <!-- Pulse Survey — SYN-677 -->
          <tr>
            <td style="padding:0 32px 8px;">
              <p style="margin:0;font-size:13px;color:#6b7280;">${question}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  ${circles}
                </tr>
              </table>
            </td>
          </tr>
          <!-- Tracking pixel -->
          <tr>
            <td>
              <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
            </td>
          </tr>`;
}
