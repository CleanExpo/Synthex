/**
 * SYN-1217: a built-in sample campaign so a new operator sees what a finished
 * campaign looks like before any social account is connected.
 *
 * Rules this module keeps:
 * - Fixed, invented data. The business, people and numbers are made up and
 *   every item says so (`isSample: true`, "Sample" in every title).
 * - Read-only. Nothing here is written to the database, queued, scheduled or
 *   sent to any platform. The module imports no database, network or publish
 *   code, so a sample post has no route into the publish queue or analytics.
 * - Removable. The operator can hide it; the choice is remembered per
 *   organisation in this browser (`sampleCampaignDismissKey`).
 *
 * @module lib/onboarding/sample-campaign
 */

export const SAMPLE_LABEL = 'Sample' as const;

export interface SamplePost {
  readonly id: string;
  readonly isSample: true;
  readonly platform: 'instagram' | 'facebook' | 'linkedin';
  /** Day of the campaign week, 1 to 7. Not a real date: nothing is booked. */
  readonly day: number;
  readonly title: string;
  readonly body: string;
}

export interface SampleCampaign {
  readonly id: string;
  readonly isSample: true;
  readonly name: string;
  readonly businessName: string;
  readonly goal: string;
  readonly audience: string;
  readonly posts: readonly SamplePost[];
}

const BUSINESS = 'Riverbend Bakery (made-up business)';

function post(
  n: number,
  platform: SamplePost['platform'],
  day: number,
  title: string,
  body: string
): SamplePost {
  return Object.freeze({
    id: `sample-post-${n}`,
    isSample: true as const,
    platform,
    day,
    title: `${SAMPLE_LABEL}: ${title}`,
    body,
  });
}

export const SAMPLE_CAMPAIGN: SampleCampaign = Object.freeze({
  id: 'sample-campaign-week-one',
  isSample: true as const,
  name: `${SAMPLE_LABEL} campaign: first week back after the holidays`,
  businessName: BUSINESS,
  goal: 'Bring regular customers back in the first week after a two-week closure.',
  audience: 'Locals within 5 km who bought from the shop in the past year.',
  posts: Object.freeze([
    post(
      1,
      'instagram',
      1,
      'We are open again',
      'Ovens are back on. Sourdough from 7 am, Tuesday to Saturday. Come and say hello.'
    ),
    post(
      2,
      'facebook',
      2,
      'Behind the counter',
      'Meet the person who starts the dough at 4 am, and the one loaf they would take to a desert island.'
    ),
    post(
      3,
      'linkedin',
      3,
      'Local supplier story',
      'Our flour comes from a mill two hours away. Here is why we pay more for it and what it changes in the bread.'
    ),
    post(
      4,
      'instagram',
      5,
      'Customer question of the week',
      'You asked how to keep sourdough fresh. Three steps, no plastic bags.'
    ),
    post(
      5,
      'facebook',
      6,
      'Saturday reminder',
      'Pre-order by Friday 5 pm and your loaf is held until 10 am Saturday.'
    ),
  ]),
});

/** localStorage key holding the operator's "hide sample" choice for one organisation. */
export function sampleCampaignDismissKey(
  organizationId: string | null
): string {
  return `synthex:sample-campaign-dismissed:${organizationId ?? 'none'}`;
}

/**
 * Show the sample only while the workspace has no real posts of its own and
 * the operator has not hidden it. Real work always replaces the sample.
 */
export function shouldShowSampleCampaign(input: {
  totalPosts: number;
  scheduledPosts: number;
  dismissed: boolean;
}): boolean {
  if (input.dismissed) return false;
  return input.totalPosts === 0 && input.scheduledPosts === 0;
}
