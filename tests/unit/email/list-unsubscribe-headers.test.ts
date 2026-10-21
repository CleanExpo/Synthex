/**
 * SEAM: the exported marketing-email senders in lib/email/*, observed at the
 * Resend boundary (emails.send payload).
 * Catches: a marketing email leaving without List-Unsubscribe (https URL to
 * the real unsubscribe route) or List-Unsubscribe-Post: List-Unsubscribe=One-Click;
 * a body link pointing at the non-existent /unsubscribe page.
 * Misses: DKIM signing of the headers (done by Resend), delivery itself.
 */

const mockSend = jest.fn();
jest.mock('resend', () => ({
  // plain function: survives the config's resetMocks between tests
  Resend: function MockResend() {
    return {
      emails: { send: (...a: unknown[]) => mockSend(...a) },
    };
  },
}));

// The newsletter-style senders run the suppression check first: a subscribed
// Synthex user with no Resend audience configured is allowed.
const mockPrisma = {
  user: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
const ENV = { ...process.env };
afterAll(() => {
  process.env = ENV;
});

import {
  sendWelcomeSequenceDay0,
  sendWelcomeSequenceDay3,
  sendWelcomeSequenceDay7,
  sendWelcomeSequenceDay14,
  sendNewsletterWelcome,
} from '@/lib/email/billing-emails';
import { sendMonthlyStoryEmail } from '@/lib/email/monthly-story-email';
import { sendEffectReportEmail } from '@/lib/email/effect-report-email';
import { sendAdvisorBriefEmail } from '@/lib/email/advisor-brief-email';
import { sendGeoScoreNotificationEmail } from '@/lib/email/geo-score-notification-email';

const TO = 'reader@example.com';
const EXPECTED_URL =
  'https://synthex.social/api/newsletter/unsubscribe?email=reader%40example.com';

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: 'em_1' }, error: null });
  process.env = { ...ENV };
  delete process.env.RESEND_AUDIENCE_ID;
  mockPrisma.user.findUnique.mockResolvedValue({ preferences: {} });
});

async function lastPayload(): Promise<Record<string, unknown>> {
  // fire-and-forget senders resolve on a later microtask
  await new Promise(r => setTimeout(r, 0));
  expect(mockSend).toHaveBeenCalledTimes(1);
  return mockSend.mock.calls[0][0] as Record<string, unknown>;
}

function expectOneClickHeaders(payload: Record<string, unknown>) {
  const headers = payload.headers as Record<string, string> | undefined;
  expect(headers?.['List-Unsubscribe']).toBe(`<${EXPECTED_URL}>`);
  expect(headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  expect(String(payload.html)).toContain(
    'https://synthex.social/api/newsletter/unsubscribe?email='
  );
  expect(String(payload.html)).not.toMatch(/synthex\.social\/unsubscribe\?/);
}

const SENDERS: Array<[string, () => unknown]> = [
  ['welcome day 0', () => sendWelcomeSequenceDay0(TO, 'R')],
  ['welcome day 3', () => sendWelcomeSequenceDay3(TO, 'R')],
  ['welcome day 7', () => sendWelcomeSequenceDay7(TO, 'R')],
  ['welcome day 14', () => sendWelcomeSequenceDay14(TO, 'R')],
  ['newsletter welcome', () => sendNewsletterWelcome(TO)],
  [
    'monthly story',
    () =>
      sendMonthlyStoryEmail({
        to: TO,
        businessName: 'Biz',
        monthLabel: 'October 2026',
        storyText: 'story',
        totalReach: 1,
        postsPublished: 1,
        autonomousPosts: 1,
        minutesSaved: 60,
        storyId: 's1',
        orgId: 'o1',
        monthYear: '2026-10',
      } as never),
  ],
  [
    'effect report',
    () =>
      sendEffectReportEmail({
        to: TO,
        businessName: 'Biz',
        quarterLabel: 'Q3 2026',
        reportUrl: '/dashboard/effect-report/Q3%202026',
        pngUrl: null,
        pdfUrl: null,
        reportData: {
          achievementSummary: {
            postsPublished: 1,
            estimatedTotalReach: 10,
            consecutiveWeeksActive: 1,
          },
          proprietaryMetrics: { geoScore: null, healthScore: null },
          biggestWin: null,
          honestGap: null,
          whatsNext: null,
        } as never,
      } as never),
  ],
  [
    'advisor brief',
    () =>
      sendAdvisorBriefEmail({
        to: TO,
        businessName: 'Biz',
        weekLabel: '20 Oct 2026',
        dollarAttribution: '$1',
        actions: [],
        briefId: 'b1',
      }),
  ],
  [
    'geo score',
    () =>
      sendGeoScoreNotificationEmail({
        to: TO,
        businessName: 'Biz',
        variant: 'improved',
        currentScore: 70,
        delta: 5,
        trendData: [],
        recommendedActions: [],
      }),
  ],
];

describe('marketing emails carry RFC 8058 one-click unsubscribe headers', () => {
  it.each(SENDERS)('%s', async (_name, send) => {
    await Promise.resolve(send()).catch(() => undefined);
    expectOneClickHeaders(await lastPayload());
  });
});
