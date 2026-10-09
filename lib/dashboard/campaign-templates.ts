import type { CampaignBrief } from '@/lib/dashboard/campaign-brief';

export type CampaignTemplate = {
  id: string;
  label: string;
  blurb: string;
  days: number;
  launchWeek?: boolean;
  brief: CampaignBrief;
  captions: string[];
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'walk-in',
    label: 'After-school rush',
    blurb: 'Get parents through the door between 3 and 5.',
    days: 5,
    brief: {
      name: 'After-school rush',
      job: 'Get more people through the door after pickup',
      audience: 'Parents walking home from the primary school',
      offer: 'Free babycino with any adult coffee after 3',
      proof: 'We bake one tray and stop when it is gone',
      cta: 'Come in and say pickup',
      place: 'The High Street counter',
      avoid: 'limited time only, influencer, synergy',
    },
    captions: [
      'School pickup special: kids’ babycino is on us with any adult coffee after 3. Say pickup. No app.',
      'The first tray of almond croissants is out. If you want one with a flat white before the rush, come now.',
      'Wednesday is soup day. Pumpkin, a bit of chilli, bread from this morning. We close the pot when it’s gone.',
      'If you want a quiet table after school, we still have the window seats until 3.30. After that it’s noise and we like it.',
      'Last of the blood orange cordial is on the counter. Ask for it in soda before noon.',
    ],
  },
  {
    id: 'offer',
    label: 'This week’s offer',
    blurb: 'One thing they can buy or book before Sunday.',
    days: 3,
    brief: {
      name: 'This week’s offer',
      job: 'Sell a short offer without sounding like an ad',
      audience: 'Regulars who already know the shop',
      offer: 'Two coffees and a share bun for $18 through Sunday',
      proof: 'The bun is the same one we sell out of on Saturdays',
      cta: 'Ask at the till for the pair',
      place: 'In the shop only',
      avoid: 'act now, deal of the century, FOMO',
    },
    captions: [
      'Two coffees and a share bun is $18 through Sunday. Ask at the till. We stop when the tray is gone.',
      'If you already come on Saturdays, this is the same bun. Pair it this week. Say you want the pair.',
      'Last day for the pair. We are not holding any. Come in if you want it.',
    ],
  },
  {
    id: 'story',
    label: 'Earn trust',
    blurb: 'Proof first. Ask second.',
    days: 4,
    brief: {
      name: 'Earn trust',
      job: 'Make a stranger trust the shop enough to try it',
      audience: 'People who have walked past and never come in',
      offer: 'A normal coffee and a seat, no membership',
      proof: 'Same baker, same oven, six mornings a week',
      cta: 'Come in once and decide for yourself',
      place: 'Window seats on High Street',
      avoid: 'best in town, award-winning, family-owned since',
    },
    captions: [
      'We open the oven at 6. Same baker. If you have only walked past, that is the smell.',
      'There is no card and no app. You sit, you order, you leave. The window seats are free until 8.',
      'A stranger asked yesterday if we roast here. We don’t. We bake. Come in and see the trays.',
      'If you have walked past all year, come in once. A coffee. Then you can keep walking if you want.',
    ],
  },
  {
    id: 'launch',
    label: 'First week',
    blurb: 'Open, settle, invite. You still book each hour.',
    days: 5,
    launchWeek: true,
    brief: {
      name: 'Launch week',
      job: 'Introduce the shop and give people a reason to come twice',
      audience: 'Neighbours on High Street and the school crowd',
      offer: 'First coffee on us if you tell us your usual order',
      proof: 'We are new, but the baker is not',
      cta: 'Come in this week and tell us what you drink',
      place: 'The new counter on High Street',
      avoid: 'grand opening, so excited, dream come true',
    },
    captions: [
      'We opened the doors this morning. First coffee is on us if you tell us your usual. That is the only speech.',
      'The baker starts at 5. If you want a quiet look before school, we are here at 7.',
      'If you live on this street, come twice this week. Once to see it. Once because the bun was warm.',
      'Saturday we open at 7. After 9 it will be loud. That is fine.',
      'We are still learning names. Come in, say yours, tell us what you drink.',
    ],
  },
];
