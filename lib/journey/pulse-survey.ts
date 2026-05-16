/**
 * Pulse Survey HTML builder — SYN-677
 *
 * Generates an email-safe HTML block containing a 1-5 satisfaction survey.
 * Each score option renders as a numbered circle. Clicking links to
 * /api/journey/click (which logs 'clicked') then redirects the client to
 * /api/journey/pulse (which logs 'surveyed' via image load).
 *
 * Because email clients strip JavaScript and many strip <form> entirely,
 * the survey uses plain <a> links. The score is captured two ways:
 *
 *   Primary:   Link click → GET /api/journey/click?...&url=<pulse-pixel-url>
 *              This redirects the browser to the pulse pixel URL, which logs
 *              the score server-side via the image GET.
 *
 *   Secondary: Each score circle is also an <img> with src pointing at the
 *              pulse pixel (for clients that pre-fetch linked images).
 *
 * Scores 1-5:
 *   1 = Very dissatisfied  (red)
 *   2 = Dissatisfied       (orange)
 *   3 = Neutral            (yellow)
 *   4 = Satisfied          (light green)
 *   5 = Very satisfied     (green)
 *
 * Usage:
 *   import { buildPulseSurveyHtml } from '@/lib/journey/pulse-survey';
 *
 *   const html = buildPulseSurveyHtml({
 *     clientId: 'org_abc123',
 *     momentId: 'evt_xyz789',
 *     question: 'How useful was this email?',
 *   });
 *   // Inject into email HTML body
 */

import { PIXEL_AUDIENCES, signJourneyToken } from './pixel-token';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export interface PulseSurveyOptions {
  /** The organisation/client ID — written to engagement_outcome row */
  clientId: string;
  /** The `client_journey_events.id` for this moment */
  momentId: string;
  /** Survey question shown above the circles */
  question?: string;
}

/** Score colour mapping — uses web-safe hex to avoid email client quirks */
const SCORE_COLOURS: Record<
  number,
  { bg: string; text: string; label: string }
> = {
  1: { bg: '#fee2e2', text: '#dc2626', label: 'Not helpful' },
  2: { bg: '#ffedd5', text: '#ea580c', label: 'Somewhat helpful' },
  3: { bg: '#fefce8', text: '#ca8a04', label: 'Helpful' },
  4: { bg: '#dcfce7', text: '#16a34a', label: 'Very helpful' },
  5: { bg: '#bbf7d0', text: '#15803d', label: 'Extremely helpful' },
};

/**
 * Build a 1-5 pulse survey HTML block suitable for embedding in a Resend email.
 * All styles are inline — no external CSS, no JavaScript.
 */
export function buildPulseSurveyHtml(opts: PulseSurveyOptions): string {
  const {
    clientId,
    momentId,
    question = 'How helpful was this update?',
  } = opts;

  const circleLinks = ([1, 2, 3, 4, 5] as const)
    .map(score => {
      const colour = SCORE_COLOURS[score];

      // Pulse pixel URL — records 'surveyed' outcome when image loads (signed)
      const pulseToken = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId,
        momentId,
        score,
      });
      const pixelUrl = `${APP_URL}/api/journey/pulse?t=${pulseToken}`;

      // Pulse-confirm URL — destination of the click tracker
      const confirmToken = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulseConfirm,
        clientId,
        momentId,
        score,
      });
      const confirmUrl = `${APP_URL}/api/journey/pulse-confirm?t=${confirmToken}`;

      // Click tracker URL — records 'clicked' then redirects to confirm page
      const clickToken = signJourneyToken({
        aud: PIXEL_AUDIENCES.click,
        clientId,
        momentId,
        url: confirmUrl,
      });
      const clickUrl = `${APP_URL}/api/journey/click?t=${clickToken}`;

      return `
                <td style="padding:0 6px;text-align:center;" align="center">
                  <a href="${clickUrl}"
                     style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:50%;background:${colour.bg};color:${colour.text};font-size:18px;font-weight:700;text-decoration:none;text-align:center;border:2px solid ${colour.text};"
                     title="${colour.label}">
                    ${score}
                  </a>
                  <!-- Pixel for image-prefetch tracking -->
                  <img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />
                </td>`;
    })
    .join('');

  return `
          <!-- Pulse Survey — SYN-677 -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px 16px;">
                    <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-align:center;">
                      ${question}
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        ${circleLinks}
                      </tr>
                    </table>
                    <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
                      1 = Not helpful &nbsp;·&nbsp; 5 = Extremely helpful
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/**
 * Build a click-tracked URL for use in email CTAs.
 * Replaces the raw destination URL so all clicks are logged via /api/journey/click.
 */
export function buildTrackedUrl(
  clientId: string,
  momentId: string,
  destUrl: string
): string {
  const token = signJourneyToken({
    aud: PIXEL_AUDIENCES.click,
    clientId,
    momentId,
    url: destUrl,
  });
  return `${APP_URL}/api/journey/click?t=${token}`;
}
