import {
  parseCampaignCards,
  serializeCampaignCards,
} from '@/lib/dashboard/campaign-cards';

describe('parseCampaignCards', () => {
  it('prefers real posts over stored JSON', () => {
    const cards = parseCampaignCards({
      platform: 'instagram',
      content: serializeCampaignCards([
        { key: 'x', text: 'Old', platform: 'instagram' },
      ]),
      posts: [
        {
          id: 'p1',
          content: 'Opening hours',
          status: 'draft',
          platform: 'instagram',
        },
        {
          id: 'p2',
          content: 'Sale this weekend',
          status: 'scheduled',
          platform: 'instagram',
        },
      ],
    });
    expect(cards).toHaveLength(2);
    expect(cards[0].text).toBe('Opening hours');
    expect(cards[1].postId).toBe('p2');
  });

  it('reads two cards from campaign JSON', () => {
    const cards = parseCampaignCards({
      platform: 'twitter',
      content: serializeCampaignCards([
        { key: 'a', text: 'First', platform: 'twitter' },
        { key: 'b', text: 'Second', platform: 'twitter', skipped: true },
      ]),
    });
    expect(cards.map(c => c.text)).toEqual(['First', 'Second']);
    expect(cards[1].skipped).toBe(true);
  });
});
