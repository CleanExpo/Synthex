import {
  campaignHealth,
  matchesCampaignQuery,
} from '@/lib/dashboard/campaign-health';

describe('campaignHealth', () => {
  it('counts booked posts as scheduled plus posted', () => {
    const health = campaignHealth([
      { status: 'draft' },
      { status: 'scheduled' },
      { status: 'published' },
      { status: 'failed' },
    ]);
    expect(health).toMatchObject({
      total: 4,
      draft: 1,
      scheduled: 1,
      posted: 1,
      failed: 1,
      bookedPercent: 50,
    });
  });

  it('treats a missing status as a draft', () => {
    expect(campaignHealth([{}]).draft).toBe(1);
  });
});

describe('matchesCampaignQuery', () => {
  it('matches a name without being picky about case', () => {
    expect(matchesCampaignQuery('Launch week', 'WEEK')).toBe(true);
    expect(matchesCampaignQuery('Launch week', 'eofy')).toBe(false);
  });
});
