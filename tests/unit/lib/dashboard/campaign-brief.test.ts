import {
  campaignBriefReady,
  campaignBriefTopic,
} from '@/lib/dashboard/campaign-brief';

const ready = {
  name: 'Spring counter',
  job: 'Get walk-ins after school',
  audience: 'Parents on pickup',
  offer: 'Free babycino with a coffee after 3',
  proof: '',
  cta: 'Come in and say pickup',
  place: '',
  avoid: '',
};

describe('campaignBriefReady', () => {
  it('needs name, job, who, offer, and the ask', () => {
    expect(campaignBriefReady(ready)).toBe(true);
    expect(campaignBriefReady({ ...ready, offer: '' })).toBe(false);
  });
});

describe('campaignBriefTopic', () => {
  it('packs the brief so drafts are not empty post boxes', () => {
    const topic = campaignBriefTopic(ready);
    expect(topic).toContain('Get walk-ins after school');
    expect(topic).toContain('Free babycino');
    expect(topic).not.toContain('Post 1');
  });
});
